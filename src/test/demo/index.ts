// ── Demo test runner bootstrap ──────────────────────────────────────────────
// Entry point for @vscode/test-electron when running demo recordings.
// Sets up Mocha with generous timeouts (recordings take time) and loads
// the demo scenario test file.

import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 120_000, // 2 minutes per scenario (recording + conversion)
    slow: 30_000,
  });

  const testsRoot = path.resolve(__dirname);
  const files = await glob('**/*.test.js', { cwd: testsRoot });

  for (const file of files) {
    mocha.addFile(path.resolve(testsRoot, file));
  }

  return new Promise<void>((resolve, reject) => {
    mocha.run(failures => {
      if (failures > 0) {
        reject(new Error(`${failures} demo scenario(s) failed`));
      } else {
        resolve();
      }
    });
  });
}
