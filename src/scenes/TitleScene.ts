import Phaser from 'phaser';
import { newGame } from '../progress';
import { loadGame, session } from '../session';
import { FONT } from './HUDScene';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.cameras.main.setBackgroundColor(0x10131f);
    this.add.text(W / 2, 130, 'ルミナブレード', { fontFamily: FONT, fontSize: '64px', color: '#fff3a0', stroke: '#3a2a10', strokeThickness: 8 }).setOrigin(0.5);
    this.add.text(W / 2, 195, '― 灯火の剣 ―　（試作版：プロローグ）', { fontFamily: FONT, fontSize: '22px', color: '#cfd8ff' }).setOrigin(0.5);

    const save = loadGame();
    const item = (y: number, label: string, onPick: () => void) => {
      const t = this.add.text(W / 2, y, label, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', backgroundColor: '#00000066', padding: { x: 16, y: 6 } }).setOrigin(0.5);
      t.setInteractive({ useHandCursor: true }).on('pointerdown', onPick);
      return t;
    };
    const start = () => {
      session.data = newGame();
      this.scene.start('Game', { room: session.data.room, entry: 'spawn' });
    };
    const resume = () => {
      if (!save) return;
      session.data = save;
      this.scene.start('Game', { room: save.room, entry: 'fountain' });
    };
    item(290, 'Z：はじめから', start);
    if (save) item(345, 'X：つづきから', resume);

    this.add
      .text(
        W / 2,
        H - 70,
        '← →：移動（2回押しでダッシュ）   Z / スペース：ジャンプ   X：剣   C：魔法   ↑：話す・調べる\n↓+Z：足場から降りる   F1：デバッグ（二段ジャンプと魔法を解放）',
        { fontFamily: FONT, fontSize: '16px', color: '#9aa3c0', align: 'center', lineSpacing: 6 },
      )
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.once('keydown-Z', start);
    kb.once('keydown-SPACE', start);
    kb.once('keydown-ENTER', start);
    if (save) kb.once('keydown-X', resume);
  }
}
