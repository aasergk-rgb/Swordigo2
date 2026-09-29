import { describe, expect, it } from 'vitest';

// The iPad app hands the page its saves at start-up and receives every new version.
describe('save files and the native bridge', () => {
  it('keeps three files, stores them natively, and reads old single saves as file 1', async () => {
    const posted: string[] = [];
    const store: Record<string, string> = {};
    const g = globalThis as Record<string, unknown>;
    const win: Record<string, unknown> = { __nativeSave: null, webkit: { messageHandlers: { save: { postMessage: (s: string) => posted.push(s) } } } };
    g.window = win;
    g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v), removeItem: (k: string) => delete store[k] };
    const { saveGame, loadSlot, deleteSlot, session } = await import('../src/session');
    const { newGame, serialize } = await import('../src/progress');

    expect(loadSlot(0)).toBeNull();
    session.slot = 1;
    session.data = newGame();
    session.data.coins = 123;
    expect(saveGame()).toBe(true);
    session.slot = 2;
    session.data = newGame();
    session.data.coins = 7;
    saveGame();

    // Web storage wiped: the app's copy still has both files, and file 1 stays empty.
    for (const k of Object.keys(store)) delete store[k];
    expect(loadSlot(0)).toBeNull();
    expect(loadSlot(1)?.coins).toBe(123);
    expect(loadSlot(2)?.coins).toBe(7);
    expect(JSON.parse(posted[posted.length - 1]).slots).toHaveLength(3);

    deleteSlot(1);
    expect(loadSlot(1)).toBeNull();
    expect(loadSlot(2)?.coins).toBe(7);

    // An app that still holds a single save from before files existed: it becomes file 1.
    const old = newGame();
    old.coins = 55;
    win.__nativeSave = serialize(old);
    expect(loadSlot(0)?.coins).toBe(55);
    expect(loadSlot(1)).toBeNull();
    delete g.window;
    delete g.localStorage;
  });
});
