import Phaser from 'phaser';
import type { Player } from './Player';

/** What enemies may ask of the game scene. */
export interface World {
  player: Player;
  shootEnemyProjectile(x: number, y: number, vx: number, vy: number, damage: number, texture: string): void;
  spawnEnemy(kind: string, x: number, y: number): Enemy | null;
  shake(ms: number, intensity: number): void;
}

export interface EnemyStats {
  hp: number;
  atk: number;
  exp: number;
  coins: number;
}

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  readonly maxHp: number;
  readonly atk: number;
  readonly exp: number;
  readonly coins: number;
  dead = false;
  /** Bosses shrug off knockback and stun. */
  heavy = false;
  /** Last player attack id that hit this enemy (one hit per swing). */
  lastHitBy = -1;
  protected stun = 0;
  protected world: World;
  protected homeX: number;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number, texture: string, stats: EnemyStats) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.world = world;
    this.homeX = x;
    this.hp = this.maxHp = stats.hp;
    this.atk = stats.atk;
    this.exp = stats.exp;
    this.coins = stats.coins;
    this.setDepth(5);
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

  /** Returns true when this hit killed the enemy. */
  hurt(damage: number, dirX: number, strong: boolean): boolean {
    if (this.dead) return false;
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    if (!this.heavy) {
      this.stun = 0.25;
      this.arcadeBody.setVelocity(dirX * (strong ? 170 : 90), this.arcadeBody.allowGravity ? -90 : 0);
    }
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  tick(dt: number): void {
    if (this.dead || !this.active || !this.body) return;
    if (this.y > this.scene.physics.world.bounds.bottom) {
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

  protected dirToPlayer(): number {
    return this.world.player.x < this.x ? -1 : 1;
  }

  protected distToPlayer(): { dx: number; dy: number; d: number } {
    const dx = this.world.player.x - this.x;
    const dy = this.world.player.y - this.y;
    return { dx, dy, d: Math.hypot(dx, dy) };
  }
}

export class Slime extends Enemy {
  private hopTimer = Phaser.Math.FloatBetween(0.3, 1.0);

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'slime', { hp: 4, atk: 1, exp: 2, coins: 2 });
    this.arcadeBody.setSize(14, 10);
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    if (!this.onGround) return;
    b.setVelocityX(0);
    this.hopTimer -= dt;
    if (this.hopTimer <= 0 && Math.abs(this.distToPlayer().dx) < 180) {
      const dir = this.dirToPlayer();
      b.setVelocity(dir * 60, -200);
      this.setFlipX(dir < 0);
      this.hopTimer = Phaser.Math.FloatBetween(0.9, 1.6);
    }
  }
}

export class Bat extends Enemy {
  private awake = false;
  private t = Phaser.Math.FloatBetween(0, 6);
  private throwTimer = 1.5;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'bat', { hp: 3, atk: 1, exp: 2, coins: 2 });
    this.arcadeBody.setAllowGravity(false);
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    const { dx, dy, d } = this.distToPlayer();
    if (!this.awake) {
      b.setVelocity(0, 0);
      if (d < 150) this.awake = true;
      return;
    }
    this.t += dt;
    // Hover above the player, bobbing, and throw nuts now and then.
    const tx = dx - Math.sign(dx) * 40;
    const ty = dy - 60 + Math.sin(this.t * 3) * 20;
    b.setVelocity(Phaser.Math.Clamp(tx, -1, 1) * 45, Phaser.Math.Clamp(ty * 1.5, -60, 60));
    this.setFlipX(dx < 0);
    this.throwTimer -= dt;
    if (this.throwTimer <= 0 && d < 200) {
      const speed = 110;
      this.world.shootEnemyProjectile(this.x, this.y + 4, (dx / d) * speed, (dy / d) * speed, 1, 'nut');
      this.throwTimer = Phaser.Math.FloatBetween(2.2, 3.2);
    }
  }
}

export class Wolf extends Enemy {
  private cooldown = 0;
  private patrolDir = 1;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'wolf', { hp: 8, atk: 2, exp: 5, coins: 4 });
    this.arcadeBody.setSize(20, 12).setOffset(1, 2);
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (!this.onGround) return;
    const { dx, dy } = this.distToPlayer();
    let vx: number;
    if (Math.abs(dx) < 150 && Math.abs(dy) < 48) {
      const dir = Math.sign(dx) || 1;
      if (Math.abs(dx) < 60 && this.cooldown <= 0) {
        b.setVelocity(dir * 170, -200);
        this.cooldown = 1.3;
        this.setFlipX(dir < 0);
        return;
      }
      vx = dir * 110;
    } else {
      if (b.blocked.left) this.patrolDir = 1;
      if (b.blocked.right) this.patrolDir = -1;
      if (this.x < this.homeX - 48) this.patrolDir = 1;
      if (this.x > this.homeX + 48) this.patrolDir = -1;
      vx = this.patrolDir * 40;
    }
    b.setVelocityX(vx);
    this.setFlipX(vx < 0);
  }
}

type BossState = 'dormant' | 'idle' | 'windup' | 'pounce' | 'charge' | 'stunned' | 'howl';

/** 影喰い狼 — prologue boss. */
export class BossWolf extends Enemy {
  state: BossState = 'dormant';
  private timer = 0;
  private chargeDir = 1;
  private nextMove: 'pounce' | 'charge' = 'pounce';
  private howls = 0;
  private minions: Enemy[] = [];

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'boss_wolf', { hp: 40, atk: 2, exp: 40, coins: 50 });
    this.heavy = true;
    this.arcadeBody.setSize(36, 22).setOffset(2, 4);
    this.setFlipX(true);
  }

  get enraged(): boolean {
    return this.hp <= this.maxHp / 2;
  }

  get harmful(): boolean {
    return !this.dead && this.state !== 'dormant';
  }

  /** The boss must never leave the arena: put it back in the middle. */
  protected fellOut(): void {
    this.setPosition(this.homeX, 60);
    this.arcadeBody.setVelocity(0, 0);
    this.state = 'idle';
    this.timer = 1.0;
  }

  wake(): void {
    if (this.state !== 'dormant') return;
    this.state = 'idle';
    this.timer = 0.8;
  }

  protected think(dt: number): void {
    const b = this.arcadeBody;
    const speed = this.enraged ? 1.3 : 1;
    this.timer -= dt;
    this.minions = this.minions.filter((m) => m.active && !m.dead);

    switch (this.state) {
      case 'dormant':
        b.setVelocityX(0);
        return;
      case 'idle':
        if (this.onGround) b.setVelocityX(0);
        this.setFlipX(this.dirToPlayer() < 0);
        if (this.timer <= 0) this.chooseMove();
        return;
      case 'windup':
        // Crouch and flash before a charge so the player can read it.
        b.setVelocityX(0);
        this.setTint(Math.floor(this.timer * 20) % 2 ? 0xff6666 : 0xffffff);
        if (this.timer <= 0) {
          this.clearTint();
          this.state = 'charge';
          this.timer = 2.5; // safety: never charge forever
          this.setFlipX(this.chargeDir < 0);
        }
        return;
      case 'charge':
        b.setVelocityX(this.chargeDir * 240 * speed);
        if ((this.chargeDir < 0 && b.blocked.left) || (this.chargeDir > 0 && b.blocked.right) || this.timer <= 0) {
          this.state = 'stunned';
          this.timer = this.enraged ? 0.6 : 0.9;
          b.setVelocity(-this.chargeDir * 60, -120);
          this.world.shake(200, 0.01);
        }
        return;
      case 'pounce':
        if (this.onGround && this.timer <= 0) {
          this.state = 'idle';
          this.timer = this.enraged ? 0.5 : 0.8;
          this.world.shake(100, 0.005);
        }
        return;
      case 'stunned':
        if (this.onGround) b.setVelocityX(0);
        this.angle = Math.sin(this.timer * 40) * 4;
        if (this.timer <= 0) {
          this.angle = 0;
          this.state = 'idle';
          this.timer = 0.4;
        }
        return;
      case 'howl':
        b.setVelocityX(0);
        if (this.timer <= 0) {
          const cam = this.scene.cameras.main;
          for (const x of [cam.worldView.left + 30, cam.worldView.right - 30]) {
            const m = this.world.spawnEnemy('w', x, this.y - 20);
            if (m) this.minions.push(m);
          }
          this.state = 'idle';
          this.timer = 1.0;
        }
        return;
    }
  }

  private chooseMove(): void {
    const b = this.arcadeBody;
    const wantHowls = this.enraged ? 2 : 1;
    if (this.howls < wantHowls && this.minions.length === 0 && this.hp < this.maxHp * 0.85) {
      this.howls += 1;
      this.state = 'howl';
      this.timer = 0.7;
      this.world.shake(600, 0.004);
      return;
    }
    if (this.nextMove === 'pounce') {
      const dx = this.world.player.x - this.x;
      this.state = 'pounce';
      this.timer = 0.2;
      b.setVelocity(Phaser.Math.Clamp(dx / 0.8, -220, 220), -330);
      this.nextMove = Math.random() < 0.5 ? 'charge' : 'pounce';
    } else {
      this.state = 'windup';
      this.timer = this.enraged ? 0.3 : 0.45;
      this.chargeDir = this.dirToPlayer();
      this.nextMove = 'pounce';
    }
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
    case 'W':
      return new BossWolf(scene, world, x, y);
    default:
      return null;
  }
}
