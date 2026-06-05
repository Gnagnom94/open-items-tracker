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

function isDefaultAntigravityPathUnverified(ide: IDEKind): boolean {
    if (ide !== 'antigravity') { return false; }
    const override = vscode.workspace.getConfiguration('openItemsTracker').get<string>('skillPathAntigravity', '').trim();
    const isDefault = !override;
    const isNonWindows = process.platform !== 'win32';
    return isDefault && isNonWindows;
}

function getSourceFile(context: vscode.ExtensionContext): string {
    return path.join(context.extensionUri.fsPath, 'skills', 'open-items-tracker', 'SKILL.md');
}

async function copySkill(context: vscode.ExtensionContext, targetDir: string): Promise<boolean> {
    const targetFile = path.join(targetDir, 'SKILL.md');
    try {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(getSourceFile(context), targetFile);
        return true;
    } catch (err) {
        vscode.window.showErrorMessage(`Open Items Tracker: Failed to install skill — ${err}`);
        return false;
    }
}

export async function promptSkillInstall(context: vscode.ExtensionContext): Promise<void> {
    const enabled = vscode.workspace.getConfiguration('openItemsTracker').get<boolean>('promptSkillInstall', true);
    if (!enabled) { return; }
    if (context.globalState.get<boolean>(DONT_ASK_KEY, false)) { return; }

    const ide = detectIDE();
    const targetDir = getTargetSkillDir(ide);
    const targetFile = path.join(targetDir, 'SKILL.md');
    if (fs.existsSync(targetFile)) { return; }

    // delay so the prompt doesn't collide with other activation-time UI
    await new Promise(resolve => setTimeout(resolve, 2000));

    const ideName = getIDEName(ide);
    const warning = isDefaultAntigravityPathUnverified(ide)
        ? ' ⚠ Path unverified on this OS — set Settings › skillPathAntigravity if wrong.'
        : '';

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

export async function showSkillStatus(context: vscode.ExtensionContext): Promise<void> {
    const ide = detectIDE();
    const targetDir = getTargetSkillDir(ide);
    const targetFile = path.join(targetDir, 'SKILL.md');
    const isInstalled = fs.existsSync(targetFile);
    const ideName = getIDEName(ide);
    const pathUnverified = isDefaultAntigravityPathUnverified(ide);

    type Action = 'install' | 'reinstall' | 'openFolder' | 'resetPrompt';
    const items: (vscode.QuickPickItem & { action: Action })[] = [];

    if (pathUnverified) {
        items.push({
            label: '$(warning) Path unverified on this OS',
            description: 'Default path may not match your installation — set "skillPathAntigravity" in Settings to override',
            action: 'openFolder', // placeholder, handled below
        });
    }

    if (isInstalled) {
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
    } else {
        items.push({
            label: '$(cloud-download) Install',
            description: `Copy SKILL.md to ${targetDir}`,
            action: 'install'
        });
    }

    items.push({
        label: '$(bell) Re-enable install prompt',
        description: 'Reset "Don\'t Ask Again" — prompt reappears on next startup',
        action: 'resetPrompt'
    });

    const statusIcon = isInstalled ? '✅' : '❌';
    const qp = vscode.window.createQuickPick<vscode.QuickPickItem & { action: Action }>();
    qp.title = `AI Skill — ${ideName}`;
    qp.placeholder = `${statusIcon} ${isInstalled ? `Installed at ${targetDir}` : `Not installed — target: ${targetDir}`}`;
    qp.items = items;
    qp.ignoreFocusOut = false;

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
            case 'reinstall': {
                await context.globalState.update(DONT_ASK_KEY, false);
                const ok = await copySkill(context, targetDir);
                if (ok) { vscode.window.showInformationMessage(
                    `Open Items Tracker: Skill ${selected.action === 'reinstall' ? 'reinstalled' : 'installed'} to ${targetDir}`
                ); }
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

    qp.onDidHide(() => qp.dispose());
    qp.show();
}
