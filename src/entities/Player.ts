import Phaser from 'phaser';
import { PLAYER, SWORD, type SwingSpec } from '../config';
import type { Controls } from '../input';
import { session } from '../session';

export type AttackKind = 'side' | 'up' | 'down';

interface Attack {
  kind: AttackKind;
  step: number; // 1..3 for side combo
  spec: SwingSpec | null; // null for the down thrust, which lasts until landing
  t: number;
  id: number;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  facing = 1;
  private coyote = 0;
  private jumpBuffer = 0;
  private airJumps = 0;
  private jumpHeld = false;
  private dashing = false;
  private lastTapDir = 0;
  private lastTapTime = -1;
  private comboTimer = 0;
  private lastStep = 0;
  private knockTimer = 0;
  invuln = 0;
  attack: Attack | null = null;
  private attackSerial = 0;
  dropThroughUntil = 0;
  private slash: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 20).setOffset(1, 2);
    body.setMaxVelocity(1000, PLAYER.maxFall);
    body.setCollideWorldBounds(true);
    this.setDepth(10);
    this.slash = scene.add.image(x, y, 'slash').setDepth(11).setVisible(false).setAlpha(0.9);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get onGround(): boolean {
    return this.arcadeBody.blocked.down || this.arcadeBody.touching.down;
  }

  get controlLocked(): boolean {
    return this.knockTimer > 0;
  }

  tick(dt: number, c: Controls, now: number): void {
    const body = this.arcadeBody;
    this.invuln = Math.max(0, this.invuln - dt);
    this.knockTimer = Math.max(0, this.knockTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.setAlpha(this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0 ? 0.3 : 1);

    const grounded = this.onGround;
    if (grounded) {
      this.coyote = PLAYER.coyoteTime;
      this.airJumps = session.data.abilities.doubleJump ? 1 : 0;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    // Falling feels snappier with extra gravity.
    body.setGravityY(body.velocity.y > 0 ? PLAYER.gravity * (PLAYER.fallGravityFactor - 1) : 0);

    if (this.controlLocked) {
      this.updateAttack(dt);
      return;
    }

    this.updateRun(dt, c, now);
    this.updateJump(dt, c, now);
    this.updateAttackInput(c, grounded);
    this.updateAttack(dt);
  }

  private updateRun(dt: number, c: Controls, now: number): void {
    const body = this.arcadeBody;
    for (const [btn, d] of [['left', -1], ['right', 1]] as const) {
      if (c.justDown(btn)) {
        this.dashing = this.lastTapDir === d && now - this.lastTapTime < PLAYER.doubleTapWindow * 1000;
        this.lastTapDir = d;
        this.lastTapTime = now;
      }
    }
    const dir = (c.isDown('right') ? 1 : 0) - (c.isDown('left') ? 1 : 0);
    if (dir === 0) this.dashing = false;

    let top = this.dashing ? PLAYER.dashSpeed : PLAYER.walkSpeed;
    if (this.attack) top *= PLAYER.attackMoveFactor;
    const target = dir * top;
    const vx = body.velocity.x;
    const rate = (dir === 0 ? PLAYER.walkSpeed / PLAYER.decelTime : PLAYER.walkSpeed / PLAYER.accelTime) * dt;
    body.setVelocityX(Math.abs(target - vx) <= rate ? target : vx + Math.sign(target - vx) * rate);

    if (dir !== 0 && !this.attack) {
      this.facing = dir;
      this.setFlipX(dir < 0);
    }
  }

  private updateJump(dt: number, c: Controls, now: number): void {
    const body = this.arcadeBody;
    const pressed = c.justDown('jump');

    // Down + jump on a one-way platform drops through it.
    if (pressed && c.isDown('down') && this.onGround && this.standingOnPlatform?.()) {
      this.dropThroughUntil = now + 200;
      this.jumpBuffer = 0;
      return;
    }

    if (pressed) this.jumpBuffer = PLAYER.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0) {
      body.setVelocityY(-PLAYER.jumpVelocity);
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.jumpHeld = true;
    } else if (pressed && this.coyote <= 0 && this.airJumps > 0) {
      body.setVelocityY(-PLAYER.doubleJumpVelocity);
      this.airJumps -= 1;
      this.jumpBuffer = 0;
      this.jumpHeld = true;
      this.emitPuff();
    }

    // Releasing jump early cuts the jump short.
    if (this.jumpHeld && !c.isDown('jump')) {
      this.jumpHeld = false;
      if (body.velocity.y < 0) body.setVelocityY(body.velocity.y * PLAYER.jumpCutFactor);
    }
  }

  /** Set by the scene: whether the tile underfoot is a one-way platform. */
  standingOnPlatform?: () => boolean;

  private queuedAttack = false;

  private updateAttackInput(c: Controls, grounded: boolean): void {
    const pressed = c.justDown('attack');
    const a = this.attack;
    // A press during a side swing is remembered and starts the next combo step.
    if (a) {
      if (pressed && a.kind === 'side' && a.spec && a.t > a.spec.startup) this.queuedAttack = true;
      return;
    }
    if (!pressed && !this.queuedAttack) return;
    this.queuedAttack = false;

    if (!grounded && c.isDown('down')) {
      this.startAttack('down', 0, null);
    } else if (c.isDown('up')) {
      this.startAttack('up', 0, SWORD.up);
    } else {
      let step = this.comboTimer > 0 ? this.lastStep + 1 : 1;
      if (step > 3 || (!grounded && step > 2)) step = 1;
      this.startAttack('side', step, SWORD.combo[step - 1]);
      this.lastStep = step;
    }
  }

  private startAttack(kind: AttackKind, step: number, spec: SwingSpec | null): void {
    this.attack = { kind, step, spec, t: 0, id: ++this.attackSerial };
    this.comboTimer = 0;
  }

  private updateAttack(dt: number): void {
    const a = this.attack;
    if (!a) {
      this.slash.setVisible(false);
      return;
    }
    a.t += dt;
    if (a.kind === 'down') {
      if (this.onGround || a.t > SWORD.downMaxTime) this.endAttack();
    } else if (a.spec && a.t >= a.spec.total) {
      if (a.kind === 'side') this.comboTimer = SWORD.comboWindow;
      this.endAttack();
    }
    this.drawSlash();
  }

  endAttack(): void {
    this.attack = null;
    this.slash.setVisible(false);
    if (this.knockTimer > 0) this.queuedAttack = false;
  }

  get attackMult(): number {
    const a = this.attack;
    if (!a) return 0;
    if (a.kind === 'down') return SWORD.downMult;
    return a.spec!.mult;
  }

  /** The sword's hit box while the swing is active, else null. */
  attackRect(): Phaser.Geom.Rectangle | null {
    const a = this.attack;
    if (!a) return null;
    if (a.spec && (a.t < a.spec.startup || a.t > a.spec.startup + a.spec.active)) return null;
    const b = this.arcadeBody;
    const r = SWORD.reach;
    if (a.kind === 'side') {
      const x = this.facing > 0 ? b.right : b.left - r;
      return new Phaser.Geom.Rectangle(x, b.top - 2, r, b.height + 2);
    }
    if (a.kind === 'up') return new Phaser.Geom.Rectangle(b.left - 5, b.top - r, b.width + 10, r);
    return new Phaser.Geom.Rectangle(b.left - 2, b.bottom - 2, b.width + 4, 14);
  }

  get attackId(): number {
    return this.attack?.id ?? -1;
  }

  private drawSlash(): void {
    const rect = this.attackRect();
    if (!rect || !this.attack) {
      this.slash.setVisible(false);
      return;
    }
    const k = this.attack.kind;
    this.slash.setVisible(true).setPosition(rect.centerX, rect.centerY);
    if (k === 'side') this.slash.setTexture('slash').setFlipX(this.facing < 0).setFlipY(this.attack.step === 2).setAngle(0);
    else this.slash.setTexture('slash_v').setFlipX(false).setFlipY(k === 'down').setAngle(0);
    this.slash.setTint(this.attack.step === 3 ? 0xfff0a0 : 0xffffff);
  }

  /** Bounce up after the down thrust connects. */
  pogo(): void {
    this.arcadeBody.setVelocityY(PLAYER.pogoVelocity);
    this.airJumps = session.data.abilities.doubleJump ? 1 : 0;
    this.jumpHeld = false;
    this.endAttack();
  }

  hurt(fromX: number): void {
    const dir = this.x < fromX ? -1 : 1;
    this.arcadeBody.setVelocity(dir * PLAYER.knockbackX, PLAYER.knockbackY);
    this.knockTimer = PLAYER.knockbackTime;
    this.invuln = PLAYER.invulnTime;
    this.dashing = false;
    this.endAttack();
  }

  private emitPuff(): void {
    const p = this.scene.add.image(this.x, this.arcadeBody.bottom, 'particle').setAlpha(0.8).setScale(3, 1);
    this.scene.tweens.add({ targets: p, alpha: 0, scaleX: 6, duration: 200, onComplete: () => p.destroy() });
  }

  override destroy(fromScene?: boolean): void {
    this.slash?.destroy();
    super.destroy(fromScene);
  }
}
