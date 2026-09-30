import Phaser from 'phaser';
import type { AttackKind, Player } from './Player';

export interface ShotOptions {
  gravity?: number;
  reflectable?: boolean;
  /** Reflected shots home in on this enemy instead of just reversing. */
  source?: Enemy;
  life?: number;
  ground?: boolean; // shockwaves: slide along the floor, ignore platforms
  pierce?: boolean;
}

/** What enemies may ask of the game scene. */
export interface World {
  player: Player;
  shoot(x: number, y: number, vx: number, vy: number, damage: number, texture: string, opts?: ShotOptions): void;
  spawnEnemy(kind: string, x: number, y: number): Enemy | null;
  /** Registers an enemy created elsewhere (boss parts). */
  adopt(e: Enemy): void;
  shake(ms: number, intensity: number): void;
  burst(x: number, y: number, tint: number, n: number): void;
  pushPlayer(vx: number, vy: number): void;
  isSolidAt(x: number, y: number): boolean;
  readonly roomW: number;
  readonly roomH: number;
  /** Water surface in px, or null. */
  readonly waterY: number | null;
}

export interface EnemyStats {
  hp: number;
  atk: number;
  exp: number;
  coins: number;
}

export interface HitInfo {
  damage: number;
  dirX: number;
  kind: AttackKind | 'magic' | 'bomb' | 'reflect';
  strong: boolean;
  /** Attacker x, to tell front from back. */
  fromX: number;
}

export type HitResult = 'hit' | 'killed' | 'blocked';

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly exp: number;
  readonly coins: number;
  dead = false;
  /** Bosses shrug off knockback and stun. */
  heavy = false;
  /** Shadow creatures take extra damage from the Luminablade. */
  hollow = true;
  /** Stone creatures take extra damage from the miner's machete. */
  stone = false;
  isBoss = false;
  /** Passes through terrain (ghosts). */
  phasing = false;
  /** Last player attack id that hit this enemy (one hit per swing). */
  lastHitBy = -1;
  protected stun = 0;
  protected world: World;
  protected homeX: number;
  protected homeY: number;
  protected t = 0;
  facing = -1;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number, texture: string, stats: EnemyStats) {
    super(scene, x, y, texture, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.world = world;
    this.homeX = x;
    this.homeY = y;
    this.hp = this.maxHp = stats.hp;
    this.atk = stats.atk;
    this.exp = stats.exp;
    this.coins = stats.coins;
    this.setDepth(5);
    // Art faces right; enemies start out facing left.
    this.setFlipX(true);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get onGround(): boolean {
    return this.arcadeBody.blocked.down;
  }

  /** Contact with this enemy hurts the player. */
  get harmful(): boolean {
    return !this.dead;
  }

  /** Extra hit box for weapon swings (checked by the scene). */
  strikeRect(): Phaser.Geom.Rectangle | null {
    return null;
  }

  /** Override to block some hits (shields, shells). */
  protected blocks(_hit: HitInfo): boolean {
    return false;
  }

  hurt(hit: HitInfo): HitResult {
    if (this.dead) return 'blocked';
    if (this.blocks(hit)) {
      this.world.burst(this.x + (hit.fromX < this.x ? -8 : 8), this.y - 4, 0xc8c8d8, 4);
      return 'blocked';
    }
    this.hp -= hit.damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    this.onHurt(hit);
    if (!this.heavy) {
      this.stun = 0.25;
      this.arcadeBody.setVelocity(hit.dirX * (hit.strong ? 170 : 90), this.arcadeBody.allowGravity ? -90 : 0);
    }
    if (this.hp <= 0) {
      this.dead = true;
      return 'killed';
    }
    return 'hit';
  }

  protected onHurt(_hit: HitInfo): void {}

  tick(dt: number): void {
    if (this.dead || !this.active || !this.body) return;
    this.t += dt;
    if (this.y > this.world.roomH + 40) {
      this.fellOut();
      return;
    }
    if (this.stun > 0) {
      this.stun -= dt;
      const b = this.arcadeBody;
      if (this.onGround) b.setVelocityX(b.velocity.x * 0.85);
      return;
    }
    this.think(dt);
  }

  protected abstract think(dt: number): void;

  /** Called when the enemy drops below the room. Regular enemies just vanish. */
  protected fellOut(): void {
    this.dead = true;
    this.destroy();
  }

  protected face(dir: number): void {
    if (!dir) return;
    this.facing = dir > 0 ? 1 : -1;
    this.setFlipX(this.facing < 0);
  }

  protected dirToPlayer(): number {
    return this.world.player.x < this.x ? -1 : 1;
  }

  protected distToPlayer(): { dx: number; dy: number; d: number } {
    const dx = this.world.player.x - this.x;
    const dy = this.world.player.y - this.y;
    // Never 0: aimed shots divide by it.
    return { dx, dy, d: Math.hypot(dx, dy) || 1 };
  }

  /** True when there is floor ahead (so walkers don't march off ledges). */
  protected groundAhead(dir: number): boolean {
    const b = this.arcadeBody;
    return this.world.isSolidAt(dir > 0 ? b.right + 4 : b.left - 4, b.bottom + 6);
  }

  protected wallAhead(dir: number): boolean {
    const b = this.arcadeBody;
    return (dir < 0 && b.blocked.left) || (dir > 0 && b.blocked.right);
  }

  protected anim(key: string): void {
    if (this.anims.currentAnim?.key !== key) this.play(key);
  }
}

// ---------------------------------------------------------------- prologue

export class Slime extends Enemy {
  private hopTimer = Phaser.Math.FloatBetween(0.3, 1.0);
  private wasAir = false;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'slime', { hp: 4, atk: 1, exp: 2, coins: 2 });
    this.arcadeBody.setSize(14, 10).setOffset(3, 6);
    this.play('slime_idle');
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    if (!this.onGround) {
      this.wasAir = true;
      return;
    }
    if (this.wasAir) {
      this.wasAir = false;
      this.play('slime_land');
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.active && this.play('slime_idle'));
    }
    b.setVelocityX(0);
    this.hopTimer -= dt;
    if (this.hopTimer <= 0 && Math.abs(this.distToPlayer().dx) < 180) {
      const dir = this.dirToPlayer();
      b.setVelocity(dir * 60, -200);
      this.face(dir);
      this.play('slime_jump');
      this.hopTimer = Phaser.Math.FloatBetween(0.9, 1.6);
    }
  }
}

export class Bat extends Enemy {
  private awake = false;
  private throwTimer = 1.5;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'bat', { hp: 3, atk: 1, exp: 2, coins: 2 });
    this.arcadeBody.setAllowGravity(false).setSize(14, 8).setOffset(4, 4);
    this.play('bat_hang');
    this.t = Phaser.Math.FloatBetween(0, 6);
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    const { dx, dy, d } = this.distToPlayer();
    if (!this.awake) {
      b.setVelocity(0, 0);
      if (d < 150) {
        this.awake = true;
        this.play('bat_fly');
      }
      return;
    }
    // Hover above the player, bobbing, and throw nuts now and then.
    const tx = dx - Math.sign(dx) * 40;
    const ty = dy - 60 + Math.sin(this.t * 3) * 20;
    b.setVelocity(Phaser.Math.Clamp(tx, -1, 1) * 45, Phaser.Math.Clamp(ty * 1.5, -60, 60));
    this.face(dx);
    this.throwTimer -= dt;
    if (this.throwTimer <= 0 && d < 200) {
      const speed = 110;
      this.world.shoot(this.x, this.y + 4, (dx / d) * speed, (dy / d) * speed, 1, 'p_nut', { reflectable: true, source: this });
      this.throwTimer = Phaser.Math.FloatBetween(2.2, 3.2);
    }
  }
}

export class Wolf extends Enemy {
  private cooldown = 0;
  private patrolDir = 1;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'wolf', { hp: 8, atk: 2, exp: 5, coins: 4 });
    this.arcadeBody.setSize(22, 12).setOffset(6, 9);
    this.play('wolf_idle');
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.onGround) {
      this.anim('wolf_pounce');
      return;
    }
    const { dx, dy } = this.distToPlayer();
    let vx: number;
    if (Math.abs(dx) < 150 && Math.abs(dy) < 48) {
      const dir = Math.sign(dx) || 1;
      if (Math.abs(dx) < 60 && this.cooldown <= 0) {
        b.setVelocity(dir * 170, -200);
        this.cooldown = 1.3;
        this.face(dir);
        return;
      }
      vx = dir * 110;
    } else {
      if (b.blocked.left || !this.groundAhead(-1)) this.patrolDir = 1;
      if (b.blocked.right || !this.groundAhead(1)) this.patrolDir = -1;
      if (this.x < this.homeX - 48) this.patrolDir = 1;
      if (this.x > this.homeX + 48) this.patrolDir = -1;
      vx = this.patrolDir * 40;
    }
    b.setVelocityX(vx);
    this.face(vx);
    this.anim('wolf_run');
  }
}

// ---------------------------------------------------------------- chapter 1

export class RockBug extends Enemy {
  private curled = 0;
  private dir = -1;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'rockbug', { hp: 10, atk: 2, exp: 6, coins: 5 });
    this.stone = true;
    this.hollow = false;
    this.arcadeBody.setSize(20, 12).setOffset(3, 6);
    this.play('rockbug_walk');
  }

  protected blocks(hit: HitInfo): boolean {
    // Curled up, the shell turns aside anything but blows from above, charges and bombs.
    return this.curled > 0 && hit.kind !== 'down' && hit.kind !== 'charge' && hit.kind !== 'bomb';
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    const { dx, dy } = this.distToPlayer();
    if (this.curled > 0) {
      this.curled -= dt;
      b.setVelocityX(0);
      if (this.curled <= 0) this.play('rockbug_walk');
      return;
    }
    if (Math.abs(dx) < 40 && Math.abs(dy) < 30 && Math.sign(dx) === this.dir) {
      this.curled = 1.4;
      this.play('rockbug_curl');
      return;
    }
    if (this.wallAhead(this.dir) || !this.groundAhead(this.dir)) this.dir *= -1;
    b.setVelocityX(this.dir * 30);
    this.face(this.dir);
  }
}

export class Wisp extends Enemy {
  private shotTimer = 2;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'wisp', { hp: 8, atk: 2, exp: 7, coins: 5 });
    this.phasing = true;
    this.hollow = true;
    this.arcadeBody.setAllowGravity(false).setSize(12, 16).setOffset(3, 3);
    this.play('wisp_float');
    this.setAlpha(0.9);
  }

  protected think(dt: number): void {
    const { dx, dy, d } = this.distToPlayer();
    const b = this.arcadeBody;
    if (d > 220) {
      b.setVelocity(0, Math.sin(this.t * 2) * 10);
      return;
    }
    b.setVelocity(Math.sign(dx) * 22, Math.sign(dy - 20) * 14 + Math.sin(this.t * 3) * 12);
    this.face(dx);
    this.shotTimer -= dt;
    if (this.shotTimer <= 0) {
      this.shotTimer = 2.8;
      this.world.shoot(this.x, this.y, (dx / d) * 90, (dy / d) * 90, 2, 'p_bolt', { reflectable: true, source: this });
    }
  }
}

// ---------------------------------------------------------------- chapter 2

export class WindSprite extends Enemy {
  private gust = 2;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'windsprite', { hp: 10, atk: 3, exp: 9, coins: 6 });
    this.arcadeBody.setAllowGravity(false).setSize(14, 14).setOffset(4, 4);
    this.play('windsprite_spin');
    this.hollow = false;
  }

  protected think(dt: number): void {
    const { dx, dy, d } = this.distToPlayer();
    const b = this.arcadeBody;
    b.setVelocity(Math.cos(this.t) * 30, Math.sin(this.t * 1.7) * 20 + (this.homeY - this.y) * 0.8);
    this.gust -= dt;
    if (this.gust <= 0 && d < 170) {
      this.gust = 3;
      // A sudden gust shoves the player away.
      this.world.pushPlayer(Math.sign(dx) * 260, -60);
      for (let k = 0; k < 8; k++) this.world.burst(this.x + Math.sign(dx) * k * 10, this.y + dy * (k / 8), 0xe0f8ff, 1);
    }
  }
}

/** Soldier-type enemy: walks up, winds up and swings. */
export class Soldier extends Enemy {
  private mode: 'walk' | 'windup' | 'strike' | 'rest' = 'walk';
  private timer = 0;
  private combo = 0;
  constructor(
    scene: Phaser.Scene,
    world: World,
    x: number,
    y: number,
    readonly look: string,
    stats: EnemyStats,
    readonly opts: { shield?: boolean; combo?: number; speed?: number; dashes?: boolean } = {},
  ) {
    super(scene, world, x, y, `sol_${look}`, stats);
    this.arcadeBody.setSize(12, 22).setOffset(14, 14);
    this.play(`sol_${look}_idle`);
    this.hollow = look.startsWith('hollow');
  }

  protected blocks(hit: HitInfo): boolean {
    if (!this.opts.shield || this.mode === 'strike') return false;
    if (hit.kind === 'charge' || hit.kind === 'bomb' || hit.kind === 'down') return false;
    const fromFront = Math.sign(hit.fromX - this.x) === this.facing;
    return fromFront;
  }

  strikeRect(): Phaser.Geom.Rectangle | null {
    // A flinching soldier's swing is interrupted.
    if (this.mode !== 'strike' || this.timer < 0.12 || this.stun > 0) return null;
    const b = this.arcadeBody;
    const x = this.facing > 0 ? b.right : b.left - 20;
    return new Phaser.Geom.Rectangle(x, b.top, 20, b.height);
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    const { dx, dy } = this.distToPlayer();
    this.timer += dt;
    switch (this.mode) {
      case 'walk': {
        const near = Math.abs(dx) < 34 && Math.abs(dy) < 30;
        if (near) {
          this.face(dx);
          this.mode = 'windup';
          this.timer = 0;
          b.setVelocityX(0);
          this.play(`sol_${this.look}_windup`);
          return;
        }
        const chase = Math.abs(dx) < 180 && Math.abs(dy) < 60;
        const dir = chase ? Math.sign(dx) : this.facing;
        if (!chase && (this.wallAhead(dir) || !this.groundAhead(dir))) this.face(-dir);
        const speed = (this.opts.speed ?? 45) * (chase ? 1.3 : 0.7);
        if (this.groundAhead(dir) && !this.wallAhead(dir)) b.setVelocityX(dir * speed);
        else b.setVelocityX(0);
        this.face(dir);
        this.anim(`sol_${this.look}_walk`);
        if (this.opts.dashes && chase && Math.abs(dx) > 70 && Math.abs(dx) < 120 && Math.random() < 0.01) b.setVelocityX(dir * 260);
        return;
      }
      case 'windup':
        b.setVelocityX(0);
        if (this.timer > 0.45) {
          this.mode = 'strike';
          this.timer = 0;
          b.setVelocityX(this.facing * 80);
          this.play(`sol_${this.look}_strike`);
        }
        return;
      case 'strike':
        if (this.timer > 0.28) {
          this.combo += 1;
          if (this.combo < (this.opts.combo ?? 1)) {
            this.mode = 'windup';
            this.timer = 0.3;
            this.play(`sol_${this.look}_windup`);
          } else {
            this.combo = 0;
            this.mode = 'rest';
            this.timer = 0;
            this.play(`sol_${this.look}_${this.opts.shield ? 'guard' : 'idle'}`);
          }
        }
        return;
      case 'rest':
        b.setVelocityX(0);
        if (this.timer > 0.8) this.mode = 'walk';
        return;
    }
  }
}

// ---------------------------------------------------------------- chapter 3

export class Jelly extends Enemy {
  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'jelly', { hp: 12, atk: 3, exp: 12, coins: 8 });
    this.arcadeBody.setAllowGravity(false).setSize(14, 16).setOffset(3, 2);
    this.play('jelly_swim');
    this.hollow = false;
    this.setAlpha(0.9);
  }

  protected think(): void {
    const { dx, dy, d } = this.distToPlayer();
    const b = this.arcadeBody;
    const pulse = Math.max(0, Math.sin(this.t * 3));
    if (d < 160) b.setVelocity(Math.sign(dx) * 25 * pulse, Math.sign(dy) * 30 * pulse - 4);
    else b.setVelocity(0, Math.sin(this.t) * 10);
    const wy = this.world.waterY;
    if (wy !== null && this.y < wy + 8) b.setVelocityY(Math.max(10, b.velocity.y));
  }
}

// ---------------------------------------------------------------- chapter 4

export class FireLizard extends Enemy {
  private spit = 1.5;
  private dir = -1;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'lizard', { hp: 20, atk: 4, exp: 18, coins: 10 });
    this.arcadeBody.setSize(26, 10).setOffset(3, 6);
    this.play('lizard_walk');
    this.hollow = false;
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    const { dx, dy } = this.distToPlayer();
    this.spit -= dt;
    if (Math.abs(dx) < 180 && Math.abs(dy) < 40 && this.spit <= 0) {
      this.face(dx);
      this.dir = this.facing;
      b.setVelocityX(0);
      this.play('lizard_spit');
      this.world.shoot(this.x + this.facing * 14, this.y - 2, this.facing * 140, 0, 4, 'p_fire', { reflectable: true, source: this });
      this.spit = 2.6;
      this.scene.time.delayedCall(300, () => this.active && !this.dead && this.play('lizard_walk'));
      return;
    }
    if (this.spit > 2.2) {
      b.setVelocityX(0);
      return;
    }
    if (this.wallAhead(this.dir) || !this.groundAhead(this.dir)) this.dir *= -1;
    b.setVelocityX(this.dir * 35);
    this.face(this.dir);
  }
}

export class LavaGolem extends Enemy {
  private slam = 2;
  private dir = -1;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'lavagolem', { hp: 40, atk: 5, exp: 35, coins: 20 });
    this.stone = true;
    this.hollow = false;
    this.arcadeBody.setSize(24, 30).setOffset(6, 4);
    this.play('lavagolem_walk');
  }

  protected blocks(hit: HitInfo): boolean {
    // Only the glowing core on its back is soft; the front plating shrugs off plain slashes.
    const fromFront = Math.sign(hit.fromX - this.x) === this.facing;
    return fromFront && hit.kind === 'side';
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    const { dx, dy } = this.distToPlayer();
    this.slam -= dt;
    if (Math.abs(dx) < 60 && Math.abs(dy) < 40 && this.slam <= 0) {
      b.setVelocityX(0);
      this.play('lavagolem_slam');
      this.world.shake(150, 0.006);
      for (const d of [-1, 1]) this.world.shoot(this.x + d * 12, this.arcadeBody.bottom - 6, d * 130, 0, 4, 'p_fire', { ground: true, life: 1500 });
      this.slam = 3;
      this.scene.time.delayedCall(500, () => this.active && !this.dead && this.play('lavagolem_walk'));
      return;
    }
    if (this.slam > 2.5) return;
    const chase = Math.abs(dx) < 200 && Math.abs(dy) < 50;
    const dir = chase ? Math.sign(dx) || 1 : this.dir;
    if (!chase && (this.wallAhead(dir) || !this.groundAhead(dir))) this.dir *= -1;
    b.setVelocityX(this.groundAhead(dir) ? dir * 22 : 0);
    this.face(dir);
  }
}

// ---------------------------------------------------------------- chapter 6

export class HollowMage extends Enemy {
  private timer = 1.5;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'sol_hollowMage', { hp: 30, atk: 5, exp: 45, coins: 20 });
    this.arcadeBody.setSize(12, 22).setOffset(14, 14);
    this.play('sol_hollowMage_idle');
  }

  protected think(dt: number): void {
    const { dx, dy, d } = this.distToPlayer();
    this.face(dx);
    this.arcadeBody.setVelocityX(0);
    this.timer -= dt;
    if (this.timer > 0 || d > 260) return;
    this.timer = 2.4;
    if (Math.random() < 0.4) {
      // Blink to the other side of the player.
      const tx = Phaser.Math.Clamp(this.world.player.x - Math.sign(dx) * 70, 20, this.world.roomW - 20);
      if (!this.world.isSolidAt(tx, this.y) && this.world.isSolidAt(tx, this.arcadeBody.bottom + 8)) {
        this.world.burst(this.x, this.y, 0x8a4ad0, 10);
        this.setX(tx);
        this.world.burst(this.x, this.y, 0x8a4ad0, 10);
      }
      return;
    }
    this.play('sol_hollowMage_guard');
    this.scene.time.delayedCall(400, () => {
      if (!this.active || this.dead) return;
      const base = Math.atan2(dy, dx);
      for (const off of [-0.3, 0, 0.3]) this.world.shoot(this.x, this.y - 6, Math.cos(base + off) * 120, Math.sin(base + off) * 120, 5, 'p_dark', { reflectable: true, source: this });
      this.play('sol_hollowMage_idle');
    });
  }
}

export function createEnemy(kind: string, scene: Phaser.Scene, world: World, x: number, y: number): Enemy | null {
  switch (kind) {
    case 's':
      return new Slime(scene, world, x, y);
    case 'b':
      return new Bat(scene, world, x, y);
    case 'w':
      return new Wolf(scene, world, x, y);
    case 'r':
      return new RockBug(scene, world, x, y);
    case 'e':
      return new Wisp(scene, world, x, y);
    case 'f':
      return new WindSprite(scene, world, x, y);
    case 't':
      return new Soldier(scene, world, x, y, 'sentinel', { hp: 18, atk: 3, exp: 14, coins: 10 }, { shield: true });
    case 'j':
      return new Jelly(scene, world, x, y);
    case 'n':
      return new Soldier(scene, world, x, y, 'knight', { hp: 26, atk: 4, exp: 20, coins: 12 }, { combo: 3, speed: 50 });
    case 'z':
      return new FireLizard(scene, world, x, y);
    case 'o':
      return new LavaGolem(scene, world, x, y);
    case 'v':
      return new Soldier(scene, world, x, y, 'hollowKnight', { hp: 45, atk: 6, exp: 50, coins: 25 }, { combo: 2, speed: 60, dashes: true });
    case 'q':
      return new HollowMage(scene, world, x, y);
    default:
      return null;
  }
}

export const ENEMY_KINDS = 'sbwreftjnzovq';
