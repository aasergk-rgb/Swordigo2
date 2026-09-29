import Phaser from 'phaser';
import { newGame } from '../progress';
import { loadGame, session } from '../session';
import { byMode, onInputMode } from '../inputMode';
import { FONT } from '../ui';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    // Painted backdrop: the village at dusk, scaled 2x like the game.
    for (const [k, i] of [
      ['bg_village_sky', 0],
      ['bg_village_far', 1],
      ['bg_village_mid', 2],
    ] as const) {
      const ts = this.add.tileSprite(0, 0, W / 2, H / 2, k).setOrigin(0).setScale(2).setDepth(i);
      this.tweens.add({ targets: ts, tilePositionX: 480, duration: 120000 / (i + 1), repeat: -1 });
    }
    this.add.rectangle(0, 0, W, H, 0x000000, 0.25).setOrigin(0).setDepth(3);
    this.add.particles(0, 0, 'dot', { x: { min: 0, max: W }, y: H, lifespan: 6000, speedY: { min: -40, max: -15 }, speedX: { min: -8, max: 8 }, scale: 2, alpha: { start: 0.8, end: 0 }, tint: 0xfff3a0, frequency: 120, blendMode: 'ADD' }).setDepth(4);

    const glow = this.add.image(W / 2, 140, 'light_warm').setScale(3.2, 1.4).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    this.tweens.add({ targets: glow, alpha: 0.25, yoyo: true, repeat: -1, duration: 1800 });
    this.add.text(W / 2, 130, 'ルミナブレード', { fontFamily: FONT, fontSize: '68px', color: '#fff3a0', stroke: '#3a2a10', strokeThickness: 10 }).setOrigin(0.5).setDepth(6);
    this.add.text(W / 2, 200, '― 灯火の剣 ―', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#1a1030', strokeThickness: 5 }).setOrigin(0.5).setDepth(6);
    const rio = this.add.sprite(W / 2, 330, 'rio', 0).setScale(4).setDepth(6);
    rio.play('rio_idle');

    const save = loadGame();
    const items: { label: string; run: () => void }[] = [
      {
        label: 'はじめから',
        run: () => {
          session.data = newGame();
          this.scene.start('Game', { room: 'village', at: '@' });
        },
      },
    ];
    if (save)
      items.unshift({
        label: 'つづきから',
        run: () => {
          session.data = save;
          this.scene.start('Game', { room: save.room, at: 'F' });
        },
      });

    let cursor = 0;
    const texts = items.map((it, i) =>
      this.add
        .text(W / 2, 410 + i * 44, it.label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#000', strokeThickness: 5 })
        .setOrigin(0.5)
        .setDepth(6)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => it.run()),
    );
    const refresh = () => texts.forEach((t, i) => t.setText((i === cursor ? '▶ ' : '　') + items[i].label + (i === cursor ? ' ◀' : '　')).setColor(i === cursor ? '#fff3a0' : '#c8d0e8'));
    refresh();

    const help = this.add.text(W / 2, H - 14, '', { fontFamily: FONT, fontSize: '14px', color: '#c8d0e8', stroke: '#000', strokeThickness: 3, align: 'center', lineSpacing: 4 }).setOrigin(0.5, 1).setDepth(6);
    const showHelp = () =>
      help.setFontSize(byMode(14, 20)).setText(
        byMode(
          '↑↓ で選んで Z で決定\n← →：移動　Z：ジャンプ　X：剣（長押しで溜め）　C：魔法　A/S：魔法切替　↑：話す　Q/E：回復　Esc：メニュー',
          '遊びたいものをタップ\n左下の ◀ ▶ で移動、右のボタンでジャンプ・剣・魔法。話せる相手の前では「話す」ボタンが出ます',
        ),
      );
    showHelp();
    const off = onInputMode(showHelp);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);

    const kb = this.input.keyboard!;
    kb.on('keydown-UP', () => {
      cursor = (cursor + items.length - 1) % items.length;
      refresh();
    });
    kb.on('keydown-DOWN', () => {
      cursor = (cursor + 1) % items.length;
      refresh();
    });
    const go = () => items[cursor].run();
    kb.once('keydown-Z', go);
    kb.once('keydown-SPACE', go);
    kb.once('keydown-ENTER', go);
  }
}
