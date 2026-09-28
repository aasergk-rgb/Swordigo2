import Phaser from 'phaser';
import { DEATH_COIN_LOSS, MAGIC, RENDER_SCALE, SWORD, TILE } from '../config';
import { BOSS_DEFEATED, GAREN_SCENE, NPCS, PICKUP_TEXT, type Line, type NpcDef } from '../data/dialogs';
import { ROOMS, ROOM_HEIGHT, type RoomDef } from '../data/rooms';
import { BossWolf, createEnemy, type Enemy, type World } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { Controls, controlsRef } from '../input';
import { addExp, applyDeath, damageTaken, swordDamage } from '../progress';
import { EV, saveGame, session } from '../session';

export type Entry = 'L' | 'R' | 'spawn' | 'fountain';

interface SceneData {
  room: string;
  entry: Entry;
}

const T_GRASS = 0;
const T_DIRT = 1;
const T_PLATFORM = 2;
const T_SPIKES = 3;

type Interactable =
  | { kind: 'sign'; img: Phaser.GameObjects.Image; text: string }
  | { kind: 'npc'; img: Phaser.GameObjects.Image; def: NpcDef }
  | { kind: 'chest'; img: Phaser.GameObjects.Image; id: string; content: string }
  | { kind: 'fountain'; img: Phaser.GameObjects.Image };

interface Projectile extends Phaser.Physics.Arcade.Image {
  owner: 'player' | 'enemy';
  damage: number;
}

export class GameScene extends Phaser.Scene implements World {
  player!: Player;
  private room!: RoomDef;
  private roomId = '';
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private controls!: Controls;
  private enemies: Enemy[] = [];
  private enemyGroup!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private breakables: { img: Phaser.GameObjects.Image; kind: 'pot' | 'grass' }[] = [];
  private interactables: Interactable[] = [];
  private prompt!: Phaser.GameObjects.Image;
  private boss: BossWolf | null = null;
  private garen: Phaser.GameObjects.Image | null = null;
  private bossStarted = false;
  private hitstopUntil = 0;
  private busy = false; // dying or changing rooms
  private lastSafe = new Phaser.Math.Vector2();
  private groundedTime = 0;

  constructor() {
    super('Game');
  }

  private entryKind: Entry = 'spawn';

  init(data: Partial<SceneData>): void {
    this.roomId = data.room && ROOMS[data.room] ? data.room : session.data.room;
    this.entryKind = data.entry ?? 'spawn';
  }

  create(): void {
    this.room = ROOMS[this.roomId];
    this.enemies = [];
    this.breakables = [];
    this.interactables = [];
    this.boss = null;
    this.garen = null;
    this.bossStarted = false;
    this.busy = false;
    this.hitstopUntil = 0;
    session.boss = null;
    session.uiBlocking = false;

    this.controls = new Controls(this);
    controlsRef.current = this.controls;

    const w = this.room.width * TILE;
    const h = ROOM_HEIGHT * TILE;
    this.physics.world.setBounds(0, 0, w, h + 64);
    this.physics.world.setBoundsCollision(true, true, true, false);
    this.physics.world.resume();

    this.drawBackground(w, h);
    this.buildTiles();

    // Adding a sprite to a physics group resets its body to the group defaults, so
    // world-bound collision is set here. Room edges act as walls; only the bottom is
    // open so enemies can still fall into pits.
    this.enemyGroup = this.physics.add.group({ collideWorldBounds: true });
    this.projectiles = this.physics.add.group({ allowGravity: false });
    this.pickups = this.physics.add.group();

    const spawn = this.spawnObjects();
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.standingOnPlatform = () => {
      const b = this.player.arcadeBody;
      return this.layer.getTileAtWorldXY(b.center.x, b.bottom + 2)?.index === T_PLATFORM;
    };
    this.lastSafe.set(spawn.x, spawn.y);

    this.physics.add.collider(this.player, this.layer, undefined, (_p, t) => {
      const tile = t as Phaser.Tilemaps.Tile;
      return !(tile.index === T_PLATFORM && this.time.now < this.player.dropThroughUntil);
    });
    this.physics.add.collider(this.enemyGroup, this.layer);
    this.physics.add.collider(this.pickups, this.layer);
    this.physics.add.collider(this.projectiles, this.layer, (p) => this.popProjectile(p as Projectile), (_p, t) => (t as Phaser.Tilemaps.Tile).index !== T_PLATFORM);

    this.prompt = this.add.image(0, 0, 'prompt').setDepth(20).setVisible(false);

    const cam = this.cameras.main;
    cam.setZoom(RENDER_SCALE);
    cam.setBounds(0, 0, w, h);
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setDeadzone(40, 30);
    cam.setRoundPixels(true);
    cam.fadeIn(150);

    if (!this.scene.isActive('HUD')) this.scene.launch('HUD');
    this.scene.bringToTop('HUD');
    this.game.events.emit(EV.toast, this.room.name);

    this.input.keyboard!.on('keydown-F1', () => {
      const a = session.data.abilities;
      const on = !(a.doubleJump && a.bolt);
      a.doubleJump = on;
      a.bolt = on;
      this.game.events.emit(EV.toast, on ? '【デバッグ】二段ジャンプと灯弾（C）を解放' : '【デバッグ】能力を元に戻した');
    });
  }

  // ---------------------------------------------------------------- building

  private buildTiles(): void {
    const rows = this.room.rows;
    // Ground gets a grass top wherever the tile above is open.
    const data: number[][] = rows.map((line, r) =>
      line.split('').map((ch, c) => {
        if (ch === '#') return r > 0 && rows[r - 1][c] === '#' ? T_DIRT : T_GRASS;
        if (ch === '-') return T_PLATFORM;
        if (ch === '^') return T_SPIKES;
        return -1;
      }),
    );

    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE, TILE, 0, 0)!;
    this.layer = map.createLayer(0, tileset, 0, 0)!;
    this.layer.setCollision([T_GRASS, T_DIRT]);
    this.layer.forEachTile((t) => {
      if (t.index === T_PLATFORM) t.setCollision(false, false, true, false);
    });
  }

  private drawBackground(w: number, h: number): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(this.room.bg);
    const base = Phaser.Display.Color.IntegerToColor(this.room.bg);
    const rng = new Phaser.Math.RandomDataGenerator([this.room.id]);
    [
      { f: 0.25, light: 12, peak: 110 },
      { f: 0.55, light: 22, peak: 70 },
    ].forEach(({ f, light, peak }, i) => {
      const g = this.add.graphics().setScrollFactor(f, 1).setDepth(-10 + i);
      g.fillStyle(base.clone().lighten(light).color, 1);
      for (let x = -80; x < w * f + 560; x += rng.between(40, 90)) {
        const top = h - peak - rng.between(0, 50);
        g.fillTriangle(x - 60, h, x, top, x + 60, h);
      }
    });
  }

  private spawnObjects(): Phaser.Math.Vector2 {
    const markers: Record<string, Phaser.Math.Vector2> = {};
    let signIndex = 0;
    const d = session.data;

    this.room.rows.forEach((line, r) =>
      line.split('').forEach((ch, c) => {
        const x = c * TILE + TILE / 2;
        const floor = (r + 1) * TILE;
        const place = (key: string) => {
          const img = this.add.image(x, floor, key).setOrigin(0.5, 1);
          return img;
        };
        switch (ch) {
          case '@':
          case 'L':
          case 'R':
            markers[ch] = new Phaser.Math.Vector2(x, floor - 11);
            break;
          case 'p':
          case 'g':
            this.breakables.push({ img: place(ch === 'p' ? 'pot' : 'grass').setDepth(2), kind: ch === 'p' ? 'pot' : 'grass' });
            break;
          case 'c':
          case 'x':
          case 'h': {
            const id = `${this.room.id}:${c},${r}`;
            const opened = d.opened.includes(id);
            const img = place(opened ? 'chest_open' : 'chest').setDepth(2);
            if (!opened) this.interactables.push({ kind: 'chest', img, id, content: ch });
            break;
          }
          case 'F': {
            const img = place('fountain').setDepth(1);
            this.interactables.push({ kind: 'fountain', img });
            markers.F = new Phaser.Math.Vector2(x + 18, floor - 11);
            this.tweens.add({ targets: img, alpha: 0.75, yoyo: true, repeat: -1, duration: 900 });
            break;
          }
          case 'S': {
            const text = this.room.signs?.[signIndex++] ?? '';
            this.interactables.push({ kind: 'sign', img: place('sign').setDepth(1), text });
            break;
          }
          case 'E':
          case 'K': {
            const def = NPCS[ch];
            this.interactables.push({ kind: 'npc', img: place(def.texture).setDepth(3), def });
            break;
          }
          case 'G':
            this.garen = place('garen').setDepth(3);
            break;
          case 'W':
            if (!d.flags.bossWolf) {
              const e = this.spawnEnemy('W', x, floor - 14);
              this.boss = e as BossWolf;
            }
            break;
          default:
            if ('sbw'.includes(ch)) this.spawnEnemy(ch, x, floor - 10);
        }
      }),
    );

    const pick =
      (this.entryKind === 'fountain' && markers.F) ||
      (this.entryKind === 'L' && markers.L) ||
      (this.entryKind === 'R' && markers.R) ||
      markers['@'] ||
      markers.L ||
      markers.F ||
      new Phaser.Math.Vector2(40, 100);
    return pick;
  }

  // ---------------------------------------------------------------- World API

  spawnEnemy(kind: string, x: number, y: number): Enemy | null {
    const e = createEnemy(kind, this, this, x, y);
    if (!e) return null;
    this.enemies.push(e);
    this.enemyGroup.add(e);
    if (kind === 'b') e.arcadeBody.setAllowGravity(false);
    return e;
  }

  shootEnemyProjectile(x: number, y: number, vx: number, vy: number, damage: number, texture: string): void {
    this.shoot(x, y, vx, vy, damage, texture, 'enemy');
  }

  shake(ms: number, intensity: number): void {
    this.cameras.main.shake(ms, intensity);
  }

  private shoot(x: number, y: number, vx: number, vy: number, damage: number, texture: string, owner: 'player' | 'enemy'): void {
    const p = this.projectiles.create(x, y, texture) as Projectile;
    p.owner = owner;
    p.damage = damage;
    p.setDepth(8);
    p.setVelocity(vx, vy);
    (p.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.time.delayedCall(4000, () => p.active && p.destroy());
  }

  private popProjectile(p: Projectile): void {
    this.burst(p.x, p.y, p.owner === 'player' ? 0xfff3a0 : 0xa0703a, 4);
    p.destroy();
  }

  // ---------------------------------------------------------------- update

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.controls.update();

    const frozen = session.uiBlocking || this.busy || time < this.hitstopUntil;
    const world = this.physics.world;
    if (frozen && !world.isPaused) world.pause();
    if (!frozen && world.isPaused) world.resume();
    if (frozen) {
      this.prompt.setVisible(false);
      return;
    }

    session.data.playTime += dt;
    this.enemies = this.enemies.filter((e) => e.active);
    this.player.tick(dt, this.controls, time);
    for (const e of this.enemies) e.tick(dt);

    this.handleMagic();
    this.handleSword();
    this.handleProjectiles();
    this.handleContact();
    this.handlePickups();
    this.handleHazards(dt);
    this.handleInteract();
    this.handleBoss();
    this.handleExits();
  }

  private handleMagic(): void {
    if (!this.controls.justDown('magic')) return;
    const d = session.data;
    if (!d.abilities.bolt) {
      this.game.events.emit(EV.toast, 'まだ魔法を覚えていない（F1 でデバッグ解放）');
      return;
    }
    if (d.mp < MAGIC.boltCost) {
      this.game.events.emit(EV.toast, 'MP が足りない');
      return;
    }
    d.mp -= MAGIC.boltCost;
    const f = this.player.facing;
    this.shoot(this.player.x + f * 8, this.player.y - 2, f * MAGIC.boltSpeed, 0, d.mag, 'bolt', 'player');
  }

  private handleSword(): void {
    const rect = this.player.attackRect();
    if (!rect) return;
    const p = this.player;
    const d = session.data;
    const kind = p.attack!.kind;
    let connected = false;

    for (const e of this.enemies) {
      if (e.dead || e.lastHitBy === p.attackId) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, e.getBounds())) continue;
      e.lastHitBy = p.attackId;
      const dmg = swordDamage(d.atk, p.attackMult);
      const dir = kind === 'side' ? p.facing : Math.sign(e.x - p.x) || p.facing;
      const killed = e.hurt(dmg, dir, p.attack!.step === 3);
      d.mp = Math.min(d.mpMax, d.mp + SWORD.mpOnHit);
      this.burst(e.x, e.y, 0xffffff, 5);
      if (killed) this.onEnemyKilled(e);
      connected = true;
    }

    for (const b of [...this.breakables]) {
      if (!Phaser.Geom.Intersects.RectangleToRectangle(rect, b.img.getBounds())) continue;
      this.breakObject(b);
    }

    for (const obj of this.projectiles.getChildren()) {
      const pr = obj as Projectile;
      if (pr.owner !== 'enemy' || !Phaser.Geom.Intersects.RectangleToRectangle(rect, pr.getBounds())) continue;
      // Reflect: send it back, harder.
      const body = pr.body as Phaser.Physics.Arcade.Body;
      pr.owner = 'player';
      pr.damage = pr.damage * SWORD.reflectMult + d.atk;
      body.setVelocity(-body.velocity.x * 1.6 || p.facing * 200, -body.velocity.y * 1.6);
      pr.setTint(0xfff3a0);
      this.burst(pr.x, pr.y, 0xfff3a0, 6);
      connected = true;
    }

    if (kind === 'down' && !connected) {
      const spikes = this.layer.getTilesWithinWorldXY(rect.x, rect.y, rect.width, rect.height).some((t) => t.index === T_SPIKES);
      if (spikes) connected = true;
    }

    if (connected) {
      this.hitstopUntil = this.time.now + SWORD.hitstop;
      if (kind === 'down') p.pogo();
    }
  }

  private handleProjectiles(): void {
    const pb = this.player.arcadeBody;
    const playerRect = new Phaser.Geom.Rectangle(pb.x, pb.y, pb.width, pb.height);
    for (const obj of [...this.projectiles.getChildren()]) {
      const pr = obj as Projectile;
      if (!pr.active) continue;
      const bounds = pr.getBounds();
      if (pr.owner === 'enemy') {
        if (this.player.invuln <= 0 && Phaser.Geom.Intersects.RectangleToRectangle(playerRect, bounds)) {
          this.hurtPlayer(pr.damage, pr.x);
          this.popProjectile(pr);
        }
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead || !Phaser.Geom.Intersects.RectangleToRectangle(bounds, e.getBounds())) continue;
        const killed = e.hurt(pr.damage, Math.sign((pr.body as Phaser.Physics.Arcade.Body).velocity.x) || 1, false);
        if (killed) this.onEnemyKilled(e);
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
    for (const obj of [...this.pickups.getChildren()]) {
      const it = obj as Phaser.Physics.Arcade.Image;
      if (Phaser.Math.Distance.Between(it.x, it.y, this.player.x, this.player.y) > 14) continue;
      const kind = it.getData('kind') as string;
      if (kind === 'coin') d.coins += it.getData('value') as number;
      else if (kind === 'heart') d.hp = Math.min(d.hpMax, d.hp + 2);
      else if (kind === 'mp') d.mp = Math.min(d.mpMax, d.mp + 3);
      it.destroy();
    }
  }

  private handleHazards(dt: number): void {
    const b = this.player.arcadeBody;
    const onSpikes = this.layer.getTilesWithinWorldXY(b.x + 2, b.y + 6, b.width - 4, b.height - 6).some((t) => t.index === T_SPIKES);
    if (onSpikes) {
      this.hazardHit();
      return;
    }
    if (this.player.y > ROOM_HEIGHT * TILE + 24) {
      this.hazardHit();
      return;
    }
    // Remember the last solid footing to return to after a hazard.
    if (this.player.onGround) {
      this.groundedTime += dt;
      if (this.groundedTime > 0.15) this.lastSafe.set(this.player.x, this.player.y);
    } else {
      this.groundedTime = 0;
    }
  }

  private hazardHit(): void {
    const d = session.data;
    d.hp -= 1;
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

  private handleInteract(): void {
    const p = this.player;
    let near: Interactable | null = null;
    for (const it of this.interactables) {
      if (Math.abs(it.img.x - p.x) < 14 && Math.abs(it.img.y - p.arcadeBody.bottom) < 12) {
        near = it;
        break;
      }
    }
    if (!near || !p.onGround) {
      this.prompt.setVisible(false);
      return;
    }
    this.prompt.setVisible(true).setPosition(near.img.x, near.img.getTopCenter().y! - 8 + Math.sin(this.time.now / 150) * 1.5);
    if (!this.controls.justDown('up')) return;
    p.arcadeBody.setVelocityX(0);

    const d = session.data;
    switch (near.kind) {
      case 'sign':
        this.say([{ text: near.text }]);
        break;
      case 'npc': {
        const def = near.def;
        this.say(def.lines(d.flags), () => {
          if (def.setFlag) d.flags[def.setFlag] = true;
        });
        break;
      }
      case 'fountain':
        d.hp = d.hpMax;
        d.mp = d.mpMax;
        d.room = this.roomId;
        this.burst(near.img.x, near.img.y - 10, 0x9fe6ff, 14);
        this.game.events.emit(EV.toast, saveGame() ? '灯の泉：HP と MP が回復した。セーブしました。' : 'HP と MP が回復した（セーブに失敗）');
        break;
      case 'chest':
        this.openChest(near);
        break;
    }
  }

  private openChest(chest: Extract<Interactable, { kind: 'chest' }>): void {
    const d = session.data;
    d.opened.push(chest.id);
    chest.img.setTexture('chest_open');
    this.interactables = this.interactables.filter((i) => i !== chest);
    this.burst(chest.img.x, chest.img.y - 6, 0xf6d743, 10);
    if (chest.content === 'c') {
      const amount = 30;
      d.coins += amount;
      this.game.events.emit(EV.toast, `灯貨を ${amount} 手に入れた！`);
    } else if (chest.content === 'x') {
      this.game.events.emit(EV.toast, PICKUP_TEXT.expBag);
      this.gainExp(30);
    } else if (chest.content === 'h') {
      d.hpMax += 2;
      d.hp = d.hpMax;
      this.say([{ text: PICKUP_TEXT.heartVessel }]);
    }
  }

  private handleBoss(): void {
    const boss = this.boss;
    if (!this.room.boss || !boss) return;
    if (!this.bossStarted && this.garen && this.player.x > this.garen.x - 30) {
      this.bossStarted = true;
      const start = () => {
        boss.wake();
        this.shake(400, 0.006);
        this.game.events.emit(EV.toast, '影喰い狼 が現れた！');
      };
      if (session.data.flags.metGaren) start();
      else
        this.say(GAREN_SCENE, () => {
          session.data.flags.metGaren = true;
          start();
        });
    }
    if (this.bossStarted && !boss.dead) session.boss = { name: '影喰い狼', hp: Math.max(0, boss.hp), max: boss.maxHp };
  }

  private handleExits(): void {
    const b = this.player.arcadeBody;
    const locked = this.bossStarted && this.boss !== null && !this.boss.dead;
    if (locked) return;
    const { left, right } = this.room.exits;
    if (left && b.x <= 1 && this.controls.isDown('left')) this.goTo(left, 'R');
    else if (right && b.right >= this.room.width * TILE - 1 && this.controls.isDown('right')) this.goTo(right, 'L');
  }

  private goTo(room: string, entry: Entry): void {
    if (this.busy) return;
    this.busy = true;
    this.cameras.main.fadeOut(120);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ room, entry }));
  }

  // ---------------------------------------------------------------- combat outcomes

  private hurtPlayer(atk: number, fromX: number): void {
    if (this.player.invuln > 0 || this.busy) return;
    const d = session.data;
    d.hp -= damageTaken(atk, d.def);
    this.player.hurt(fromX);
    this.shake(120, 0.008);
    if (d.hp <= 0) this.die();
  }

  private die(): void {
    if (this.busy) return;
    this.busy = true;
    session.data.hp = 0;
    this.player.setTint(0x333333);
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const lost = applyDeath(session.data, DEATH_COIN_LOSS);
      this.game.events.emit(EV.toast, `倒れてしまった……（灯貨を ${lost} 失った）`);
      this.scene.restart({ room: session.data.room, entry: 'fountain' });
    });
  }

  private onEnemyKilled(e: Enemy): void {
    this.burst(e.x, e.y, 0xffffff, 12);
    // The freed light rises to the sky.
    const light = this.add.image(e.x, e.y, 'particle').setTint(0xfff8d0).setScale(2).setDepth(12);
    this.tweens.add({ targets: light, y: e.y - 60, alpha: 0, duration: 900, onComplete: () => light.destroy() });

    this.dropCoins(e.x, e.y, e.coins);
    if (Math.random() < 0.15) this.spawnPickup('heart', e.x, e.y);

    const isBoss = e === this.boss;
    if (isBoss) {
      session.boss = null;
      session.data.flags.bossWolf = true;
    }
    this.tweens.add({ targets: e, alpha: 0, duration: isBoss ? 900 : 150, onComplete: () => e.destroy() });
    this.gainExp(e.exp, isBoss ? () => this.finishPrologue() : undefined);
  }

  private gainExp(amount: number, then?: () => void): void {
    const ups = addExp(session.data, amount);
    if (ups > 0) this.game.events.emit(EV.levelUp, ups, then);
    else then?.();
  }

  private finishPrologue(): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.dead = true;
      this.burst(e.x, e.y, 0xffffff, 8);
      e.destroy();
    }
    this.time.delayedCall(700, () =>
      this.say(BOSS_DEFEATED, () => {
        saveGame();
        this.busy = true;
        this.cameras.main.fadeOut(1200, 255, 255, 255);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.stop('HUD');
          this.scene.start('End');
        });
      }),
    );
  }

  private breakObject(b: { img: Phaser.GameObjects.Image; kind: 'pot' | 'grass' }): void {
    this.breakables = this.breakables.filter((x) => x !== b);
    const { x, y } = b.img.getCenter();
    this.burst(x!, y!, b.kind === 'pot' ? 0x9a5b34 : 0x6fd06a, 6);
    b.img.destroy();
    const r = Math.random();
    if (b.kind === 'pot') {
      if (r < 0.6) this.dropCoins(x!, y!, Phaser.Math.Between(1, 3));
      else if (r < 0.75) this.spawnPickup('heart', x!, y!);
      else if (r < 0.9) this.spawnPickup('mp', x!, y!);
    } else {
      if (r < 0.3) this.dropCoins(x!, y!, 1);
      else if (r < 0.4) this.spawnPickup('heart', x!, y!);
    }
  }

  private dropCoins(x: number, y: number, amount: number): void {
    let left = amount;
    while (left > 0) {
      const v = left >= 5 ? 5 : 1;
      left -= v;
      const c = this.spawnPickup('coin', x, y);
      c.setData('value', v);
      if (v === 5) c.setScale(1.6);
    }
  }

  private spawnPickup(kind: 'coin' | 'heart' | 'mp', x: number, y: number): Phaser.Physics.Arcade.Image {
    const tex = kind === 'coin' ? 'coin' : kind === 'heart' ? 'heart' : 'mp_orb';
    const it = this.pickups.create(x, y, tex) as Phaser.Physics.Arcade.Image;
    it.setData('kind', kind).setData('value', 1).setDepth(6);
    it.setVelocity(Phaser.Math.Between(-60, 60), Phaser.Math.Between(-180, -120));
    it.setBounce(0.4).setDragX(80);
    this.time.delayedCall(7000, () => it.active && this.tweens.add({ targets: it, alpha: 0.2, yoyo: true, repeat: 8, duration: 90 }));
    this.time.delayedCall(9000, () => it.active && it.destroy());
    return it;
  }

  private burst(x: number, y: number, tint: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'particle').setTint(tint).setDepth(15);
      const a = Math.random() * Math.PI * 2;
      const s = Phaser.Math.Between(10, 30);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * s, y: y + Math.sin(a) * s, alpha: 0, scale: 0.3, duration: 300, onComplete: () => p.destroy() });
    }
  }

  private say(lines: Line[], onDone?: () => void): void {
    this.game.events.emit(EV.dialog, lines, onDone);
  }
}
