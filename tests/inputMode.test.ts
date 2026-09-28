import { describe, expect, it } from 'vitest';
import { byMode, fmt } from '../src/inputMode';

describe('control wording', () => {
  it('names keys on a keyboard and buttons on touch', () => {
    const text = '空中で {down} + {attack} で下突き。{menu} でメニュー。';
    expect(fmt(text, 'keyboard')).toBe('空中で ↓ + X で下突き。Esc でメニュー。');
    expect(fmt(text, 'touch')).toBe('空中で ［▼］ + ［剣］ で下突き。［MENU］ でメニュー。');
  });

  it('leaves unknown placeholders alone', () => {
    expect(fmt('{nope} {jump}', 'keyboard')).toBe('{nope} Z');
  });

  it('picks the phrasing for the mode', () => {
    expect(byMode('Z', 'タップ', 'touch')).toBe('タップ');
    expect(byMode('Z', 'タップ', 'keyboard')).toBe('Z');
  });
});
