import Phaser from 'phaser';
import { session } from '../session';
import { byMode } from '../inputMode';
import { FONT } from '../ui';

const CREDITS = [
  'ルミナブレード ― 灯火の剣 ―',
  '',
  '企画・シナリオ・プログラム・グラフィック',
  'Claude と あなた',
  '',
  'インスピレーション',
  'Swordigo（Touch Foo）',
  '',
  '使用ライブラリ',
  'Phaser 3 / TypeScript / Vite',
  '',
  'Thank you for playing!',
];

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const d = session.data;
    const lights = d.lights.length;
    this.cameras.main.setBackgroundColor(0x0b0b16).fadeIn(1500, 255, 255, 255);

    // Dawn over the village.
    for (const [k, i] of [
      ['bg_village_sky', 0],
      ['bg_village_far', 1],
      ['bg_village_mid', 2],
    ] as const)
      this.add.tileSprite(0, 0, W / 2, H / 2, k).setOrigin(0).setScale(2).setDepth(i).setAlpha(0.9);
    this.add.rectangle(0, 0, W, H, 0x000000, 0.35).setOrigin(0).setDepth(3);
    this.add.particles(0, 0, 'dot', { x: { min: 0, max: W }, y: H, lifespan: 7000, speedY: { min: -40, max: -15 }, scale: 2, alpha: { start: 0.9, end: 0 }, tint: 0xfff3a0, frequency: 90, blendMode: 'ADD' }).setDepth(4);

    const ground = H - 70;
    const rio = this.add.sprite(W / 2, ground, 'rio', 0).setOrigin(0.5, 1).setScale(4).setDepth(6).play('rio_idle');
    if (lights >= 12) {
      this.add.sprite(W / 2 - 120, ground, 'npc_mina', 0).setOrigin(0.5, 1).setScale(4).setDepth(6).play('npc_mina_idle');
      this.add.sprite(W / 2 + 120, ground, 'npc_kai', 0).setOrigin(0.5, 1).setScale(4).setDepth(6).setFlipX(true).play('npc_kai_idle');
    }
    void rio;

    const t = Math.floor(d.playTime);
    const time = `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    const epilogue =
      lights >= 12
        ? 'リオはカイと共に、残った虚を払う旅に出た。\nミナは新しい地図を描きはじめる。――三人の名前を、余白に書き添えて。'
        : lights >= 6
          ? 'リオは村に戻らず、残った虚を払う旅に出た。\n空には、星がひとつ増えていた。'
          : '夜明けの空に、星がひとつ増えていた。\nリオの影は、もう勝手に動かない。';

    const lines = [
      { text: 'THE END', size: 52, color: '#fff3a0' },
      { text: epilogue, size: 22, color: '#ffffff' },
      { text: `レベル ${d.level}　　託された灯 ${lights}/12　　プレイ時間 ${time}`, size: 18, color: '#cfd8ff' },
    ];
    let y = 70;
    const objs = lines.map((l) => {
      const o = this.add.text(W / 2, y, l.text, { fontFamily: FONT, fontSize: `${l.size}px`, color: l.color, align: 'center', lineSpacing: 8, stroke: '#000', strokeThickness: 4 }).setOrigin(0.5, 0).setDepth(7).setAlpha(0);
      y += o.height + 26;
      return o;
    });
    objs.forEach((o, i) => this.tweens.add({ targets: o, alpha: 1, delay: 1200 + i * 1400, duration: 1200 }));

    // Credits roll after the epilogue.
    const credits = this.add
      .text(W / 2, H + 20, CREDITS.join('\n'), { fontFamily: FONT, fontSize: '22px', color: '#ffffff', align: 'center', lineSpacing: 12, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5, 0)
      .setDepth(8);
    this.time.delayedCall(7000, () => {
      this.tweens.add({ targets: objs, alpha: 0, duration: 1000 });
      this.tweens.add({ targets: credits, y: -credits.height - 20, duration: 22000 });
    });

    const back = () => this.scene.start('Title');
    this.time.delayedCall(3000, () => {
      this.add.text(W - 16, H - 12, byMode('Z でタイトルへ', 'タップでタイトルへ'), { fontFamily: FONT, fontSize: '14px', color: '#9aa3c0' }).setOrigin(1, 1).setDepth(9);
      this.input.keyboard!.once('keydown-Z', back);
      this.input.once('pointerdown', back);
    });
  }
}
