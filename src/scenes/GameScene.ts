import Phaser from 'phaser';
import { DEATH_COIN_LOSS, RENDER_SCALE, SWORD, VIEW_H, VIEW_W } from '../config';
import { EVENTS } from '../data/events';
import { CONSUMABLES, EQUIPMENT, SPELL_ORDER, SPELLS } from '../data/items';
import { NPCS } from '../data/npcs';
import { ROOMS } from '../data/rooms/index';
import type { GameApi, Line, NpcHandle, RoomDef } from '../data/types';
import { BOSS_TITLES, type Boss, createBoss } from '../entities/bosses';
import { createEnemy, type Enemy, ENEMY_KINDS, type HitInfo, type HitResult, type ShotOptions, type World } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Controls, controlsRef } from '../input';
import { addExp, applyDeath, attackPower, coinGain, damageTaken, defense, giveEquipment, hasCharm, maxHp, swordDamage, takeKey, useEther, useHeal } from '../progress';
import { EV, saveGame, session } from '../session';
import { FONT } from '../ui';
import { checkCond, type Marker, parseRoom, type ParsedRoom, TI, TILE } from '../world/parse';

interface SceneData {
  room: string;
  /** Link digit to arrive at, 'F' (spring), 'T' (beacon) or '@' (new game spawn). */
  at: string;
}

interface Projectile extends Phaser.Physics.Arcade.Image {
  owner: 'player' | 'enemy';
  damage: number;
  opts: ShotOptions;
  resting?: boolean;
  bornAt: number;
}

type Interactable =
  | { kind: 'sign'; img: Phaser.GameObjects.GameObject & { x: number; y: number }; text: string }
  | { kind: 'npc'; img: Phaser.GameObjects.Sprite; id: string; letter: string }
  | { kind: 'chest'; img: Phaser.GameObjects.Sprite; id: string; content: string; item?: string }
  | { kind: 'fountain'; img: Phaser.GameObjects.Sprite }
  | { kind: 'beacon'; img: Phaser.GameObjects.Sprite }
  | { kind: 'door'; img: Phaser.GameObjects.Sprite; marker: Marker }
  | { kind: 'lock'; img: Phaser.Physics.Arcade.Image; id: string; boss: boolean };

const DEPTH = { bg: -20, props: 1, objects: 3, enemies: 5, player: 10, water: 14, front: 16, fx: 18, dark: 30 };

export class GameScene extends Phaser.Scene implements World, GameApi {
  player!: Player;
  room!: RoomDef;
  roomId = '';
  private parsed!: ParsedRoom;
  private arriveAt = '@';
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private controls!: Controls;
  private enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private locks!: Phaser.Physics.Arcade.StaticGroup;
  private breakables: { img: Phaser.GameObjects.Sprite; kind: 'pot' | 'grass' }[] = [];
  private interactables: Interactable[] = [];
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private orbs: { img: Phaser.GameObjects.Sprite; id: string; lit: boolean }[] = [];
  private bombs: { img: Phaser.GameObjects.Sprite; t: number }[] = [];
  private lightSources: { x: () => number; y: () => number; r: number; flicker?: boolean }[] = [];
  private bgLayers: { img: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private prompt!: Phaser.GameObjects.Image;
  private darkRT: Phaser.GameObjects.RenderTexture | null = null;
  private lightStamp!: Phaser.GameObjects.Image;
  private waterRect: Phaser.GameObjects.Rectangle | null = null;
  private waterLine: Phaser.GameObjects.Rectangle | null = null;
  private lavaRect: Phaser.GameObjects.Rectangle | null = null;
  private lavaY = Infinity;
  private wardFx: Phaser.GameObjects.Image | null = null;
  private crumbling = new Map<string, number>();
  private boss: Enemy | null = null;
  private bossStarted = false;
  private hitstopUntil = 0;
  private busy = false; // dying or changing rooms
  /** Seconds left in which water can't slow the hop out of a floor link's hole. */
  private lift = 0;
  // Rewards of the people's lights (chapter 5): slow healing, and allies in the last fight.
  private regenT = 0;
  private allyT = 2;
  private allyTurn = 0;
  private scripting = 0; // running story scripts
  private lastSafe = new Phaser.Math.Vector2();
  private groundedTime = 0;
  private triggered = new Set<number>();
  private entered = 0;
  private generation = 0;

  constructor() {
    super('Game');
  }

  init(data: Partial<SceneData>): void {
    this.roomId = data.room && ROOMS[data.room] ? data.room : session.data.room;
    if (!ROOMS[this.roomId]) this.roomId = 'village';
    this.arriveAt = data.at ?? '@';
  }

  // ================================================================ build

  create(): void {
    this.room = ROOMS[this.roomId];
    this.parsed = parseRoom(this.room);
    this.enemies = [];
    this.breakables = [];
    this.interactables = [];
    this.npcSprites.clear();
    this.orbs = [];
    this.bombs = [];
    this.lightSources = [];
    this.bgLayers = [];
    this.crumbling.clear();
    this.triggered.clear();
    this.boss = null;
    this.bossStarted = false;
    this.busy = false;
    this.scripting = 0;
    this.generation++;
    this.hitstopUntil = 0;
    this.darkRT = null;
    this.waterRect = this.waterLine = this.lavaRect = null;
    this.wardFx = null;
    this.lavaY = Infinity;
    this.entered = this.time.now;
    session.boss = null;
    session.uiBlocking = false;
    session.interactHint = null;
    session.roomName = this.room.name;
    session.roomArea = this.room.area;
    const d = session.data;
    if (!d.visited.includes(this.roomId)) d.visited.push(this.roomId);

    this.controls = new Controls(this);
    controlsRef.current = this.controls;

    const w = this.roomW;
    const h = this.roomH;
    this.physics.world.setBounds(0, 0, w, h + 64);
    this.physics.world.setBoundsCollision(true, true, false, false);
    this.physics.world.resume();

    this.buildBackground();
    this.buildTiles();
    this.buildProps();

    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true });
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.pickups = this.physics.add.group();
    this.locks = this.physics.add.staticGroup();

    const spawn = this.spawnObjects();
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.setFlipX(spawn.face < 0);
    this.player.facing = spawn.face;
    this.player.standingOnPlatform = () => {
      const b = this.player.arcadeBody;
      return this.layer.getTileAtWorldXY(b.center.x, b.bottom + 2)?.index === TI.platform;
    };
    this.lastSafe.set(spawn.x, spawn.y);
    if (spawn.vy) {
      this.player.arcadeBody.setVelocityY(spawn.vy);
      this.lift = 0.5;
    }

    this.physics.add.collider(this.player, this.layer, undefined, (_p, t) => {
      const tile = t as Phaser.Tilemaps.Tile;
      if (tile.index === TI.platform && this.time.now < this.player.dropThroughUntil) return false;
      if (tile.index === TI.grid && this.player.rifting) return false;
      return true;
    });
    this.physics.add.collider(this.player, this.locks);
    this.physics.add.collider(this.enemyGroup, this.layer, undefined, (e) => !(e as Enemy).phasing);
    this.physics.add.collider(this.enemyGroup, this.locks);
    this.physics.add.collider(this.pickups, this.layer);
    this.physics.add.collider(
      this.projectiles,
      this.layer,
      (p) => this.projectileHitWall(p as Projectile),
      (p, t) => {
        const pr = p as Projectile;
        const tile = t as Phaser.Tilemaps.Tile;
        if (pr.opts.pierce) return false;
        if (tile.index === TI.platform) return !!pr.opts.gravity && !pr.opts.ground;
        return true;
      },
    );

    this.prompt = this.add.image(0, 0, 'prompt').setDepth(DEPTH.fx).setVisible(false);
    this.lightStamp = this.make.image({ key: 'light', add: false });
    this.buildEnvironment();

    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE);
    this.fitCamera();
    cam.startFollow(this.player, true, 0.15, 0.15, 0, 10);
    cam.setDeadzone(40, 30);
    cam.setRoundPixels(true);
    cam.fadeIn(180);

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');
    this.game.events.emit(EV.area, this.room.name);

    this.input.keyboard!.on('keydown-F1', () => this.debugUnlock());

    if (this.room.onEnter) this.time.delayedCall(250, () => this.runEvent(this.room.onEnter!));
  }

  /** Camera size and bounds for the current view size. */
  private fitCamera(): void {
    const cam = this.cameras.main;
    cam.setSize(this.scale.width, this.scale.height);
    // A room narrower than the view (only on very wide screens) is centred rather than pinned left.
    const padX = Math.max(0, VIEW_W - this.roomW) / 2;
    cam.setBounds(-padX, 0, this.roomW + padX * 2, this.roomH);
  }

  /** Rebuilds what depends on the view size after the window changed shape. */
  relayout(): void {
    this.fitCamera();
    for (const l of this.bgLayers) l.img.destroy();
    this.bgLayers = [];
    this.buildBackground();
    this.updateBackground();
    if (this.darkRT) {
      this.darkRT.destroy();
      this.darkRT = this.makeDarkRT();
    }
  }

  private makeDarkRT(): Phaser.GameObjects.RenderTexture {
    return this.add.renderTexture(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.dark);
  }

  get roomW(): number {
    return this.parsed.width * TILE;
  }

  get roomH(): number {
    return this.parsed.height * TILE;
  }

  get waterY(): number | null {
    const w = this.room.water;
    if (w === undefined) return null;
    if (typeof w === 'number') return w * TILE;
    const idx = session.data.vars[`water_${this.roomId}`] ?? 0;
    return w.levels[idx % w.levels.length] * TILE;
  }

  private buildBackground(): void {
    const theme = this.room.bg;
    const cam = this.cameras.main;
    cam.setBackgroundColor(0x000000);
    const layers: [string, number][] = [
      [`bg_${theme}_sky`, 0],
      [`bg_${theme}_far`, 0.2],
      [`bg_${theme}_mid`, 0.45],
    ];
    layers.forEach(([key, f], i) => {
      const ts = this.add.tileSprite(VIEW_W / 2, VIEW_H / 2, VIEW_W, 272, key).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.bg + i);
      this.bgLayers.push({ img: ts, f });
    });
  }

  private updateBackground(): void {
    const wv = this.cameras.main.worldView;
    const bottomGap = this.roomH - (wv.y + wv.height);
    for (const { img, f } of this.bgLayers) {
      img.tilePositionX = wv.x * f;
      // Layers sit on the room's floor and slide down a little as the camera climbs.
      img.y = VIEW_H / 2 + (f ? Math.min(160, bottomGap * f * 0.6) - 36 : 0);
    }
  }

  private buildTiles(): void {
    const map = this.make.tilemap({ data: this.parsed.tiles, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(`tiles_${this.room.tiles}`, `tiles_${this.room.tiles}`, TILE, TILE, 0, 0)!;
    this.layer = map.createLayer(0, tileset, 0, 0)!;
    this.layer.setDepth(0);
    const solid = [...Array(16).keys(), TI.crumble, TI.bombWall, TI.grid, TI.gate, TI.lava];
    this.layer.setCollision(solid);
    this.layer.forEachTile((t) => {
      if (t.index === TI.platform) t.setCollision(false, false, true, false);
      if (t.index === TI.bombWall && session.data.opened.includes(this.wallId(t.x, t.y))) this.layer.removeTileAt(t.x, t.y);
    });
    if (session.data.flags[`gate_${this.roomId}`]) this.openGates(false);
    // Lava tiles glow.
    this.layer.forEachTile((t) => {
      if (t.index === TI.lava && (t.y === 0 || this.parsed.tiles[t.y - 1][t.x] !== TI.lava))
        this.addLight(t.getCenterX(), t.getCenterY(), 40, true);
    });
  }

  private wallId(c: number, r: number): string {
    return `wall:${this.roomId}:${c},${r}`;
  }

  private buildProps(): void {
    for (const p of this.room.props ?? []) {
      const key = `prop_${p.kind}`;
      if (!this.textures.exists(key)) continue;
      const img = this.add.image(p.col * TILE + TILE / 2, (p.row + 1) * TILE, key).setOrigin(0.5, 1).setDepth(p.front ? DEPTH.front : DEPTH.props).setFlipX(!!p.flip);
      if (p.front) img.setAlpha(0.9);
      if (['lamp', 'torch', 'crystal', 'crystalPink', 'glowShroom', 'forgeFire', 'bigCrystal', 'fireSpirit'].includes(p.kind)) {
        const top = img.getTopCenter();
        this.addLight(top.x!, top.y! + 6, p.kind === 'bigCrystal' ? 120 : p.kind === 'glowShroom' ? 40 : 70, p.kind === 'torch' || p.kind === 'forgeFire');
        if (p.kind === 'torch') this.add.sprite(top.x!, top.y! + 7, 'flame').play('flame_burn').setDepth(DEPTH.props + 1);
      }
    }
  }

  private buildEnvironment(): void {
    const wy = this.waterY;
    if (wy !== null) {
      this.waterRect = this.add.rectangle(0, wy, this.roomW, this.roomH - wy + 64, 0x2a8ac0, 0.38).setOrigin(0).setDepth(DEPTH.water);
      this.waterLine = this.add.rectangle(0, wy, this.roomW, 2, 0xbff4ff, 0.7).setOrigin(0).setDepth(DEPTH.water);
    }
    if (this.room.lava && !(this.room.lava.flag && session.data.flags[this.room.lava.flag])) {
      this.lavaY = this.roomH - this.room.lava.start * TILE;
      this.lavaRect = this.add.rectangle(0, this.lavaY, this.roomW, this.roomH, 0xd8401a, 0.92).setOrigin(0).setDepth(DEPTH.water);
    }
    if (this.room.dark) {
      this.darkRT = this.makeDarkRT();
      this.lightSources.push({ x: () => this.player.x, y: () => this.player.y - 4, r: hasCharm(session.data, 'firefly') ? 150 : 90 });
    }
    this.buildParticles();
  }

  private buildParticles(): void {
    const kind = this.room.particles;
    if (!kind) return;
    const w = this.roomW;
    const h = this.roomH;
    const cfg: Record<string, Phaser.Types.GameObjects.Particles.ParticleEmitterConfig> = {
      fireflies: { x: { min: 0, max: w }, y: { min: 0, max: h }, lifespan: 5000, speedX: { min: -8, max: 8 }, speedY: { min: -8, max: 8 }, alpha: { start: 0, end: 0, ease: 'Sine.easeInOut' }, scale: 1, tint: 0xd8ff80, frequency: 250, blendMode: 'ADD', quantity: 1 },
      dust: { x: { min: 0, max: w }, y: { min: 0, max: h }, lifespan: 6000, speedX: { min: -4, max: 4 }, speedY: { min: 2, max: 8 }, alpha: { start: 0.5, end: 0 }, scale: 0.5, tint: 0xc8b8a0, frequency: 200 },
      embers: { x: { min: 0, max: w }, y: h, lifespan: 4000, speedX: { min: -10, max: 10 }, speedY: { min: -40, max: -20 }, alpha: { start: 1, end: 0 }, scale: { start: 0.8, end: 0.2 }, tint: [0xff8030, 0xffc040], frequency: 120, blendMode: 'ADD' },
      bubbles: { x: { min: 0, max: w }, y: h, lifespan: 5000, speedY: { min: -30, max: -15 }, speedX: { min: -4, max: 4 }, alpha: { start: 0.7, end: 0 }, scale: 0.8, tint: 0xbff4ff, frequency: 200 },
      leaves: { x: { min: 0, max: w }, y: -4, lifespan: 7000, speedX: { min: -20, max: 10 }, speedY: { min: 15, max: 30 }, alpha: { start: 1, end: 0.4 }, scale: 1, tint: [0x6fd06a, 0xe0c040], frequency: 400 },
      motes: { x: { min: 0, max: w }, y: { min: 0, max: h }, lifespan: 5000, speedX: { min: -6, max: 6 }, speedY: { min: -10, max: -2 }, alpha: { start: 0.8, end: 0 }, scale: 0.6, tint: 0xffffff, frequency: 180, blendMode: 'ADD' },
      ash: { x: { min: 0, max: w }, y: -4, lifespan: 6000, speedX: { min: -8, max: 8 }, speedY: { min: 10, max: 25 }, alpha: { start: 0.6, end: 0 }, scale: 0.7, tint: 0x6a6a7a, frequency: 150 },
      sparkles: { x: { min: 0, max: w }, y: { min: 0, max: h }, lifespan: 2000, alpha: { start: 1, end: 0 }, scale: { start: 1, end: 0 }, tint: 0xfff3a0, frequency: 200, blendMode: 'ADD' },
    };
    const c = cfg[kind];
    if (kind === 'fireflies') c.alpha = { onEmit: () => 0, onUpdate: (_p, _k, t) => Math.sin(t * Math.PI) };
    this.add.particles(0, 0, 'dot', c).setDepth(DEPTH.fx);
  }

  private addLight(x: number, y: number, r: number, flicker = false): void {
    this.lightSources.push({ x: () => x, y: () => y, r, flicker });
  }

  /** Places every object of the grid and returns the player's arrival point. */
  private spawnObjects(): { x: number; y: number; face: number; vy?: number } {
    const d = session.data;
    const when = this.room.when ?? {};
    const visible = (c: number, r: number) => checkCond(when[`${c},${r}`], d.flags);
    let signIndex = 0;
    let itemIndex = 0;
    const markers: Record<string, { x: number; y: number; face: number; vy?: number }> = {};

    for (const m of this.parsed.links) {
      const x = m.col * TILE + TILE / 2;
      const floor = (m.row + 1) * TILE;
      const link = this.room.links[m.ch];
      let face = 1;
      let px = x;
      let vy: number | undefined;
      if (m.edge === 'left') px = x + 10;
      if (m.edge === 'right') {
        px = x - 10;
        face = -1;
      }
      if (m.edge === 'bottom') vy = -330;
      markers[m.ch] = { x: px, y: floor - 16, face, vy };
      if (!m.edge && link && visible(m.col, m.row)) {
        const style = link.door ?? 'cave';
        const img = this.add.sprite(x, floor, `door_${style === 'hidden' ? 'dark' : style}`, 0).setOrigin(0.5, 1).setDepth(DEPTH.props);
        if (style === 'hidden') img.setAlpha(0);
        this.interactables.push({ kind: 'door', img, marker: m });
      }
    }

    for (const m of this.parsed.objects) {
      const { ch, col, row } = m;
      if (!visible(col, row)) {
        if (ch === 'i') itemIndex++;
        if (ch === 'S') signIndex++;
        continue;
      }
      const x = col * TILE + TILE / 2;
      const floor = (row + 1) * TILE;
      const place = (key: string, frame: number | string = 0) => this.add.sprite(x, floor, key, frame).setOrigin(0.5, 1);
      switch (ch) {
        case '@':
          markers['@'] = { x, y: floor - 16, face: 1 };
          break;
        case 'p':
          this.breakables.push({ img: place('pot').setDepth(DEPTH.objects), kind: 'pot' });
          break;
        case 'g':
          this.breakables.push({ img: place('grass').setDepth(DEPTH.objects).play({ key: 'grass_sway', startFrame: (col % 2) as 0 | 1 }), kind: 'grass' });
          break;
        case 'c':
        case 'x':
        case 'h':
        case 'm':
        case 'y':
        case 'u':
        case 'i': {
          const id = `${this.roomId}:${col},${row}`;
          const item = ch === 'i' ? this.room.items?.[itemIndex++] : undefined;
          const opened = d.opened.includes(id);
          const img = place('chest', opened ? 1 : 0).setDepth(DEPTH.objects);
          if (!opened) this.interactables.push({ kind: 'chest', img, id, content: ch, item });
          break;
        }
        case 'F': {
          const img = place('fountain').play('fountain_flow').setDepth(DEPTH.props);
          this.interactables.push({ kind: 'fountain', img });
          this.addLight(x, floor - 22, 80);
          markers.F = { x: x + 22, y: floor - 16, face: -1 };
          break;
        }
        case 'T': {
          const lit = d.beacons.includes(this.roomId);
          const img = place('beacon', lit ? 1 : 0).setDepth(DEPTH.props);
          if (lit) img.play('beacon_lit');
          this.interactables.push({ kind: 'beacon', img });
          this.lightSources.push({ x: () => x, y: () => floor - 30, r: 70, flicker: false });
          markers.T = { x: x + 18, y: floor - 16, face: 1 };
          break;
        }
        case 'S': {
          const sign = this.room.signs?.[signIndex++] ?? '';
          const text = typeof sign === 'string' ? sign : checkCond(sign.when, d.flags) ? sign.text : sign.before;
          this.interactables.push({ kind: 'sign', img: place('sign').setDepth(DEPTH.props), text });
          break;
        }
        case 'L':
        case 'X': {
          const id = `lock:${this.roomId}:${col},${row}`;
          if (d.opened.includes(id)) break;
          const img = this.locks.create(x, floor - 16, ch === 'L' ? 'door_locked' : 'door_boss', 0) as Phaser.Physics.Arcade.Image;
          img.setDepth(DEPTH.objects);
          (img.body as Phaser.Physics.Arcade.StaticBody).setSize(16, 32);
          this.interactables.push({ kind: 'lock', img, id, boss: ch === 'X' });
          break;
        }
        case '*': {
          const id = `orb:${this.roomId}:${col},${row}`;
          const lit = d.opened.includes(id) || (this.room.orbs === 'gate' && !!d.flags[`gate_${this.roomId}`]);
          const img = this.add.sprite(x, floor - 8, 'orb', lit && this.room.orbs !== 'water' ? 1 : 0).setDepth(DEPTH.objects);
          this.orbs.push({ img, id, lit: lit && this.room.orbs !== 'water' });
          break;
        }
        case 'B': {
          const id = this.room.boss;
          if (!id || d.flags[`boss_${id}`]) break;
          const b = createBoss(id, this, this, x, floor - 30);
          if (b) {
            this.adopt(b);
            this.boss = b;
          }
          break;
        }
        default:
          if (ENEMY_KINDS.includes(ch)) {
            this.spawnEnemy(ch, x, floor - 12);
            break;
          }
          if (ch >= 'A' && ch <= 'Z') this.spawnNpc(ch, x, floor);
      }
    }

    return (
      markers[this.arriveAt] ??
      markers['@'] ??
      markers.F ??
      markers[this.parsed.links[0]?.ch ?? ''] ?? { x: 40, y: 100, face: 1 }
    );
  }

  private spawnNpc(letter: string, x: number, floor: number): void {
    const id = this.room.npcs?.[letter];
    const def = id ? NPCS[id] : undefined;
    if (!def || !checkCond(def.when, session.data.flags)) return;
    const look = def.alt && checkCond(def.alt.when, session.data.flags) ? def.alt.look : def.look;
    const humanKey = `npc_${def.lying ? 'garenLying' : look}`;
    let img: Phaser.GameObjects.Sprite;
    if (this.textures.exists(humanKey)) {
      img = this.add.sprite(x, floor + 1, humanKey, 0).setOrigin(0.5, 1);
      const idle = this.anims.get(`${humanKey}_idle`);
      if (idle) img.play({ key: idle.key, startFrame: Math.floor(x / 16) % idle.frames.length });
    } else {
      img = this.add.sprite(x, floor, `prop_${look}`).setOrigin(0.5, 1);
    }
    img.setDepth(DEPTH.objects);
    // Face the middle of the room by default.
    img.setFlipX(x > this.roomW / 2);
    this.npcSprites.set(letter, img);
    this.interactables.push({ kind: 'npc', img, id: id!, letter });
    if (def.look === 'fireSpirit' || def.look === 'ghostGirl') this.lightSources.push({ x: () => img.x, y: () => img.y - 10, r: 60 });
  }

  // ================================================================ World (for enemies)

  spawnEnemy(kind: string, x: number, y: number): Enemy | null {
    const e = createEnemy(kind, this, this, x, y);
    if (!e) return null;
    this.adopt(e);
    return e;
  }

  adopt(e: Enemy): void {
    this.enemies.push(e);
    this.enemyGroup.add(e);
    // Adding to a group resets body defaults: restore flight for flyers.
    const flyers = ['bat', 'wisp', 'windsprite', 'jelly', 'eagle', 'levia', 'tentacle', 'noxgiant', 'shadowhand'];
    e.arcadeBody.setAllowGravity(!flyers.includes(e.texture.key));
    if (e.texture.key === 'dragon' || e.texture.key === 'tentacle') e.arcadeBody.setImmovable(true);
    if (e.phasing) e.arcadeBody.setCollideWorldBounds(false);
    if (this.room.dark && e.texture.key === 'wisp') this.lightSources.push({ x: () => e.x, y: () => e.y, r: 50 });
  }

  shoot(x: number, y: number, vx: number, vy: number, damage: number, texture: string, opts: ShotOptions = {}): void {
    this.fire(x, y, vx, vy, damage, texture, 'enemy', opts);
  }

  pushPlayer(vx: number, vy: number): void {
    const b = this.player.arcadeBody;
    b.setVelocity(b.velocity.x + vx, b.velocity.y + vy);
  }

  isSolidAt(x: number, y: number): boolean {
    const t = this.layer.getTileAtWorldXY(x, y);
    return !!t && t.index >= 0 && t.index !== TI.spikes;
  }

  shake(ms: number, intensity = 0.006): void {
    this.cameras.main.shake(ms, intensity);
  }

  burst(x: number, y: number, tint: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'particle').setTint(tint).setDepth(DEPTH.fx);
      const a = Math.random() * Math.PI * 2;
      const s = Phaser.Math.Between(8, 28);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * s, y: y + Math.sin(a) * s, alpha: 0, scale: 0.3, duration: 320, onComplete: () => p.destroy() });
    }
  }

  private fire(x: number, y: number, vx: number, vy: number, damage: number, texture: string, owner: 'player' | 'enemy', opts: ShotOptions = {}): Projectile {
    const p = this.projectiles.create(x, y, texture) as Projectile;
    p.owner = owner;
    p.damage = damage;
    p.opts = opts;
    p.bornAt = this.time.now;
    p.setDepth(DEPTH.fx - 1);
    const body = p.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(!!opts.gravity);
    if (opts.gravity) body.setGravityY(opts.gravity - this.physics.world.gravity.y);
    body.setSize(Math.max(4, p.width - 4), Math.max(4, p.height - 4));
    p.setVelocity(vx, vy);
    if (opts.ground) {
      body.setSize(p.width, p.height);
      p.setScale(1.3, 1);
    }
    if (texture === 'p_bolt' || texture === 'p_fire' || texture === 'p_dark') p.setBlendMode(Phaser.BlendModes.NORMAL);
    return p;
  }

  private projectileHitWall(p: Projectile): void {
    if (p.opts.gravity && p.texture.key === 'p_rock' && p.owner === 'enemy') {
      // Falling rocks come to rest and can be batted back.
      const body = p.body as Phaser.Physics.Arcade.Body;
      if (body.blocked.down && !p.resting) {
        p.resting = true;
        body.setVelocity(0, 0);
        body.setAllowGravity(false);
        this.time.delayedCall(2500, () => p.active && p.resting && this.popProjectile(p));
      }
      return;
    }
    this.popProjectile(p);
  }

  private popProjectile(p: Projectile): void {
    const tint = p.texture.key === 'p_fire' ? 0xff8030 : p.texture.key === 'p_dark' ? 0x8a4ad0 : p.owner === 'player' ? 0xfff3a0 : 0xc8b8a0;
    this.burst(p.x, p.y, tint, 4);
    p.destroy();
  }

  // ================================================================ update

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.controls.update();
    this.updateBackground();
    this.updateLighting();

    const frozen = session.uiBlocking || this.busy || time < this.hitstopUntil;
    const world = this.physics.world;
    if (frozen && !world.isPaused) world.pause();
    if (!frozen && world.isPaused) world.resume();
    if (frozen) {
      this.prompt.setVisible(false);
      session.interactHint = null;
      this.anims.pauseAll();
      return;
    }
    this.anims.resumeAll();

    session.data.playTime += dt;
    this.enemies = this.enemies.filter((e) => e.active);
    this.updateEnvironment(dt);
    this.player.locked = this.scripting > 0;
    const wasRifting = this.player.rifting;
    this.player.tick(dt, this.controls, time);
    if (wasRifting && !this.player.rifting) {
      const b = this.player.arcadeBody;
      if (this.layer.getTilesWithinWorldXY(b.x, b.y, b.width, b.height).some((t) => t.index === TI.grid)) this.player.extendRift();
    }
    for (const e of this.enemies) e.tick(dt);

    if (this.scripting === 0) {
      this.handleMenuKeys();
      this.handleMagic();
    }
    this.handleSword();
    this.handleBombs(dt);
    this.handleProjectiles();
    this.handleContact();
    this.handlePickups();
    this.handleHazards(dt);
    this.handleCrumble(dt);
    if (this.scripting === 0) this.handleInteract();
    this.handleBoss();
    this.handlePerks(dt);
    this.handleTriggers();
    if (this.scripting === 0) this.handleExits();
    this.updateWard();
  }

  private updateEnvironment(dt: number): void {
    const p = this.player;
    const wy = this.waterY;
    if (this.waterRect && wy !== null && Math.abs(this.waterRect.y - wy) > 0.5) {
      const ny = this.waterRect.y + Math.sign(wy - this.waterRect.y) * Math.min(Math.abs(wy - this.waterRect.y), 60 * dt);
      this.waterRect.setY(ny);
      this.waterLine!.setY(ny);
    }
    const surf = this.waterRect ? this.waterRect.y : null;
    this.lift = Math.max(0, this.lift - dt);
    p.inWater = surf !== null && p.arcadeBody.center.y > surf && this.lift === 0;
    if (this.waterLine) this.waterLine.setAlpha(0.5 + Math.sin(this.time.now / 300) * 0.2);

    p.wind.set(0, 0);
    for (const z of this.room.wind ?? []) {
      const r = new Phaser.Geom.Rectangle(z.col * TILE, z.row * TILE, z.w * TILE, z.h * TILE);
      if (r.contains(p.x, p.y)) p.wind.set(z.fx, z.fy);
      if (Math.random() < 0.15) {
        const s = this.add.image(r.x + Math.random() * r.width, r.y + Math.random() * r.height, 'dot').setTint(0xe0f8ff).setAlpha(0.6).setDepth(DEPTH.fx);
        this.tweens.add({ targets: s, x: s.x + z.fx * 0.4, y: s.y + z.fy * 0.4, alpha: 0, duration: 600, onComplete: () => s.destroy() });
      }
    }

    if (this.lavaRect && this.room.lava) {
      if (this.room.lava.flag && session.data.flags[this.room.lava.flag]) {
        this.lavaRect.destroy();
        this.lavaRect = null;
        this.lavaY = Infinity;
      } else {
        this.lavaY -= this.room.lava.speed * dt;
        this.lavaY = Math.max(this.lavaY, 3 * TILE);
        this.lavaRect.setY(this.lavaY);
        if (Math.random() < 0.3) this.burst(Math.random() * this.roomW, this.lavaY, 0xffb040, 1);
      }
    }
  }

  private updateLighting(): void {
    const rt = this.darkRT;
    if (!rt) return;
    const wv = this.cameras.main.worldView;
    rt.clear();
    rt.fill(0x05030a, this.room.dark ?? 0.8);
    for (const l of this.lightSources) {
      const x = l.x() - wv.x;
      const y = l.y() - wv.y;
      if (x < -l.r || y < -l.r || x > VIEW_W + l.r || y > VIEW_H + l.r) continue;
      const flick = l.flicker ? 1 + Math.sin(this.time.now / 70 + x) * 0.06 : 1;
      this.lightStamp.setScale(((l.r * 2) / 128) * flick);
      rt.erase(this.lightStamp, x, y);
    }
    for (const pr of this.projectiles.getChildren() as Projectile[]) {
      if (pr.texture.key !== 'p_bolt' && pr.texture.key !== 'p_fire') continue;
      this.lightStamp.setScale(0.5);
      rt.erase(this.lightStamp, pr.x - wv.x, pr.y - wv.y);
    }
  }

  // ---------------------------------------------------------------- player actions

  private handleMenuKeys(): void {
    const c = this.controls;
    const d = session.data;
    if (c.justDown('menu')) {
      c.eat('menu');
      this.game.events.emit(EV.menu, () => undefined);
      return;
    }
    if (c.justDown('heal')) {
      const used = useHeal(d);
      this.toast(used ? `${CONSUMABLES[used].name}を使った` : d.hp >= maxHp(d) ? 'HP は満タンだ' : '回復薬を持っていない');
      if (used) this.burst(this.player.x, this.player.y, 0xff8aa0, 10);
    }
    if (c.justDown('ether')) {
      const ok = useEther(d);
      this.toast(ok ? '星の粉を使った' : d.items.ether <= 0 ? '星の粉を持っていない' : 'MP は満タンだ');
      if (ok) this.burst(this.player.x, this.player.y, 0x8ac0ff, 10);
    }
    if (c.justDown('switch')) {
      const owned = SPELL_ORDER.filter((s) => d.abilities[s]);
      if (owned.length > 1) {
        const i = owned.indexOf(d.spell);
        d.spell = owned[(i + c.switchDir + owned.length) % owned.length];
        this.toast(`魔法：${SPELLS[d.spell].name}`);
      }
    }
  }

  private handleMagic(): void {
    if (!this.controls.justDown('magic')) return;
    const d = session.data;
    const spell = d.spell;
    if (!d.abilities[spell]) {
      this.toast('まだ魔法を覚えていない');
      return;
    }
    const cost = SPELLS[spell].cost;
    if (d.mp < cost) {
      this.toast('MP が足りない');
      return;
    }
    d.mp -= cost;
    const p = this.player;
    const f = p.facing;
    p.cast();
    switch (spell) {
      case 'bolt':
        // Chest height: fits through one-tile gaps at the player's feet level + 1.
        this.fire(p.x + f * 10, p.feetY - 12, f * 280, 0, d.mag + 2, 'p_bolt', 'player');
        break;
      case 'rift':
        this.burst(p.x, p.y, 0x9fe6ff, 10);
        p.startRift();
        this.time.delayedCall(140, () => this.burst(this.player.x, this.player.y, 0x9fe6ff, 10));
        break;
      case 'bomb': {
        const img = this.add.sprite(p.x + f * 12, p.feetY - 7, 'bomb').play('bomb_fuse').setDepth(DEPTH.objects);
        this.bombs.push({ img, t: 1.2 });
        break;
      }
      case 'ward':
        p.wardTimer = 3;
        break;
    }
  }

  private updateWard(): void {
    const p = this.player;
    if (p.wardTimer > 0) {
      if (!this.wardFx) this.wardFx = this.add.image(p.x, p.y, 'light_warm').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setScale(0.45);
      this.wardFx.setPosition(p.x, p.y).setAlpha(0.6 + Math.sin(this.time.now / 60) * 0.2);
    } else if (this.wardFx) {
      this.wardFx.destroy();
      this.wardFx = null;
    }
  }

  private handleBombs(dt: number): void {
    for (const b of [...this.bombs]) {
      b.t -= dt;
      if (b.t > 0) continue;
      this.bombs = this.bombs.filter((x) => x !== b);
      const { x, y } = b.img;
      b.img.destroy();
      this.explode(x, y);
    }
  }

  private explode(x: number, y: number): void {
    const d = session.data;
    this.shake(250, 0.012);
    const flash = this.add.image(x, y, 'light_warm').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setScale(0.2);
    this.tweens.add({ targets: flash, scale: 0.9, alpha: 0, duration: 300, onComplete: () => flash.destroy() });
    this.burst(x, y, 0xffc040, 20);
    const R = 34;
    // Break cracked walls.
    for (const t of this.layer.getTilesWithinWorldXY(x - R, y - R, R * 2, R * 2)) {
      if (t.index !== TI.bombWall) continue;
      this.layer.removeTileAt(t.x, t.y);
      d.opened.push(this.wallId(t.x, t.y));
      this.burst(t.getCenterX(), t.getCenterY(), 0x9a8a7a, 8);
    }
    for (const e of this.enemies) {
      if (e.dead || Phaser.Math.Distance.Between(e.x, e.y, x, y) > R + e.width / 2) continue;
      this.applyHit(e, { damage: Math.round(d.mag * 2.5), dirX: Math.sign(e.x - x) || 1, kind: 'bomb', strong: true, fromX: x });
    }
    for (const b of [...this.breakables]) if (Phaser.Math.Distance.Between(b.img.x, b.img.y, x, y) < R) this.breakObject(b);
  }

  private handleSword(): void {
    const rect = this.player.attackRect();
    if (!rect) return;
    const p = this.player;
    const d = session.data;
    const a = p.attack!;
    let connected = false;

    for (const e of this.enemies) {
      if (e.dead || e.lastHitBy === p.attackId) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) continue;
      e.lastHitBy = p.attackId;
      let dmg = swordDamage(attackPower(d), p.attackMult);
      if (e.stone && d.equip.sword === 'machete') dmg = Math.round(dmg * 1.5);
      if (e.hollow && d.equip.sword === 'luminablade') dmg *= 2;
      const dir = a.kind === 'side' || a.kind === 'charge' ? p.facing : Math.sign(e.x - p.x) || p.facing;
      const res = this.applyHit(e, { damage: dmg, dirX: dir, kind: a.kind, strong: a.kind === 'charge' || a.step === 3, fromX: p.x });
      if (res !== 'blocked') {
        d.mp = Math.min(d.mpMax, d.mp + SWORD.mpOnHit + (d.equip.sword === 'tideblade' ? 2 : 0));
        if (d.equip.sword === 'kaiDagger' && a.step === 3) this.time.delayedCall(90, () => e.active && !e.dead && this.applyHit(e, { damage: dmg, dirX: dir, kind: 'side', strong: false, fromX: p.x }));
      }
      connected = true;
    }

    for (const b of [...this.breakables]) if (Phaser.Geom.Intersects.RectangleToRectangle(rect, b.img.getBounds())) this.breakObject(b);

    for (const o of this.orbs) if (Phaser.Geom.Intersects.RectangleToRectangle(rect, o.img.getBounds())) connected = this.hitOrb(o) || connected;

    for (const obj of this.projectiles.getChildren()) {
      const pr = obj as Projectile;
      if (pr.owner !== 'enemy' || !pr.opts.reflectable || !Phaser.Geom.Intersects.RectangleToRectangle(rect, pr.getBounds())) continue;
      this.reflect(pr);
      connected = true;
    }

    if (a.kind === 'down' && !connected) {
      const spikes = this.layer.getTilesWithinWorldXY(rect.x, rect.y, rect.width, rect.height).some((t) => t.index === TI.spikes);
      if (spikes) connected = true;
    }

    // The Luminablade's charged slash sends a wave of light.
    if (a.kind === 'charge' && a.t < 0.08 && d.equip.sword === 'luminablade' && d.flags.bladeWave && !(a as { waved?: boolean }).waved) {
      (a as { waved?: boolean }).waved = true;
      this.fire(p.x + p.facing * 14, p.y - 2, p.facing * 320, 0, attackPower(d) * 2, 'p_bolt', 'player', { pierce: true }).setScale(2, 1.2);
    }

    if (connected) {
      this.hitstopUntil = this.time.now + SWORD.hitstop;
      if (a.kind === 'down') p.pogo();
    }
  }

  private reflect(pr: Projectile): void {
    const body = pr.body as Phaser.Physics.Arcade.Body;
    pr.owner = 'player';
    pr.damage = pr.damage * SWORD.reflectMult + attackPower(session.data);
    const src = pr.opts.source;
    const speed = Math.max(220, Math.hypot(body.velocity.x, body.velocity.y) * 1.6);
    // Lift it off the floor so a rock at rest doesn't shatter on the ground at once.
    if (pr.resting) pr.y -= 8;
    if (src && src.active && !src.dead) {
      const a = Phaser.Math.Angle.Between(pr.x, pr.y, src.x, src.y - 8);
      body.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
    } else {
      body.setVelocity(this.player.facing * speed, -body.velocity.y * 0.5);
    }
    body.setAllowGravity(false);
    pr.resting = false;
    pr.opts = { ...pr.opts, gravity: 0, ground: false };
    pr.setTint(0xfff3a0);
    this.burst(pr.x, pr.y, 0xfff3a0, 6);
  }

  private hitOrb(o: { img: Phaser.GameObjects.Sprite; id: string; lit: boolean }): boolean {
    const d = session.data;
    if (this.room.orbs === 'water') {
      if (this.time.now - ((o as { last?: number }).last ?? 0) < 600) return false;
      (o as { last?: number }).last = this.time.now;
      const w = this.room.water as { levels: number[] };
      const key = `water_${this.roomId}`;
      d.vars[key] = ((d.vars[key] ?? 0) + 1) % w.levels.length;
      o.img.setFrame(1);
      this.time.delayedCall(400, () => o.img.active && o.img.setFrame(0));
      this.toast('水の高さが変わった');
      return true;
    }
    if (o.lit) return false;
    o.lit = true;
    o.img.setFrame(1);
    d.opened.push(o.id);
    this.burst(o.img.x, o.img.y, 0xfff3a0, 10);
    if (this.orbs.every((x) => x.lit)) {
      d.flags[`gate_${this.roomId}`] = true;
      this.time.delayedCall(300, () => this.openGates(true));
    }
    return true;
  }

  private openGates(fx: boolean): void {
    this.layer.forEachTile((t) => {
      if (t.index !== TI.gate) return;
      if (fx) this.burst(t.getCenterX(), t.getCenterY(), 0xc8c8d8, 4);
      this.layer.removeTileAt(t.x, t.y);
    });
    if (fx) {
      this.shake(200, 0.004);
      this.toast('どこかで門が開いた');
    }
  }

  private applyHit(e: Enemy, hit: HitInfo): HitResult {
    const res = e.hurt(hit);
    if (res === 'blocked') return res;
    this.burst(e.x, e.y - 4, 0xffffff, 5);
    if (res === 'killed') this.onEnemyKilled(e);
    return res;
  }

  private handleProjectiles(): void {
    const pb = this.player.arcadeBody;
    const playerRect = new Phaser.Geom.Rectangle(pb.x, pb.y, pb.width, pb.height);
    const now = this.time.now;
    for (const obj of [...this.projectiles.getChildren()]) {
      const pr = obj as Projectile;
      if (!pr.active) continue;
      if (pr.opts.life && now - pr.bornAt > pr.opts.life) {
        this.popProjectile(pr);
        continue;
      }
      if (now - pr.bornAt > 6000 || pr.x < -40 || pr.x > this.roomW + 40 || pr.y > this.roomH + 40 || pr.y < -200) {
        pr.destroy();
        continue;
      }
      if (pr.texture.key === 'p_feather' || pr.texture.key === 'p_fire') pr.setRotation(Math.atan2(pr.body!.velocity.y, pr.body!.velocity.x));
      const bounds = pr.getBounds();
      if (pr.owner === 'enemy') {
        if (pr.resting) continue;
        // The ward bounces shots back.
        if (this.player.wardTimer > 0 && Phaser.Math.Distance.Between(pr.x, pr.y, this.player.x, this.player.y) < 26) {
          if (pr.opts.reflectable) this.reflect(pr);
          else this.popProjectile(pr);
          continue;
        }
        if (this.player.invuln <= 0 && Phaser.Geom.Intersects.RectangleToRectangle(playerRect, bounds)) {
          this.hurtPlayer(pr.damage, pr.x);
          this.popProjectile(pr);
        }
        continue;
      }
      for (const o of this.orbs) {
        const ob = o.img.getBounds();
        Phaser.Geom.Rectangle.Inflate(ob, 3, 3);
        if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, ob) && this.hitOrb(o)) {
          this.popProjectile(pr);
          break;
        }
      }
      if (!pr.active) continue;
      for (const e of this.enemies) {
        if (e.dead || !Phaser.Geom.Intersects.RectangleToRectangle(bounds, e.getBounds())) continue;
        if (pr.opts.pierce && (pr as { hitIds?: Set<Enemy> }).hitIds?.has(e)) continue;
        const reflected = !!pr.opts.source || pr.texture.key === 'p_rock' || pr.texture.key === 'p_nut';
        this.applyHit(e, { damage: pr.damage, dirX: Math.sign((pr.body as Phaser.Physics.Arcade.Body).velocity.x) || 1, kind: reflected ? 'reflect' : 'magic', strong: false, fromX: pr.x });
        if (pr.opts.pierce) {
          ((pr as { hitIds?: Set<Enemy> }).hitIds ??= new Set()).add(e);
          continue;
        }
        this.popProjectile(pr);
        break;
      }
    }
  }

  private handleContact(): void {
    if (this.player.invuln > 0) return;
    const pb = this.player.arcadeBody;
    const playerRect = new Phaser.Geom.Rectangle(pb.x + 1, pb.y + 2, pb.width - 2, pb.height - 2);
    for (const e of this.enemies) {
      if (e.dead) continue;
      const strike = e.strikeRect();
      if (strike && Phaser.Geom.Intersects.RectangleToRectangle(playerRect, strike)) {
        this.hurtPlayer(e.atk, e.x);
        return;
      }
      if (!e.harmful) continue;
      const eb = e.arcadeBody;
      const r = new Phaser.Geom.Rectangle(eb.x + 2, eb.y + 2, eb.width - 4, eb.height - 3);
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerRect, r)) {
        this.hurtPlayer(e.atk, e.x);
        return;
      }
    }
  }

  private handlePickups(): void {
    const d = session.data;
    const magnet = hasCharm(d, 'magnet');
    // Compare against the player's body (not the sprite centre, which sits well above the
    // feet), padded a little so items resting on the floor are collected by walking over them.
    const pb = this.player.arcadeBody;
    const reach = new Phaser.Geom.Rectangle(pb.x - 4, pb.y - 4, pb.width + 8, pb.height + 8);
    for (const obj of [...this.pickups.getChildren()]) {
      const it = obj as Phaser.Physics.Arcade.Image;
      if (magnet && it.getData('kind') === 'coin' && Phaser.Math.Distance.Between(it.x, it.y, pb.center.x, pb.center.y) < 90) {
        const a = Phaser.Math.Angle.Between(it.x, it.y, pb.center.x, pb.center.y);
        it.setVelocity(Math.cos(a) * 180, Math.sin(a) * 180);
      }
      if (!Phaser.Geom.Intersects.RectangleToRectangle(reach, it.getBounds())) continue;
      const kind = it.getData('kind') as string;
      if (kind === 'coin') d.coins += coinGain(d, it.getData('value') as number);
      else if (kind === 'heart') d.hp = Math.min(maxHp(d), d.hp + 2);
      else if (kind === 'mp') d.mp = Math.min(d.mpMax, d.mp + 3);
      it.destroy();
    }
  }

  private handleHazards(dt: number): void {
    const b = this.player.arcadeBody;
    const d = session.data;
    const touching = this.layer.getTilesWithinWorldXY(b.x + 2, b.y + 6, b.width - 4, b.height - 5);
    const below = this.layer.getTilesWithinWorldXY(b.x + 2, b.bottom, b.width - 4, 2);
    if (touching.some((t) => t.index === TI.spikes)) return this.hazardHit(1);
    if (below.some((t) => t.index === TI.lava) && !(d.equip.armor === 'dragonCloak')) return this.hazardHit(3);
    if (this.player.y > this.roomH + 24 && !this.bottomLinkNear()) return this.hazardHit(1);
    if (this.player.arcadeBody.bottom > this.lavaY + 4) {
      // Rising lava: back to the room's entrance.
      this.hazardHit(3);
      if (this.room.lava) this.lavaY = this.roomH - this.room.lava.start * TILE;
      return;
    }
    // Remember the last solid footing to return to after a hazard.
    if (this.player.onGround) {
      this.groundedTime += dt;
      const onCrumble = below.some((t) => t.index === TI.crumble);
      if (this.groundedTime > 0.15 && !onCrumble) this.lastSafe.set(this.player.x, this.player.y);
    } else {
      this.groundedTime = 0;
    }
  }

  private bottomLinkNear(): boolean {
    return this.parsed.links.some((m) => m.edge === 'bottom' && Math.abs(m.col * TILE + 8 - this.player.x) < 48);
  }

  private hazardHit(dmg: number): void {
    const d = session.data;
    if (this.busy) return;
    d.hp -= this.room.lava || dmg > 1 ? damageTaken(dmg, 0, d) : 1;
    this.shake(120, 0.01);
    if (d.hp <= 0) {
      this.die();
      return;
    }
    this.player.setPosition(this.lastSafe.x, this.lastSafe.y);
    this.player.arcadeBody.setVelocity(0, 0);
    this.player.invuln = 1.0;
    this.player.endAttack();
  }

  private handleCrumble(dt: number): void {
    const b = this.player.arcadeBody;
    if (this.player.onGround) {
      for (const t of this.layer.getTilesWithinWorldXY(b.x, b.bottom, b.width, 2)) {
        if (t.index !== TI.crumble) continue;
        const key = `${t.x},${t.y}`;
        if (!this.crumbling.has(key)) this.crumbling.set(key, 0.45);
      }
    }
    for (const [key, left] of [...this.crumbling]) {
      const [x, y] = key.split(',').map(Number);
      const nl = left - dt;
      this.crumbling.set(key, nl);
      const tile = this.layer.getTileAt(x, y);
      if (nl > 0 && tile) tile.pixelX = x * TILE + Math.round(Math.sin(nl * 60));
      if (nl <= 0 && nl + dt > 0) {
        this.burst(x * TILE + 8, y * TILE + 8, 0x8a7a6a, 6);
        this.layer.removeTileAt(x, y);
      }
      if (nl < -3) {
        // Rebuild once nobody stands in the way.
        const cell = new Phaser.Geom.Rectangle(x * TILE, y * TILE, TILE, TILE);
        if (!Phaser.Geom.Intersects.RectangleToRectangle(cell, new Phaser.Geom.Rectangle(b.x, b.y, b.width, b.height))) {
          const t = this.layer.putTileAt(TI.crumble, x, y);
          t.setCollision(true);
          this.crumbling.delete(key);
        }
      }
    }
  }

  private handleInteract(): void {
    const p = this.player;
    let near: Interactable | null = null;
    for (const it of this.interactables) {
      const reach = it.kind === 'lock' ? 22 : 14;
      if (Math.abs(it.img.x - p.x) < reach && Math.abs(it.img.y - p.feetY) < (it.kind === 'lock' ? 20 : 14)) {
        near = it;
        break;
      }
    }
    if (!near || !p.onGround) {
      this.prompt.setVisible(false);
      session.interactHint = null;
      return;
    }
    session.interactHint = {
      sign: '読む',
      npc: '話す',
      chest: '開ける',
      fountain: 'セーブ',
      beacon: session.data.beacons.includes(this.roomId) ? 'ワープ' : '灯す',
      door: '入る',
      lock: '開ける',
    }[near.kind];
    const top = near.kind === 'lock' ? near.img.y - 22 : (near.img as Phaser.GameObjects.Sprite).getTopCenter().y!;
    this.prompt.setVisible(true).setPosition(near.img.x, top - 8 + Math.sin(this.time.now / 150) * 1.5);
    if (!this.controls.justDown('up')) return;
    this.controls.eat('up');
    p.arcadeBody.setVelocityX(0);
    this.interact(near);
  }

  private interact(it: Interactable): void {
    const d = session.data;
    switch (it.kind) {
      case 'sign':
        void this.script((api) => api.say(it.text));
        break;
      case 'npc': {
        const def = NPCS[it.id];
        it.img.setFlipX(this.player.x < it.img.x);
        this.player.facing = it.img.x > this.player.x ? 1 : -1;
        this.player.setFlipX(this.player.facing < 0);
        void this.script((api) => def.talk(api));
        break;
      }
      case 'fountain':
        d.hp = maxHp(d);
        d.mp = d.mpMax;
        d.room = this.roomId;
        this.burst(it.img.x, it.img.y - 14, 0x9fe6ff, 16);
        this.toast(saveGame() ? '灯の泉：HP と MP が回復した。セーブしました。' : 'HP と MP が回復した（セーブに失敗）');
        break;
      case 'beacon':
        void this.useBeacon(it.img);
        break;
      case 'door':
        this.followLink(it.marker);
        break;
      case 'chest':
        void this.script(() => this.openChest(it));
        break;
      case 'lock': {
        const area = this.room.area;
        const ok = it.boss ? d.bossKeys.includes(area) : takeKey(d, area);
        if (!ok) {
          this.toast(it.boss ? 'ボスの鍵がかかっている' : '鍵がかかっている（小さな鍵が必要）');
          return;
        }
        d.opened.push(it.id);
        this.interactables = this.interactables.filter((x) => x !== it);
        this.burst(it.img.x, it.img.y, 0xf2c14e, 12);
        this.tweens.add({ targets: it.img, alpha: 0, duration: 300, onComplete: () => it.img.destroy() });
        this.toast(it.boss ? '大きな扉が開いた' : '鍵を開けた');
        break;
      }
    }
  }

  private async useBeacon(img: Phaser.GameObjects.Sprite): Promise<void> {
    const d = session.data;
    if (!d.beacons.includes(this.roomId)) {
      d.beacons.push(this.roomId);
      img.play('beacon_lit');
      this.burst(img.x, img.y - 30, 0xfff3a0, 16);
      this.toast('灯台に火を灯した。灯台どうしでワープできる。');
      return;
    }
    const target = await new Promise<string | null>((res) => this.game.events.emit(EV.warp, res));
    if (target && target !== this.roomId) this.travel(target, 'T');
  }

  private async openChest(chest: Extract<Interactable, { kind: 'chest' }>): Promise<void> {
    const d = session.data;
    d.opened.push(chest.id);
    chest.img.setFrame(1);
    this.interactables = this.interactables.filter((i) => i !== chest);
    this.burst(chest.img.x, chest.img.y - 8, 0xf6d743, 12);
    const area = this.room.area;
    switch (chest.content) {
      case 'c': {
        const amount = 20 + Math.floor(Math.random() * 20) + 10 * this.chapterIndex();
        d.coins += amount;
        this.toast(`灯貨を ${amount} 手に入れた！`);
        break;
      }
      case 'x':
        this.toast('経験値の袋を手に入れた！');
        await this.giveExp(30 + 25 * this.chapterIndex());
        break;
      case 'h':
        d.hpMax += 2;
        d.hp = maxHp(d);
        await this.banner('灯の器', '最大HPが 2 増えた');
        break;
      case 'm':
        d.mpMax += 4;
        d.mp = d.mpMax;
        await this.banner('星の器', '最大MPが 4 増えた');
        break;
      case 'y':
        d.keys[area] = (d.keys[area] ?? 0) + 1;
        this.toast('小さな鍵を手に入れた');
        break;
      case 'u':
        if (!d.bossKeys.includes(area)) d.bossKeys.push(area);
        await this.banner('ボスの鍵', 'この先の大きな扉を開けられる');
        break;
      case 'i':
        await this.giveThing(chest.item ?? 'potion');
        break;
    }
  }

  /** Gives an item id from room data: equipment, "potion"... or "quest:<id>". */
  private async giveThing(id: string): Promise<void> {
    const d = session.data;
    if (id.startsWith('quest:')) {
      const q = id.slice(6);
      d.flags[`item_${q}`] = true;
      const names: Record<string, string> = { shadowIron: '影の鉄', musicBox: 'オルゴール', scale: '竜の鱗', tablet1: '石版', tablet2: '石版', tablet3: '石版', tablet4: '石版' };
      await this.banner(names[q] ?? q, '大切なものを手に入れた');
      return;
    }
    if (id === 'potion' || id === 'bigPotion' || id === 'ether') {
      this.giveItem(id, 1);
      return;
    }
    if (EQUIPMENT[id]) await this.giveEquip(id);
  }

  private chapterIndex(): number {
    return ['haruna', 'forest'].includes(this.room.area) ? 0 : ['road', 'dorm', 'mine'].includes(this.room.area) ? 1 : ['plateau', 'shrine'].includes(this.room.area) ? 2 : ['lake', 'aqualia'].includes(this.room.area) ? 3 : 4;
  }

  private handleBoss(): void {
    const boss = this.boss;
    if (!boss || boss.dead) return;
    const b = boss as Boss;
    if (!this.bossStarted && !this.room.onEnter && Math.abs(this.player.x - boss.x) < 220 && this.time.now - this.entered > 600) this.startBoss();
    if (this.bossStarted) session.boss = { name: BOSS_TITLES[this.room.boss ?? ''] ?? b.title ?? '', hp: Math.max(0, boss.hp), max: boss.maxHp };
  }

  private handlePerks(dt: number): void {
    const d = session.data;
    // 8+ lights: HP slowly comes back, 1 every 5 seconds.
    if (d.flags.regen && d.hp > 0 && d.hp < maxHp(d)) {
      this.regenT += dt;
      if (this.regenT >= 5) {
        this.regenT = 0;
        d.hp += 1;
      }
    } else this.regenT = 0;
    // 12 lights: Mina (from the village) and Kai send light at the shadow king.
    const boss = this.boss;
    if (!d.flags.allies || this.room.boss !== 'noxgiant' || !this.bossStarted || !boss || boss.dead) return;
    this.allyT -= dt;
    if (this.allyT > 0) return;
    this.allyT = 4;
    this.allyTurn += 1;
    const mina = this.allyTurn % 2 === 1;
    const view = this.cameras.main.worldView;
    // From the screen edges at mid-height, clear of the HUD in the corners.
    const x = mina ? view.x + 16 : view.right - 16;
    const y = view.y + view.height * 0.45;
    const len = Math.hypot(boss.x - x, boss.y - y) || 1;
    this.burst(x, y, mina ? 0x9fe6ff : 0xfff3a0, 8);
    this.fire(x, y, ((boss.x - x) / len) * 300, ((boss.y - y) / len) * 300, 4 + d.mag, 'p_bolt', 'player');
    const tag = this.add
      .text(x, y + 6, mina ? 'ミナ' : 'カイ', { fontFamily: FONT, fontSize: '8px', color: mina ? '#9fe6ff' : '#fff3a0', stroke: '#000', strokeThickness: 2, resolution: 2 })
      .setOrigin(mina ? 0 : 1, 0)
      .setDepth(DEPTH.fx);
    this.tweens.add({ targets: tag, y: y - 6, alpha: 0, delay: 500, duration: 700, onComplete: () => tag.destroy() });
  }

  private handleTriggers(): void {
    const t = this.room.triggers;
    if (!t || this.scripting) return;
    t.forEach((tr, i) => {
      if (this.triggered.has(i)) return;
      if (this.player.x >= tr.col * TILE) {
        this.triggered.add(i);
        this.runEvent(tr.event);
      }
    });
  }

  private handleExits(): void {
    if (this.busy) return;
    if (this.bossStarted && this.boss && !this.boss.dead) return;
    const p = this.player;
    const b = p.arcadeBody;
    const c = this.controls;
    let edge: 'left' | 'right' | 'top' | 'bottom' | null = null;
    if (b.x <= 1 && c.isDown('left')) edge = 'left';
    else if (b.right >= this.roomW - 1 && c.isDown('right')) edge = 'right';
    else if (b.bottom < 4 && b.velocity.y < 0) edge = 'top';
    else if (b.top > this.roomH - 4) edge = 'bottom';
    if (!edge) return;
    const horizontal = edge === 'left' || edge === 'right';
    const when = this.room.when ?? {};
    const candidates = this.parsed.links.filter((m) => m.edge === edge && this.room.links[m.ch] && checkCond(when[`${m.col},${m.row}`], session.data.flags));
    let best: Marker | null = null;
    let bestD = Infinity;
    for (const m of candidates) {
      const dist = horizontal ? Math.abs(m.row * TILE + TILE - b.bottom) : Math.abs(m.col * TILE + 8 - p.x);
      if (dist < bestD) {
        best = m;
        bestD = dist;
      }
    }
    if (best && bestD < (horizontal ? 64 : 56)) this.followLink(best);
    else if (edge === 'top') b.setVelocityY(0);
  }

  private followLink(m: Marker): void {
    const link = this.room.links[m.ch];
    if (!link) return;
    this.travel(link.to, link.at);
  }

  private travel(room: string, at: string): void {
    if (this.busy) return;
    this.busy = true;
    this.cameras.main.fadeOut(140);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ room, at }));
  }

  // ---------------------------------------------------------------- combat outcomes

  private hurtPlayer(atk: number, fromX: number): void {
    const p = this.player;
    if (p.invuln > 0 || this.busy || p.rifting) return;
    const d = session.data;
    d.hp -= damageTaken(atk, defense(d), d);
    p.hurt(fromX);
    this.shake(120, 0.008);
    this.flash(0xff4040, 80);
    if (d.hp <= 0) {
      if (this.room.boss === 'kai' && this.boss && !this.boss.dead) {
        // Rio cannot die in the duel: Kai wins and the story goes on.
        d.hp = 1;
        this.boss.dead = true;
        session.boss = null;
        this.runEvent('kaiWins');
        return;
      }
      this.die();
    }
  }

  private die(): void {
    if (this.busy) return;
    this.busy = true;
    session.data.hp = 0;
    session.boss = null;
    this.player.setTint(0x333333);
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const lost = applyDeath(session.data, DEATH_COIN_LOSS);
      this.toast(lost > 0 ? `倒れてしまった……（灯貨を ${lost} 失った）` : '倒れてしまった……');
      this.scene.restart({ room: session.data.room, at: 'F' });
    });
  }

  private onEnemyKilled(e: Enemy): void {
    this.burst(e.x, e.y, 0xffffff, 12);
    if (e.hollow) {
      // The freed light rises to the sky.
      const light = this.add.image(e.x, e.y, 'light').setScale(0.12).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: light, y: e.y - 70, alpha: 0, duration: 1100, onComplete: () => light.destroy() });
    }
    this.dropCoins(e.x, e.y, e.coins);
    if (Math.random() < 0.15) this.spawnPickup('heart', e.x, e.y);
    else if (Math.random() < 0.15) this.spawnPickup('mp', e.x, e.y);

    const isBoss = e === this.boss;
    this.tweens.add({ targets: e, alpha: 0, duration: isBoss ? 1200 : 150, onComplete: () => e.destroy() });
    if (isBoss) {
      const id = this.room.boss!;
      session.boss = null;
      session.data.flags[`boss_${id}`] = true;
      for (const other of this.enemies) if (other !== e && !other.dead) {
        other.dead = true;
        this.burst(other.x, other.y, 0xffffff, 6);
        other.destroy();
      }
      this.shake(600, 0.01);
      this.flash(0xffffff, 300);
      void this.giveExp(e.exp).then(() => this.runEvent(`boss_${id}`));
    } else void this.giveExp(e.exp);
  }

  private breakObject(b: { img: Phaser.GameObjects.Sprite; kind: 'pot' | 'grass' }): void {
    this.breakables = this.breakables.filter((x) => x !== b);
    const { x, y } = b.img.getCenter();
    this.burst(x!, y!, b.kind === 'pot' ? 0xa8643a : 0x6fd06a, 7);
    b.img.destroy();
    const r = Math.random();
    if (b.kind === 'pot') {
      if (r < 0.6) this.dropCoins(x!, y!, Phaser.Math.Between(1, 3 + this.chapterIndex()));
      else if (r < 0.75) this.spawnPickup('heart', x!, y!);
      else if (r < 0.9) this.spawnPickup('mp', x!, y!);
    } else {
      if (r < 0.3) this.dropCoins(x!, y!, 1);
      else if (r < 0.4) this.spawnPickup('heart', x!, y!);
    }
  }

  private dropCoins(x: number, y: number, amount: number): void {
    let left = amount;
    let n = 0;
    while (left > 0 && n < 20) {
      const v = left >= 10 ? 10 : left >= 5 ? 5 : 1;
      left -= v;
      n++;
      const c = this.spawnPickup('coin', x, y);
      c.setData('value', v);
      if (v >= 5) c.setScale(v === 10 ? 1.8 : 1.4);
    }
  }

  private spawnPickup(kind: 'coin' | 'heart' | 'mp', x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const tex = kind === 'coin' ? 'coin' : kind === 'heart' ? 'heart' : 'mp_orb';
    const it = this.pickups.create(x, y, tex) as Phaser.Physics.Arcade.Sprite;
    if (kind === 'coin') it.play('coin_spin');
    it.setData('kind', kind).setData('value', 1).setDepth(DEPTH.objects + 1);
    it.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-180, -120));
    it.setBounce(0.4).setDragX(80);
    this.time.delayedCall(7000, () => it.active && this.tweens.add({ targets: it, alpha: 0.2, yoyo: true, repeat: 8, duration: 90 }));
    this.time.delayedCall(9000, () => it.active && it.destroy());
    return it;
  }

  // ================================================================ GameApi (story scripts)

  get save() {
    return session.data;
  }

  private async script(fn: (api: GameApi) => Promise<void>): Promise<void> {
    // Scripts can outlive the room they started in (warps and deaths restart the scene).
    // Each gets an API bound to its room: once that room is gone, every call freezes the
    // script instead of acting on the new room.
    const gen = this.generation;
    const api = new Proxy(this as GameApi, {
      get: (target, prop, receiver) => {
        const v = Reflect.get(target, prop, receiver);
        if (typeof v !== 'function') return v;
        return (...args: unknown[]) => (this.generation === gen ? (v as (...a: unknown[]) => unknown).apply(target, args) : new Promise(() => undefined));
      },
    });
    this.scripting++;
    try {
      await fn(api);
    } finally {
      if (gen === this.generation) this.scripting = Math.max(0, this.scripting - 1);
    }
  }

  runEvent(id: string): void {
    const ev = EVENTS[id];
    if (!ev) return;
    void this.script((api) => ev(api));
  }

  say(lines: Line[] | string, who?: string): Promise<void> {
    const ls = typeof lines === 'string' ? [{ who, text: lines }] : lines;
    return new Promise((res) => this.game.events.emit(EV.dialog, ls, res));
  }

  choose(question: string, options: string[]): Promise<number> {
    return new Promise((res) => this.game.events.emit(EV.choice, question, options, res));
  }

  wait(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  toast(text: string): void {
    this.game.events.emit(EV.toast, text);
  }

  banner(title: string, sub: string): Promise<void> {
    return new Promise((res) => this.game.events.emit(EV.banner, title, sub, res));
  }

  flag(name: string): boolean {
    return !!session.data.flags[name];
  }

  setFlag(name: string, value = true): void {
    session.data.flags[name] = value;
  }

  giveCoins(n: number): void {
    session.data.coins += n;
    this.toast(`灯貨を ${n} 手に入れた`);
  }

  giveExp(n: number): Promise<void> {
    const ups = addExp(session.data, n);
    if (ups <= 0) return Promise.resolve();
    return new Promise((res) => this.game.events.emit(EV.levelUp, ups, res));
  }

  async giveEquip(id: string): Promise<void> {
    if (!giveEquipment(session.data, id)) return;
    const e = EQUIPMENT[id];
    await this.banner(e.name, `${e.desc}\n（メニューで装備できる）`);
  }

  giveItem(id: 'potion' | 'bigPotion' | 'ether', n: number): void {
    const d = session.data;
    d.items[id] = Math.min(CONSUMABLES[id].max, d.items[id] + n);
    this.toast(`${CONSUMABLES[id].name}を手に入れた`);
  }

  async giveAbility(id: keyof typeof session.data.abilities, title: string, help: string): Promise<void> {
    session.data.abilities[id] = true;
    if (SPELL_ORDER.includes(id as never)) session.data.spell = id as never;
    this.flash(0xfff3a0, 400);
    await this.banner(title, help);
  }

  async giveFragment(): Promise<void> {
    session.data.fragments += 1;
    this.flash(0xffffff, 600);
    await this.banner(`剣の欠片（${session.data.fragments}/4）`, 'ルミナブレードの欠片を取り戻した');
  }

  async completeQuest(id: string, who: string): Promise<void> {
    const d = session.data;
    if (d.lights.includes(id)) return;
    d.lights.push(id);
    const glow = this.add.image(this.player.x, this.player.y - 30, 'light_warm').setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setScale(0.1);
    this.tweens.add({ targets: glow, y: this.player.y, scale: 0.4, alpha: 0, duration: 900, onComplete: () => glow.destroy() });
    await this.banner(`託された灯（${d.lights.length}/12）`, `${who}の灯を分けてもらった`);
  }

  openShop(id: string): Promise<void> {
    return new Promise((res) => this.game.events.emit(EV.shop, id, res));
  }

  flash(color: number, ms = 200): void {
    const c = Phaser.Display.Color.IntegerToColor(color);
    this.cameras.main.flash(ms, c.red, c.green, c.blue);
  }

  fadeOut(ms = 500, color = 0): Promise<void> {
    const c = Phaser.Display.Color.IntegerToColor(color);
    return new Promise((res) => {
      this.cameras.main.fadeOut(ms, c.red, c.green, c.blue);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => res());
    });
  }

  fadeIn(ms = 500): Promise<void> {
    return new Promise((res) => {
      this.cameras.main.fadeIn(ms);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => res());
    });
  }

  npc(letter: string): NpcHandle | null {
    const img = this.npcSprites.get(letter);
    if (!img) return null;
    return {
      get x() {
        return img.x;
      },
      get y() {
        return img.y;
      },
      face: (dir) => img.setFlipX(dir < 0),
      moveTo: (x, speed = 60) =>
        new Promise((res) => {
          img.setFlipX(x < img.x);
          this.tweens.add({ targets: img, x, duration: (Math.abs(x - img.x) / speed) * 1000, onComplete: () => res() });
        }),
      hide: () => {
        img.setVisible(false);
        this.interactables = this.interactables.filter((i) => i.img !== img);
      },
      show: () => img.setVisible(true),
      setLook: (look) => {
        const key = `npc_${look}`;
        if (this.textures.exists(key)) img.setTexture(key, 0).play(`${key}_idle`);
        else if (this.textures.exists(`prop_${look}`)) img.setTexture(`prop_${look}`);
      },
    };
  }

  playerX(): number {
    return this.player.x;
  }

  lockPlayer(locked: boolean): void {
    this.player.locked = locked;
  }

  face(dir: 1 | -1): void {
    this.player.facing = dir;
    this.player.setFlipX(dir < 0);
  }

  warp(room: string, at: string): Promise<void> {
    this.travel(room, at);
    return this.wait(400);
  }

  startBoss(): void {
    if (!this.boss || this.bossStarted) return;
    this.bossStarted = true;
    (this.boss as Boss).wake?.();
    this.shake(300, 0.006);
  }

  summon(kind: string, col: number, row: number): void {
    const e = this.spawnEnemy(kind, col * TILE + TILE / 2, (row + 1) * TILE - 12);
    if (e) this.burst(e.x, e.y, 0x8a4ad0, 10);
  }

  async waitNoEnemies(): Promise<void> {
    const gen = this.generation;
    this.scripting = Math.max(0, this.scripting - 1);
    while (gen === this.generation && this.enemies.some((e) => e.active && !e.dead)) await this.wait(200);
    if (gen === this.generation) this.scripting++;
  }

  get roomAlive(): boolean {
    return this.scene.isActive();
  }

  refreshRoom(): void {
    this.travel(this.roomId, 'F');
  }

  ending(): void {
    this.busy = true;
    saveGame();
    this.cameras.main.fadeOut(1500, 255, 255, 255);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.stop('HUD');
      this.scene.start('End');
    });
  }

  // ---------------------------------------------------------------- debug

  private debugUnlock(): void {
    const a = session.data.abilities;
    for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = true;
    session.data.mp = session.data.mpMax;
    this.toast('【デバッグ】すべての能力を解放（{switch} で魔法切り替え）');
  }
}
