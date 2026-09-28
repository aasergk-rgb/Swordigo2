import Phaser from 'phaser';
import { PLAYER, SWORD, type SwingSpec } from '../config';
import { PLAYER_FRAMES } from '../art/humanoid';
import type { Controls } from '../input';
import { hasCharm } from '../progress';
import { session } from '../session';

export type AttackKind = 'side' | 'up' | 'down' | 'charge';

interface Attack {
  kind: AttackKind;
  step: number; // 1..3 for the side combo
  spec: SwingSpec | null; // null for the down thrust, which lasts until landing
  t: number;
  id: number;
}

const CHARGE_TIME = 0.8;
const CHARGE_SPEC: SwingSpec = { mult: 3, startup: 0.06, active: 0.14, total: 0.4 };
const RIFT_TIME = 0.13;
const RIFT_SPEED = 500;

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
  private queuedAttack = false;
  private attackHeld = 0;
  private castTimer = 0;
  invuln = 0;
  attack: Attack | null = null;
  private attackSerial = 0;
  dropThroughUntil = 0;
  /** Environmental state set by the scene each frame. */
  inWater = false;
  wind = new Phaser.Math.Vector2();
  /** Cutscenes freeze input. */
  locked = false;
  riftTimer = 0;
  wardTimer = 0;
  private slash: Phaser.GameObjects.Image;
  private chargeGlow: Phaser.GameObjects.Image;
  private skin: 'rio' | 'nox';

  constructor(scene: Phaser.Scene, x: number, y: number, skin: 'rio' | 'nox' = 'rio') {
    super(scene, x, y, skin, 0);
    this.skin = skin;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(10, 20).setOffset(15, 16);
    body.setMaxVelocity(1000, PLAYER.maxFall);
    body.setCollideWorldBounds(true);
    this.setDepth(10);
    this.slash = scene.add.image(x, y, 'slash_side').setDepth(11).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.chargeGlow = scene.add.image(x, y, 'light_warm').setDepth(9).setVisible(false).setScale(0.35).setBlendMode(Phaser.BlendModes.ADD);
    this.play(`${skin}_idle`);
  }

  get arcadeBody(): Phaser.Physics.Arcade.Body {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  get onGround(): boolean {
    return this.arcadeBody.blocked.down || this.arcadeBody.touching.down;
  }

  get controlLocked(): boolean {
    return this.knockTimer > 0 || this.locked;
  }

  get rifting(): boolean {
    return this.riftTimer > 0;
  }

  get charged(): boolean {
    return this.attackHeld >= CHARGE_TIME;
  }

  /** Feet position, handy for placing things on the ground. */
  get feetY(): number {
    return this.arcadeBody.bottom;
  }

  tick(dt: number, c: Controls, now: number): void {
    const body = this.arcadeBody;
    this.invuln = Math.max(0, this.invuln - dt);
    this.knockTimer = Math.max(0, this.knockTimer - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.castTimer = Math.max(0, this.castTimer - dt);
    this.wardTimer = Math.max(0, this.wardTimer - dt);
    this.setAlpha(this.invuln > 0 && !this.rifting && Math.floor(this.invuln * 20) % 2 === 0 ? 0.35 : 1);

    const grounded = this.onGround;
    if (grounded || this.inWater) {
      this.coyote = PLAYER.coyoteTime;
      this.airJumps = session.data.abilities.doubleJump ? 1 : 0;
    } else {
      this.coyote = Math.max(0, this.coyote - dt);
    }

    if (this.rifting) {
      this.riftTimer -= dt;
      body.setAllowGravity(false);
      body.setVelocity(this.facing * RIFT_SPEED, 0);
      if (this.riftTimer <= 0) {
        body.setAllowGravity(true);
        body.setVelocityX(this.facing * PLAYER.walkSpeed);
      }
      this.updateVisuals();
      return;
    }

    // Gravity: heavier when falling, light in water, gentle with the feather charm.
    const featherFloat = hasCharm(session.data, 'feather') && c.isDown('jump') && body.velocity.y > 0 && !this.locked;
    if (this.inWater) {
      body.setGravityY(-PLAYER.gravity * 0.7);
      body.setMaxVelocity(1000, 90);
    } else {
      body.setGravityY(body.velocity.y > 0 ? PLAYER.gravity * (PLAYER.fallGravityFactor - 1) : 0);
      body.setMaxVelocity(1000, featherFloat ? 55 : PLAYER.maxFall);
    }
    if (this.wind.x || this.wind.y) {
      body.velocity.x += this.wind.x * dt;
      body.velocity.y += this.wind.y * dt;
    }

    if (this.controlLocked) {
      if (this.locked && grounded) body.setVelocityX(body.velocity.x * 0.8);
      this.updateAttack(dt);
      this.updateVisuals();
      return;
    }

    this.updateRun(dt, c, now);
    this.updateJump(dt, c, now);
    this.updateAttackInput(dt, c, grounded);
    this.updateAttack(dt);
    this.updateVisuals();
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
    if (this.inWater) top *= 0.7;
    const target = dir * top + this.wind.x * 0.25;
    const vx = body.velocity.x;
    const rate = (dir === 0 ? PLAYER.walkSpeed / PLAYER.decelTime : PLAYER.walkSpeed / PLAYER.accelTime) * dt;
    body.setVelocityX(Math.abs(target - vx) <= rate ? target : vx + Math.sign(target - vx) * rate);

    if (dir !== 0 && (!this.attack || this.attack.kind === 'down')) {
      this.facing = dir;
      this.setFlipX(dir < 0);
    }
  }

  private updateJump(dt: number, c: Controls, now: number): void {
    const body = this.arcadeBody;
    const pressed = c.justDown('jump');

    // Down + jump on a one-way platform drops through it.
    if (pressed && c.isDown('down') && this.onGround && this.standingOnPlatform?.()) {
      this.dropThroughUntil = now + 220;
      this.jumpBuffer = 0;
      return;
    }

    if (this.inWater) {
      // Swim strokes: every press pushes up.
      if (pressed) {
        body.setVelocityY(-190);
        this.jumpHeld = false;
      }
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

  private updateAttackInput(dt: number, c: Controls, grounded: boolean): void {
    const pressed = c.justDown('attack');
    const a = this.attack;

    // Holding the button charges a heavy slash (once learned).
    if (session.data.abilities.charge && c.isDown('attack') && !a) this.attackHeld += dt;
    else if (!c.isDown('attack')) {
      if (this.attackHeld >= CHARGE_TIME && !a) {
        this.attackHeld = 0;
        this.startAttack('charge', 0, CHARGE_SPEC);
        return;
      }
      this.attackHeld = 0;
    }

    // A press during a side swing is remembered and starts the next combo step.
    if (a) {
      if (pressed && a.kind === 'side' && a.spec && a.t > a.spec.startup) this.queuedAttack = true;
      return;
    }
    if (!pressed && !this.queuedAttack) return;
    this.queuedAttack = false;

    if (!grounded && !this.inWater && c.isDown('down')) {
      this.startAttack('down', 0, null);
    } else if (c.isDown('up')) {
      this.startAttack('up', 0, SWORD.up);
    } else {
      let step = this.comboTimer > 0 ? this.lastStep + 1 : 1;
      if (step > 3 || (!grounded && step > 2)) step = 1;
      const spec = SWORD.combo[step - 1];
      // The wind blade swings faster.
      const fast = session.data.equip.sword === 'windblade' ? 0.8 : 1;
      this.startAttack('side', step, { ...spec, total: spec.total * fast });
      this.lastStep = step;
    }
  }

  private startAttack(kind: AttackKind, step: number, spec: SwingSpec | null): void {
    this.attack = { kind, step, spec, t: 0, id: ++this.attackSerial };
    this.comboTimer = 0;
    if (kind === 'charge') this.arcadeBody.setVelocityX(this.facing * 160);
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
    let m = a.spec!.mult;
    if (a.kind === 'side' && a.step === 3 && hasCharm(session.data, 'wolfFang')) m *= 1.3;
    return m;
  }

  /** The sword's hit box while the swing is active, else null. */
  attackRect(): Phaser.Geom.Rectangle | null {
    const a = this.attack;
    if (!a) return null;
    if (a.spec && (a.t < a.spec.startup || a.t > a.spec.startup + a.spec.active)) return null;
    const b = this.arcadeBody;
    const r = SWORD.reach + (a.kind === 'charge' ? 10 : 0);
    if (a.kind === 'side' || a.kind === 'charge') {
      const x = this.facing > 0 ? b.right : b.left - r;
      return new Phaser.Geom.Rectangle(x, b.top - 4, r, b.height + 6);
    }
    if (a.kind === 'up') return new Phaser.Geom.Rectangle(b.left - 6, b.top - r, b.width + 12, r);
    return new Phaser.Geom.Rectangle(b.left - 3, b.bottom - 2, b.width + 6, 16);
  }

  get attackId(): number {
    return this.attack?.id ?? -1;
  }

  private drawSlash(): void {
    const rect = this.attackRect();
    const a = this.attack;
    if (!rect || !a) {
      this.slash.setVisible(false);
      return;
    }
    const gold = a.kind === 'charge' || a.step === 3 || session.data.equip.sword === 'luminablade';
    const tex = a.kind === 'up' ? 'slash_up' : a.kind === 'down' ? 'slash_down' : a.kind === 'charge' || a.step === 3 ? 'slash_thrust' : 'slash_side';
    this.slash
      .setTexture(gold ? `${tex}_gold` : tex)
      .setVisible(true)
      .setPosition(rect.centerX + (a.kind === 'side' ? this.facing * 2 : 0), rect.centerY)
      .setFlipX(this.facing < 0 && (a.kind === 'side' || a.kind === 'charge' || a.step === 3))
      .setFlipY(a.kind === 'side' && a.step === 2)
      .setScale(a.kind === 'charge' ? 1.4 : 1)
      .setAlpha(0.95);
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
    this.attackHeld = 0;
    this.endAttack();
  }

  cast(): void {
    this.castTimer = 0.22;
  }

  startRift(): void {
    this.riftTimer = RIFT_TIME;
    this.invuln = Math.max(this.invuln, RIFT_TIME + 0.1);
    this.endAttack();
  }

  private updateVisuals(): void {
    const body = this.arcadeBody;
    const a = this.attack;
    const s = this.skin;
    const frame = (i: number) => {
      this.anims.stop();
      this.setFrame(i);
    };
    if (this.knockTimer > 0) frame(PLAYER_FRAMES.hurt[0]);
    else if (this.rifting) frame(PLAYER_FRAMES.dash[0]);
    else if (a) {
      const early = a.spec ? a.t < a.spec.startup + 0.02 : false;
      if (a.kind === 'down') frame(PLAYER_FRAMES.down[0]);
      else if (a.kind === 'up') frame(PLAYER_FRAMES.up[0]);
      else if (a.kind === 'charge') frame(early ? PLAYER_FRAMES.atk1[0] : PLAYER_FRAMES.atk3[0]);
      else if (a.step === 1) frame(PLAYER_FRAMES.atk1[early ? 0 : 1]);
      else if (a.step === 2) frame(PLAYER_FRAMES.atk2[early ? 0 : 1]);
      else frame(PLAYER_FRAMES.atk3[0]);
    } else if (this.castTimer > 0) frame(PLAYER_FRAMES.cast[0]);
    else if (!this.onGround && !this.inWater) frame(body.velocity.y < 0 ? PLAYER_FRAMES.jump[0] : PLAYER_FRAMES.fall[0]);
    else if (this.inWater && !this.onGround) frame(body.velocity.y < 0 ? PLAYER_FRAMES.jump[0] : PLAYER_FRAMES.fall[0]);
    else if (Math.abs(body.velocity.x) > 12) {
      this.play(`${s}_run`, true);
      this.anims.timeScale = this.dashing ? 1.5 : 1;
    } else this.play(`${s}_idle`, true);

    // Charge glow grows while the slash charges.
    const charging = this.attackHeld > 0.2;
    this.chargeGlow.setVisible(charging).setPosition(this.x + this.facing * 6, this.y + 2);
    if (charging) {
      const ready = this.charged;
      this.chargeGlow.setScale(ready ? 0.45 + Math.sin(this.scene.time.now / 60) * 0.05 : 0.15 + this.attackHeld * 0.3).setAlpha(ready ? 0.9 : 0.6);
      if (ready) this.setTint(Math.floor(this.scene.time.now / 80) % 2 ? 0xfff0b0 : 0xffffff);
    } else if (!this.isTinted || this.tintTopLeft === 0xfff0b0) this.clearTint();
  }

  private emitPuff(): void {
    for (const dx of [-4, 4]) {
      const p = this.scene.add.image(this.x + dx, this.arcadeBody.bottom, 'particle').setAlpha(0.8).setDepth(9);
      this.scene.tweens.add({ targets: p, alpha: 0, x: this.x + dx * 3, y: p.y + 4, duration: 220, onComplete: () => p.destroy() });
    }
  }

  override destroy(fromScene?: boolean): void {
    this.slash?.destroy();
    this.chargeGlow?.destroy();
    super.destroy(fromScene);
  }
}
