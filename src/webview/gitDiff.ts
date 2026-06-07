// ── Git diff logic ───────────────────────────────────────────────────────────
// Pure algorithmic functions — no VS Code or Node dependencies.
// Compares a ParsedDocument against HEAD content to produce a RenderGitState.

import { parseDocument } from '../parser';
import type {
  ParsedDocument, OpenItem,
  GitItemInfo, RenderGitState,
} from '../shared/types';

// ── HTML escaping (Node-side) ────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Inline word-level diff (LCS) ─────────────────────────────────────────────

export function diffTextInline(oldText: string, newText: string): string {
  const oldWords = oldText.split(/(\s+|[.,:;()\-—–\[\]]+)/).filter(Boolean);
  const newWords = newText.split(/(\s+|[.,:;()\-—–\[\]]+)/).filter(Boolean);

  const dp: number[][] = Array(oldWords.length + 1)
    .fill(0)
    .map(() => Array(newWords.length + 1).fill(0));

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = oldWords.length;
  let j = newWords.length;
  const result: string[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift(escapeHtml(oldWords[i - 1]));
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift(`<ins class="git-diff-ins">${escapeHtml(newWords[j - 1])}</ins>`);
      j--;
    } else {
      result.unshift(`<del class="git-diff-del">${escapeHtml(oldWords[i - 1])}</del>`);
      i--;
    }
  }

  return result.join('');
}

// ── Main diff computation ────────────────────────────────────────────────────

export function computeGitDiff(
  currentDoc: ParsedDocument,
  headContent: string | undefined,
  isRepo: boolean,
  status: 'clean' | 'modified' | 'untracked' | 'error'
): RenderGitState {
  const itemStatus: Record<string, 'added' | 'modified' | 'clean'> = {};
  const itemDiffHtml: Record<string, string> = {};
  const itemNoteDiffHtml: Record<string, string> = {};
  const deletedItems: Record<string, GitItemInfo[]> = {};
  const stats = { added: 0, modified: 0, deleted: 0 };

  if (!isRepo || status === 'error') {
    return { isRepo, status, stats, itemStatus, itemDiffHtml, itemNoteDiffHtml, deletedItems };
  }

  if (status === 'untracked' || !headContent) {
    const allCurrentItems = currentDoc.modules.flatMap(m => [
      ...m.items,
      ...m.subSections.flatMap(s => s.items)
    ]);
    for (const item of allCurrentItems) {
      itemStatus[item.rawLine] = 'added';
    }
    stats.added = allCurrentItems.length;
    return { isRepo, status, stats, itemStatus, itemDiffHtml, itemNoteDiffHtml, deletedItems };
  }

  const headDoc = parseDocument(headContent);

  for (const curMod of currentDoc.modules) {
    const headMod = headDoc.modules.find(m => m.title === curMod.title);

    // Diff module items
    const modDiff = diffItemList(curMod.items, headMod ? headMod.items : []);
    for (const item of modDiff.currentWithGit) {
      itemStatus[item.rawLine] = item.gitStatus;
      if (item.gitStatus === 'added') {
        stats.added++;
      } else if (item.gitStatus === 'modified') {
        stats.modified++;
        if (item.headText && item.headText !== item.text) {
          itemDiffHtml[item.rawLine] = diffTextInline(item.headText, item.text);
        }
        if (item.headNote !== item.note) {
          if (item.headNote && item.note) {
            itemNoteDiffHtml[item.rawLine] = diffTextInline(item.headNote, item.note);
          } else if (item.note) {
            itemNoteDiffHtml[item.rawLine] = `<ins class="git-diff-ins">${escapeHtml(item.note)}</ins>`;
          } else if (item.headNote) {
            itemNoteDiffHtml[item.rawLine] = `<del class="git-diff-del">${escapeHtml(item.headNote)}</del>`;
          }
        }
      }
    }
    if (modDiff.deleted.length > 0) {
      deletedItems[curMod.rawLine] = modDiff.deleted;
      stats.deleted += modDiff.deleted.length;
    }

    // Diff subsections
    for (const curSub of curMod.subSections) {
      const headSub = headMod ? headMod.subSections.find(s => s.title === curSub.title) : undefined;
      const subDiff = diffItemList(curSub.items, headSub ? headSub.items : []);
      for (const item of subDiff.currentWithGit) {
        itemStatus[item.rawLine] = item.gitStatus;
        if (item.gitStatus === 'added') {
          stats.added++;
        } else if (item.gitStatus === 'modified') {
          stats.modified++;
          if (item.headText && item.headText !== item.text) {
            itemDiffHtml[item.rawLine] = diffTextInline(item.headText, item.text);
          }
          if (item.headNote !== item.note) {
            if (item.headNote && item.note) {
              itemNoteDiffHtml[item.rawLine] = diffTextInline(item.headNote, item.note);
            } else if (item.note) {
              itemNoteDiffHtml[item.rawLine] = `<ins class="git-diff-ins">${escapeHtml(item.note)}</ins>`;
            } else if (item.headNote) {
              itemNoteDiffHtml[item.rawLine] = `<del class="git-diff-del">${escapeHtml(item.headNote)}</del>`;
            }
          }
        }
      }
      if (subDiff.deleted.length > 0) {
        deletedItems[curSub.rawLine] = subDiff.deleted;
        stats.deleted += subDiff.deleted.length;
      }
    }
  }

  return { isRepo, status, stats, itemStatus, itemDiffHtml, itemNoteDiffHtml, deletedItems };
}

// ── Private helpers ──────────────────────────────────────────────────────────

function getLISIndices(arr: number[]): Set<number> {
  const n = arr.length;
  if (n === 0) { return new Set(); }

  const parent = Array(n).fill(-1);
  const lengths = Array(n).fill(1);

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[i] > arr[j] && lengths[j] + 1 > lengths[i]) {
        lengths[i] = lengths[j] + 1;
        parent[i] = j;
      }
    }
  }

  let maxLength = 0;
  let maxIdx = -1;
  for (let i = 0; i < n; i++) {
    if (lengths[i] > maxLength) {
      maxLength = lengths[i];
      maxIdx = i;
    }
  }

  const lisIndices = new Set<number>();
  let curr = maxIdx;
  while (curr !== -1) {
    lisIndices.add(curr);
    curr = parent[curr];
  }

  return lisIndices;
}

function levenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  // Defensive: parseDocument never produces items with empty text,
  // so these branches cannot be reached through computeGitDiff.
  /* c8 ignore next 2 */
  if (len1 === 0) { return len2; }
  if (len2 === 0) { return len1; }

  let prevRow = Array(len2 + 1);
  let currRow = Array(len2 + 1);

  for (let j = 0; j <= len2; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    currRow[0] = i;
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        currRow[j - 1] + 1, // Insertion
        prevRow[j] + 1,     // Deletion
        prevRow[j - 1] + cost // Substitution
      );
    }
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[len2];
}

function stringSimilarity(s1: string, s2: string): number {
  const clean1 = s1.toLowerCase().trim();
  const clean2 = s2.toLowerCase().trim();
  const d = levenshteinDistance(clean1, clean2);
  const maxLen = Math.max(clean1.length, clean2.length);
  // Defensive: both strings empty is unreachable because items always have text.
  /* c8 ignore next */
  if (maxLen === 0) { return 1.0; }
  return 1.0 - d / maxLen;
}

function jaccardSimilarity(s1: string, s2: string): number {
  const words1 = s1.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
  const words2 = s2.toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean);
  if (words1.length === 0 || words2.length === 0) { return 0; }

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let intersection = 0;
  for (const w of set1) {
    if (set2.has(w)) {
      intersection++;
    }
  }

  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

interface ItemWithGit extends OpenItem {
  gitStatus: 'added' | 'modified' | 'clean';
  headText?: string;
  headNote?: string;
  headIdx?: number;
}

function diffItemList(currentItems: OpenItem[], headItems: OpenItem[]): {
  currentWithGit: ItemWithGit[];
  deleted: GitItemInfo[];
} {
  const currentWithGit: ItemWithGit[] = currentItems.map(item => ({
    ...item,
    gitStatus: 'added' as const,
    headText: undefined as string | undefined,
    headNote: undefined as string | undefined,
    headIdx: undefined as number | undefined
  }));
  const deleted: GitItemInfo[] = [];
  const matchedHeadIndices = new Set<number>();

  // 1. Match by ID
  for (let i = 0; i < currentWithGit.length; i++) {
    const cur = currentWithGit[i];
    const curId = extractId(cur.text);
    if (!curId) { continue; }

    for (let j = 0; j < headItems.length; j++) {
      if (matchedHeadIndices.has(j)) { continue; }
      const head = headItems[j];
      const headId = extractId(head.text);
      if (headId === curId) {
        matchedHeadIndices.add(j);
        currentWithGit[i].gitStatus = itemIdentical(cur, head) ? 'clean' : 'modified';
        currentWithGit[i].headText = head.text;
        currentWithGit[i].headNote = head.note;
        currentWithGit[i].headIdx = j;
        break;
      }
    }
  }

  // 2. Match by exact text
  for (let i = 0; i < currentWithGit.length; i++) {
    if (currentWithGit[i].gitStatus !== 'added') { continue; }
    const cur = currentWithGit[i];

    for (let j = 0; j < headItems.length; j++) {
      if (matchedHeadIndices.has(j)) { continue; }
      const head = headItems[j];
      if (cur.text.trim() === head.text.trim()) {
        matchedHeadIndices.add(j);
        currentWithGit[i].gitStatus = itemIdentical(cur, head) ? 'clean' : 'modified';
        currentWithGit[i].headText = head.text;
        currentWithGit[i].headNote = head.note;
        currentWithGit[i].headIdx = j;
        break;
      }
    }
  }

  // 2.5. Match by fuzzy similarity
  for (let i = 0; i < currentWithGit.length; i++) {
    if (currentWithGit[i].gitStatus !== 'added') { continue; }
    const cur = currentWithGit[i];
    const curId = extractId(cur.text);
    if (curId) { continue; }

    let bestHeadIdx = -1;
    let bestSimilarity = -1;

    for (let j = 0; j < headItems.length; j++) {
      if (matchedHeadIndices.has(j)) { continue; }
      const head = headItems[j];
      const headId = extractId(head.text);
      if (headId) { continue; }

      const levSim = stringSimilarity(cur.text, head.text);
      const jacSim = jaccardSimilarity(cur.text, head.text);
      const isSimilar = levSim >= 0.55 || jacSim >= 0.45;
      const score = Math.max(levSim, jacSim);

      if (isSimilar && score > bestSimilarity) {
        bestSimilarity = score;
        bestHeadIdx = j;
      }
    }

    if (bestHeadIdx !== -1) {
      matchedHeadIndices.add(bestHeadIdx);
      const head = headItems[bestHeadIdx];
      // Fuzzy match only fires when exact-text match (step 2) failed,
      // meaning texts differ — so itemIdentical (which checks text equality)
      // always returns false here. The 'clean' branch is unreachable.
      /* c8 ignore next */
      currentWithGit[i].gitStatus = itemIdentical(cur, head) ? 'clean' : 'modified';
      currentWithGit[i].headText = head.text;
      currentWithGit[i].headNote = head.note;
      currentWithGit[i].headIdx = bestHeadIdx;
    }
  }

  // Find reordered items using LIS on matched indices
  const matchedPairs = currentWithGit
    .map((item, index) => ({ currentIdx: index, headIdx: item.headIdx }))
    .filter((pair): pair is { currentIdx: number; headIdx: number } => pair.headIdx !== undefined);

  const headIndices = matchedPairs.map(p => p.headIdx);
  const lisIndices = getLISIndices(headIndices);

  for (let k = 0; k < matchedPairs.length; k++) {
    if (!lisIndices.has(k)) {
      const curIdx = matchedPairs[k].currentIdx;
      currentWithGit[curIdx].gitStatus = 'modified';
    }
  }

  // 4. Any remaining head items are deleted
  for (let j = 0; j < headItems.length; j++) {
    if (!matchedHeadIndices.has(j)) {
      const h = headItems[j];
      deleted.push({ text: h.text, status: h.status, note: h.note, date: h.date });
    }
  }

  return { currentWithGit, deleted };
}

function extractId(text: string): string | undefined {
  const m1 = text.match(/^([A-Z0-9_-]+-\d+)/i);
  if (m1) { return m1[1].toLowerCase(); }
  return undefined;
}

function itemIdentical(a: OpenItem, b: OpenItem): boolean {
  return a.text === b.text && a.status === b.status && a.note === b.note;
}
