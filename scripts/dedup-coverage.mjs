#!/usr/bin/env node
// ── scripts/dedup-coverage.mjs ──────────────────────────────────────────────
// De-duplicates function entries in Istanbul coverage-final.json produced by
// c8 when V8 coverage is merged from multiple processes (Extension Host +
// test runner). Each function appears twice: once with a phantom count=0 and
// once with the real count. This script merges duplicates by taking the MAX
// count for each unique (name, startLine) pair, then regenerates the text
// summary.
//
// Usage:
//   node scripts/dedup-coverage.mjs [coverage-dir]
//   (default: ./coverage)
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const coverageDir = process.argv[2] || './coverage';
const finalPath = join(coverageDir, 'coverage-final.json');

if (!existsSync(finalPath)) {
  console.error(`❌ ${finalPath} not found. Run coverage first.`);
  process.exit(1);
}

const data = JSON.parse(readFileSync(finalPath, 'utf8'));
let totalDeduped = 0;

for (const [filePath, fileData] of Object.entries(data)) {
  const fnMap = fileData.fnMap;
  const fn = fileData.f;
  if (!fnMap || !fn) { continue; }

  // Step 0: Remove V8 phantom function entries that aren't real source code
  // - Module wrappers: name contains '/' (e.g. "src/panel.ts")
  // - Class body initializers: name matches a class but loc spans only L1:0-L1:N
  const fileBasename = filePath.split(/[/\\]/).pop()?.replace(/\.\w+$/, '') || '';
  for (const [idxStr, info] of Object.entries(fnMap)) {
    const idx = parseInt(idxStr, 10);
    const name = info.name || '';
    const startLine = info.loc?.start?.line ?? 0;
    const endLine = info.loc?.end?.line ?? 0;

    const isModuleWrapper = name.includes('/') || name.includes('\\');
    const isClassBodyInit = startLine === 1 && endLine === 1 && name !== '' && !name.startsWith('<');

    if (isModuleWrapper || isClassBodyInit) {
      delete fnMap[idx];
      delete fn[idx];
      totalDeduped++;
    }
  }

  // Group functions by (name, startLine) — duplicates have same name and
  // approximately same start line (±5 lines due to c8 ignore comments)
  const groups = new Map(); // key → { indices: number[], maxCount: number }

  for (const [idxStr, info] of Object.entries(fnMap)) {
    const idx = parseInt(idxStr, 10);
    const name = info.name || '(anonymous)';
    const startLine = info.loc?.start?.line ?? info.decl?.start?.line ?? 0;
    const endLine = info.loc?.end?.line ?? info.decl?.end?.line ?? 0;
    const key = `${name}:${startLine}:${endLine}`;
    
    if (!groups.has(key)) {
      groups.set(key, { indices: [], maxCount: 0 });
    }
    const group = groups.get(key);
    group.indices.push(idx);
    group.maxCount = Math.max(group.maxCount, fn[idx] || 0);
  }

  // Step 1: De-duplicate exact matches within the same group
  // (entries with identical name:startLine:endLine but different fnMap indices)
  for (const [key, group] of groups) {
    if (group.indices.length <= 1) { continue; }
    
    // Keep the index with the highest count, remove the rest
    let bestIdx = group.indices[0];
    let bestCount = fn[bestIdx] || 0;
    for (const idx of group.indices) {
      if ((fn[idx] || 0) > bestCount) {
        bestCount = fn[idx] || 0;
        bestIdx = idx;
      }
    }
    
    for (const idx of group.indices) {
      if (idx !== bestIdx) {
        delete fnMap[idx];
        delete fn[idx];
        totalDeduped++;
      }
    }
    // Ensure the kept entry has the max count
    fn[bestIdx] = group.maxCount;
  }

  // Step 2: Merge entries with same name and overlapping/nearby line ranges
  // (entries that differ slightly in line numbers due to comment insertions)
  const nameGroups = new Map(); // name → [{ startLine, endLine, indices, maxCount }]
  for (const [key, group] of groups) {
    // Skip groups that were fully removed in step 1
    const survivingIndices = group.indices.filter(i => fnMap[i] !== undefined);
    if (survivingIndices.length === 0) { continue; }
    
    const [name] = key.split(':');
    if (!nameGroups.has(name)) { nameGroups.set(name, []); }
    const startLine = parseInt(key.split(':')[1], 10);
    const endLine = parseInt(key.split(':')[2], 10);
    nameGroups.get(name).push({ startLine, endLine, indices: survivingIndices, maxCount: group.maxCount });
  }

  for (const [name, entries] of nameGroups) {
    if (entries.length <= 1) { continue; }
    
    entries.sort((a, b) => a.startLine - b.startLine);
    
    for (let i = 0; i < entries.length - 1; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (Math.abs(a.startLine - b.startLine) <= 10) {
          const mergedCount = Math.max(a.maxCount, b.maxCount);
          const keepEntry = a.maxCount >= b.maxCount ? a : b;
          const removeEntry = a.maxCount >= b.maxCount ? b : a;
          
          fn[keepEntry.indices[0]] = mergedCount;
          
          for (const ri of removeEntry.indices) {
            delete fnMap[ri];
            delete fn[ri];
            totalDeduped++;
          }
          
          entries.splice(j, 1);
          j--;
        }
      }
    }
  }

  // Re-index fnMap and fn to be contiguous
  const newFnMap = {};
  const newFn = {};
  let newIdx = 0;
  for (const [oldIdx, info] of Object.entries(fnMap)) {
    if (info === undefined) { continue; }
    newFnMap[newIdx] = info;
    newFn[newIdx] = fn[oldIdx] ?? 0;
    newIdx++;
  }
  fileData.fnMap = newFnMap;
  fileData.f = newFn;
}

writeFileSync(finalPath, JSON.stringify(data, null, 2));
console.log(`✅ De-duplicated ${totalDeduped} phantom function entries in ${finalPath}`);

// Also regenerate coverage-summary.json if it exists
const summaryPath = join(coverageDir, 'coverage-summary.json');
if (existsSync(summaryPath)) {
  const summary = {};
  const totalStats = { statements: { total: 0, covered: 0 }, branches: { total: 0, covered: 0 }, functions: { total: 0, covered: 0 }, lines: { total: 0, covered: 0 } };

  for (const [filePath, fileData] of Object.entries(data)) {
    const stats = {
      statements: countCoverage(fileData.s),
      branches: countCoverage(fileData.b, true),
      functions: countCoverage(fileData.f),
      lines: countCoverage(fileData.s), // lines ≈ statements in Istanbul format
    };
    
    summary[filePath] = {};
    for (const metric of ['statements', 'branches', 'functions', 'lines']) {
      const s = stats[metric];
      summary[filePath][metric] = { total: s.total, covered: s.covered, skipped: 0, pct: s.total === 0 ? 100 : Math.round(s.covered / s.total * 10000) / 100 };
      totalStats[metric].total += s.total;
      totalStats[metric].covered += s.covered;
    }
  }

  summary.total = {};
  for (const metric of ['statements', 'branches', 'functions', 'lines']) {
    const s = totalStats[metric];
    summary.total[metric] = { total: s.total, covered: s.covered, skipped: 0, pct: s.total === 0 ? 100 : Math.round(s.covered / s.total * 10000) / 100 };
  }

  writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✅ Regenerated ${summaryPath}`);
}

function countCoverage(map, isBranch = false) {
  if (!map) { return { total: 0, covered: 0 }; }
  let total = 0;
  let covered = 0;
  for (const val of Object.values(map)) {
    if (isBranch && Array.isArray(val)) {
      for (const v of val) { total++; if (v > 0) { covered++; } }
    } else {
      total++;
      if ((typeof val === 'number' ? val : 0) > 0) { covered++; }
    }
  }
  return { total, covered };
}
