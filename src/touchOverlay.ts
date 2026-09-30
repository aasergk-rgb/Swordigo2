// On-screen touch controls, drawn as an HTML layer over the whole phone screen (not just
// the game canvas), so they can sit at the very edges. Every finger that started on a
// control is tracked, so a thumb can slide between directions or onto another button.
// The layout editor (from the menu's settings tab) moves and resizes the controls and the
// HUD blocks; see settings.ts.
import type Phaser from 'phaser';
import { IC, ICON } from './art/icons';
import { cross, glyph, medallion, plate } from './art/touchArt';
import { SPELL_ORDER } from './data/items';
import { inputMode, onInputMode } from './inputMode';
import { session, type ButtonName } from './session';
import { onSettings, resetLayout, saveSettings, settings, type CtlId, type HudId } from './settings';
import { FONT } from './ui';

/** Screen metrics in CSS pixels: `u` is 1% of a 16:9 screen's height. */
interface Metrics {
  W: number;
  H: number;
  u: number;
  el: number;
  er: number;
}

interface Ctl {
  id: CtlId;
  el: HTMLDivElement;
  /** Width and height in `u`. */
  base: [number, number];
  /** Default centre. */
  home: (m: Metrics) => [number, number];
  /** Shown in play (the editor shows every control of the chosen movement type). */
  visible: () => boolean;
  btn?: ButtonName | 'context';
  round?: boolean;
  icon?: HTMLDivElement;
  cap?: HTMLSpanElement;
  count?: HTMLSpanElement;
}

type Dir = 'left' | 'right' | 'up' | 'down';

// Canvas-space size of the HUD blocks, for the editor's handles.
const STATUS_BOX = { x: 14, y: 8, w: 330, h: 125 };
const PURSE_BOX = { w: 220, h: 112 };

const CSS = `
#touch { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: ${FONT}; user-select: none; -webkit-user-select: none; }
#touch.off:not(.edit), #touch.away { display: none; }
#touch .ctl { position: absolute; pointer-events: auto; touch-action: none; box-sizing: border-box; -webkit-tap-highlight-color: transparent;
  display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1;
  background-size: 100% 100%; image-rendering: pixelated; color: #ffe8b0; font-weight: bold;
  text-shadow: 1px 1px 0 #120a20, -1px 1px 0 #120a20, 1px -1px 0 #120a20, -1px -1px 0 #120a20, 0 0 3px #120a20; }
#touch .ctl.hidden, #touch .ctl.gone { display: none; }
#touch.edit .ctl.hidden:not(.gone) { display: flex; }
#touch.dim:not(.edit) .ctl { opacity: 0.2 !important; pointer-events: none; }
#touch .icon { width: 46%; height: 46%; background: center / contain no-repeat; image-rendering: pixelated; }
#touch .cap { margin-top: 3%; white-space: nowrap; }
#touch .count { position: absolute; right: 12%; bottom: 10%; }
#touch .half { position: absolute; top: 0; bottom: 0; width: 50%; background-size: 100% 100%; image-rendering: pixelated;
  display: flex; align-items: center; justify-content: center; }
#touch .half .icon { width: 40%; height: 52%; }
#touch .layer { position: absolute; inset: 0; background-size: 100% 100%; image-rendering: pixelated; display: none; }
#touch .layer.on { display: block; }
#touch .arm { position: absolute; width: 18%; height: 18%; background: center / contain no-repeat; image-rendering: pixelated; transform: translate(-50%, -50%); }
#touch .context { color: #2a1a10; text-shadow: 0 1px 0 #fff3c0; }
#touch .edit-bg, #touch .hudbox, #touch .toolbar { display: none; }
#touch.edit .edit-bg { display: block; position: absolute; inset: 0; background: rgba(10, 6, 24, 0.55); pointer-events: auto; }
#touch.edit .ctl { opacity: 1 !important; outline: 2px dashed rgba(255, 224, 138, 0.55); outline-offset: 2px; }
#touch.edit .hudbox { display: flex; position: absolute; box-sizing: border-box; align-items: center; justify-content: center; pointer-events: auto; touch-action: none;
  border: 2px dashed #ffe08a; background: rgba(255, 224, 138, 0.14); color: #ffe08a; font-weight: bold; text-shadow: 0 0 3px #000; }
#touch.edit .sel { outline: 3px solid #fff3a0 !important; box-shadow: 0 0 12px #ffc850; }
#touch.edit .toolbar { display: flex; flex-direction: column; align-items: center; gap: 0.6em; position: absolute; left: 50%; top: 34%; transform: translate(-50%, -50%);
  pointer-events: auto; background: rgba(18, 10, 32, 0.94); border: 3px solid #c9a44a; border-radius: 10px; padding: 0.8em 1.1em; color: #ffe8b0; text-align: center; }
#touch .toolbar .row { display: flex; gap: 0.5em; }
#touch .toolbar button { font: inherit; font-weight: bold; color: #ffe8b0; background: #2a1e52; border: 2px solid #c9a44a; border-radius: 6px; padding: 0.35em 0.8em; touch-action: manipulation; }
#touch .toolbar button:disabled { opacity: 0.35; }
#touch .toolbar button.go { background: #c9a44a; color: #1a1030; }
`;

export class TouchOverlay {
  private root: HTMLDivElement;
  private probe: HTMLDivElement;
  private ctls: Ctl[] = [];
  private byId = {} as Record<CtlId, Ctl>;
  private halves!: Record<'left' | 'right', HTMLDivElement>;
  private arms!: Record<Dir, HTMLDivElement>;
  private hudBoxes = {} as Record<HudId, HTMLDivElement>;
  private toolbar!: { el: HTMLDivElement; smaller: HTMLButtonElement; bigger: HTMLButtonElement };
  /** Fingers that started on a control: identifier → position. */
  private fingers = new Map<number, { x: number; y: number }>();
  private iconUrls: Record<number, string> = {};
  private editing: { done: () => void; sel: CtlId | HudId | null } | null = null;

  constructor(private game: Phaser.Game) {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    this.root = document.createElement('div');
    this.root.id = 'touch';
    document.body.appendChild(this.root);
    // Reads the screen's safe-area insets (camera cut-outs) in pixels.
    this.probe = document.createElement('div');
    Object.assign(this.probe.style, { position: 'fixed', visibility: 'hidden', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' });
    document.body.appendChild(this.probe);
    this.build();

    const track = (e: TouchEvent) => {
      if (this.editing) return;
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
    onSettings(() => this.place());
    window.addEventListener('resize', () => this.place());
    game.events.on('ui:edit', (done: () => void) => this.startEdit(done));
    this.place();
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

  // ================================================================ building

  private build(): void {
    const bg = document.createElement('div');
    bg.className = 'edit-bg';
    this.root.appendChild(bg);
    bg.addEventListener('pointerdown', () => this.select(null));

    const d = () => session.data;
    const spells = () => SPELL_ORDER.filter((s) => d().abilities[s]).length;
    const bar = () => settings.pad === 'bar';
    const add = (c: Omit<Ctl, 'el'> & { cls?: string }) => {
      const el = document.createElement('div');
      el.className = `ctl ${c.cls ?? ''}`;
      this.root.appendChild(el);
      const ctl: Ctl = { ...c, el };
      this.ctls.push(ctl);
      this.byId[c.id] = ctl;
      this.draggable(el, c.id);
      return ctl;
    };
    const iconDiv = (parent: HTMLElement, url?: string) => {
      const i = document.createElement('div');
      i.className = 'icon';
      if (url) i.style.backgroundImage = `url(${url})`;
      parent.appendChild(i);
      return i;
    };

    // Movement, type 1: a wide ◀ ▶ bar. Which half is held depends only on which side of
    // its middle the thumb is, so sliding across turns around.
    const move = add({ id: 'move', base: [64, 30], home: (m) => [m.el + 32 * m.u, m.H - 20 * m.u], visible: bar });
    const half = (side: 'left' | 'right') => {
      const h = document.createElement('div');
      h.className = 'half';
      h.style[side] = '0';
      iconDiv(h, glyph(side));
      move.el.appendChild(h);
      return h;
    };
    this.halves = { left: half('left'), right: half('right') };
    // Small ▲ ▼ for upward slashes and downward thrusts.
    const small = (id: 'up' | 'down', dx: number) =>
      add({ id, btn: id, round: true, base: [15, 15], home: (m) => [m.el + dx * m.u, m.H - 45.5 * m.u], visible: bar });
    iconDiv(small('up', 20.5).el, glyph('up'));
    iconDiv(small('down', 43.5).el, glyph('down'));

    // Movement, type 2: a D-pad.
    const pad = add({ id: 'dpad', base: [44, 44], home: (m) => [m.el + 24 * m.u, m.H - 27 * m.u], visible: () => !bar() });
    pad.el.style.backgroundImage = `url(${cross()})`;
    const layer = (dir: Dir) => {
      const l = document.createElement('div');
      l.className = 'layer';
      l.style.backgroundImage = `url(${cross(dir)})`;
      pad.el.appendChild(l);
      return l;
    };
    this.arms = { left: layer('left'), right: layer('right'), up: layer('up'), down: layer('down') };
    for (const [dir, x, y] of [
      ['left', 17, 50],
      ['right', 83, 50],
      ['up', 50, 17],
      ['down', 50, 83],
    ] as const) {
      const a = document.createElement('div');
      a.className = 'arm';
      Object.assign(a.style, { left: `${x}%`, top: `${y}%`, backgroundImage: `url(${glyph(dir)})` });
      pad.el.appendChild(a);
    }

    // Action buttons: bottom-right, big enough for thumbs.
    const button = (id: CtlId & ButtonName, size: number, home: Ctl['home'], cap: string, visible: () => boolean, icon: number | string, withCount = false) => {
      const c = add({ id, btn: id, round: true, base: [size, size], home, visible });
      c.icon = iconDiv(c.el, typeof icon === 'string' ? glyph(icon) : undefined);
      if (typeof icon === 'number') c.icon.dataset.icon = String(icon);
      c.cap = document.createElement('span');
      c.cap.className = 'cap';
      c.cap.textContent = cap;
      c.el.appendChild(c.cap);
      if (withCount) {
        c.count = document.createElement('span');
        c.count.className = 'count';
        c.el.appendChild(c.count);
      }
      return c;
    };
    button('jump', 30, (m) => [m.W - m.er - 15 * m.u, m.H - 20 * m.u], 'ジャンプ', () => true, 'jump');
    button('attack', 26, (m) => [m.W - m.er - 43 * m.u, m.H - 25 * m.u], '剣', () => true, IC.sword);
    button('magic', 22, (m) => [m.W - m.er - 31 * m.u, m.H - 47 * m.u], '魔法', () => spells() > 0, IC.bolt);
    button('switch', 15, (m) => [m.W - m.er - 51.5 * m.u, m.H - 47.5 * m.u], '切替', () => spells() > 1, 'switch');
    // Small buttons: a column at the right edge.
    button('menu', 14, (m) => [m.W - m.er - 7 * m.u, 10 * m.u], 'メニュー', () => true, 'menu');
    button('heal', 14, (m) => [m.W - m.er - 7 * m.u, 26 * m.u], '回復', () => true, IC.potion, true);
    button('ether', 14, (m) => [m.W - m.er - 7 * m.u, 42 * m.u], 'MP', () => d().items.ether > 0, IC.ether, true);
    // Context button: shows the verb for what can be used right now.
    const ctx = add({ id: 'context', btn: 'context', base: [26, 14], home: (m) => [m.W - m.er - 71 * m.u, m.H - 13 * m.u], visible: () => !!session.interactHint, cls: 'context' });
    ctx.el.style.backgroundImage = `url(${plate(40, 20, true)})`;

    // Layout editor: handles for the HUD blocks and a toolbar.
    for (const [id, label] of [
      ['status', 'HP・MP'],
      ['purse', '灯貨・魔法'],
    ] as const) {
      const b = document.createElement('div');
      b.className = 'hudbox';
      b.textContent = label;
      this.root.appendChild(b);
      this.hudBoxes[id] = b;
      this.draggable(b, id);
    }
    const tb = document.createElement('div');
    tb.className = 'toolbar';
    tb.innerHTML = `<div class="title">ボタンとHP表示をドラッグして動かせます</div><div class="row"></div><div class="row"></div>`;
    const [row1, row2] = Array.from(tb.querySelectorAll<HTMLDivElement>('.row'));
    const btn = (row: HTMLDivElement, text: string, fn: () => void, cls = '') => {
      const b = document.createElement('button');
      b.textContent = text;
      b.className = cls;
      b.addEventListener('click', fn);
      row.appendChild(b);
      return b;
    };
    const smaller = btn(row1, '選んだボタンを小さく', () => this.resizeSel(-0.1));
    const bigger = btn(row1, '大きく', () => this.resizeSel(0.1));
    btn(row2, '元の配置に戻す', () => {
      resetLayout();
      this.select(null);
    });
    btn(row2, '完了', () => this.endEdit(), 'go');
    this.root.appendChild(tb);
    this.toolbar = { el: tb, smaller, bigger };
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

  // ================================================================ layout

  private metrics(): Metrics {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const cs = getComputedStyle(this.probe);
    return { W, H, u: Math.min(H, W * 0.5625) / 100, el: Math.max(W * 0.02, parseFloat(cs.paddingLeft) || 0), er: Math.max(W * 0.02, parseFloat(cs.paddingRight) || 0) };
  }

  private centre(c: Ctl, m: Metrics): [number, number] {
    const p = settings.layout[c.id];
    return p ? [p.x * m.W, p.y * m.H] : c.home(m);
  }

  /** Positions and sizes every control from the defaults and the player's settings. */
  private place(): void {
    const m = this.metrics();
    for (const c of this.ctls) {
      const k = m.u * settings.size * (settings.layout[c.id]?.s ?? 1);
      const w = c.base[0] * k;
      const h = c.base[1] * k;
      let [x, y] = this.centre(c, m);
      x = Math.min(m.W - w / 2, Math.max(w / 2, x));
      y = Math.min(m.H - h / 2, Math.max(h / 2, y));
      Object.assign(c.el.style, { left: `${x - w / 2}px`, top: `${y - h / 2}px`, width: `${w}px`, height: `${h}px`, opacity: String(settings.opacity) });
      if (c.round) c.el.style.fontSize = `${Math.min(h * 0.16, (w * 0.8) / Math.max(2, c.cap?.textContent?.length ?? 2))}px`;
      if (c.id === 'context') c.el.style.fontSize = `${h * 0.42}px`;
      if (c.count) c.count.style.fontSize = `${h * 0.2}px`;
      c.el.classList.toggle('gone', ['dpad', 'move', 'up', 'down'].includes(c.id) && (c.id === 'dpad') !== (settings.pad === 'dpad'));
    }
    this.toolbar.el.style.fontSize = `${Math.max(12, m.u * 3.6)}px`;
  }

  // ================================================================ play

  private recompute(): void {
    const t: Partial<Record<ButtonName, boolean>> = {};
    if (!session.uiBlocking) {
      const bar = this.byId.move.el.getBoundingClientRect();
      const pad = this.byId.dpad.el.getBoundingClientRect();
      for (const { x, y } of this.fingers.values()) {
        if (settings.pad === 'bar') {
          // Generous margins around the move bar, except upwards where ▲ ▼ sit.
          if (x >= bar.left - 40 && x <= bar.right + 20 && y >= bar.top - 6 && y <= bar.bottom + 40) {
            if (x < bar.left + bar.width / 2) t.left = true;
            else t.right = true;
            continue;
          }
        } else {
          const r = pad.width / 2;
          const dx = x - (pad.left + r);
          const dy = y - (pad.top + pad.height / 2);
          const dist = Math.hypot(dx, dy);
          if (dist < r * 1.3) {
            // Eight directions in 45° slices, with a small dead centre.
            if (dist > r * 0.18) {
              if (dx < -dist * 0.38) t.left = true;
              if (dx > dist * 0.38) t.right = true;
              if (dy < -dist * 0.38) t.up = true;
              if (dy > dist * 0.38) t.down = true;
            }
            continue;
          }
        }
        for (const c of this.ctls) {
          if (!c.btn || c.el.classList.contains('hidden') || c.el.classList.contains('gone')) continue;
          const b = c.el.getBoundingClientRect();
          if (x >= b.left - 6 && x <= b.right + 6 && y >= b.top - 6 && y <= b.bottom + 6) {
            if (c.btn === 'context') t.up = true;
            else t[c.btn] = true;
          }
        }
      }
    }
    for (const k of Object.keys(t) as ButtonName[]) if (!session.touch[k]) session.touchPressed[k] = true;
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
    if (away) return;
    this.ensureIcons();
    this.updateHud();
    if (this.root.classList.contains('off') && !this.editing) return;
    this.root.classList.toggle('dim', session.uiBlocking);
    if (session.uiBlocking && Object.keys(session.touch).length) session.touch = {};
    const held = session.touch;
    for (const side of ['left', 'right'] as const) {
      const url = plate(32, 30, !!held[side], side);
      const h = this.halves[side];
      if (h.dataset.url !== url) {
        h.style.backgroundImage = `url(${url})`;
        h.dataset.url = url;
      }
    }
    for (const dir of ['left', 'right', 'up', 'down'] as const) this.arms[dir].classList.toggle('on', !!held[dir]);
    const d = session.data;
    for (const c of this.ctls) {
      c.el.classList.toggle('hidden', !c.visible());
      if (c.id === 'context') {
        const text = session.interactHint ?? (this.editing ? '話す' : '');
        if (c.el.textContent !== text) c.el.textContent = text;
        c.el.style.filter = held.up ? 'brightness(1.25)' : '';
        continue;
      }
      if (c.round) {
        const url = medallion(!!(c.btn && held[c.btn as ButtonName]));
        if (c.el.dataset.url !== url) {
          c.el.style.backgroundImage = `url(${url})`;
          c.el.dataset.url = url;
        }
      }
      if (c.icon?.dataset.icon) {
        const n = c.id === 'magic' ? IC[d.spell] : Number(c.icon.dataset.icon);
        const url = this.iconUrls[n];
        if (url && c.icon.dataset.url !== url) {
          c.icon.style.backgroundImage = `url(${url})`;
          c.icon.dataset.url = url;
        }
      }
      if (c.id === 'attack' && c.cap && d.abilities.charge && c.cap.textContent === '剣') c.cap.textContent = '剣・長押し';
      if (c.count) c.count.textContent = String(c.id === 'heal' ? d.items.potion + d.items.bigPotion : d.items.ether);
    }
  }

  /** Tells the HUD where its blocks go, in canvas pixels. */
  private updateHud(): void {
    const cr = this.game.canvas.getBoundingClientRect();
    if (!cr.width) return;
    const W = this.game.scale.width;
    const H = this.game.scale.height;
    const k = W / cr.width;
    // Where buttons in the top right overlap the canvas (no black bar to sit in), the purse moves left.
    let inset = 0;
    if (!this.root.classList.contains('off')) {
      for (const c of this.ctls) {
        if (!c.btn || c.el.classList.contains('hidden') || c.el.classList.contains('gone')) continue;
        const b = c.el.getBoundingClientRect();
        if (b.top < cr.top + cr.height * 0.3 && b.left > cr.left + cr.width * 0.6 && b.left < cr.right) inset = Math.max(inset, Math.ceil((cr.right - b.left + 6) * k));
      }
    }
    const s = settings.hud.status;
    const p = settings.hud.purse;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const hud = {
      sx: s ? clamp((s.x * window.innerWidth - cr.left) * k - STATUS_BOX.x, -STATUS_BOX.x, W - STATUS_BOX.w - STATUS_BOX.x) : 0,
      sy: s ? clamp((s.y * window.innerHeight - cr.top) * k - STATUS_BOX.y, -STATUS_BOX.y, H - STATUS_BOX.h - STATUS_BOX.y) : 0,
      right: p ? clamp((p.x * window.innerWidth - cr.left) * k + 14, PURSE_BOX.w + 14, W) : W - inset,
      py: p ? clamp((p.y * window.innerHeight - cr.top) * k - 8, -8, H - PURSE_BOX.h - 8) : 0,
    };
    session.hud = hud;
    if (!this.editing) return;
    const box = (el: HTMLDivElement, x: number, y: number, w: number, h: number) =>
      Object.assign(el.style, { left: `${cr.left + x / k}px`, top: `${cr.top + y / k}px`, width: `${w / k}px`, height: `${h / k}px`, fontSize: `${Math.max(12, 22 / k)}px` });
    box(this.hudBoxes.status, STATUS_BOX.x + hud.sx, STATUS_BOX.y + hud.sy, STATUS_BOX.w, STATUS_BOX.h);
    box(this.hudBoxes.purse, hud.right - 14 - PURSE_BOX.w, 8 + hud.py, PURSE_BOX.w, PURSE_BOX.h);
  }

  // ================================================================ layout editor

  private startEdit(done: () => void): void {
    this.fingers.clear();
    session.touch = {};
    this.editing = { done, sel: null };
    this.root.classList.add('edit');
    this.select(null);
  }

  private endEdit(): void {
    const e = this.editing;
    if (!e) return;
    this.select(null);
    this.editing = null;
    this.root.classList.remove('edit');
    saveSettings();
    e.done();
  }

  private select(id: CtlId | HudId | null): void {
    if (this.editing) this.editing.sel = id;
    for (const c of this.ctls) c.el.classList.toggle('sel', c.id === id);
    for (const [k, b] of Object.entries(this.hudBoxes)) b.classList.toggle('sel', k === id);
    const isCtl = !!id && id in this.byId;
    this.toolbar.smaller.disabled = !isCtl;
    this.toolbar.bigger.disabled = !isCtl;
  }

  private resizeSel(step: number): void {
    const id = this.editing?.sel;
    if (!id || !(id in this.byId)) return;
    const c = this.byId[id as CtlId];
    const m = this.metrics();
    const [x, y] = this.centre(c, m);
    const s = Math.min(2, Math.max(0.5, (settings.layout[c.id]?.s ?? 1) + step));
    settings.layout[c.id] = { x: x / m.W, y: y / m.H, s };
    saveSettings();
  }

  /** In the editor, drags a control (by its centre) or a HUD block (by its corner). */
  private draggable(el: HTMLDivElement, id: CtlId | HudId): void {
    el.addEventListener('pointerdown', (e) => {
      if (!this.editing) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      this.select(id);
      const r = el.getBoundingClientRect();
      const hud = id === 'status' || id === 'purse';
      const ax = hud ? (id === 'purse' ? r.right : r.left) : r.left + r.width / 2;
      const ay = hud ? r.top : r.top + r.height / 2;
      const gx = e.clientX - ax;
      const gy = e.clientY - ay;
      const move = (ev: PointerEvent) => {
        const x = Math.min(1, Math.max(0, (ev.clientX - gx) / window.innerWidth));
        const y = Math.min(1, Math.max(0, (ev.clientY - gy) / window.innerHeight));
        if (hud) settings.hud[id as HudId] = { x, y };
        else {
          const s = settings.layout[id as CtlId]?.s;
          settings.layout[id as CtlId] = s === undefined ? { x, y } : { x, y, s };
          this.place();
        }
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        saveSettings();
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }
}
