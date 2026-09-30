import Phaser from 'phaser';
import { IC } from '../art/icons';
import { CONSUMABLES, EQUIPMENT, SHOPS, SPELLS, SPELL_ORDER, type ShopEntry } from '../data/items';
import { ROOMS } from '../data/rooms/index';
import type { Line } from '../data/types';
import { controlsRef } from '../input';
import { applyLevelChoice, attackPower, buy, defense, equip, expToNext, maxHp, type StatChoice } from '../progress';
import { EV, saveGame, session } from '../session';
import { byMode, fmt, inputMode, onInputMode } from '../inputMode';
import { OPACITIES, SIZES, cycle, labelOf, resetLayout, saveSettings, settings } from '../settings';
import { FONT } from '../ui';

type Done<T = void> = (v: T) => void;

type UiTask =
  | { type: 'dialog'; lines: Line[]; done?: Done }
  | { type: 'levelup'; count: number; done?: Done }
  | { type: 'choice'; question: string; options: string[]; done: Done<number> }
  | { type: 'banner'; title: string; sub: string; done?: Done }
  | { type: 'edit'; done?: Done }
  | {
      type: 'list';
      title: string;
      build: () => ListRow[];
      onPick: (i: number) => boolean | void;
      /** Label of the action button for the selected row; null hides it, `off` greys it out. */
      action: (i: number) => { label: string; off?: boolean } | null;
      done?: Done<number | null>;
      footer?: () => string;
      tabs?: string[];
      tab?: number;
      onTab?: (t: number) => void;
    };

interface ListRow {
  text: string;
  sub?: string;
  icon?: number;
  dim?: boolean;
}

const CHOICES: { key: StatChoice; label: string; desc: string }[] = [
  { key: 'hp', label: '体力', desc: '最大HP +2' },
  { key: 'atk', label: '攻撃力', desc: '剣の威力 +1' },
  { key: 'mag', label: '魔力', desc: '最大MP +4\n魔法威力 +1' },
];

const AREA_NAMES: Record<string, string> = {
  haruna: 'ハルナ村',
  forest: 'ささやきの森',
  road: '街道',
  dorm: '鉱山町ドルム',
  mine: '石の心臓',
  plateau: '風の高原',
  shrine: '天の祠',
  lake: '地底湖',
  aqualia: '沈んだ都アクアリア',
  forge: '竜の炉',
  capital: '王都ルミエ',
  tower: '虚の塔',
};

/** Screen-space UI drawn at full canvas resolution (960x540). */
export class HUDScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[] = [];
  private texts!: Record<'coins' | 'lv' | 'keys' | 'spell' | 'items' | 'boss' | 'area' | 'hp', Phaser.GameObjects.Text>;
  private toasts: Phaser.GameObjects.Text[] = [];

  private queue: UiTask[] = [];
  private current: UiTask | null = null;
  private openedAt = 0;

  private dialogBox!: Phaser.GameObjects.Container;
  private dialogWho!: Phaser.GameObjects.Text;
  private dialogText!: Phaser.GameObjects.Text;
  private dialogMore!: Phaser.GameObjects.Text;
  private lineIndex = 0;
  private typed = 0;

  private panel!: Phaser.GameObjects.Container;
  /** Tap area over the selected-spell box: opens the magic tab. */
  private spellTap!: Phaser.GameObjects.Zone;
  private panelObjs: Phaser.GameObjects.GameObject[] = [];
  private cursor = 0;
  private scrollTop = 0;

  constructor() {
    super('HUD');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.queue = [];
    this.current = null;
    this.toasts = [];
    this.icons = [];
    this.g = this.add.graphics();
    const style = { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 };
    this.texts = {
      coins: this.add.text(W - 20, 16, '', style).setOrigin(1, 0),
      hp: this.add.text(50, 17, '', style).setVisible(false),
      lv: this.add.text(20, 70, '', { ...style, fontSize: '16px' }),
      keys: this.add.text(W - 20, 44, '', { ...style, fontSize: '16px' }).setOrigin(1, 0),
      spell: this.add.text(W - 64, 76, '', { ...style, fontSize: '14px' }).setOrigin(1, 0),
      items: this.add.text(20, 94, '', { ...style, fontSize: '14px', color: '#dddddd' }),
      boss: this.add.text(W / 2, H - 56, '', { ...style, color: '#ffdddd' }).setOrigin(0.5, 1),
      area: this.add.text(W / 2, 120, '', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0),
    };

    this.buildDialog(W, H);
    this.panel = this.add.container(0, 0).setDepth(60).setVisible(false);
    const off = onInputMode(() => {
      if (this.current && this.current.type !== 'dialog') this.redraw();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    // In touch mode a tap anywhere moves the dialog on.
    this.input.on('pointerdown', () => {
      if (inputMode.current === 'touch' && this.current?.type === 'dialog') this.dialogAdvance();
    });

    const on = <A extends unknown[]>(ev: string, fn: (...a: A) => void) => {
      this.game.events.on(ev, fn);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(ev, fn));
    };
    on(EV.dialog, (lines: Line[], done?: Done) => this.enqueue({ type: 'dialog', lines, done }));
    on(EV.levelUp, (count: number, done?: Done) => this.enqueue({ type: 'levelup', count, done }));
    on(EV.choice, (question: string, options: string[], done: Done<number>) => this.enqueue({ type: 'choice', question, options, done }));
    on(EV.banner, (title: string, sub: string, done?: Done) => this.enqueue({ type: 'banner', title, sub, done }));
    on(EV.toast, (text: string) => this.toast(text));
    on(EV.area, (name: string) => this.showArea(name));
    on(EV.shop, (id: string, done?: Done) => this.openShop(id, done));
    on(EV.warp, (done: Done<string | null>) => this.openWarp(done));
    on(EV.menu, () => this.openMenu(0));
    this.spellTap = this.add
      .zone(0, 0, 130, 54)
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        // Not during story scenes: "save and quit" there could lose a boss's reward for good.
        if (!this.current && !session.uiBlocking && !session.cutscene) this.openMenu(2);
      });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      session.touch = {};
      session.uiBlocking = false;
    });
  }

  // ================================================================ task queue

  private enqueue(t: UiTask): void {
    this.queue.push(t);
    session.uiBlocking = true;
    if (!this.current) this.next();
  }

  private next(result?: unknown): void {
    const prev = this.current;
    this.current = this.queue.shift() ?? null;
    this.dialogBox.setVisible(false);
    this.clearPanel();
    this.openedAt = this.time.now;
    if (!this.current) session.uiBlocking = false;
    else this.show(this.current);
    (prev?.done as ((v: unknown) => void) | undefined)?.(result);
  }

  private show(t: UiTask): void {
    this.cursor = 0;
    this.scrollTop = 0;
    if (t.type === 'dialog') {
      this.lineIndex = 0;
      this.showLine();
    } else if (t.type === 'levelup') this.drawLevelUp();
    else if (t.type === 'choice') this.drawChoice();
    else if (t.type === 'banner') this.drawBanner();
    else if (t.type === 'edit') this.game.events.emit(EV.edit, () => this.next());
    else this.drawList();
  }

  // ================================================================ dialog

  private buildDialog(W: number, H: number): void {
    const bw = W - 80;
    const bh = 150;
    const bg = this.add.graphics();
    bg.fillStyle(0x0b0b1a, 0.94).fillRoundedRect(0, 0, bw, bh, 10);
    bg.lineStyle(2, 0xcfd8ff, 0.8).strokeRoundedRect(0, 0, bw, bh, 10);
    this.dialogWho = this.add.text(24, 14, '', { fontFamily: FONT, fontSize: '20px', color: '#ffd98a' });
    this.dialogText = this.add.text(24, 46, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', lineSpacing: 8, wordWrap: { width: bw - 48, useAdvancedWrap: true } });
    this.dialogMore = this.add.text(bw - 30, bh - 30, '▼', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' });
    this.dialogBox = this.add.container(40, H - bh - 24, [bg, this.dialogWho, this.dialogText, this.dialogMore]).setVisible(false).setDepth(50);
    bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, bw, bh), Phaser.Geom.Rectangle.Contains).on('pointerdown', () => this.dialogAdvance());
  }

  private showLine(): void {
    const t = this.current as Extract<UiTask, { type: 'dialog' }>;
    const line = t.lines[this.lineIndex];
    this.dialogBox.setVisible(true);
    this.dialogWho.setText(line.who ?? '');
    this.dialogText.setY(line.who ? 46 : 28);
    this.typed = 0;
    this.dialogText.setText('');
  }

  private dialogAdvance(): void {
    const t = this.current;
    if (!t || t.type !== 'dialog' || this.time.now - this.openedAt < 150) return;
    const full = fmt(t.lines[this.lineIndex].text);
    if (this.typed < full.length) {
      this.typed = full.length;
      this.dialogText.setText(full);
    } else if (this.lineIndex < t.lines.length - 1) {
      this.lineIndex += 1;
      this.showLine();
    } else this.next();
  }

  private updateDialog(dt: number): void {
    const t = this.current as Extract<UiTask, { type: 'dialog' }>;
    const full = fmt(t.lines[this.lineIndex].text);
    if (this.typed < full.length) {
      this.typed = Math.min(full.length, this.typed + dt * 45);
      this.dialogText.setText(full.slice(0, Math.floor(this.typed)));
    }
    this.dialogMore.setVisible(this.typed >= full.length && Math.floor(this.time.now / 300) % 2 === 0);
  }

  // ================================================================ panels

  private clearPanel(): void {
    for (const o of this.panelObjs) o.destroy();
    this.panelObjs = [];
    this.panel.setVisible(false);
  }

  private add2<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.panelObjs.push(o);
    this.panel.add(o);
    return o;
  }

  /** Makes an object tappable over a larger area than its own bounds (text is small to hit). */
  private tappable<T extends Phaser.GameObjects.Text>(o: T, fn: () => void, padX = 16, padY = 10): T {
    o.setInteractive({ hitArea: new Phaser.Geom.Rectangle(-padX, -padY, o.width + padX * 2, o.height + padY * 2), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    o.on('pointerdown', fn);
    return o;
  }

  /** A gold button in the game's style, anchored at its bottom-right corner. */
  private actionButton(right: number, bottom: number, label: string, off: boolean, fn: () => void): Phaser.GameObjects.Text {
    const b = this.add2(
      this.add
        .text(right, bottom, label, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: off ? '#8a8070' : '#1a1030', backgroundColor: off ? '#3a3448' : '#e0b850', padding: { x: 22, y: 8 } })
        .setOrigin(1, 1),
    );
    const edge = this.add2(this.add.rectangle(b.x - b.width, b.y - b.height, b.width, b.height).setOrigin(0).setStrokeStyle(3, off ? 0x5a5070 : 0xfff3a0));
    edge.setDepth(b.depth);
    if (!off) this.tappable(b, fn, 10, 8);
    return b;
  }

  private shade(alpha = 0.65): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add2(this.add.rectangle(0, 0, W, H, 0x000000, alpha).setOrigin(0));
  }

  private frame(x: number, y: number, w: number, h: number): void {
    const g = this.add2(this.add.graphics());
    g.fillStyle(0x10102a, 0.96).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, 0xcfd8ff, 0.8).strokeRoundedRect(x, y, w, h, 10);
  }

  private drawLevelUp(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.panel.setVisible(true);
    this.shade();
    this.add2(this.add.text(W / 2, 110, `レベルアップ！  Lv ${session.data.level}\n伸ばす力を 1 つ選ぼう`, { fontFamily: FONT, fontSize: '32px', color: '#fff3a0', stroke: '#000', strokeThickness: 5, align: 'center' }).setOrigin(0.5));
    this.add2(this.add.text(W / 2, H - 90, byMode('← → で選んで Z で決定', '伸ばしたい力をタップして「決定」'), { fontFamily: FONT, fontSize: '18px', color: '#dddddd' }).setOrigin(0.5));
    if (inputMode.current === 'touch') this.actionButton(W - 40, H - 30, '決定', false, () => this.pickStat());
    CHOICES.forEach((c, i) => {
      // Three cards side by side, narrower on narrow screens.
      const step = Math.min(230, (W - 40) / 3);
      const x = W / 2 + (i - 1) * step;
      const on = i === this.cursor;
      const box = this.add2(this.add.rectangle(x, H / 2 + 10, step - 30, 190, 0x1a1a33).setStrokeStyle(on ? 5 : 3, on ? 0xfff3a0 : 0x666688));
      this.add2(this.add.text(x, H / 2 - 40, c.label, { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5));
      this.add2(this.add.text(x, H / 2 + 30, c.desc, { fontFamily: FONT, fontSize: '20px', color: '#cfe0ff', align: 'center' }).setOrigin(0.5));
      box.setInteractive().on('pointerdown', () => {
        this.cursor = i;
        // Touch picks with the 決定 button; a mouse click picks at once.
        if (inputMode.current === 'touch') this.redraw();
        else this.pickStat();
      });
    });
  }

  private pickStat(): void {
    const t = this.current as Extract<UiTask, { type: 'levelup' }>;
    applyLevelChoice(session.data, CHOICES[this.cursor].key);
    this.toast(`${CHOICES[this.cursor].label} が上がった！`);
    t.count -= 1;
    if (t.count > 0) {
      this.openedAt = this.time.now;
      this.clearPanel();
      this.drawLevelUp();
    } else this.next();
  }

  private drawChoice(): void {
    const t = this.current as Extract<UiTask, { type: 'choice' }>;
    const W = this.scale.width;
    this.panel.setVisible(true);
    const fw = Math.min(560, W - 40);
    // The panel grows with the question (it may run to several lines).
    const q = this.add.text(W / 2, 0, t.question, { fontFamily: FONT, fontSize: '22px', color: '#ffd98a', align: 'center', lineSpacing: 6, wordWrap: { width: fw - 40, useAdvancedWrap: true } }).setOrigin(0.5, 0);
    const top = q.height + 34;
    const h = top + t.options.length * 40 + 10;
    const y = Math.max(16, Math.min(150, (this.scale.height - h) / 2));
    this.frame(W / 2 - fw / 2, y, fw, h);
    this.add2(q.setY(y + 20));
    t.options.forEach((o, i) => {
      const oy = y + top + i * 40;
      const on = i === this.cursor;
      const row = this.add2(this.add.rectangle(W / 2, oy + 14, fw - 40, 36, on ? 0x2a2a5a : 0x000000, on ? 1 : 0.001));
      this.add2(this.add.text(W / 2, oy, (on ? '▶ ' : '   ') + o, { fontFamily: FONT, fontSize: '22px', color: on ? '#ffffff' : '#9aa3c0' }).setOrigin(0.5, 0));
      // The whole row is the button.
      row.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.cursor = i;
        this.next(i);
      });
    });
  }

  private drawBanner(): void {
    const t = this.current as Extract<UiTask, { type: 'banner' }>;
    const W = this.scale.width;
    const H = this.scale.height;
    this.panel.setVisible(true);
    this.shade(0.45);
    const bw = Math.min(600, W - 40);
    this.frame(W / 2 - bw / 2, H / 2 - 90, bw, 180);
    const glow = this.add2(this.add.image(W / 2, H / 2 - 40, 'light_warm').setScale(1.4).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD));
    this.tweens.add({ targets: glow, alpha: 0.2, yoyo: true, repeat: -1, duration: 700 });
    this.add2(this.add.text(W / 2, H / 2 - 50, t.title, { fontFamily: FONT, fontSize: '32px', color: '#fff3a0', stroke: '#3a2a10', strokeThickness: 5 }).setOrigin(0.5));
    this.add2(this.add.text(W / 2, H / 2 + 20, fmt(t.sub), { fontFamily: FONT, fontSize: '20px', color: '#ffffff', align: 'center', lineSpacing: 6, wordWrap: { width: bw - 40, useAdvancedWrap: true } }).setOrigin(0.5, 0.5));
    this.add2(this.add.text(W / 2 + bw / 2 - 20, H / 2 + 70, '▼', { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(1, 0.5));
    this.add2(this.add.rectangle(0, 0, W, H, 0, 0).setOrigin(0).setInteractive().on('pointerdown', () => this.time.now - this.openedAt > 300 && this.next()));
  }

  private drawList(): void {
    const t = this.current as Extract<UiTask, { type: 'list' }>;
    const W = this.scale.width;
    const H = this.scale.height;
    this.panel.setVisible(true);
    this.shade(0.55);
    // Narrower panel margins on narrow screens (4:3 tablets).
    const x0 = Math.max(24, Math.min(120, (W - 720) / 2));
    const w = W - x0 * 2;
    this.frame(x0, 50, w, H - 110);
    // A big close button, for fingers and mice alike.
    const close = this.add2(this.add.text(x0 + w - 16, 58, '✕', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', backgroundColor: '#3a2a5a', padding: { x: 10, y: 2 } }).setOrigin(1, 0));
    this.tappable(close, () => this.next(null), 14, 10);
    if (t.tabs) {
      let tabsEnd = 0;
      const step = Math.min(150, (w - 110) / t.tabs.length);
      t.tabs.forEach((name, i) => {
        const tx = this.add2(this.add.text(x0 + 30 + i * step, 66, name, { fontFamily: FONT, fontSize: step < 130 ? '19px' : '22px', color: i === t.tab ? '#fff3a0' : '#7a82a0' }));
        tabsEnd = tx.x + tx.width;
        if (i === t.tab) this.add2(this.add.rectangle(tx.x, 96, tx.width, 3, 0xfff3a0).setOrigin(0));
        this.tappable(tx, () => t.onTab?.(i), Math.max(8, (step - tx.width) / 2), 14);
      });
      const hint = this.add2(this.add.text(x0 + w - 70, 70, byMode('← → 切り替え  ↑↓ 選択  Z 決定  X 閉じる', 'タブで切り替え・選んで右下のボタンで決定'), { fontFamily: FONT, fontSize: '14px', color: '#9aa3c0' }).setOrigin(1, 0));
      // No room beside the tabs: the hint goes just above the panel.
      if (hint.x - hint.width < tabsEnd + 16) hint.setPosition(x0 + w, 28);
    } else {
      this.add2(this.add.text(x0 + 30, 66, t.title, { fontFamily: FONT, fontSize: '24px', color: '#fff3a0' }));
      this.add2(this.add.text(x0 + w - 70, 70, byMode('↑↓ 選択  Z 決定  X 閉じる', '選んで右下のボタンで決定'), { fontFamily: FONT, fontSize: '14px', color: '#9aa3c0' }).setOrigin(1, 0));
    }
    const rows = t.build();
    // As many rows as fit above the description (9 at full height).
    const perPage = Math.max(4, Math.floor((H - 262) / 34) + 1);
    const more = rows.length > perPage;
    if (this.cursor >= rows.length) this.cursor = Math.max(0, rows.length - 1);
    if (this.cursor < this.scrollTop) this.scrollTop = this.cursor;
    if (this.cursor >= this.scrollTop + perPage) this.scrollTop = this.cursor - perPage + 1;
    rows.slice(this.scrollTop, this.scrollTop + perPage).forEach((r, k) => {
      const i = k + this.scrollTop;
      const y = 112 + k * 34;
      const on = i === this.cursor;
      // The whole row selects (a tap anywhere on it); the action button then does it.
      const hit = this.add2(this.add.rectangle(x0 + 16, y - 3, w - 32 - (more ? 56 : 0), 33, 0x2a2a5a, on ? 1 : 0.001).setOrigin(0));
      if (r.icon !== undefined) this.add2(this.add.image(x0 + 38, y + 13, 'icons', r.icon).setScale(1.5));
      this.add2(this.add.text(x0 + 60, y, fmt(r.text), { fontFamily: FONT, fontSize: '20px', color: r.dim ? '#6a7090' : on ? '#ffffff' : '#c8d0e8' }));
      if (r.sub) this.add2(this.add.text(x0 + w - 30 - (more ? 56 : 0), y + 2, fmt(r.sub), { fontFamily: FONT, fontSize: '18px', color: '#ffd98a' }).setOrigin(1, 0));
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (this.cursor === i && inputMode.current !== 'touch') this.listPick();
        else {
          this.cursor = i;
          this.redraw();
        }
      });
    });
    // Page buttons when the list is longer than the panel.
    if (more) {
      const px = x0 + w - 44;
      const page = (label: string, y: number, dir: number) => {
        const can = dir < 0 ? this.scrollTop > 0 : this.scrollTop + perPage < rows.length;
        const b = this.add2(this.add.text(px, y, label, { fontFamily: FONT, fontSize: '22px', color: can ? '#1a1030' : '#6a6480', backgroundColor: can ? '#e0b850' : '#2a2640', padding: { x: 10, y: 6 } }).setOrigin(0.5));
        if (can)
          this.tappable(b, () => {
            this.scrollTop = Math.max(0, Math.min(rows.length - perPage, this.scrollTop + dir * perPage));
            this.cursor = this.scrollTop;
            this.redraw();
          }, 8, 8);
      };
      page('▲', 128, -1);
      page('▼', 112 + (perPage - 1) * 34, 1);
    }
    const sel = rows[this.cursor];
    const footer = t.footer?.() ?? '';
    const desc = (sel as { desc?: string } | undefined)?.desc ?? '';
    const act = rows.length ? t.action(this.cursor) : null;
    let btnW = 0;
    if (act) btnW = this.actionButton(x0 + w - 24, H - 76, act.label, !!act.off, () => this.listPick()).width + 20;
    this.add2(this.add.text(x0 + 30, H - 130, fmt(footer || desc), { fontFamily: FONT, fontSize: '17px', color: '#cfd8ff', lineSpacing: 5, wordWrap: { width: w - 60 - btnW, useAdvancedWrap: true } }));
  }

  private redraw(): void {
    this.clearPanel();
    if (this.current) {
      const keep = this.cursor;
      const top = this.scrollTop;
      if (this.current.type === 'dialog') this.dialogBox.setVisible(true);
      else if (this.current.type === 'levelup') this.drawLevelUp();
      else if (this.current.type === 'choice') this.drawChoice();
      else if (this.current.type === 'banner') this.drawBanner();
      else if (this.current.type !== 'edit') this.drawList();
      this.cursor = keep;
      this.scrollTop = top;
    }
  }

  private listPick(): void {
    const t = this.current as Extract<UiTask, { type: 'list' }>;
    const close = t.onPick(this.cursor);
    if (close) this.next(this.cursor);
    else this.redraw();
  }

  // ---------------------------------------------------------------- shop / warp / menu

  private openShop(id: string, done?: Done): void {
    const entries = SHOPS[id] ?? [];
    const label = (e: ShopEntry) => (e.kind === 'equip' ? EQUIPMENT[e.id].name : CONSUMABLES[e.id].name);
    const price = (e: ShopEntry) => (e.kind === 'equip' ? EQUIPMENT[e.id].price ?? 0 : CONSUMABLES[e.id].price);
    const desc = (e: ShopEntry) => (e.kind === 'equip' ? EQUIPMENT[e.id].desc : CONSUMABLES[e.id].desc);
    let msg = '';
    this.enqueue({
      type: 'list',
      title: 'お店',
      build: () =>
        entries.map((e) => {
          const d = session.data;
          const owned = e.kind === 'equip' ? d.owned.includes(e.id) : false;
          const count = e.kind === 'item' ? `（${d.items[e.id]}/${CONSUMABLES[e.id].max}）` : '';
          return { text: label(e) + count, sub: owned ? '持っている' : `${price(e)} 灯貨`, dim: owned, icon: iconFor(e), desc: desc(e) } as ListRow;
        }),
      footer: () => `所持金 ${session.data.coins} 灯貨　${msg}\n${desc(entries[this.cursor] ?? entries[0])}`,
      action: (i) => {
        const e = entries[i];
        if (!e) return null;
        if (e.kind === 'equip' && session.data.owned.includes(e.id)) return { label: '持っている', off: true };
        if (e.kind === 'item' && session.data.items[e.id] >= CONSUMABLES[e.id].max) return { label: 'もう持てない', off: true };
        return { label: `買う（${price(e)} 灯貨）` };
      },
      onPick: (i) => {
        const e = entries[i];
        const r = buy(session.data, e.kind, e.id);
        msg = r === 'ok' ? `${label(e)}を買った！` : r === 'poor' ? '灯貨が足りない' : r === 'owned' ? 'もう持っている' : 'これ以上持てない';
        if (r === 'ok' && e.kind === 'equip') msg += '（メニューで装備できる）';
        return false;
      },
      done: () => done?.(),
    });
  }

  private openWarp(done: Done<string | null>): void {
    const rooms = session.data.beacons.filter((r) => ROOMS[r]);
    this.enqueue({
      type: 'list',
      title: 'どの灯台へワープする？',
      build: () => rooms.map((r) => ({ text: ROOMS[r].name, sub: AREA_NAMES[ROOMS[r].area] ?? '', icon: IC.beacon })),
      action: () => ({ label: 'ワープする' }),
      onPick: () => true,
      done: (i) => done(i === null || i === undefined ? null : rooms[i]),
    });
  }

  private openMenu(tab: number): void {
    const d = session.data;
    const tabs = ['装備', '持ち物', '魔法', '能力', '記録', '設定'];
    const T = { gear: 0, items: 1, magic: 2, stats: 3, record: 4, settings: 5 };
    const slotOrder = ['sword', 'armor', 'charm'];
    const gear = () => [...d.owned].sort((a, b) => slotOrder.indexOf(EQUIPMENT[a].slot) - slotOrder.indexOf(EQUIPMENT[b].slot));
    const task: Extract<UiTask, { type: 'list' }> = {
      type: 'list',
      title: 'メニュー',
      tabs,
      tab,
      onTab: (t) => {
        task.tab = t;
        this.cursor = 0;
        this.scrollTop = 0;
        this.redraw();
      },
      build: () => {
        switch (task.tab) {
          case 0:
            return gear().map((id) => {
              const e = EQUIPMENT[id];
              const on = d.equip.sword === id || d.equip.armor === id || d.equip.charms.includes(id);
              const stat = e.atk ? `攻撃 +${e.atk}` : e.def ? `防御 +${e.def}` : e.slot === 'charm' ? 'お守り' : '';
              return { text: (on ? '★ ' : '　 ') + e.name, sub: stat, icon: e.slot === 'sword' ? IC.sword : e.slot === 'armor' ? IC.armor : IC.charm, desc: e.desc } as ListRow;
            });
          case 1: {
            const rows: ListRow[] = [
              { text: `灯の雫 ×${d.items.potion}`, icon: IC.potion, sub: fmt('{heal} で使う') },
              { text: `大きな灯の雫 ×${d.items.bigPotion}`, icon: IC.bigPotion, sub: fmt('{heal} で使う') },
              { text: `星の粉 ×${d.items.ether}`, icon: IC.ether, sub: fmt('{ether} で使う') },
              { text: `剣の欠片 ${d.fragments}/4`, icon: IC.fragment },
              { text: `託された灯 ${d.lights.length}/12`, icon: IC.light },
            ];
            if (d.abilities.doubleJump) rows.push({ text: '跳躍のブーツ（二段ジャンプ）', icon: IC.armor });
            if (d.abilities.charge) rows.push({ text: fmt('溜め斬り（{attack} 長押し）'), icon: IC.sword });
            const questNames: Record<string, string> = { shadowIron: '影の鉄', musicBox: 'オルゴール', scale: '竜の鱗' };
            for (const [k, n] of Object.entries(questNames)) if (d.flags[`item_${k}`] && !d.flags[`gave_${k}`]) rows.push({ text: n, icon: IC.key });
            const tabs2 = ['tablet1', 'tablet2', 'tablet3', 'tablet4'].filter((k) => d.flags[`item_${k}`]).length;
            if (tabs2 && !d.flags.gave_tablets) rows.push({ text: `石版 ×${tabs2}`, icon: IC.key });
            return rows;
          }
          case T.magic:
            // Every spell, so the player can see there are more to find.
            return SPELL_ORDER.map((s) =>
              d.abilities[s]
                ? ({ text: `${SPELLS[s].name}（MP ${SPELLS[s].cost}）`, sub: d.spell === s ? '使用中' : '', icon: IC[s], desc: SPELLS[s].desc } as ListRow)
                : ({ text: '？？？', sub: 'まだ覚えていない', dim: true, desc: '旅の先で覚えられる魔法。' } as ListRow),
            );
          case T.stats: {
            const t = Math.floor(d.playTime);
            return [
              { text: `レベル ${d.level}`, sub: `次まで ${expToNext(d.level) - d.exp}` },
              { text: `HP ${d.hp}/${maxHp(d)}`, icon: IC.heartFull },
              { text: `MP ${d.mp}/${d.mpMax}`, icon: IC.mp },
              { text: `攻撃力 ${attackPower(d)}`, icon: IC.sword },
              { text: `魔力 ${d.mag}`, icon: IC.bolt },
              { text: `防御 ${defense(d)}`, icon: IC.armor },
              { text: `灯貨 ${d.coins}`, icon: IC.coin },
              { text: `プレイ時間 ${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` },
              { text: `やさしいモード：${d.easy ? 'オン' : 'オフ'}` },
            ];
          }
          case T.settings:
            return [
              { text: `移動ボタン：${settings.pad === 'bar' ? '◀ ▶ ボタン' : '十字キー'}` },
              { text: `ボタンの大きさ：${labelOf(SIZES, settings.size)}` },
              { text: `ボタンの濃さ：${labelOf(OPACITIES, settings.opacity)}` },
              { text: 'ボタンとHP表示の配置を変える' },
              { text: '配置を元に戻す' },
              { text: 'タイトルに戻る' },
            ];
          default: {
            const rows: ListRow[] = [];
            for (const [area, name] of Object.entries(AREA_NAMES)) {
              const rooms = Object.values(ROOMS).filter((r) => r.area === area);
              if (!rooms.length) continue;
              const seen = rooms.filter((r) => d.visited.includes(r.id)).length;
              if (!seen) continue;
              const keys = d.keys[area] ? `鍵×${d.keys[area]}` : '';
              const bk = d.bossKeys.includes(area) ? ' ボス鍵' : '';
              rows.push({ text: name, sub: `${seen}/${rooms.length} 部屋 ${keys}${bk}` });
            }
            return rows;
          }
        }
      },
      footer: () => {
        if (task.tab === 0) {
          const id = gear()[this.cursor];
          return id ? `${EQUIPMENT[id].desc}\n${byMode('Z で装備', '「装備する」で装備')}（お守りは2つまで）` : '';
        }
        if (task.tab === T.magic) {
          const s = SPELL_ORDER[this.cursor];
          const desc = s && d.abilities[s] ? SPELLS[s].desc : '旅の先で覚えられる魔法。';
          const owned = SPELL_ORDER.filter((x) => d.abilities[x]).length;
          const how = byMode(
            '{magic} で使う　A / S で切り替え',
            owned > 1 ? '「魔法」ボタンで使う　「切替」ボタンで切り替え' : '「魔法」ボタンで使う（2つ以上覚えると「切替」ボタンが出る）',
          );
          return `${desc}\n${fmt(how)}`;
        }
        if (task.tab === T.record) return `ファイル${session.slot + 1}　　現在地：${session.roomName}　　灯台 ${d.beacons.length} か所`;
        if (task.tab === T.settings) {
          return [
            'スマホの移動ボタンを ◀ ▶ ボタンと十字キーで切り替えます。十字キーは上下・斜めも押せます',
            'スマホのボタンの大きさ（小・中・大・特大）',
            'スマホのボタンの濃さ（うすい・ふつう・こい）',
            '編集画面で、ボタンやHP表示をドラッグで動かしたり、大きさを変えたりできます',
            'ボタンとHP表示の位置・大きさを最初の状態に戻します',
            `タイトル画面に戻ります（ファイル${session.slot + 1}）`,
          ][this.cursor] ?? '';
        }
        return '';
      },
      action: (i) => {
        if (task.tab === 0) {
          const id = gear()[i];
          if (!id) return null;
          const e = EQUIPMENT[id];
          if (e.slot === 'charm') return { label: d.equip.charms.includes(id) ? '外す' : '装備する' };
          return d.equip.sword === id || d.equip.armor === id ? { label: '装備中', off: true } : { label: '装備する' };
        }
        if (task.tab === T.magic) {
          const s = SPELL_ORDER[i];
          return s && d.abilities[s] ? (d.spell === s ? { label: '使用中', off: true } : { label: 'この魔法を使う' }) : null;
        }
        if (task.tab === T.stats) return i === 8 ? { label: d.easy ? 'オフにする' : 'オンにする' } : null;
        if (task.tab === T.settings) return { label: ['切り替える', '変える', '変える', '編集する', '元に戻す', 'タイトルへ'][i] };
        return null;
      },
      onPick: (i) => {
        if (task.tab === 0) {
          const id = gear()[i];
          if (!equip(d, id)) this.toast('お守りは2つまでしか付けられない');
        } else if (task.tab === T.magic) {
          const s = SPELL_ORDER[i];
          if (s && d.abilities[s]) d.spell = s;
        } else if (task.tab === T.stats && i === 8) {
          d.easy = !d.easy;
          saveGame();
        } else if (task.tab === T.settings) {
          if (i === 0) settings.pad = settings.pad === 'bar' ? 'dpad' : 'bar';
          else if (i === 1) settings.size = cycle(SIZES, settings.size).v;
          else if (i === 2) settings.opacity = cycle(OPACITIES, settings.opacity).v;
          else if (i === 3) {
            this.queue.unshift({ type: 'edit' });
            return true;
          } else if (i === 5) {
            this.queue.unshift({
              type: 'choice',
              question: 'タイトルに戻りますか？\n記録すると、手に入れた物や経験はそのままで、\n次は最後に触れた灯の泉から始まります。',
              options: ['記録してタイトルへ', '記録せずにタイトルへ', 'やめる'],
              done: (c) => {
                if (c === 0 || c === 1) this.game.events.emit(EV.toTitle, c === 0);
              },
            });
            return true;
          } else if (i === 4) {
            resetLayout();
            this.toast('ボタンとHP表示を元の配置に戻した');
          }
          saveSettings();
        }
        return false;
      },
    };
    this.enqueue(task);
  }

  // ================================================================ toasts & area card

  toast(text: string): void {
    const W = this.scale.width;
    const t = this.add
      .text(W / 2, 30, fmt(text), { fontFamily: FONT, fontSize: '19px', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(70);
    this.toasts.push(t);
    if (this.toasts.length > 4) this.toasts.shift()?.destroy();
    this.layoutToasts();
    this.tweens.add({
      targets: t,
      alpha: 0,
      delay: 2200,
      duration: 500,
      onComplete: () => {
        this.toasts = this.toasts.filter((x) => x !== t);
        t.destroy();
        this.layoutToasts();
      },
    });
  }

  private layoutToasts(): void {
    let y = 130;
    for (const t of this.toasts) {
      if (!t.active) continue;
      t.setY(y);
      y += t.height + 4;
    }
  }

  private showArea(name: string): void {
    const a = this.texts.area;
    if (a.text === name && a.alpha > 0) return;
    a.setText(name).setAlpha(0);
    this.tweens.killTweensOf(a);
    this.tweens.chain({ targets: a, tweens: [{ alpha: 1, duration: 400 }, { alpha: 1, duration: 1200 }, { alpha: 0, duration: 600 }] });
  }

  // ================================================================ frame

  update(_time: number, delta: number): void {
    this.drawStatus();
    const t = this.current;
    if (!t) return;
    const c = controlsRef.current;
    const ready = this.time.now - this.openedAt > 150;
    if (t.type === 'edit') return;
    if (t.type === 'dialog') {
      this.updateDialog(delta / 1000);
      if (ready && c && (c.justDown('jump') || c.justDown('attack') || c.justDown('up'))) this.dialogAdvance();
      return;
    }
    if (!ready || !c) return;
    if (t.type === 'banner') {
      if (this.time.now - this.openedAt > 400 && (c.justDown('jump') || c.justDown('attack') || c.justDown('menu'))) this.next();
      return;
    }
    if (t.type === 'levelup') {
      if (c.justDown('left')) this.cursor = (this.cursor + 2) % 3;
      if (c.justDown('right')) this.cursor = (this.cursor + 1) % 3;
      if (c.justDown('left') || c.justDown('right')) this.redraw();
      if (c.justDown('jump') || c.justDown('attack')) this.pickStat();
      return;
    }
    if (t.type === 'choice') {
      const n = t.options.length;
      if (c.justDown('up')) this.cursor = (this.cursor + n - 1) % n;
      if (c.justDown('down')) this.cursor = (this.cursor + 1) % n;
      if (c.justDown('up') || c.justDown('down')) this.redraw();
      if (c.justDown('jump')) this.next(this.cursor);
      return;
    }
    // Lists.
    const rows = t.build().length;
    if (c.justDown('up') && rows) {
      this.cursor = (this.cursor + rows - 1) % rows;
      this.redraw();
    }
    if (c.justDown('down') && rows) {
      this.cursor = (this.cursor + 1) % rows;
      this.redraw();
    }
    if (t.tabs && (c.justDown('left') || c.justDown('right'))) {
      const n = t.tabs.length;
      t.onTab?.(((t.tab ?? 0) + (c.justDown('right') ? 1 : n - 1)) % n);
    }
    if (c.justDown('jump') && rows) this.listPick();
    else if (c.justDown('attack') || c.justDown('menu')) {
      c.eat('menu');
      this.next(null);
    }
  }

  private drawStatus(): void {
    const d = session.data;
    const g = this.g.clear();
    const W = this.scale.width;
    // Block positions from the layout settings (see TouchOverlay.updateHud).
    const { sx, sy, py } = session.hud;
    const R = session.hud.right ?? W;
    for (const i of this.icons) i.setVisible(false);
    let n = 0;
    const icon = (x: number, y: number, frame: number, scale = 2) => {
      let img = this.icons[n];
      if (!img) {
        img = this.add.image(0, 0, 'icons', 0).setDepth(1);
        this.icons.push(img);
      }
      n++;
      img.setVisible(true).setPosition(x, y).setFrame(frame).setScale(scale);
      return img;
    };

    // Hearts: one heart = 2 HP (numbers instead once there are too many to show).
    const mh = maxHp(d);
    const hearts = Math.ceil(mh / 2);
    let rowsH = 26;
    if (hearts > 24) {
      icon(sx + 34, sy + 28, d.hp > 0 ? IC.heartFull : IC.heartEmpty, 1.6);
      this.texts.hp.setVisible(true).setPosition(sx + 50, sy + 17).setText(`${Math.max(0, d.hp)} / ${mh}`);
    } else {
      this.texts.hp.setVisible(false);
      for (let i = 0; i < hearts; i++) {
        const fill = Phaser.Math.Clamp(d.hp - i * 2, 0, 2);
        const row = Math.floor(i / 12);
        icon(sx + 34 + (i % 12) * 26, sy + 28 + row * 26, fill === 2 ? IC.heartFull : fill === 1 ? IC.heartHalf : IC.heartEmpty, 1.6);
      }
      rowsH = Math.ceil(hearts / 12) * 26;
    }
    // MP bar.
    const mpY = sy + 18 + rowsH + 8;
    const mpX = sx + 44;
    icon(sx + 30, mpY + 6, IC.mp, 1.2);
    const mpW = 20 + d.mpMax * 5;
    g.fillStyle(0x10203a).fillRect(mpX, mpY, mpW, 12);
    g.fillStyle(0x5fa8ff).fillRect(mpX, mpY, (mpW * Math.max(0, d.mp)) / d.mpMax, 12);
    g.fillStyle(0xbfe0ff).fillRect(mpX, mpY, (mpW * Math.max(0, d.mp)) / d.mpMax, 3);
    g.lineStyle(2, 0x000000).strokeRect(mpX, mpY, mpW, 12);
    this.texts.lv.setPosition(sx + 20, mpY + 18).setText(`Lv ${d.level}   EXP ${d.exp}/${expToNext(d.level)}`);
    this.texts.items.setPosition(sx + 20, mpY + 40).setText(`雫×${d.items.potion + d.items.bigPotion}  粉×${d.items.ether}`);

    // Coins and keys, top right.
    this.texts.coins.setPosition(R - 20, py + 16).setText(`${d.coins}`);
    icon(R - 20 - this.texts.coins.width - 20, py + 28, IC.coin, 1.5);
    const roomArea = session.roomArea;
    const k = d.keys[roomArea] ?? 0;
    const bk = d.bossKeys.includes(roomArea);
    this.texts.keys.setPosition(R - 20, py + 44).setText(`${k ? `鍵×${k}` : ''}${bk ? '  ボス鍵' : ''}${d.flags.prologueDone ? `  欠片 ${d.fragments}/4` : ''}`);

    // Selected spell.
    if (SPELL_ORDER.some((s) => d.abilities[s])) {
      g.fillStyle(0x10102a, 0.8).fillRoundedRect(R - 58, py + 66, 44, 44, 8);
      g.lineStyle(2, 0xcfd8ff, 0.7).strokeRoundedRect(R - 58, py + 66, 44, 44, 8);
      icon(R - 36, py + 88, IC[d.spell], 2);
      this.spellTap.setPosition(R - 8, py + 62).setActive(true);
      if (this.spellTap.input) this.spellTap.input.enabled = true;
      this.texts.spell.setPosition(R - 64, py + 76).setText(`${SPELLS[d.spell].name}\nMP ${SPELLS[d.spell].cost}`).setVisible(true);
    } else {
      this.texts.spell.setVisible(false);
      if (this.spellTap.input) this.spellTap.input.enabled = false;
    }

    // Boss bar.
    const boss = session.boss;
    if (boss) {
      const H = this.scale.height;
      const bw = Math.min(560, W - 80);
      const x = (W - bw) / 2;
      const y = H - 48;
      g.fillStyle(0x220a0a).fillRect(x, y, bw, 16);
      g.fillStyle(0xc0304a).fillRect(x, y, (bw * boss.hp) / boss.max, 16);
      g.fillStyle(0xff8a9a).fillRect(x, y, (bw * boss.hp) / boss.max, 4);
      g.lineStyle(2, 0x000000).strokeRect(x, y, bw, 16);
      this.texts.boss.setText(boss.name).setVisible(true);
    } else this.texts.boss.setVisible(false);
  }
}

function iconFor(e: ShopEntry): number {
  if (e.kind === 'item') return IC[e.id];
  const s = EQUIPMENT[e.id].slot;
  return s === 'sword' ? IC.sword : s === 'armor' ? IC.armor : IC.charm;
}
