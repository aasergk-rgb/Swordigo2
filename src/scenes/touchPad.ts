// On-screen controls for touch play. Every active finger is checked against the pad each
// frame, so a thumb can slide from ◀ to ▶ (or onto another button) without lifting.
import Phaser from 'phaser';
import { IC } from '../art/icons';
import { SPELL_ORDER } from '../data/items';
import { session, type ButtonName } from '../session';
import { FONT } from '../ui';

interface Btn {
  btn: ButtonName;
  x: number;
  y: number;
  r: number;
  label: string;
  icon?: number;
  visible: () => boolean;
  circle: Phaser.GameObjects.Arc;
  text: Phaser.GameObjects.Text;
  img?: Phaser.GameObjects.Image;
  count?: Phaser.GameObjects.Text;
}

export class TouchPad {
  private root: Phaser.GameObjects.Container;
  private dpad: { x: number; y: number; r: number; base: Phaser.GameObjects.Arc; arrows: Record<'left' | 'right' | 'up' | 'down', Phaser.GameObjects.Text> };
  private buttons: Btn[] = [];
  private context!: { pill: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; zone: Phaser.Geom.Rectangle };
  private enabled = true;

  constructor(private scene: Phaser.Scene) {
    const W = scene.scale.width;
    const H = scene.scale.height;
    this.root = scene.add.container(0, 0).setDepth(40);
    scene.input.addPointer(4);

    // D-pad.
    const dx = 132;
    const dy = H - 132;
    const r = 96;
    const base = scene.add.circle(dx, dy, r, 0x000000, 0.22).setStrokeStyle(3, 0xffffff, 0.35);
    const arrow = (x: number, y: number, s: string) => scene.add.text(x, y, s, { fontFamily: FONT, fontSize: '34px', color: '#ffffff' }).setOrigin(0.5).setAlpha(0.6);
    const arrows = { left: arrow(dx - 58, dy, '◀'), right: arrow(dx + 58, dy, '▶'), up: arrow(dx, dy - 58, '▲'), down: arrow(dx, dy + 58, '▼') };
    this.root.add([base, ...Object.values(arrows)]);
    this.dpad = { x: dx, y: dy, r, base, arrows };

    const d = () => session.data;
    const hasSpell = () => SPELL_ORDER.some((s) => d().abilities[s]);
    const add = (btn: ButtonName, x: number, y: number, rr: number, label: string, visible: () => boolean, icon?: number) => {
      const circle = scene.add.circle(x, y, rr, 0x000000, 0.25).setStrokeStyle(3, 0xffffff, 0.4);
      const text = scene.add.text(x, y + (icon !== undefined ? rr * 0.45 : 0), label, { fontFamily: FONT, fontSize: `${Math.round(Math.min(rr * 0.55, (rr * 1.6) / label.length))}px`, color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      const b: Btn = { btn, x, y, r: rr, label, icon, visible, circle, text };
      this.root.add([circle, text]);
      if (icon !== undefined) {
        b.img = scene.add.image(x, y - rr * 0.15, 'icons', icon).setScale(rr / 18);
        this.root.add(b.img);
      }
      this.buttons.push(b);
      return b;
    };
    add('jump', W - 96, H - 100, 62, 'ジャンプ', () => true);
    add('attack', W - 226, H - 128, 54, '剣', () => true, IC.sword);
    add('magic', W - 122, H - 236, 46, '魔法', hasSpell, IC.bolt);
    add('switch', W - 232, H - 246, 30, '切替', () => SPELL_ORDER.filter((s) => d().abilities[s]).length > 1);
    const heal = add('heal', W - 42, 170, 30, '回復', () => true, IC.potion);
    const ether = add('ether', W - 42, 236, 30, 'MP', () => d().items.ether > 0 || d().mpMax > 20, IC.ether);
    add('menu', W - 42, 302, 30, 'MENU', () => true);
    for (const b of [heal, ether]) {
      b.count = scene.add.text(b.x + b.r * 0.6, b.y + b.r * 0.55, '', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      this.root.add(b.count);
    }

    // Context button: appears with the right verb when something can be used ("話す", "開ける"...).
    const cx = W - 360;
    const cy = H - 70;
    const pill = scene.add.graphics();
    const text = scene.add.text(cx, cy, '', { fontFamily: FONT, fontSize: '24px', color: '#1a1030' }).setOrigin(0.5);
    this.root.add([pill, text]);
    this.context = { pill, text, zone: new Phaser.Geom.Rectangle(cx - 70, cy - 30, 140, 60) };

    const refresh = () => this.refresh();
    scene.input.on('pointerdown', refresh);
    scene.input.on('pointermove', refresh);
    scene.input.on('pointerup', refresh);
    scene.input.on('pointerupoutside', refresh);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.root.setVisible(on);
    if (!on) session.touch = {};
  }

  /** Recomputes which buttons are held from every finger on the screen. */
  private refresh(): void {
    const t: Partial<Record<ButtonName, boolean>> = {};
    if (this.enabled && !session.uiBlocking) {
      for (const p of this.scene.input.manager.pointers) {
        if (!p.isDown) continue;
        const { x, y } = p;
        const dx = x - this.dpad.x;
        const dy = y - this.dpad.y;
        if (Math.hypot(dx, dy) < this.dpad.r * 1.25) {
          const dead = this.dpad.r * 0.28;
          if (dx < -dead) t.left = true;
          if (dx > dead) t.right = true;
          if (dy < -dead * 1.4) t.up = true;
          if (dy > dead * 1.4) t.down = true;
          continue;
        }
        if (session.interactHint && this.context.zone.contains(x, y)) {
          t.up = true;
          continue;
        }
        for (const b of this.buttons) if (b.visible() && Math.hypot(x - b.x, y - b.y) < b.r * 1.15) t[b.btn] = true;
      }
    }
    session.touch = t;
  }

  update(): void {
    if (!this.enabled) return;
    // Hide the buttons while a dialog or menu is open: those are tapped directly.
    const show = !session.uiBlocking;
    this.root.setAlpha(show ? 1 : 0.25);
    if (!show && Object.keys(session.touch).length) session.touch = {};
    const held = session.touch;
    for (const [k, a] of Object.entries(this.dpad.arrows)) a.setAlpha(held[k as ButtonName] ? 1 : 0.55).setScale(held[k as ButtonName] ? 1.2 : 1);
    const d = session.data;
    for (const b of this.buttons) {
      const v = b.visible();
      b.circle.setVisible(v).setFillStyle(held[b.btn] ? 0xffffff : 0x000000, held[b.btn] ? 0.35 : 0.25);
      b.text.setVisible(v);
      b.img?.setVisible(v);
      if (b.btn === 'magic' && b.img) b.img.setFrame(IC[d.spell]);
      if (b.btn === 'attack' && b.img && d.abilities.charge) b.text.setText('剣(長押し)').setFontSize(13);
    }
    const [heal, ether] = [this.buttons.find((b) => b.btn === 'heal')!, this.buttons.find((b) => b.btn === 'ether')!];
    heal.count?.setText(String(d.items.potion + d.items.bigPotion)).setVisible(heal.circle.visible);
    ether.count?.setText(String(d.items.ether)).setVisible(ether.circle.visible);

    const hint = show ? session.interactHint : null;
    const c = this.context;
    c.pill.clear();
    c.text.setVisible(!!hint);
    if (hint) {
      const z = c.zone;
      const pressed = !!held.up;
      c.pill.fillStyle(pressed ? 0xffffff : 0xfff3a0, 0.92).fillRoundedRect(z.x, z.y, z.width, z.height, 28);
      c.pill.lineStyle(3, 0x3a2a10, 0.8).strokeRoundedRect(z.x, z.y, z.width, z.height, 28);
      c.text.setText(hint);
    }
  }
}
