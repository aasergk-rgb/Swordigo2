// On-screen touch controls, drawn as an HTML layer over the whole phone screen (not just
// the game canvas), so they sit at the very edges — in the black bars beside the game on
// wide phones. Every finger that started on a control is tracked, so a thumb can slide
// across the D-pad or onto another button without lifting.
import type Phaser from 'phaser';
import { IC, ICON } from './art/icons';
import { SPELL_ORDER } from './data/items';
import { inputMode, onInputMode } from './inputMode';
import { session, type ButtonName } from './session';
import { FONT } from './ui';

interface Ctl {
  el: HTMLDivElement;
  btn: ButtonName | 'dpad' | 'context';
  visible: () => boolean;
  icon?: HTMLDivElement;
  count?: HTMLSpanElement;
  label?: HTMLSpanElement;
}

const CSS = `
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: ${FONT}; user-select: none; -webkit-user-select: none; }
#touch.off { display: none; }
#touch.dim .ctl { opacity: 0.2; pointer-events: none; }
#touch .ctl { position: absolute; pointer-events: auto; border-radius: 50%; box-sizing: border-box;
  background: rgba(0,0,0,0.28); border: 3px solid rgba(255,255,255,0.45); color: #fff;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-shadow: 0 0 3px #000, 0 0 3px #000; touch-action: none; -webkit-tap-highlight-color: transparent; }
#touch .ctl.held { background: rgba(255,255,255,0.35); }
#touch .ctl.hidden { display: none; }
#touch .icon { width: 44%; height: 44%; background-size: cover; image-rendering: pixelated; }
#touch .count { position: absolute; right: 8%; bottom: 6%; font-size: 3.2vh; }
#touch .dpad { border-radius: 50%; }
#touch .arrow { position: absolute; font-size: 6.5vh; opacity: 0.6; line-height: 1; transform: translate(-50%, -50%); }
#touch .arrow.on { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
#touch .context { border-radius: 999px; background: rgba(255,243,160,0.93); border-color: rgba(58,42,16,0.8);
  color: #1a1030; text-shadow: none; font-size: 5.2vh; font-weight: bold; }
#touch .context.held { background: #fff; }
`;

export class TouchOverlay {
  private root: HTMLDivElement;
  private ctls: Ctl[] = [];
  private dpad!: { el: HTMLDivElement; arrows: Record<'left' | 'right' | 'up' | 'down', HTMLSpanElement> };
  /** Fingers that started on a control: identifier → position. */
  private fingers = new Map<number, { x: number; y: number }>();
  private iconUrls: Record<number, string> = {};

  constructor(private game: Phaser.Game) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'touch';
    document.body.appendChild(this.root);
    this.build();

    const track = (e: TouchEvent) => {
      let mine = false;
      for (const t of Array.from(e.changedTouches)) {
        if (e.type === 'touchstart') {
          if (this.ctls.some((c) => c.el.contains(t.target as Node))) this.fingers.set(t.identifier, { x: t.clientX, y: t.clientY });
        } else if (this.fingers.has(t.identifier)) {
          if (e.type === 'touchmove') this.fingers.set(t.identifier, { x: t.clientX, y: t.clientY });
          else this.fingers.delete(t.identifier);
        } else continue;
        mine = true;
      }
      if (mine) {
        e.preventDefault();
        this.recompute();
      }
    };
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) document.addEventListener(type, track, { passive: false });

    this.setEnabled(inputMode.current === 'touch');
    onInputMode((m) => this.setEnabled(m === 'touch'));
    const loop = () => {
      this.update();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private setEnabled(on: boolean): void {
    this.root.classList.toggle('off', !on);
    if (!on) {
      this.fingers.clear();
      session.touch = {};
    }
  }

  private build(): void {
    const mk = (cls: string, css: Partial<CSSStyleDeclaration>) => {
      const el = document.createElement('div');
      el.className = `ctl ${cls}`;
      Object.assign(el.style, css);
      this.root.appendChild(el);
      return el;
    };
    // D-pad: bottom-left corner of the phone screen.
    const dpadEl = mk('dpad', { left: '2vw', bottom: '5vh', width: '46vh', height: '46vh' });
    const arrow = (s: string, x: string, y: string) => {
      const a = document.createElement('span');
      a.className = 'arrow';
      a.textContent = s;
      Object.assign(a.style, { left: x, top: y });
      dpadEl.appendChild(a);
      return a;
    };
    this.dpad = { el: dpadEl, arrows: { left: arrow('◀', '20%', '50%'), right: arrow('▶', '80%', '50%'), up: arrow('▲', '50%', '20%'), down: arrow('▼', '50%', '80%') } };
    this.ctls.push({ el: dpadEl, btn: 'dpad', visible: () => true });

    const d = () => session.data;
    const spells = () => SPELL_ORDER.filter((s) => d().abilities[s]).length;
    const button = (btn: ButtonName, size: number, pos: Partial<CSSStyleDeclaration>, text: string, visible: () => boolean, icon?: number, withCount = false) => {
      const el = mk('', { width: `${size}vh`, height: `${size}vh`, fontSize: `${Math.min(size * 0.26, (size * 0.8) / text.length)}vh`, ...pos });
      const c: Ctl = { el, btn, visible };
      if (icon !== undefined) {
        c.icon = document.createElement('div');
        c.icon.className = 'icon';
        c.icon.dataset.icon = String(icon);
        el.appendChild(c.icon);
      }
      c.label = document.createElement('span');
      c.label.textContent = text;
      el.appendChild(c.label);
      if (withCount) {
        c.count = document.createElement('span');
        c.count.className = 'count';
        el.appendChild(c.count);
      }
      this.ctls.push(c);
      return c;
    };
    // Action buttons: bottom-right corner, big enough for thumbs.
    button('jump', 30, { right: '2vw', bottom: '5vh' }, 'ジャンプ', () => true);
    button('attack', 26, { right: 'calc(2vw + 30vh)', bottom: '12vh' }, '剣', () => true, IC.sword);
    button('magic', 22, { right: 'calc(2vw + 20vh)', bottom: '36vh' }, '魔法', () => spells() > 0, IC.bolt);
    button('switch', 15, { right: 'calc(2vw + 44vh)', bottom: '40vh' }, '切替', () => spells() > 1);
    // Small buttons: a column at the right edge (the black bar on wide phones).
    button('menu', 14, { right: '2vw', top: '3vh' }, 'MENU', () => true);
    button('heal', 14, { right: '2vw', top: '19vh' }, '回復', () => true, IC.potion, true);
    button('ether', 14, { right: '2vw', top: '35vh' }, 'MP', () => d().items.ether > 0, IC.ether, true);
    // Context button: shows the verb for what can be used right now.
    const ctx = mk('context hidden', { right: 'calc(2vw + 58vh)', bottom: '6vh', width: '26vh', height: '14vh' });
    this.ctls.push({ el: ctx, btn: 'context', visible: () => !!session.interactHint });
  }

  /** Builds icon images from the game's generated icon strip once it exists. */
  private ensureIcons(): void {
    if (Object.keys(this.iconUrls).length || !this.game.textures.exists('icons')) return;
    const src = this.game.textures.get('icons').getSourceImage() as HTMLCanvasElement;
    const c = document.createElement('canvas');
    c.width = c.height = ICON;
    const ctx = c.getContext('2d')!;
    for (let i = 0; i * ICON < src.width; i++) {
      ctx.clearRect(0, 0, ICON, ICON);
      ctx.drawImage(src, i * ICON, 0, ICON, ICON, 0, 0, ICON, ICON);
      this.iconUrls[i] = c.toDataURL();
    }
  }

  private recompute(): void {
    const t: Partial<Record<ButtonName, boolean>> = {};
    if (!session.uiBlocking) {
      const pad = this.dpad.el.getBoundingClientRect();
      for (const { x, y } of this.fingers.values()) {
        const cx = pad.left + pad.width / 2;
        const cy = pad.top + pad.height / 2;
        const r = pad.width / 2;
        const dx = x - cx;
        const dy = y - cy;
        if (Math.hypot(dx, dy) < r * 1.3) {
          const dead = r * 0.25;
          if (dx < -dead) t.left = true;
          if (dx > dead) t.right = true;
          if (dy < -dead * 1.4) t.up = true;
          if (dy > dead * 1.4) t.down = true;
          continue;
        }
        for (const c of this.ctls) {
          if (c.btn === 'dpad' || c.el.classList.contains('hidden')) continue;
          const b = c.el.getBoundingClientRect();
          if (x >= b.left - 6 && x <= b.right + 6 && y >= b.top - 6 && y <= b.bottom + 6) {
            if (c.btn === 'context') t.up = true;
            else t[c.btn] = true;
          }
        }
      }
    }
    session.touch = t;
  }

  private update(): void {
    if (this.root.classList.contains('off')) return;
    this.ensureIcons();
    this.root.classList.toggle('dim', session.uiBlocking);
    if (session.uiBlocking && Object.keys(session.touch).length) session.touch = {};
    const held = session.touch;
    for (const [k, a] of Object.entries(this.dpad.arrows)) a.classList.toggle('on', !!held[k as ButtonName]);
    const d = session.data;
    for (const c of this.ctls) {
      c.el.classList.toggle('hidden', !c.visible());
      if (c.btn === 'context') {
        c.el.textContent = session.interactHint ?? '';
        c.el.classList.toggle('held', !!held.up);
        continue;
      }
      if (c.btn !== 'dpad') c.el.classList.toggle('held', !!held[c.btn]);
      if (c.icon) {
        const n = c.btn === 'magic' ? IC[d.spell] : Number(c.icon.dataset.icon);
        const url = this.iconUrls[n];
        if (url && c.icon.dataset.url !== url) {
          c.icon.style.backgroundImage = `url(${url})`;
          c.icon.dataset.url = url;
        }
      }
      if (c.btn === 'attack' && c.label && d.abilities.charge && c.label.textContent === '剣') {
        c.label.textContent = '剣（長押し）';
        c.el.style.fontSize = '3.4vh';
      }
      if (c.count) c.count.textContent = String(c.btn === 'heal' ? d.items.potion + d.items.bigPotion : d.items.ether);
    }
  }
}
