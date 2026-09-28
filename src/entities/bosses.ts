// Bosses. Each is a state machine driven by `think`; the scene shows the HP bar and runs
// the room's "defeated" event when `dead` becomes true.
import Phaser from 'phaser';
import { Enemy, type EnemyStats, type HitInfo, Soldier, type World } from './Enemy';

export abstract class Boss extends Enemy {
  abstract readonly title: string;
  awake = false;
  protected mode = 'idle';
  protected timer = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number, texture: string, stats: EnemyStats) {
    super(scene, world, x, y, texture, stats);
    this.heavy = true;
    this.isBoss = true;
  }

  get enraged(): boolean {
    return this.hp <= this.maxHp / 2;
  }

  get harmful(): boolean {
    return !this.dead && this.awake;
  }

  wake(): void {
    this.awake = true;
    this.mode = 'idle';
    this.timer = 1;
  }

  protected think(dt: number): void {
    if (!this.awake) {
      this.arcadeBody.setVelocityX(0);
      return;
    }
    this.timer -= dt;
    this.act(dt);
  }

  protected abstract act(dt: number): void;

  protected go(state: string, time: number): void {
    this.mode = state;
    this.timer = time;
  }

  /** Bosses never leave the arena: put them back in the middle. */
  protected fellOut(): void {
    this.setPosition(this.homeX, 60);
    this.arcadeBody.setVelocity(0, 0);
    this.go('idle', 1);
  }
}

// ---------------------------------------------------------------- prologue: shadow-eater wolf

export class BossWolf extends Boss {
  readonly title = '影喰い狼';
  private chargeDir = 1;
  private nextMove: 'pounce' | 'charge' = 'pounce';
  private howls = 0;
  private minions: Enemy[] = [];

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'boss_wolf', { hp: 40, atk: 2, exp: 40, coins: 50 });
    this.arcadeBody.setSize(40, 22).setOffset(12, 17);
    this.play('boss_wolf_idle');
  }

  protected act(): void {
    const b = this.arcadeBody;
    const speed = this.enraged ? 1.3 : 1;
    this.minions = this.minions.filter((m) => m.active && !m.dead);
    switch (this.mode) {
      case 'idle':
        if (this.onGround) b.setVelocityX(0);
        this.face(this.dirToPlayer());
        this.anim('boss_wolf_idle');
        if (this.timer <= 0) this.chooseMove();
        return;
      case 'windup':
        b.setVelocityX(0);
        this.anim('boss_wolf_crouch');
        this.setTint(Math.floor(this.timer * 20) % 2 ? 0xff6666 : 0xffffff);
        if (this.timer <= 0) {
          this.clearTint();
          this.go('charge', 2.5);
          this.face(this.chargeDir);
        }
        return;
      case 'charge':
        this.anim('boss_wolf_run');
        b.setVelocityX(this.chargeDir * 240 * speed);
        if (this.wallAhead(this.chargeDir) || this.timer <= 0) {
          this.go('stunned', this.enraged ? 0.6 : 0.9);
          b.setVelocity(-this.chargeDir * 60, -120);
          this.world.shake(200, 0.01);
        }
        return;
      case 'pounce':
        this.anim('boss_wolf_pounce');
        if (this.onGround && this.timer <= 0) {
          this.go('idle', this.enraged ? 0.5 : 0.8);
          this.world.shake(100, 0.005);
        }
        return;
      case 'stunned':
        if (this.onGround) b.setVelocityX(0);
        this.anim('boss_wolf_idle');
        this.angle = Math.sin(this.timer * 40) * 4;
        if (this.timer <= 0) {
          this.angle = 0;
          this.go('idle', 0.4);
        }
        return;
      case 'howl':
        b.setVelocityX(0);
        this.anim('boss_wolf_howl');
        if (this.timer <= 0) {
          const cam = this.scene.cameras.main;
          for (const x of [cam.worldView.left + 30, cam.worldView.right - 30]) {
            const m = this.world.spawnEnemy('w', x, this.y - 20);
            if (m) this.minions.push(m);
          }
          this.go('idle', 1.0);
        }
        return;
    }
  }

  private chooseMove(): void {
    const b = this.arcadeBody;
    const wantHowls = this.enraged ? 2 : 1;
    if (this.howls < wantHowls && this.minions.length === 0 && this.hp < this.maxHp * 0.85) {
      this.howls += 1;
      this.go('howl', 0.7);
      this.world.shake(600, 0.004);
      return;
    }
    if (this.nextMove === 'pounce') {
      const dx = this.world.player.x - this.x;
      this.go('pounce', 0.2);
      b.setVelocity(Phaser.Math.Clamp(dx / 0.8, -220, 220), -330);
      this.face(dx);
      this.nextMove = Math.random() < 0.5 ? 'charge' : 'pounce';
    } else {
      this.go('windup', this.enraged ? 0.3 : 0.45);
      this.chargeDir = this.dirToPlayer();
      this.face(this.chargeDir);
      this.nextMove = 'pounce';
    }
  }
}

// ---------------------------------------------------------------- chapter 1: rock bug queen (mid-boss)

export class RockQueen extends Boss {
  readonly title = '岩虫の女王';
  private rollDir = 1;
  private bounces = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'rockqueen', { hp: 50, atk: 3, exp: 60, coins: 60 });
    this.stone = true;
    this.hollow = false;
    this.arcadeBody.setSize(44, 26).setOffset(6, 13);
    this.play('rockqueen_walk');
  }

  protected blocks(hit: HitInfo): boolean {
    return (this.mode === 'roll' || this.mode === 'curl') && hit.kind !== 'down' && hit.kind !== 'bomb';
  }

  protected act(): void {
    const b = this.arcadeBody;
    const dir = this.dirToPlayer();
    switch (this.mode) {
      case 'idle':
        this.anim('rockqueen_walk');
        b.setVelocityX(dir * (this.enraged ? 50 : 35));
        this.face(dir);
        if (this.timer <= 0) {
          if (Math.random() < 0.35) {
            for (const d of [-1, 1]) this.world.spawnEnemy('r', this.x + d * 30, this.y - 10);
            this.go('idle', 2.5);
          } else this.go('curl', 0.6);
        }
        return;
      case 'curl':
        b.setVelocityX(0);
        this.anim('rockqueen_curl');
        if (this.timer <= 0) {
          this.rollDir = dir;
          this.bounces = this.enraged ? 3 : 2;
          this.go('roll', 4);
        }
        return;
      case 'roll':
        b.setVelocityX(this.rollDir * 230);
        this.angle += this.rollDir * 18;
        if (this.wallAhead(this.rollDir)) {
          this.world.shake(120, 0.008);
          this.rollDir *= -1;
          this.bounces -= 1;
        }
        if (this.bounces <= 0 || this.timer <= 0) {
          this.angle = 0;
          this.go('dizzy', 1.6);
        }
        return;
      case 'dizzy':
        b.setVelocityX(0);
        this.anim('rockqueen_walk');
        this.angle = Math.sin(this.timer * 30) * 5;
        if (this.timer <= 0) {
          this.angle = 0;
          this.go('idle', 2);
        }
        return;
    }
  }
}

// ---------------------------------------------------------------- chapter 1: rock-eater golem

export class Golem extends Boss {
  readonly title = '岩喰いゴーレム';
  private slams = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'golem', { hp: 90, atk: 3, exp: 120, coins: 150 });
    this.stone = true;
    this.hollow = false;
    this.arcadeBody.setSize(52, 76).setOffset(14, 8);
    this.setFrame(0);
  }

  get coreOpen(): boolean {
    return this.mode === 'stunned';
  }

  protected blocks(hit: HitInfo): boolean {
    // Only a stunned golem with its chest open can be hurt (reflected rocks stun it).
    if (hit.kind === 'reflect') return false;
    return !this.coreOpen;
  }

  protected onHurt(hit: HitInfo): void {
    if (hit.kind === 'reflect' && !this.coreOpen) {
      this.hp += hit.damage; // the rock stuns rather than wounds
      this.go('stunned', 3.5);
      this.setFrame(3);
      this.world.shake(300, 0.01);
    }
  }

  protected act(): void {
    const b = this.arcadeBody;
    b.setVelocityX(0);
    const { dx } = this.distToPlayer();
    switch (this.mode) {
      case 'idle':
        this.setFrame(0);
        this.face(dx);
        if (this.timer <= 0) {
          if (Math.abs(dx) < 90 && this.slams < 2) {
            this.slams += 1;
            this.go('raise', this.enraged ? 0.45 : 0.7);
          } else {
            this.slams = 0;
            this.go('rockfall', 1.2);
          }
        }
        return;
      case 'raise':
        this.setFrame(1);
        this.setTint(Math.floor(this.timer * 16) % 2 ? 0xffc0a0 : 0xffffff);
        if (this.timer <= 0) {
          this.clearTint();
          this.setFrame(2);
          this.world.shake(260, 0.012);
          const n = this.enraged ? 2 : 1;
          for (let k = 0; k < n; k++)
            for (const d of [-1, 1]) this.scene.time.delayedCall(k * 350, () => this.active && this.world.shoot(this.x + d * 34, this.arcadeBody.bottom - 7, d * 150, 0, 3, 'p_rock', { ground: true, life: 2200 }));
          this.go('recover', 0.8);
        }
        return;
      case 'recover':
        if (this.timer <= 0) this.go('idle', this.enraged ? 0.7 : 1.1);
        return;
      case 'rockfall': {
        this.setFrame(1);
        if (this.timer <= 0) {
          this.world.shake(500, 0.006);
          const cam = this.scene.cameras.main.worldView;
          const n = this.enraged ? 5 : 4;
          for (let k = 0; k < n; k++) {
            const x = k === 0 ? this.world.player.x : Phaser.Math.Between(cam.left + 24, cam.right - 24);
            this.scene.time.delayedCall(k * 260, () => {
              if (this.active && !this.dead) this.world.shoot(x, cam.top + 8, 0, 40, 2, 'p_rock', { gravity: 320, reflectable: true, source: this, life: 6000 });
            });
          }
          this.go('recover', 1.6);
        }
        return;
      }
      case 'stunned':
        this.setFrame(this.timer < 0.8 ? 4 : 3);
        if (this.timer <= 0) this.go('idle', 0.8);
        return;
    }
  }
}

// ---------------------------------------------------------------- chapter 2: storm eagle

export class Tempest extends Boss {
  readonly title = '嵐の大鷲テンペスト';
  private dir = 1;
  private attacks = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'eagle', { hp: 140, atk: 4, exp: 200, coins: 250 });
    this.hollow = false;
    this.arcadeBody.setAllowGravity(false).setSize(30, 36).setOffset(29, 14);
    this.play('eagle_fly');
  }

  protected act(dt: number): void {
    const b = this.arcadeBody;
    const p = this.world.player;
    const topY = 60;
    switch (this.mode) {
      case 'idle':
        this.anim('eagle_fly');
        b.setVelocity(this.dir * (this.enraged ? 110 : 80), (topY + Math.sin(this.t * 2) * 16 - this.y) * 2);
        if (this.x < 50) this.dir = 1;
        if (this.x > this.world.roomW - 50) this.dir = -1;
        this.face(this.dir);
        if (this.timer <= 0) {
          this.attacks += 1;
          if (this.attacks % 3 === 0) this.go('diveWind', 0.7);
          else if (this.enraged && this.attacks % 4 === 1) this.go('gust', 1.4);
          else this.go('feathers', 0.5);
        }
        return;
      case 'feathers':
        b.setVelocity(0, 0);
        if (this.timer <= 0) {
          const n = this.enraged ? 5 : 3;
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          for (let k = 0; k < n; k++) {
            const a = base + (k - (n - 1) / 2) * 0.18;
            this.world.shoot(this.x, this.y + 6, Math.cos(a) * 160, Math.sin(a) * 160, 3, 'p_feather', { reflectable: true, source: this });
          }
          this.go('idle', this.enraged ? 1.1 : 1.6);
        }
        return;
      case 'gust':
        b.setVelocity(0, 0);
        this.world.pushPlayer(Math.sign(p.x - this.x) * 420 * dt * 60 * 0.02, 0);
        if (Math.random() < 0.3) this.world.burst(this.x + Phaser.Math.Between(-60, 60), this.y + Phaser.Math.Between(0, 120), 0xe0f8ff, 1);
        if (this.timer <= 0) this.go('idle', 1);
        return;
      case 'diveWind':
        b.setVelocity(0, -20);
        this.setTint(Math.floor(this.timer * 16) % 2 ? 0xffa0a0 : 0xffffff);
        if (this.timer <= 0) {
          this.clearTint();
          const dx = p.x - this.x;
          const dy = p.y - this.y;
          const d = Math.hypot(dx, dy) || 1;
          b.setVelocity((dx / d) * 300, (dy / d) * 300);
          this.setFrame(3);
          this.anims.stop();
          this.go('dive', 1.2);
        }
        return;
      case 'dive':
        if (b.blocked.down || this.y > this.world.roomH - 40 || this.timer <= 0) {
          b.setVelocity(0, 0);
          this.world.shake(200, 0.01);
          this.setFrame(4);
          this.go('perched', this.enraged ? 1.4 : 2);
        }
        return;
      case 'perched':
        b.setVelocity(0, 0);
        if (this.timer <= 0) {
          this.play('eagle_fly');
          this.go('rise', 1);
        }
        return;
      case 'rise':
        b.setVelocity(0, -120);
        if (this.y < topY || this.timer <= 0) this.go('idle', 1.2);
        return;
    }
  }
}

// ---------------------------------------------------------------- chapter 3: Levia and its tentacles

export class Tentacle extends Enemy {
  up = false;
  private life = 0;
  private baseY: number;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y + 80, 'tentacle', { hp: 999, atk: 3, exp: 0, coins: 0 });
    this.baseY = y;
    this.arcadeBody.setAllowGravity(false).setSize(10, 64).setOffset(5, 6).setImmovable(true);
    this.phasing = true;
    this.hollow = false;
    this.play('tentacle_wave');
    this.setDepth(4);
  }

  protected blocks(): boolean {
    return true;
  }

  get harmful(): boolean {
    return this.up && !this.dead;
  }

  rise(x: number, hold: number): void {
    this.setX(x);
    this.life = hold;
    // Ripples warn where it will burst out.
    for (let k = 0; k < 6; k++) this.scene.time.delayedCall(k * 120, () => this.world.burst(x, this.baseY - 4, 0x9af0e0, 2));
    this.scene.time.delayedCall(800, () => {
      if (!this.active) return;
      this.up = true;
      this.scene.tweens.add({ targets: this, y: this.baseY - 30, duration: 200 });
    });
  }

  protected think(dt: number): void {
    if (!this.up) return;
    this.life -= dt;
    if (this.life < 0) {
      this.up = false;
      this.scene.tweens.add({ targets: this, y: this.baseY + 80, duration: 300 });
    }
  }
}

export class Levia extends Boss {
  readonly title = '深き者レヴィア';
  private tentacles: Tentacle[] = [];
  private spots: number[];
  private surfaceY: number;
  emerged = false;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'levia', { hp: 200, atk: 4, exp: 320, coins: 400 });
    this.hollow = false;
    this.arcadeBody.setAllowGravity(false).setSize(44, 30).setOffset(22, 8);
    this.surfaceY = world.waterY ?? y;
    this.spots = [60, world.roomW / 2, world.roomW - 60];
    this.setY(this.surfaceY + 70);
    this.setDepth(3);
    this.play('levia_idle');
  }

  get harmful(): boolean {
    return this.emerged && !this.dead;
  }

  protected blocks(): boolean {
    return !this.emerged;
  }

  protected act(): void {
    this.arcadeBody.setVelocity(0, 0);
    this.tentacles = this.tentacles.filter((t) => t.active);
    const phase = this.hp > this.maxHp * 0.66 ? 1 : this.hp > this.maxHp * 0.33 ? 2 : 3;
    switch (this.mode) {
      case 'idle':
        if (this.timer <= 0) {
          const x = Phaser.Utils.Array.GetRandom(this.spots);
          this.setX(x);
          this.face(this.world.player.x - x);
          for (let k = 0; k < 8; k++) this.scene.time.delayedCall(k * 90, () => this.world.burst(x + Phaser.Math.Between(-20, 20), this.surfaceY - 2, 0xbff4ff, 2));
          this.go('emerge', 0.8);
        }
        return;
      case 'emerge':
        if (this.timer <= 0) {
          this.emerged = true;
          this.scene.tweens.add({ targets: this, y: this.surfaceY - 30, duration: 300 });
          this.world.shake(200, 0.006);
          this.go('roar', 0.7);
        }
        return;
      case 'roar':
        this.setFrame(2);
        this.anims.stop();
        if (this.timer <= 0) {
          const p = this.world.player;
          const base = Math.atan2(p.y - this.y, p.x - this.x);
          const n = phase === 1 ? 3 : 5;
          for (let k = 0; k < n; k++) {
            const a = base + (k - (n - 1) / 2) * 0.22;
            this.world.shoot(this.x + this.facing * 20, this.y, Math.cos(a) * 110, Math.sin(a) * 110, 3, 'p_bubble', { reflectable: true, source: this });
          }
          this.play('levia_idle');
          this.go('exposed', phase === 3 ? 1.8 : 2.6);
        }
        return;
      case 'exposed':
        if (this.timer <= 0) {
          this.emerged = false;
          this.scene.tweens.add({ targets: this, y: this.surfaceY + 70, duration: 400 });
          this.go('tentacles', 0.5);
        }
        return;
      case 'tentacles':
        if (this.timer <= 0) {
          const n = phase;
          const p = this.world.player;
          for (let k = 0; k < n; k++) {
            const t = new Tentacle(this.scene, this.world, 0, this.world.roomH - 48);
            this.world.adopt(t);
            this.tentacles.push(t);
            const x = k === 0 ? p.x : Phaser.Math.Between(30, this.world.roomW - 30);
            t.rise(x, 1.3);
            this.scene.time.delayedCall(3200, () => t.active && t.destroy());
          }
          this.go('idle', 2.4);
        }
        return;
    }
  }
}

// ---------------------------------------------------------------- chapter 4: lava dragon Ignia

export class Ignia extends Boss {
  readonly title = '溶岩竜イグニア';
  private moves = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'dragon', { hp: 260, atk: 5, exp: 420, coins: 500 });
    this.hollow = false;
    this.arcadeBody.setSize(70, 56).setOffset(26, 24).setImmovable(true);
    this.play('dragon_idle');
  }

  get stunned(): boolean {
    return this.mode === 'stunned';
  }

  protected onHurt(hit: HitInfo): void {
    if (hit.kind === 'bomb' && !this.stunned) {
      this.go('stunned', 3);
      this.setFrame(4);
      this.anims.stop();
      this.world.shake(400, 0.012);
    }
    if (this.stunned && hit.kind !== 'bomb') this.hp -= Math.round(hit.damage * 0.5);
  }

  protected act(): void {
    const b = this.arcadeBody;
    b.setVelocity(0, 0);
    this.face(-1);
    switch (this.mode) {
      case 'idle':
        this.anim('dragon_idle');
        if (this.timer <= 0) {
          this.moves += 1;
          const m = this.moves % 3;
          this.go(m === 1 ? 'breathWind' : m === 2 ? 'tail' : 'erupt', 0.7);
        }
        return;
      case 'breathWind':
        this.setTint(Math.floor(this.timer * 16) % 2 ? 0xffc080 : 0xffffff);
        if (this.timer <= 0) {
          this.clearTint();
          this.setFrame(2);
          this.anims.stop();
          const n = this.enraged ? 10 : 7;
          for (let k = 0; k < n; k++)
            this.scene.time.delayedCall(k * 110, () => {
              if (!this.active || this.dead) return;
              const vy = 30 + Math.sin(k) * 40;
              this.world.shoot(this.x - 50, this.y - 24, -200, vy, 5, 'p_fire', { reflectable: false, life: 2500 });
            });
          this.go('recover', 1.4);
        }
        return;
      case 'tail':
        if (this.timer <= 0) {
          this.setFrame(3);
          this.anims.stop();
          this.world.shoot(this.x - 40, this.arcadeBody.bottom - 8, -190, 0, 5, 'p_fire', { ground: true, life: 3000 });
          if (this.enraged) this.scene.time.delayedCall(500, () => this.active && this.world.shoot(this.x - 40, this.arcadeBody.bottom - 8, -240, 0, 5, 'p_fire', { ground: true, life: 3000 }));
          this.go('recover', 1.1);
        }
        return;
      case 'erupt':
        if (this.timer <= 0) {
          const p = this.world.player;
          const xs = [p.x, p.x - 70, p.x + 70].slice(0, this.enraged ? 3 : 2);
          for (const x of xs) {
            for (let k = 0; k < 6; k++) this.scene.time.delayedCall(k * 100, () => this.world.burst(x, this.world.roomH - 50, 0xff8030, 1));
            this.scene.time.delayedCall(700, () => {
              if (!this.active || this.dead) return;
              for (let k = 0; k < 3; k++) this.world.shoot(x, this.world.roomH - 50 - k * 4, (k - 1) * 20, -260 - k * 30, 4, 'p_fire', { gravity: 500, life: 2000 });
            });
          }
          this.go('recover', 1.6);
        }
        return;
      case 'recover':
        if (this.timer <= 0) this.go('idle', this.enraged ? 0.6 : 1);
        return;
      case 'stunned':
        if (this.timer <= 0) this.go('idle', 0.8);
        return;
    }
  }
}

// ---------------------------------------------------------------- chapter 4: Kai (duel)

export class KaiBoss extends Boss {
  readonly title = '影狩りカイ';
  private combo = 0;
  guarding = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'kai', { hp: 180, atk: 4, exp: 250, coins: 0 });
    this.hollow = false;
    this.arcadeBody.setSize(10, 20).setOffset(15, 16);
    this.setFrame(0);
  }

  get harmful(): boolean {
    return false; // Kai only hurts with his blades.
  }

  protected blocks(hit: HitInfo): boolean {
    return this.guarding > 0 && hit.kind !== 'charge' && Math.sign(hit.fromX - this.x) === this.facing;
  }

  strikeRect(): Phaser.Geom.Rectangle | null {
    if (this.mode !== 'strike' || this.timer > 0.16) return null;
    const b = this.arcadeBody;
    return new Phaser.Geom.Rectangle(this.facing > 0 ? b.right : b.left - 22, b.top - 2, 22, b.height + 4);
  }

  protected act(dt: number): void {
    const b = this.arcadeBody;
    const { dx, dy } = this.distToPlayer();
    this.guarding = Math.max(0, this.guarding - dt);
    switch (this.mode) {
      case 'idle':
        this.face(dx);
        this.setFrame(this.guarding > 0 ? 17 : 0);
        b.setVelocityX(0);
        if (this.timer <= 0) {
          const r = Math.random();
          if (Math.abs(dx) > 110 || r < 0.25) this.go('throw', 0.3);
          else if (r < 0.4) {
            this.guarding = 0.9;
            this.go('idle', 0.9);
          } else this.go('approach', 1.2);
        }
        return;
      case 'approach':
        this.face(dx);
        b.setVelocityX(Math.sign(dx) * 160);
        this.setFrame(2 + (Math.floor(this.t * 12) % 6));
        if (Math.abs(dx) < 34 || this.timer <= 0) {
          this.combo = this.enraged ? 3 : 2;
          this.go('strike', 0.3);
        }
        return;
      case 'strike':
        b.setVelocityX(this.facing * 60);
        this.setFrame(this.timer > 0.16 ? 10 : 11);
        if (this.timer <= 0) {
          this.combo -= 1;
          if (this.combo > 0) this.go('strike', 0.26);
          else {
            // Hop back out of reach.
            b.setVelocity(-this.facing * 170, -180);
            this.go('retreat', 0.6);
          }
        }
        return;
      case 'retreat':
        this.setFrame(8);
        if (this.onGround && this.timer <= 0) this.go('idle', this.enraged ? 0.35 : 0.6);
        return;
      case 'throw':
        this.face(dx);
        this.setFrame(19);
        b.setVelocityX(0);
        if (this.timer <= 0) {
          const n = this.enraged ? 3 : 2;
          for (let k = 0; k < n; k++) this.world.shoot(this.x + this.facing * 8, this.y - 4 + k * 6, this.facing * 220, dy * 0.3 + (k - 1) * 20, 4, 'p_feather', { reflectable: true, source: this });
          this.go('idle', 0.8);
        }
        return;
    }
  }
}

// ---------------------------------------------------------------- chapter 3: knight captain (mid-boss)

export class KnightCaptain extends Soldier {
  readonly title = '沈んだ騎士長';
  awake = true;
  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'knight', { hp: 80, atk: 4, exp: 90, coins: 80 }, { combo: 3, speed: 60, shield: false });
    this.isBoss = true;
    this.heavy = true;
    this.setScale(1.35);
    this.arcadeBody.setSize(12, 22).setOffset(14, 14);
  }
  wake(): void {}
}

// ---------------------------------------------------------------- chapter 6: Nox

/** First form: Rio's own shadow, using Rio's moves. */
export class NoxShadow extends Boss {
  readonly title = '虚の王ノクス';
  private combo = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'nox', { hp: 300, atk: 5, exp: 0, coins: 0 });
    this.arcadeBody.setSize(10, 20).setOffset(15, 16);
    this.setFrame(0);
  }

  get harmful(): boolean {
    return false;
  }

  strikeRect(): Phaser.Geom.Rectangle | null {
    if (this.mode !== 'strike' && this.mode !== 'upslash') return null;
    if (this.timer > 0.17) return null;
    const b = this.arcadeBody;
    if (this.mode === 'upslash') return new Phaser.Geom.Rectangle(b.left - 6, b.top - 22, b.width + 12, 22);
    return new Phaser.Geom.Rectangle(this.facing > 0 ? b.right : b.left - 22, b.top - 4, 22, b.height + 6);
  }

  protected act(): void {
    const b = this.arcadeBody;
    const p = this.world.player;
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    switch (this.mode) {
      case 'idle':
        this.face(dx);
        b.setVelocityX(0);
        this.setFrame(0);
        if (this.timer <= 0) {
          const r = Math.random();
          if (dy < -40 && Math.abs(dx) < 60) this.go('jump', 0.5);
          else if (Math.abs(dx) > 120 && r < 0.5) this.go('bolt', 0.35);
          else if (r < 0.2) this.go('rift', 0.3);
          else this.go('chase', 1.5);
        }
        return;
      case 'chase':
        this.face(dx);
        b.setVelocityX(Math.sign(dx) * (this.enraged ? 150 : 120));
        this.setFrame(2 + (Math.floor(this.t * 12) % 6));
        if (Math.abs(dx) < 30) {
          this.combo = this.enraged ? 3 : 2;
          this.go(dy < -24 ? 'upslash' : 'strike', 0.3);
        } else if (this.timer <= 0) this.go('idle', 0.3);
        return;
      case 'strike':
        b.setVelocityX(this.facing * 50);
        this.setFrame(this.timer > 0.17 ? 10 : 11);
        if (this.timer <= 0) {
          this.combo -= 1;
          this.go(this.combo > 0 ? 'strike' : 'idle', this.combo > 0 ? 0.26 : 0.7);
        }
        return;
      case 'upslash':
        b.setVelocityX(0);
        this.setFrame(15);
        if (this.timer <= 0) this.go('idle', 0.6);
        return;
      case 'jump':
        if (this.onGround && this.timer > 0.4) b.setVelocity(Math.sign(dx) * 80, -330);
        this.setFrame(b.velocity.y < 0 ? 8 : 9);
        if (this.timer <= 0 && this.onGround) this.go('idle', 0.4);
        if (this.timer <= 0.2 && Math.abs(dx) < 30 && Math.abs(dy) < 30) this.go('upslash', 0.3);
        return;
      case 'bolt':
        this.face(dx);
        this.setFrame(19);
        if (this.timer <= 0) {
          this.world.shoot(this.x + this.facing * 10, this.y, this.facing * 180, 0, 5, 'p_dark', { reflectable: true, source: this });
          this.go('idle', 0.6);
        }
        return;
      case 'rift':
        this.setFrame(18);
        if (this.timer <= 0) {
          // Appear behind the player.
          this.world.burst(this.x, this.y, 0x8a4ad0, 10);
          const tx = Phaser.Math.Clamp(p.x - Math.sign(dx || 1) * -30, 20, this.world.roomW - 20);
          this.setPosition(tx, p.y);
          this.world.burst(this.x, this.y, 0x8a4ad0, 10);
          this.face(p.x - tx);
          this.combo = 1;
          this.go('strike', 0.35);
        }
        return;
    }
  }
}

class ShadowHand extends Enemy {
  constructor(
    scene: Phaser.Scene,
    world: World,
    x: number,
    y: number,
    readonly owner: NoxGiant,
  ) {
    super(scene, world, x, y, 'shadowhand', { hp: 999, atk: 5, exp: 0, coins: 0 });
    this.arcadeBody.setAllowGravity(false).setSize(24, 24).setOffset(6, 12);
    this.phasing = true;
    this.heavy = true;
    this.play('shadowhand_grab');
    this.setDepth(6);
  }

  resting = false;

  get harmful(): boolean {
    return !this.resting && !this.dead;
  }

  hurt(hit: HitInfo): 'hit' | 'killed' | 'blocked' {
    // Striking the glowing palm wounds Nox itself.
    if (!this.resting) return 'blocked';
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    return this.owner.hurt({ ...hit, kind: 'magic' });
  }

  protected think(): void {}
}

/** Second form: a huge shadow above the arena that slams with its hands and rains darkness. */
export class NoxGiant extends Boss {
  readonly title = '虚の王ノクス';
  private hands: ShadowHand[] = [];
  private turn = 0;

  constructor(scene: Phaser.Scene, world: World, x: number, y: number) {
    super(scene, world, x, y, 'noxgiant', { hp: 400, atk: 6, exp: 0, coins: 0 });
    this.arcadeBody.setAllowGravity(false).setSize(80, 60).setOffset(20, 30).setImmovable(true);
    this.phasing = true;
    this.play('noxgiant_idle');
    this.setDepth(2);
  }

  get harmful(): boolean {
    return false;
  }

  protected blocks(hit: HitInfo): boolean {
    // Out of sword reach; only magic, reflected darkness and hand strikes hurt it.
    return hit.kind === 'side' || hit.kind === 'up' || hit.kind === 'down' || hit.kind === 'charge';
  }

  wake(): void {
    super.wake();
    for (const d of [-1, 1]) {
      const h = new ShadowHand(this.scene, this.world, this.x + d * 90, this.y + 60, this);
      this.world.adopt(h);
      this.hands.push(h);
    }
  }

  protected act(): void {
    this.arcadeBody.setVelocity(0, 0);
    this.setX(this.homeX + Math.sin(this.t * 0.6) * 40);
    const p = this.world.player;
    this.hands.forEach((h, i) => {
      if (h.resting || this.mode === 'slam') return;
      const tx = this.x + (i ? 90 : -90);
      const ty = this.y + 60 + Math.sin(this.t * 2 + i) * 10;
      h.setPosition(h.x + (tx - h.x) * 0.05, h.y + (ty - h.y) * 0.05);
    });
    switch (this.mode) {
      case 'idle':
        if (this.timer <= 0) {
          this.turn += 1;
          if (this.turn % 3 === 0) this.go('rain', 0.1);
          else this.slam(this.hands[this.turn % 2], p.x);
        }
        return;
      case 'slam':
        if (this.timer <= 0) this.go('idle', this.enraged ? 0.8 : 1.4);
        return;
      case 'rain':
        this.setFrame(2);
        this.anims.stop();
        if (this.timer <= 0) {
          const n = this.enraged ? 14 : 10;
          for (let k = 0; k < n; k++)
            this.scene.time.delayedCall(k * 140, () => {
              if (!this.active || this.dead) return;
              const x = Phaser.Math.Between(20, this.world.roomW - 20);
              this.world.shoot(x, 20, 0, 90, 5, 'p_dark', { reflectable: true, source: this, life: 5000 });
            });
          this.scene.time.delayedCall(n * 140, () => this.active && this.play('noxgiant_idle'));
          this.go('idle', 2.4);
        }
        return;
    }
  }

  private slam(hand: ShadowHand, x: number): void {
    if (!hand?.active) return;
    const ground = this.world.roomH - 48 - 14;
    this.scene.tweens.add({
      targets: hand,
      x,
      y: ground - 60,
      duration: 500,
      onComplete: () => {
        hand.setTint(0xff8080);
        this.scene.time.delayedCall(350, () => {
          if (!hand.active) return;
          hand.clearTint();
          this.scene.tweens.add({
            targets: hand,
            y: ground,
            duration: 140,
            onComplete: () => {
              this.world.shake(200, 0.012);
              hand.resting = true;
              this.scene.time.delayedCall(this.enraged ? 1100 : 1600, () => {
                hand.resting = false;
              });
            },
          });
        });
      },
    });
    this.go('slam', 2.4);
  }

  destroy(fromScene?: boolean): void {
    for (const h of this.hands) h.destroy();
    super.destroy(fromScene);
  }
}

export function createBoss(id: string, scene: Phaser.Scene, world: World, x: number, y: number): Boss | Enemy | null {
  switch (id) {
    case 'wolf':
      return new BossWolf(scene, world, x, y);
    case 'rockqueen':
      return new RockQueen(scene, world, x, y);
    case 'golem':
      return new Golem(scene, world, x, y);
    case 'tempest':
      return new Tempest(scene, world, x, y);
    case 'captain':
      return new KnightCaptain(scene, world, x, y);
    case 'levia':
      return new Levia(scene, world, x, y);
    case 'ignia':
      return new Ignia(scene, world, x, y);
    case 'kai':
      return new KaiBoss(scene, world, x, y);
    case 'nox':
      return new NoxShadow(scene, world, x, y);
    case 'noxgiant':
      return new NoxGiant(scene, world, x, y);
    default:
      return null;
  }
}

export const BOSS_TITLES: Record<string, string> = {
  wolf: '影喰い狼',
  rockqueen: '岩虫の女王',
  golem: '岩喰いゴーレム',
  tempest: '嵐の大鷲テンペスト',
  captain: '沈んだ騎士長',
  levia: '深き者レヴィア',
  ignia: '溶岩竜イグニア',
  kai: '影狩りカイ',
  nox: '虚の王ノクス',
  noxgiant: '虚の王ノクス',
};
