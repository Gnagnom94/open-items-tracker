import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getGitState } from '../gitManager';

suite('gitManager Test Suite', () => {

  test('getGitState — tracked file in repo returns isRepo true', async () => {
    // Use the project's own package.json as a known tracked file
    const projectRoot = path.resolve(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'package.json');
    const state = await getGitState(filePath);
    assert.strictEqual(state.isRepo, true);
  });

  test('getGitState — tracked file has valid status', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'package.json');
    const state = await getGitState(filePath);
    assert.ok(['clean', 'modified', 'untracked'].includes(state.status));
  });

  test('getGitState — tracked file has gitPath', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'package.json');
    const state = await getGitState(filePath);
    assert.ok(state.gitPath);
  });

  test('getGitState — clean file returns status clean', async () => {
    // Use .gitignore which is committed and never modified by tests
    const projectRoot = path.resolve(__dirname, '..', '..');
    const filePath = path.join(projectRoot, '.gitignore');
    // .gitignore should be committed and unmodified during test runs
    const state = await getGitState(filePath);
    assert.strictEqual(state.isRepo, true);
    assert.strictEqual(state.status, 'clean', '.gitignore should be clean (committed, unmodified)');
    assert.ok(state.headContent, 'clean tracked file should have headContent');
  });

  test('getGitState — non-repo directory returns isRepo false', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oit-git-test-'));
    const tmpFile = path.join(tmpDir, 'test.md');
    fs.writeFileSync(tmpFile, '# Test', 'utf8');
    try {
      const state = await getGitState(tmpFile);
      assert.strictEqual(state.isRepo, false);
      assert.strictEqual(state.status, 'error');
      assert.strictEqual(state.gitPath, '');
    } finally {
      fs.unlinkSync(tmpFile);
      fs.rmdirSync(tmpDir);
    }
  });

  test('getGitState — untracked file in repo', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const tmpFile = path.join(projectRoot, `_tmp_untracked_${Date.now()}.md`);
    fs.writeFileSync(tmpFile, '# Untracked test', 'utf8');
    try {
      const state = await getGitState(tmpFile);
      assert.strictEqual(state.isRepo, true);
      assert.strictEqual(state.status, 'untracked');
      assert.strictEqual(state.headContent, '');
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  test('getGitState — modified tracked file returns modified status', async () => {
    const projectRoot = path.resolve(__dirname, '..', '..');
    const filePath = path.join(projectRoot, 'LICENSE');
    const original = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(filePath, original + '\n# test modification\n', 'utf8');
    try {
      const state = await getGitState(filePath);
      assert.strictEqual(state.isRepo, true);
      assert.strictEqual(state.status, 'modified');
      assert.ok(state.headContent, 'modified file should have HEAD content');
    } finally {
      fs.writeFileSync(filePath, original, 'utf8');
    }
  });
});
