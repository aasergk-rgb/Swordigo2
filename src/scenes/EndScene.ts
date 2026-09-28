import Phaser from 'phaser';
import { session } from '../session';
import { FONT } from './HUDScene';

export class EndScene extends Phaser.Scene {
  constructor() {
    super('End');
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const d = session.data;
    this.cameras.main.setBackgroundColor(0x0b0b16).fadeIn(1200, 255, 255, 255);
    const min = Math.floor(d.playTime / 60);
    const sec = Math.floor(d.playTime % 60).toString().padStart(2, '0');
    this.add.text(W / 2, 110, 'プロローグ クリア', { fontFamily: FONT, fontSize: '48px', color: '#fff3a0' }).setOrigin(0.5);
    this.add
      .text(
        W / 2,
        230,
        'ハルナ村で目を覚ましたリオは、\n割れた剣の柄を握りしめ、四つの欠片を探す旅に出る――\n\n（第1章「石の心臓」へつづく）',
        { fontFamily: FONT, fontSize: '22px', color: '#ffffff', align: 'center', lineSpacing: 10 },
      )
      .setOrigin(0.5);
    this.add
      .text(W / 2, 380, `レベル ${d.level}　　灯貨 ${d.coins}　　プレイ時間 ${min}:${sec}`, { fontFamily: FONT, fontSize: '20px', color: '#cfd8ff' })
      .setOrigin(0.5);
    this.add.text(W / 2, H - 60, 'Z（またはタップ）でタイトルへ', { fontFamily: FONT, fontSize: '18px', color: '#9aa3c0' }).setOrigin(0.5);
    const back = () => this.scene.start('Title');
    this.time.delayedCall(800, () => {
      this.input.keyboard!.once('keydown-Z', back);
      this.input.once('pointerdown', back);
    });
  }
}
