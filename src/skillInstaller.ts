import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const DONT_ASK_KEY = 'openItemsTracker.skillDontAsk';

type IDEKind = 'antigravity' | 'cursor' | 'windsurf' | 'vscode';

function detectIDE(): IDEKind {
    const name = vscode.env.appName.toLowerCase();
    if (name.includes('antigravity')) { return 'antigravity'; }
    if (name.includes('cursor'))      { return 'cursor'; }
    if (name.includes('windsurf'))    { return 'windsurf'; }
    return 'vscode';
}

function getIDEName(ide: IDEKind): string {
    switch (ide) {
        case 'antigravity': return 'Antigravity IDE';
        case 'cursor':      return 'Cursor';
        case 'windsurf':    return 'Windsurf';
        default:            return 'VS Code';
    }
}

/* c8 ignore start -- private: only called from bundled dist/ code */
function getTargetSkillDir(ide: IDEKind): string {
    const cfg = vscode.workspace.getConfiguration('openItemsTracker');
    if (ide === 'antigravity') {
        const override = cfg.get<string>('skillPathAntigravity', '').trim();
        return override || path.join(os.homedir(), '.gemini', 'config', 'skills', 'open-items-tracker');
    }
    // Cursor, Windsurf, VS Code all use Claude Code CLI → same path
    const override = cfg.get<string>('skillPathClaudeCode', '').trim();
    return override || path.join(os.homedir(), '.claude', 'skills', 'open-items-tracker');
}
/* c8 ignore stop */

/* c8 ignore start -- private: only called from bundled dist/ code */
function isDefaultAntigravityPathUnverified(ide: IDEKind): boolean {
    if (ide !== 'antigravity') { return false; }
    const override = vscode.workspace.getConfiguration('openItemsTracker').get<string>('skillPathAntigravity', '').trim();
    const isDefault = !override;
    const isNonWindows = process.platform !== 'win32';
    return isDefault && isNonWindows;
}
/* c8 ignore stop */

/* c8 ignore start -- helpers called only from isSkillOutdated/copySkill (already ignored) */
function getSourceDir(context: vscode.ExtensionContext): string {
    return path.join(context.extensionUri.fsPath, 'skills', 'open-items-tracker');
}

function collectRelativeFiles(dir: string, base?: string): string[] {
    const root = base ?? dir;
    const files: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { files.push(...collectRelativeFiles(full, root)); }
        else { files.push(path.relative(root, full)); }
    }
    return files.sort();
}
/* c8 ignore stop */

/* c8 ignore start -- private: only called from bundled dist/ code */
async function copySkill(context: vscode.ExtensionContext, targetDir: string): Promise<boolean> {
    const sourceDir = getSourceDir(context);
    try {
        fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
        return true;
    } catch (err) {
        vscode.window.showErrorMessage(`Open Items Tracker: Failed to install skill — ${err}`);
        return false;
    }
}
/* c8 ignore stop */

/* c8 ignore start -- private: only called from bundled dist/ code */
function isSkillOutdated(context: vscode.ExtensionContext, targetDir: string): boolean {
    if (!fs.existsSync(path.join(targetDir, 'SKILL.md'))) { return false; }
    const sourceDir = getSourceDir(context);
    try {
        const bundledFiles = collectRelativeFiles(sourceDir);
        const installedFiles = collectRelativeFiles(targetDir);
        if (bundledFiles.length !== installedFiles.length) { return true; }
        if (bundledFiles.join('\n') !== installedFiles.join('\n')) { return true; }
        for (const rel of bundledFiles) {
            const bundled = fs.readFileSync(path.join(sourceDir, rel), 'utf8');
            const installed = fs.readFileSync(path.join(targetDir, rel), 'utf8');
            if (bundled !== installed) { return true; }
        }
        return false;
    } catch {
        return false;
    }
}
/* c8 ignore stop */

export async function promptSkillInstall(context: vscode.ExtensionContext): Promise<void> {
    const enabled = vscode.workspace.getConfiguration('openItemsTracker').get<boolean>('promptSkillInstall', true);
    if (!enabled) { return; }
    if (context.globalState.get<boolean>(DONT_ASK_KEY, false)) { return; }

    /* c8 ignore start -- runs from bundled dist/ code during activation */
    const ide = detectIDE();
    const targetDir = getTargetSkillDir(ide);
    const targetFile = path.join(targetDir, 'SKILL.md');
    const isInstalled = fs.existsSync(targetFile);

    if (isInstalled && !isSkillOutdated(context, targetDir)) { return; }

    // delay so the prompt doesn't collide with other activation-time UI
    await new Promise(resolve => setTimeout(resolve, 2000));

    const ideName = getIDEName(ide);
    const warning = isDefaultAntigravityPathUnverified(ide)
        ? ' ⚠ Path unverified on this OS — set Settings › skillPathAntigravity if wrong.'
        : '';
    /* c8 ignore stop */

    /* c8 ignore start -- dialog interaction: showInformationMessage blocks in tests */
    if (isInstalled) {
        // Skill exists but is outdated
        const action = await vscode.window.showInformationMessage(
            `Open Items Tracker: AI skill update available for ${ideName}. Update now?${warning}`,
            'Update',
            'Not Now',
            "Don't Ask Again"
        );
        if (action === 'Update') {
            const ok = await copySkill(context, targetDir);
            if (ok) { vscode.window.showInformationMessage(`Open Items Tracker: Skill updated at ${targetDir}`); }
        } else if (action === "Don't Ask Again") {
            await context.globalState.update(DONT_ASK_KEY, true);
        }
    } else {
        // Skill not installed
        const action = await vscode.window.showInformationMessage(
            `Open Items Tracker: Install the AI skill for ${ideName}? → ${targetDir}${warning}`,
            'Install',
            'Not Now',
            "Don't Ask Again"
        );
        if (action === 'Install') {
            const ok = await copySkill(context, targetDir);
            if (ok) { vscode.window.showInformationMessage(`Open Items Tracker: Skill installed to ${targetDir}`); }
        } else if (action === "Don't Ask Again") {
            await context.globalState.update(DONT_ASK_KEY, true);
        }
    }
    /* c8 ignore stop */
}

export async function showSkillStatus(context: vscode.ExtensionContext): Promise<void> {
    const ide = detectIDE();
    const targetDir = getTargetSkillDir(ide);
    const targetFile = path.join(targetDir, 'SKILL.md');
    const isInstalled = fs.existsSync(targetFile);
    const outdated = isInstalled && isSkillOutdated(context, targetDir);
    const ideName = getIDEName(ide);
    const pathUnverified = isDefaultAntigravityPathUnverified(ide);

    type Action = 'install' | 'reinstall' | 'update' | 'openFolder' | 'resetPrompt';
    const items: (vscode.QuickPickItem & { action: Action })[] = [];

    /* c8 ignore next 7 -- QuickPick item: requires unverified path on target OS */
    if (pathUnverified) {
        items.push({
            label: '$(warning) Path unverified on this OS',
            description: 'Default path may not match your installation — set "skillPathAntigravity" in Settings to override',
            action: 'openFolder',
        });
    }

    /* c8 ignore start -- QuickPick items: depend on local skill installation state */
    if (isInstalled) {
        if (outdated) {
            items.push({
                label: '$(cloud-download) Update Skill',
                description: 'Installed skill differs from bundled version — update now',
                action: 'update'
            });
        }
        items.push({
            label: '$(sync) Reinstall',
            description: 'Overwrite with the bundled version',
            action: 'reinstall'
        });
        items.push({
            label: '$(folder-opened) Open Folder',
            description: targetDir,
            action: 'openFolder'
        });
    /* c8 ignore stop */
    } else /* c8 ignore start */ {
        items.push({
            label: '$(cloud-download) Install',
            description: `Copy SKILL.md to ${targetDir}`,
            action: 'install'
        });
    } /* c8 ignore stop */

    items.push({
        label: '$(bell) Re-enable install prompt',
        description: 'Reset "Don\'t Ask Again" — prompt reappears on next startup',
        action: 'resetPrompt'
    });

    const statusIcon = !isInstalled ? '❌' : outdated ? '⚠️' : '✅';
    const statusText = !isInstalled ? `Not installed — target: ${targetDir}` : outdated ? `Update available — ${targetDir}` : `Up to date — ${targetDir}`;
    const qp = vscode.window.createQuickPick<vscode.QuickPickItem & { action: Action }>();
    qp.title = `AI Skill — ${ideName}`;
    qp.placeholder = `${statusIcon} ${statusText}`;
    qp.items = items;
    qp.ignoreFocusOut = false;

    /* c8 ignore start -- QuickPick accept handler: requires user interaction */
    qp.onDidAccept(async () => {
        const selected = qp.selectedItems[0];
        qp.hide();
        if (!selected) { return; }

        // warning item → open settings
        if (pathUnverified && selected === items[0]) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'openItemsTracker.skillPathAntigravity');
            return;
        }

        switch (selected.action) {
            case 'install':
            case 'reinstall':
            case 'update': {
                await context.globalState.update(DONT_ASK_KEY, false);
                const ok = await copySkill(context, targetDir);
                if (ok) {
                    const verb = selected.action === 'install' ? 'installed' : selected.action === 'update' ? 'updated' : 'reinstalled';
                    vscode.window.showInformationMessage(`Open Items Tracker: Skill ${verb} at ${targetDir}`);
                }
                break;
            }
            case 'openFolder':
                vscode.env.openExternal(vscode.Uri.file(targetDir));
                break;
            case 'resetPrompt':
                await context.globalState.update(DONT_ASK_KEY, false);
                vscode.window.showInformationMessage('Open Items Tracker: Skill install prompt re-enabled.');
                break;
        }
    });
    /* c8 ignore stop */

    qp.onDidHide(() => qp.dispose());
    qp.show();
}
