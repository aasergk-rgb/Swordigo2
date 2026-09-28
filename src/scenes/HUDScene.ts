import Phaser from 'phaser';
import type { Line } from '../data/dialogs';
import { controlsRef } from '../input';
import { applyLevelChoice, expToNext, type StatChoice } from '../progress';
import { EV, session, type ButtonName } from '../session';

export const FONT = "'Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic','Meiryo',sans-serif";

type UiTask = { type: 'dialog'; lines: Line[]; onDone?: () => void } | { type: 'levelup'; count: number; onDone?: () => void };

const CHOICES: { key: StatChoice; label: string; desc: string }[] = [
  { key: 'hp', label: '体力', desc: '最大HP +2' },
  { key: 'atk', label: '攻撃力', desc: '剣の威力 +1' },
  { key: 'mag', label: '魔力', desc: '最大MP +4\n魔法威力 +1' },
];

/** Screen-space UI drawn at full canvas resolution (960x540). */
export class HUDScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private stats!: Phaser.GameObjects.Text;
  private toasts: Phaser.GameObjects.Text[] = [];
  private bossName!: Phaser.GameObjects.Text;

  private queue: UiTask[] = [];
  private current: UiTask | null = null;
  private openedAt = 0;

  private dialogBox!: Phaser.GameObjects.Container;
  private dialogWho!: Phaser.GameObjects.Text;
  private dialogText!: Phaser.GameObjects.Text;
  private dialogMore!: Phaser.GameObjects.Text;
  private lineIndex = 0;
  private typed = 0;

  private levelBox!: Phaser.GameObjects.Container;
  private levelTitle!: Phaser.GameObjects.Text;
  private levelCards: Phaser.GameObjects.Container[] = [];
  private choiceIndex = 0;

  constructor() {
    super('HUD');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.queue = [];
    this.current = null;
    this.toasts = [];
    this.g = this.add.graphics();
    this.stats = this.add.text(20, 64, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 4 });
    this.bossName = this.add.text(W / 2, H - 58, '', { fontFamily: FONT, fontSize: '18px', color: '#ffdddd', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 1);

    this.buildDialog(W, H);
    this.buildLevelUp(W, H);
    if (this.sys.game.device.input.touch) this.buildTouch(W, H);

    const onDialog = (lines: Line[], onDone?: () => void) => this.enqueue({ type: 'dialog', lines, onDone });
    const onLevel = (count: number, onDone?: () => void) => this.enqueue({ type: 'levelup', count, onDone });
    const onToast = (text: string) => this.toast(text);
    this.game.events.on(EV.dialog, onDialog);
    this.game.events.on(EV.levelUp, onLevel);
    this.game.events.on(EV.toast, onToast);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(EV.dialog, onDialog);
      this.game.events.off(EV.levelUp, onLevel);
      this.game.events.off(EV.toast, onToast);
      session.touch = {};
      session.uiBlocking = false;
    });
  }

  // ---------------------------------------------------------------- task queue

  private enqueue(t: UiTask): void {
    this.queue.push(t);
    session.uiBlocking = true;
    if (!this.current) this.next();
  }

  private next(): void {
    const prev = this.current;
    this.current = this.queue.shift() ?? null;
    this.dialogBox.setVisible(false);
    this.levelBox.setVisible(false);
    this.openedAt = this.time.now;
    if (!this.current) session.uiBlocking = false;
    else if (this.current.type === 'dialog') {
      this.lineIndex = 0;
      this.showLine();
    } else {
      this.choiceIndex = 0;
      this.showLevelUp();
    }
    prev?.onDone?.();
  }

  // ---------------------------------------------------------------- dialog

  private buildDialog(W: number, H: number): void {
    const bw = W - 80;
    const bh = 150;
    const bg = this.add.graphics();
    bg.fillStyle(0x0b0b1a, 0.92).fillRoundedRect(0, 0, bw, bh, 10);
    bg.lineStyle(2, 0xcfd8ff, 0.8).strokeRoundedRect(0, 0, bw, bh, 10);
    this.dialogWho = this.add.text(24, 14, '', { fontFamily: FONT, fontSize: '20px', color: '#ffd98a' });
    this.dialogText = this.add.text(24, 46, '', { fontFamily: FONT, fontSize: '22px', color: '#ffffff', lineSpacing: 8, wordWrap: { width: bw - 48, useAdvancedWrap: true } });
    this.dialogMore = this.add.text(bw - 30, bh - 30, '▼', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' });
    this.dialogBox = this.add.container(40, H - bh - 30, [bg, this.dialogWho, this.dialogText, this.dialogMore]).setVisible(false).setDepth(50);
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

  private updateDialog(dt: number, advance: boolean): void {
    const t = this.current as Extract<UiTask, { type: 'dialog' }>;
    const full = t.lines[this.lineIndex].text;
    const done = this.typed >= full.length;
    if (!done) {
      this.typed = Math.min(full.length, this.typed + dt * 45);
      this.dialogText.setText(full.slice(0, Math.floor(this.typed)));
    }
    this.dialogMore.setVisible(done && Math.floor(this.time.now / 300) % 2 === 0);
    if (!advance) return;
    if (!done) {
      this.typed = full.length;
      this.dialogText.setText(full);
    } else if (this.lineIndex < t.lines.length - 1) {
      this.lineIndex += 1;
      this.showLine();
    } else {
      this.next();
    }
  }

  // ---------------------------------------------------------------- level up

  private buildLevelUp(W: number, H: number): void {
    const shade = this.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0);
    this.levelTitle = this.add.text(W / 2, 110, '', { fontFamily: FONT, fontSize: '34px', color: '#fff3a0', stroke: '#000', strokeThickness: 5, align: 'center' }).setOrigin(0.5);
    const hint = this.add.text(W / 2, H - 90, '← → で選んで Z で決定（タップでも選べます）', { fontFamily: FONT, fontSize: '18px', color: '#dddddd' }).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [shade, this.levelTitle, hint];
    this.levelCards = CHOICES.map((c, i) => {
      const x = W / 2 + (i - 1) * 230;
      const box = this.add.rectangle(0, 0, 200, 190, 0x1a1a33).setStrokeStyle(3, 0x666688);
      const label = this.add.text(0, -50, c.label, { fontFamily: FONT, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
      const desc = this.add.text(0, 20, c.desc, { fontFamily: FONT, fontSize: '20px', color: '#cfe0ff', align: 'center' }).setOrigin(0.5);
      const card = this.add.container(x, H / 2 + 10, [box, label, desc]);
      box.setInteractive().on('pointerdown', () => {
        if (this.current?.type !== 'levelup') return;
        this.choiceIndex = i;
        this.chooseStat();
      });
      children.push(card);
      return card;
    });
    this.levelBox = this.add.container(0, 0, children).setVisible(false).setDepth(60);
  }

  private showLevelUp(): void {
    this.levelBox.setVisible(true);
    this.levelTitle.setText(`レベルアップ！  Lv ${session.data.level}\n伸ばす力を 1 つ選ぼう`);
    this.refreshCards();
  }

  private refreshCards(): void {
    this.levelCards.forEach((card, i) => {
      const box = card.list[0] as Phaser.GameObjects.Rectangle;
      const on = i === this.choiceIndex;
      box.setStrokeStyle(on ? 5 : 3, on ? 0xfff3a0 : 0x666688);
      card.setScale(on ? 1.06 : 1);
    });
  }

  private updateLevelUp(): void {
    const c = controlsRef.current;
    if (!c) return;
    if (c.justDown('left')) this.choiceIndex = (this.choiceIndex + 2) % 3;
    if (c.justDown('right')) this.choiceIndex = (this.choiceIndex + 1) % 3;
    this.refreshCards();
    if (c.justDown('jump') || c.justDown('attack')) this.chooseStat();
  }

  private chooseStat(): void {
    const t = this.current as Extract<UiTask, { type: 'levelup' }>;
    applyLevelChoice(session.data, CHOICES[this.choiceIndex].key);
    this.toast(`${CHOICES[this.choiceIndex].label} が上がった！`);
    t.count -= 1;
    if (t.count > 0) {
      this.openedAt = this.time.now;
      this.showLevelUp();
    } else {
      this.next();
    }
  }

  // ---------------------------------------------------------------- toasts

  private toast(text: string): void {
    const W = this.scale.width;
    const t = this.add
      .text(W / 2, 30, text, { fontFamily: FONT, fontSize: '20px', color: '#ffffff', stroke: '#000', strokeThickness: 4, align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(70);
    this.toasts.push(t);
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
    let y = 30;
    for (const t of this.toasts) {
      t.setY(y);
      y += t.height + 4;
    }
  }

  // ---------------------------------------------------------------- touch

  private buildTouch(W: number, H: number): void {
    this.input.addPointer(3);
    const pad = (x: number, y: number, r: number, label: string, btn: ButtonName) => {
      const c = this.add.circle(x, y, r, 0xffffff, 0.15).setStrokeStyle(2, 0xffffff, 0.4).setDepth(40).setInteractive();
      this.add.text(x, y, label, { fontFamily: FONT, fontSize: `${Math.round(Math.min(r * 0.7, (r * 1.5) / label.length))}px`, color: '#ffffff' }).setOrigin(0.5).setAlpha(0.7).setDepth(41);
      const set = (v: boolean) => {
        session.touch[btn] = v;
        c.setFillStyle(0xffffff, v ? 0.35 : 0.15);
      };
      c.on('pointerdown', () => set(true));
      c.on('pointerup', () => set(false));
      c.on('pointerout', () => set(false));
    };
    const bx = 120;
    const by = H - 120;
    pad(bx - 70, by, 42, '◀', 'left');
    pad(bx + 70, by, 42, '▶', 'right');
    pad(bx, by - 70, 36, '▲', 'up');
    pad(bx, by + 70, 36, '▼', 'down');
    pad(W - 90, H - 90, 52, 'ジャンプ', 'jump');
    pad(W - 200, H - 120, 46, '剣', 'attack');
    pad(W - 110, H - 215, 38, '魔法', 'magic');
  }

  // ---------------------------------------------------------------- frame

  update(_time: number, delta: number): void {
    this.drawStatus();
    const t = this.current;
    if (!t) return;
    const ready = this.time.now - this.openedAt > 150;
    const c = controlsRef.current;
    if (t.type === 'dialog') {
      const advance = ready && !!c && (c.justDown('jump') || c.justDown('attack') || c.justDown('up'));
      this.updateDialog(delta / 1000, advance);
    } else if (ready) {
      this.updateLevelUp();
    }
  }

  private drawStatus(): void {
    const d = session.data;
    const g = this.g.clear();

    // Hearts: one heart = 2 HP.
    const hearts = Math.ceil(d.hpMax / 2);
    for (let i = 0; i < hearts; i++) {
      const x = 20 + i * 30;
      const fill = Phaser.Math.Clamp(d.hp - i * 2, 0, 2);
      g.fillStyle(0x3a1a22).fillRect(x, 16, 24, 20);
      if (fill > 0) g.fillStyle(0xe8425a).fillRect(x, 16, fill === 2 ? 24 : 12, 20);
      g.lineStyle(2, 0x000000).strokeRect(x, 16, 24, 20);
    }
    // MP bar.
    const mpW = 8 + d.mpMax * 6;
    g.fillStyle(0x10203a).fillRect(20, 44, mpW, 12);
    g.fillStyle(0x5fa8ff).fillRect(20, 44, (mpW * d.mp) / d.mpMax, 12);
    g.lineStyle(2, 0x000000).strokeRect(20, 44, mpW, 12);

    this.stats.setText(`Lv ${d.level}   EXP ${d.exp}/${expToNext(d.level)}   灯貨 ${d.coins}   HP ${Math.max(0, d.hp)}/${d.hpMax}  MP ${d.mp}/${d.mpMax}`);

    // Boss bar.
    const boss = session.boss;
    if (boss) {
      const W = this.scale.width;
      const bw = 520;
      const x = (W - bw) / 2;
      const y = this.scale.height - 50;
      g.fillStyle(0x220a0a).fillRect(x, y, bw, 16);
      g.fillStyle(0xc0304a).fillRect(x, y, (bw * boss.hp) / boss.max, 16);
      g.lineStyle(2, 0x000000).strokeRect(x, y, bw, 16);
      this.bossName.setText(boss.name).setVisible(true);
    } else {
      this.bossName.setVisible(false);
    }
  }
}
