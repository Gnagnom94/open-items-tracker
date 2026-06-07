import * as assert from 'assert';
import { initStore, getStoredPath, setStoredPath, onPathChange } from '../store';

suite('Store Test Suite', () => {

  // Create a mock ExtensionContext with workspaceState
  const mockState = new Map<string, unknown>();
  const mockContext = {
    workspaceState: {
      get: <T>(key: string): T | undefined => mockState.get(key) as T | undefined,
      update: (key: string, value: unknown) => {
        if (value === undefined) {
          mockState.delete(key);
        } else {
          mockState.set(key, value);
        }
        return Promise.resolve();
      },
    },
  } as never; // Cast because we only need the workspaceState subset

  suiteSetup(() => {
    initStore(mockContext);
  });

  setup(() => {
    // Clear state between tests
    mockState.clear();
  });

  test('getStoredPath — returns undefined when no path is stored', () => {
    const result = getStoredPath();
    assert.strictEqual(result, undefined);
  });

  test('setStoredPath + getStoredPath — round trip', () => {
    setStoredPath('/test/path.md');
    assert.strictEqual(getStoredPath(), '/test/path.md');
  });

  test('setStoredPath — undefined clears the path', () => {
    setStoredPath('/some/path.md');
    assert.strictEqual(getStoredPath(), '/some/path.md');
    setStoredPath(undefined);
    assert.strictEqual(getStoredPath(), undefined);
  });

  test('onPathChange — listener is called on setStoredPath', () => {
    let called = false;
    let receivedPath: string | undefined;

    const disposable = onPathChange((p) => {
      called = true;
      receivedPath = p;
    });

    setStoredPath('/changed/path.md');
    assert.strictEqual(called, true);
    assert.strictEqual(receivedPath, '/changed/path.md');

    disposable.dispose();
  });

  test('onPathChange — listener is NOT called after dispose', () => {
    let callCount = 0;

    const disposable = onPathChange(() => {
      callCount++;
    });

    setStoredPath('/first.md');
    assert.strictEqual(callCount, 1);

    disposable.dispose();

    setStoredPath('/second.md');
    assert.strictEqual(callCount, 1);
  });

  test('onPathChange — undefined path', () => {
    let receivedPath: string | undefined = 'sentinel';

    const disposable = onPathChange((p) => {
      receivedPath = p;
    });

    setStoredPath(undefined);
    assert.strictEqual(receivedPath, undefined);

    disposable.dispose();
  });

  test('onPathChange — multiple listeners', () => {
    let count1 = 0, count2 = 0;

    const d1 = onPathChange(() => count1++);
    const d2 = onPathChange(() => count2++);

    setStoredPath('/test.md');
    assert.strictEqual(count1, 1);
    assert.strictEqual(count2, 1);

    d1.dispose();

    setStoredPath('/test2.md');
    assert.strictEqual(count1, 1); // no more increments
    assert.strictEqual(count2, 2);

    d2.dispose();
  });
});
