// Detects whether the player is using touch or a keyboard, and words controls to match.

export type InputMode = 'touch' | 'keyboard';

type Listener = (mode: InputMode) => void;

function detect(): InputMode {
  try {
    if (window.matchMedia?.('(pointer: coarse)').matches) return 'touch';
  } catch {
    /* ignore */
  }
  return 'ontouchstart' in window && navigator.maxTouchPoints > 0 && !window.matchMedia?.('(pointer: fine)').matches ? 'touch' : 'keyboard';
}

export const inputMode: { current: InputMode } = { current: typeof window === 'undefined' ? 'keyboard' : detect() };
const listeners = new Set<Listener>();

export function setInputMode(mode: InputMode): void {
  if (inputMode.current === mode) return;
  inputMode.current = mode;
  for (const l of listeners) l(mode);
}

/** Subscribes to mode changes; returns an unsubscribe function. */
export function onInputMode(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Switches mode on the first real keyboard or touch input. Call once at startup. */
export function watchInputMode(): void {
  window.addEventListener('keydown', () => setInputMode('keyboard'));
  window.addEventListener('touchstart', () => setInputMode('touch'), { passive: true });
}

export type ControlName = 'jump' | 'attack' | 'magic' | 'switch' | 'heal' | 'ether' | 'menu' | 'up' | 'down' | 'move' | 'confirm' | 'cancel';

const LABELS: Record<InputMode, Record<ControlName, string>> = {
  keyboard: {
    jump: 'Z',
    attack: 'X',
    magic: 'C',
    switch: 'A / S',
    heal: 'Q',
    ether: 'E',
    menu: 'Esc',
    up: '↑',
    down: '↓',
    move: '← →',
    confirm: 'Z',
    cancel: 'X',
  },
  touch: {
    jump: '［ジャンプ］',
    attack: '［剣］',
    magic: '［魔法］',
    switch: '［切替］',
    heal: '［回復］',
    ether: '［MP］',
    menu: '［MENU］',
    up: '［▲］',
    down: '［▼］',
    move: '［◀ ▶］',
    confirm: 'タップ',
    cancel: '［✕］',
  },
};

export function label(name: ControlName, mode: InputMode = inputMode.current): string {
  return LABELS[mode][name];
}

/** Replaces {jump}, {attack}, ... with the right words for the current input mode. */
export function fmt(text: string, mode: InputMode = inputMode.current): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in LABELS[mode] ? LABELS[mode][k as ControlName] : m));
}

/** Picks one of two phrasings. */
export function byMode<T>(keyboard: T, touch: T, mode: InputMode = inputMode.current): T {
  return mode === 'touch' ? touch : keyboard;
}
