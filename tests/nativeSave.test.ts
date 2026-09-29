import { describe, expect, it } from 'vitest';

// The iPad app hands the page its save at start-up and receives every new save.
describe('native save bridge', () => {
  it('posts saves to the app and loads the save the app hands in', async () => {
    const posted: string[] = [];
    const store: Record<string, string> = {};
    const g = globalThis as Record<string, unknown>;
    g.window = { __nativeSave: null, webkit: { messageHandlers: { save: { postMessage: (s: string) => posted.push(s) } } } };
    g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) };
    const { saveGame, loadGame, session } = await import('../src/session');

    expect(loadGame()).toBeNull();
    session.data.coins = 123;
    expect(saveGame()).toBe(true);
    expect(posted).toHaveLength(1);

    // A fresh start with only the app's copy (web storage wiped) still finds the save.
    for (const k of Object.keys(store)) delete store[k];
    (g.window as { __nativeSave: string }).__nativeSave = posted[0];
    expect(loadGame()?.coins).toBe(123);
    delete g.window;
    delete g.localStorage;
  });
});
