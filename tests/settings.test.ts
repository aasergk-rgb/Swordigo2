import { describe, expect, it } from 'vitest';
import { OPACITIES, SIZES, cycle, defaultSettings, labelOf, parseSettings } from '../src/settings';

describe('settings', () => {
  it('falls back to defaults for missing or broken data', () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings('not json')).toEqual(defaultSettings());
  });

  it('keeps valid values and clamps or drops bad ones', () => {
    const s = parseSettings(
      JSON.stringify({
        pad: 'dpad',
        size: 9,
        opacity: 0.45,
        layout: { jump: { x: 0.5, y: 1.4, s: 1.2 }, attack: { x: 'left' }, menu: null },
        hud: { status: { x: -1, y: 0.3 } },
      }),
    );
    expect(s.pad).toBe('dpad');
    expect(s.size).toBe(1.6);
    expect(s.opacity).toBe(0.45);
    expect(s.layout).toEqual({ jump: { x: 0.5, y: 1, s: 1.2 } });
    expect(s.hud).toEqual({ status: { x: 0, y: 0.3 } });
    expect(parseSettings(JSON.stringify({ pad: 'joystick' })).pad).toBe('bar');
  });

  it('cycles through the size and opacity options', () => {
    expect(cycle(SIZES, 1).v).toBe(1.15);
    expect(cycle(SIZES, 1.3).v).toBe(0.85);
    expect(labelOf(OPACITIES, 0.8)).toBe('ふつう');
  });
});
