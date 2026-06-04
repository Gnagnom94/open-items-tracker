import { exec } from 'child_process';
import * as path from 'path';

export interface GitState {
  isRepo: boolean;
  status: 'clean' | 'modified' | 'untracked' | 'error';
  gitPath: string;
  headContent?: string;
}

function runCmd(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (err, stdout) => {
      if (err) {
        resolve('');
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function getGitState(filePath: string): Promise<GitState> {
  const dir = path.dirname(filePath);
  const file = path.basename(filePath);

  const isRepo = await runCmd('git rev-parse --is-inside-work-tree', dir);
  if (isRepo !== 'true') {
    return { isRepo: false, status: 'error', gitPath: '' };
  }

  const gitPath = await runCmd(`git ls-files --full-name "${file}"`, dir);
  if (!gitPath) {
    // Untracked new file not in git yet
    return {
      isRepo: true,
      status: 'untracked',
      gitPath: file,
      headContent: '',
    };
  }

  const statusOutput = await runCmd(`git status --porcelain "${file}"`, dir);
  let status: 'clean' | 'modified' | 'untracked' = 'clean';

  if (statusOutput) {
    if (statusOutput.startsWith('??')) {
      status = 'untracked';
    } else {
      status = 'modified';
    }
  }

  let headContent = '';
  if (status !== 'untracked') {
    headContent = await runCmd(`git show HEAD:"${gitPath}"`, dir);
  }

  return {
    isRepo: true,
    status,
    gitPath,
    headContent,
  };
}
