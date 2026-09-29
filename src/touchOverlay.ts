// On-screen touch controls, drawn as an HTML layer over the whole phone screen (not just
// the game canvas), so they sit at the very edges — in the black bars beside the game on
// wide phones. Every finger that started on a control is tracked, so a thumb can slide
// between ◀ and ▶ or onto another button without lifting.
import type Phaser from 'phaser';
import { IC, ICON } from './art/icons';
import { SPELL_ORDER } from './data/items';
import { inputMode, onInputMode } from './inputMode';
import { session, type ButtonName } from './session';
import { FONT } from './ui';

interface Ctl {
  el: HTMLDivElement;
  btn: ButtonName | 'move' | 'context';
  visible: () => boolean;
  icon?: HTMLDivElement;
  count?: HTMLSpanElement;
  label?: HTMLSpanElement;
}

const CSS = `
#touch { --u: min(1vh, 0.5625vw); --el: max(2vw, env(safe-area-inset-left)); --er: max(2vw, env(safe-area-inset-right)); position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: ${FONT}; user-select: none; -webkit-user-select: none; }
#touch.off, #touch.away { display: none; }
#touch.dim .ctl { opacity: 0.2; pointer-events: none; }
#touch .ctl { position: absolute; pointer-events: auto; border-radius: 50%; box-sizing: border-box;
  background: rgba(0,0,0,0.28); border: 3px solid rgba(255,255,255,0.45); color: #fff;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-shadow: 0 0 3px #000, 0 0 3px #000; touch-action: none; -webkit-tap-highlight-color: transparent; }
#touch .ctl.held { background: rgba(255,255,255,0.35); }
#touch .ctl.hidden { display: none; }
#touch .icon { width: 44%; height: 44%; background-size: cover; image-rendering: pixelated; }
#touch .count { position: absolute; right: 8%; bottom: 6%; font-size: calc(3.2 * var(--u)); }
#touch .move { flex-direction: row; border-radius: calc(15 * var(--u)); overflow: hidden; }
#touch .half { flex: 1; height: 100%; display: flex; align-items: center; justify-content: center; font-size: calc(11 * var(--u)); }
#touch .half + .half { border-left: 3px solid rgba(255,255,255,0.3); }
#touch .half.on { background: rgba(255,255,255,0.35); }
#touch .context { border-radius: 999px; background: rgba(255,243,160,0.93); border-color: rgba(58,42,16,0.8);
  color: #1a1030; text-shadow: none; font-size: calc(5.2 * var(--u)); font-weight: bold; }
#touch .context.held { background: #fff; }
`;

export class TouchOverlay {
  private root: HTMLDivElement;
  private ctls: Ctl[] = [];
  private move!: { el: HTMLDivElement; left: HTMLDivElement; right: HTMLDivElement };
  /** Fingers that started on a control: identifier → position. */
  private fingers = new Map<number, { x: number; y: number }>();
  private menuEl!: HTMLDivElement;
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
    // Movement: one wide ◀ ▶ bar in the bottom-left corner. Which half is held depends
    // only on which side of its middle the thumb is, so sliding across switches direction.
    const moveEl = mk('move', { left: 'var(--el)', bottom: 'calc(5 * var(--u))', width: 'calc(64 * var(--u))', height: 'calc(30 * var(--u))' });
    const half = (s: string) => {
      const h = document.createElement('div');
      h.className = 'half';
      h.textContent = s;
      moveEl.appendChild(h);
      return h;
    };
    this.move = { el: moveEl, left: half('◀'), right: half('▶') };
    this.ctls.push({ el: moveEl, btn: 'move', visible: () => true });

    const d = () => session.data;
    const spells = () => SPELL_ORDER.filter((s) => d().abilities[s]).length;
    const button = (btn: ButtonName, size: number, pos: Partial<CSSStyleDeclaration>, text: string, visible: () => boolean, icon?: number, withCount = false) => {
      const el = mk('', { width: `calc(${size} * var(--u))`, height: `calc(${size} * var(--u))`, fontSize: `calc(${Math.min(size * 0.26, (size * 0.8) / text.length)} * var(--u))`, ...pos });
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
    // Up (upward slash) and down (downward thrust in the air), small, above the move bar.
    button('up', 15, { left: 'calc(var(--el) + calc(13 * var(--u)))', bottom: 'calc(38 * var(--u))' }, '▲', () => true);
    button('down', 15, { left: 'calc(var(--el) + calc(36 * var(--u)))', bottom: 'calc(38 * var(--u))' }, '▼', () => true);
    button('jump', 30, { right: 'var(--er)', bottom: 'calc(5 * var(--u))' }, 'ジャンプ', () => true);
    button('attack', 26, { right: 'calc(var(--er) + calc(30 * var(--u)))', bottom: 'calc(12 * var(--u))' }, '剣', () => true, IC.sword);
    button('magic', 22, { right: 'calc(var(--er) + calc(20 * var(--u)))', bottom: 'calc(36 * var(--u))' }, '魔法', () => spells() > 0, IC.bolt);
    button('switch', 15, { right: 'calc(var(--er) + calc(44 * var(--u)))', bottom: 'calc(40 * var(--u))' }, '切替', () => spells() > 1);
    // Small buttons: a column at the right edge (the black bar on wide phones).
    this.menuEl = button('menu', 14, { right: 'var(--er)', top: 'calc(3 * var(--u))' }, 'MENU', () => true).el;
    button('heal', 14, { right: 'var(--er)', top: 'calc(19 * var(--u))' }, '回復', () => true, IC.potion, true);
    button('ether', 14, { right: 'var(--er)', top: 'calc(35 * var(--u))' }, 'MP', () => d().items.ether > 0, IC.ether, true);
    // Context button: shows the verb for what can be used right now.
    const ctx = mk('context hidden', { right: 'calc(var(--er) + calc(58 * var(--u)))', bottom: 'calc(6 * var(--u))', width: 'calc(26 * var(--u))', height: 'calc(14 * var(--u))' });
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
      const bar = this.move.el.getBoundingClientRect();
      for (const { x, y } of this.fingers.values()) {
        // Generous margins around the move bar, except upwards where ▲ ▼ sit.
        if (x >= bar.left - 40 && x <= bar.right + 20 && y >= bar.top - 6 && y <= bar.bottom + 40) {
          if (x < bar.left + bar.width / 2) t.left = true;
          else t.right = true;
          continue;
        }
        for (const c of this.ctls) {
          if (c.btn === 'move' || c.el.classList.contains('hidden')) continue;
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
    // Only shown while playing, not on the title or ending screens.
    const away = !this.game.scene.isActive('Game');
    if (away !== this.root.classList.contains('away')) {
      this.root.classList.toggle('away', away);
      this.fingers.clear();
      session.touch = {};
    }
    if (this.root.classList.contains('off') || away) {
      session.hudInsetRight = 0;
      return;
    }
    this.ensureIcons();
    this.root.classList.toggle('dim', session.uiBlocking);
    if (session.uiBlocking && Object.keys(session.touch).length) session.touch = {};
    const held = session.touch;
    // Where the right button column overlaps the canvas (no black bar to sit in), the HUD moves left.
    const canvas = this.game.canvas.getBoundingClientRect();
    const col = this.menuEl.getBoundingClientRect();
    session.hudInsetRight = canvas.width ? Math.max(0, Math.ceil(((canvas.right - col.left + 6) * this.game.scale.width) / canvas.width)) : 0;
    this.move.left.classList.toggle('on', !!held.left);
    this.move.right.classList.toggle('on', !!held.right);
    const d = session.data;
    for (const c of this.ctls) {
      c.el.classList.toggle('hidden', !c.visible());
      if (c.btn === 'context') {
        c.el.textContent = session.interactHint ?? '';
        c.el.classList.toggle('held', !!held.up);
        continue;
      }
      if (c.btn !== 'move') c.el.classList.toggle('held', !!held[c.btn]);
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
        c.el.style.fontSize = 'calc(3.4 * var(--u))';
      }
      if (c.count) c.count.textContent = String(c.btn === 'heal' ? d.items.potion + d.items.bigPotion : d.items.ether);
    }
  }
}
