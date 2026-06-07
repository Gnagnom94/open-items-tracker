// ── Demo Recording Launcher ─────────────────────────────────────────────────
// Prepares a temporary workspace and launches Antigravity IDE with the
// extension loaded + demo test suite. Run via: npm run record-demos
//
// Prerequisites:
//   - Antigravity IDE installed
//   - ffmpeg installed and on PATH
//   - npm run compile-tests (run automatically via pretest)

const { runTests } = require('@vscode/test-electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// ── Configuration ───────────────────────────────────────────────────────────

const ANTIGRAVITY_PATH = path.join(
  process.env.LOCALAPPDATA || '',
  'Programs', 'Antigravity IDE', 'Antigravity IDE.exe'
);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEMO_WORKSPACE_TEMPLATE = path.join(__dirname, 'demo-workspace');
const DEMO_WORKSPACE = path.join(PROJECT_ROOT, '.demo-workspace');
const EXAMPLE_FILE = path.join(PROJECT_ROOT, 'open-items.example.md');

// ── Workspace preparation ───────────────────────────────────────────────────

function prepareWorkspace() {
  console.log('📁 Preparing demo workspace...');

  // Clean previous workspace
  if (fs.existsSync(DEMO_WORKSPACE)) {
    fs.rmSync(DEMO_WORKSPACE, { recursive: true, force: true });
  }

  // Create workspace structure
  fs.mkdirSync(path.join(DEMO_WORKSPACE, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(DEMO_WORKSPACE, '.vscode'), { recursive: true });

  // Copy settings
  fs.copyFileSync(
    path.join(DEMO_WORKSPACE_TEMPLATE, '.vscode', 'settings.json'),
    path.join(DEMO_WORKSPACE, '.vscode', 'settings.json')
  );

  // Copy compact demo file as docs/open-items.md (fits in viewport)
  fs.copyFileSync(
    path.join(DEMO_WORKSPACE_TEMPLATE, 'docs', 'demo-open-items.md'),
    path.join(DEMO_WORKSPACE, 'docs', 'open-items.md')
  );

  // Initialize git repo (needed for git diff demos)
  execSync('git init', { cwd: DEMO_WORKSPACE, stdio: 'ignore' });
  execSync('git add -A', { cwd: DEMO_WORKSPACE, stdio: 'ignore' });
  execSync('git -c user.name="Demo" -c user.email="demo@test.com" commit -m "initial"', {
    cwd: DEMO_WORKSPACE,
    stdio: 'ignore',
  });

  console.log('  ✓ Workspace ready at', DEMO_WORKSPACE);
}

// ── Output directory ────────────────────────────────────────────────────────

function ensureOutputDir() {
  const outputDir = path.join(PROJECT_ROOT, 'media', 'demos');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Verify Antigravity IDE exists
  if (!fs.existsSync(ANTIGRAVITY_PATH)) {
    console.error('❌ Antigravity IDE not found at:', ANTIGRAVITY_PATH);
    console.error('   Please install it or update the ANTIGRAVITY_PATH in this script.');
    process.exit(1);
  }

  // Verify ffmpeg
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
  } catch {
    console.error('❌ ffmpeg not found on PATH. Please install it.');
    process.exit(1);
  }

  prepareWorkspace();
  const outputDir = ensureOutputDir();

  // Parse scenario filter from CLI args (everything after the script name)
  // Usage: npm run record-demos -- sort-filter inline-edit
  const scenarioArgs = process.argv.slice(2).filter(a => !a.startsWith('-'));
  const scenarioFilter = scenarioArgs.length > 0 ? scenarioArgs.join(',') : '';

  console.log('');
  console.log('🎬 Launching Antigravity IDE for demo recording...');
  console.log('   Output: ' + outputDir);
  if (scenarioFilter) {
    console.log('   Scenarios: ' + scenarioArgs.join(', '));
  } else {
    console.log('   Scenarios: all');
  }
  console.log('');

  try {
    await runTests({
      vscodeExecutablePath: ANTIGRAVITY_PATH,
      extensionDevelopmentPath: PROJECT_ROOT,
      extensionTestsPath: path.join(PROJECT_ROOT, 'out', 'test', 'demo', 'index.js'),
      launchArgs: [
        DEMO_WORKSPACE,
        '--new-window',
        '--disable-extensions',       // disable other extensions for clean UI
        '--disable-gpu',              // force software rendering (gdigrab can't capture GPU-rendered content)
        '--disable-gpu-compositing',  // ensure window content goes through GDI
        '--skip-welcome',
        '--skip-release-notes',
      ],
      extensionTestsEnv: {
        DEMO_OUTPUT_DIR: outputDir,
        DEMO_WORKSPACE_PATH: DEMO_WORKSPACE,
        DEMO_SCENARIOS: scenarioFilter,
      },
    });

    console.log('');
    console.log('✅ All demo GIFs generated successfully!');
    console.log('   Output: ' + outputDir);

    // List generated GIFs
    const gifs = fs.readdirSync(outputDir).filter(f => f.endsWith('.gif'));
    for (const gif of gifs) {
      const stats = fs.statSync(path.join(outputDir, gif));
      console.log(`   📸 ${gif} — ${(stats.size / 1024).toFixed(0)} KB`);
    }

  } catch (err) {
    console.error('❌ Demo recording failed:', err);
    process.exit(1);
  } finally {
    // Cleanup workspace
    if (fs.existsSync(DEMO_WORKSPACE)) {
      fs.rmSync(DEMO_WORKSPACE, { recursive: true, force: true });
    }
  }
}

main();
