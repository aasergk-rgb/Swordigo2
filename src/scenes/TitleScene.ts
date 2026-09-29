import Phaser from 'phaser';
import { ROOMS } from '../data/rooms/index';
import { newGame, type SaveData } from '../progress';
import { deleteSlot, loadSlot, saveGame, session, SLOTS } from '../session';
import { byMode, inputMode, onInputMode } from '../inputMode';
import { FONT } from '../ui';

interface Row {
  label: string;
  run: () => void;
  /** Deletes the file on this row. */
  del?: () => void;
  /** Can't be picked (an empty file when continuing). */
  off?: boolean;
}

type Mode =
  | { kind: 'main' }
  | { kind: 'files'; purpose: 'continue' | 'new' }
  | { kind: 'confirm'; text: string; yes: string; run: () => void; back: Mode; backCursor: number };

const CHAPTERS: [string, string][] = [
  ['boss_noxgiant', '★クリア'],
  ['ch6', '第6章'],
  ['ch5', '第5章'],
  ['ch4', '第4章'],
  ['ch3', '第3章'],
  ['ch2', '第2章'],
  ['ch1', '第1章'],
];

function chapterOf(s: SaveData): string {
  return CHAPTERS.find(([f]) => s.flags[f])?.[1] ?? 'プロローグ';
}

function playTime(s: SaveData): string {
  const t = Math.floor(s.playTime);
  return `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    // Painted backdrop: the village at dusk, scaled 2x like the game.
    for (const [k, i] of [
      ['bg_village_sky', 0],
      ['bg_village_far', 1],
      ['bg_village_mid', 2],
    ] as const) {
      const ts = this.add.tileSprite(0, 0, W / 2, H / 2, k).setOrigin(0).setScale(2).setDepth(i);
      this.tweens.add({ targets: ts, tilePositionX: 480, duration: 120000 / (i + 1), repeat: -1 });
    }
    this.add.rectangle(0, 0, W, H, 0x000000, 0.25).setOrigin(0).setDepth(3);
    this.add.particles(0, 0, 'dot', { x: { min: 0, max: W }, y: H, lifespan: 6000, speedY: { min: -40, max: -15 }, speedX: { min: -8, max: 8 }, scale: 2, alpha: { start: 0.8, end: 0 }, tint: 0xfff3a0, frequency: 120, blendMode: 'ADD' }).setDepth(4);

    // Laid out for 540 high; shorter (very wide) windows squeeze the gaps.
    const k = H / 540;
    const glow = this.add.image(W / 2, 140 * k, 'light_warm').setScale(3.2, 1.4).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.tweens.add({ targets: glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 1800 });
    this.add.text(W / 2, 130 * k, 'ルミナブレード', { fontFamily: FONT, fontSize: '68px', color: '#fff3a0', stroke: '#3a2a10', strokeThickness: 10 }).setOrigin(0.5).setDepth(6);
    this.add.text(W / 2, 200 * k, '― 灯火の剣 ―', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#1a1030', strokeThickness: 5 }).setOrigin(0.5).setDepth(6);
    const rio = this.add.sprite(W / 2, 330 * k, 'rio', 0).setScale(4 * Math.min(1, k * 1.1)).setDepth(6);
    rio.play('rio_idle');

    this.k = k;
    this.ui = []; // a restart (window resize) already destroyed the old ones
    this.help = this.add.text(W / 2, H - 14, '', { fontFamily: FONT, fontSize: '14px', color: '#c8d0e8', stroke: '#000', strokeThickness: 3, align: 'center', lineSpacing: 4, wordWrap: { width: W - 40, useAdvancedWrap: true } }).setOrigin(0.5, 1).setDepth(6);
    const off = onInputMode(() => this.render());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

    const kb = this.input.keyboard!;
    kb.on('keydown-UP', () => this.move(-1));
    kb.on('keydown-DOWN', () => this.move(1));
    for (const key of ['Z', 'SPACE', 'ENTER']) kb.on(`keydown-${key}`, () => this.rows[this.cursor]?.run());
    for (const key of ['X', 'ESC', 'BACKSPACE']) kb.on(`keydown-${key}`, () => this.back?.());
    kb.on('keydown-DELETE', () => this.rows[this.cursor]?.del?.());
    this.mode = { kind: 'main' };
    this.cursor = 0;
    this.render();
  }

  // ================================================================ menus

  private k = 1;
  private help!: Phaser.GameObjects.Text;
  private mode: Mode = { kind: 'main' };
  private cursor = 0;
  private ui: Phaser.GameObjects.GameObject[] = [];
  /** Selectable rows of the current screen, for keys and taps. */
  private rows: Row[] = [];
  private back: (() => void) | null = null;

  private setMode(mode: Mode, cursor = 0): void {
    this.mode = mode;
    this.cursor = cursor;
    this.render();
  }

  private move(d: number): void {
    const n = this.rows.length;
    if (!n) return;
    for (let step = 0; step < n; step++) {
      this.cursor = (this.cursor + d + n) % n;
      if (!this.rows[this.cursor].off) break;
    }
    this.render();
  }

  private start(slot: number, save: SaveData | null): void {
    session.slot = slot;
    if (save) {
      session.data = save;
      this.scene.start('Game', { room: save.room, at: 'F' });
    } else {
      session.data = newGame();
      saveGame();
      this.scene.start('Game', { room: 'village', at: '@' });
    }
  }

  private render(): void {
    for (const o of this.ui) o.destroy();
    this.ui = [];
    this.rows = [];
    this.back = null;
    const W = this.scale.width;
    const H = this.scale.height;
    const k = this.k;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.ui.push(o);
      return o;
    };
    const tap = (x: number, y: number, w: number, h: number, fn: () => void, depth = 11) =>
      add(this.add.zone(x, y, w, h).setOrigin(0).setDepth(depth).setInteractive({ useHandCursor: true }).on('pointerdown', fn));
    const saves = Array.from({ length: SLOTS }, (_, i) => loadSlot(i));
    const m = this.mode;

    if (m.kind === 'main') {
      const any = saves.some(Boolean);
      const items: Row[] = [];
      if (any) items.push({ label: 'つづきから', run: () => this.setMode({ kind: 'files', purpose: 'continue' }, Math.max(0, saves.findIndex(Boolean))) });
      items.push({ label: 'はじめから', run: () => this.setMode({ kind: 'files', purpose: 'new' }, Math.max(0, saves.findIndex((sv) => !sv))) });
      this.rows = items;
      if (this.cursor >= items.length) this.cursor = 0;
      items.forEach((it, i) => {
        const on = i === this.cursor;
        const y = (410 + i * 44) * k;
        add(this.add.text(W / 2, y, (on ? '▶ ' : '　') + it.label + (on ? ' ◀' : '　'), { fontFamily: FONT, fontSize: '28px', color: on ? '#fff3a0' : '#c8d0e8', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(6));
        // Wide tap zones, so a finger doesn't have to land on the letters.
        tap(W / 2 - 190, y - 22 * k, 380, 44 * k, it.run);
      });
      this.setHelp(
        byMode(
          '↑↓ で選んで Z で決定\n← →：移動　Z：ジャンプ　X：剣（長押しで溜め）　C：魔法　A/S：魔法切替　↑：話す　Q/E：回復　Esc：メニュー',
          '左下の ◀ ▶ で移動、右のボタンでジャンプ・剣・魔法\n話せる相手の前では「話す」ボタンが出ます',
        ),
      );
      return;
    }

    // Files and confirmations sit on a dark panel over the title.
    add(this.add.rectangle(0, 0, W, H, 0x05030f, 0.72).setOrigin(0).setDepth(9).setInteractive());
    const pw = Math.min(640, W - 40);
    const px = (W - pw) / 2;

    if (m.kind === 'confirm') {
      this.back = () => this.setMode(m.back, m.backCursor);
      const ph = 190;
      const py = (H - ph) / 2;
      add(this.add.rectangle(px, py, pw, ph, 0x10102a, 0.97).setOrigin(0).setStrokeStyle(3, 0xc9a44a).setDepth(10));
      add(this.add.text(W / 2, py + 30, m.text, { fontFamily: FONT, fontSize: '22px', color: '#ffe8b0', align: 'center', lineSpacing: 6, wordWrap: { width: pw - 40, useAdvancedWrap: true } }).setOrigin(0.5, 0).setDepth(11));
      this.rows = [
        { label: m.yes, run: m.run },
        { label: 'やめる', run: this.back },
      ];
      this.rows.forEach((r, i) => {
        const on = i === this.cursor;
        const bx = W / 2 + (i === 0 ? -pw / 4 : pw / 4);
        const by = py + ph - 50;
        add(this.add.rectangle(bx, by, pw / 2 - 40, 50, on ? 0xe0b850 : 0x2a1e52).setStrokeStyle(3, 0xc9a44a).setDepth(11));
        add(this.add.text(bx, by, r.label, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: on ? '#1a1030' : '#ffe8b0' }).setOrigin(0.5).setDepth(12));
        tap(bx - (pw / 2 - 40) / 2, by - 25, pw / 2 - 40, 50, r.run, 13);
      });
      this.setHelp(byMode('← → / ↑↓ で選んで Z で決定　X でもどる', ''));
      return;
    }

    // File list.
    const purpose = m.purpose;
    this.back = () => this.setMode({ kind: 'main' }, purpose === 'continue' ? 0 : saves.some(Boolean) ? 1 : 0);
    const rowH = Math.min(78, (H - 150) / (SLOTS + 0.8));
    const listH = SLOTS * rowH + 56;
    let y = Math.max(16, (H - listH - 60) / 2);
    add(this.add.text(W / 2, y, purpose === 'continue' ? 'どのファイルで続ける？' : 'どのファイルに記録する？', { fontFamily: FONT, fontSize: '26px', color: '#fff3a0', stroke: '#000', strokeThickness: 5 }).setOrigin(0.5, 0).setDepth(10));
    y += 46;
    saves.forEach((sv, i) => {
      const off = purpose === 'continue' && !sv;
      const row: Row = {
        label: '',
        off,
        run: () => {
          if (off) return;
          if (purpose === 'continue') this.start(i, sv);
          else if (sv)
            this.setMode({ kind: 'confirm', text: `ファイル${i + 1} の記録を消して、\nはじめから遊びますか？`, yes: '上書きする', run: () => this.start(i, null), back: m, backCursor: i }, 1);
          else this.start(i, null);
        },
        del: sv
          ? () => this.setMode({ kind: 'confirm', text: `ファイル${i + 1} の記録を消しますか？\n（元には戻せません）`, yes: '消す', run: () => { deleteSlot(i); this.setMode(m, i); }, back: m, backCursor: i }, 1)
          : undefined,
      };
      this.rows.push(row);
      const on = i === this.cursor;
      const ry = y + i * rowH;
      add(this.add.rectangle(px, ry, pw, rowH - 8, on ? 0x2a2a5a : 0x10102a, 0.96).setOrigin(0).setStrokeStyle(on ? 3 : 2, on ? 0xfff3a0 : 0x6a6490).setDepth(10));
      const line1 = sv ? `ファイル${i + 1}　${chapterOf(sv)}　${ROOMS[sv.room]?.name ?? ''}` : `ファイル${i + 1}　―― 空き ――`;
      const line2 = sv ? `Lv ${sv.level}　プレイ時間 ${playTime(sv)}　託された灯 ${sv.lights.length}/12` : purpose === 'new' ? 'ここに新しく記録する' : '';
      const small = rowH < 64;
      add(this.add.text(px + 18, ry + (small ? 6 : 10), line1, { fontFamily: FONT, fontSize: small ? '18px' : '21px', color: off ? '#6a6480' : '#ffffff' }).setDepth(11));
      add(this.add.text(px + 18, ry + (small ? 30 : 40), line2, { fontFamily: FONT, fontSize: small ? '14px' : '16px', color: off ? '#6a6480' : '#cfd8ff' }).setDepth(11));
      tap(px, ry, pw, rowH - 8, () => {
        if (off) return;
        if (this.cursor === i || inputMode.current === 'touch') row.run();
        else {
          this.cursor = i;
          this.render();
        }
      });
      if (row.del) {
        const b = add(this.add.text(px + pw - 14, ry + (rowH - 8) / 2, '消す', { fontFamily: FONT, fontSize: '17px', color: '#ffb0a0', backgroundColor: '#3a1a2a', padding: { x: 10, y: 5 } }).setOrigin(1, 0.5).setDepth(12));
        tap(b.x - b.width - 8, b.y - b.height / 2 - 8, b.width + 16, b.height + 16, row.del, 13);
      }
    });
    const by = y + SLOTS * rowH + 6;
    const backRow: Row = { label: 'もどる', run: this.back };
    this.rows.push(backRow);
    const onBack = this.cursor === SLOTS;
    add(this.add.text(W / 2, by + 16, (onBack ? '▶ ' : '') + 'もどる', { fontFamily: FONT, fontSize: '22px', color: onBack ? '#fff3a0' : '#c8d0e8', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0.5).setDepth(11));
    tap(W / 2 - 120, by - 6, 240, 44, this.back);
    this.setHelp(byMode('↑↓ で選んで Z で決定　Delete で記録を消す　X でもどる', purpose === 'continue' ? 'ファイルをタップして続きから' : 'ファイルをタップして、はじめから'));
  }

  private setHelp(text: string): void {
    this.help.setFontSize(byMode(14, 20)).setText(text).setDepth(this.mode.kind === 'main' ? 6 : 11);
  }
}
