# ルミナブレード ― 灯火の剣 ―（仮）

Swordigo に影響を受けた、横スクロールのアクションアドベンチャーゲームです。
いまは **試作版（プロローグ）** が遊べます。見た目は仮の図形です。

## 遊び方

```bash
npm install
npm run dev      # http://localhost:5173 をブラウザで開く
```

| 操作 | キーボード | スマホ |
|---|---|---|
| 移動（2回押しでダッシュ） | ← → | 左の十字ボタン |
| ジャンプ（長押しで高く） | Z / スペース | ジャンプ |
| 剣（連打で3段斬り） | X | 剣 |
| 上斬り／下突き（空中） | ↑ + X ／ ↓ + X | 十字 + 剣 |
| 話す・調べる・セーブ | ↑ | ▲ |
| 足場から降りる | ↓ + Z | ▼ + ジャンプ |
| 魔法（灯弾） | C | 魔法 |
| デバッグ：二段ジャンプと魔法を解放 | F1 | ― |

## 開発

```bash
npm test           # 単体テスト（成長の計算・セーブ・部屋データの検査）
npm run typecheck  # 型チェック
npm run build      # dist/ に書き出し
```

- `src/config.ts` … 動きや剣の数値
- `src/data/rooms.ts` … 部屋の配置（文字で描くマップ）
- `src/data/dialogs.ts` … 会話
- `src/entities/` … 主人公・敵・ボス
- `src/scenes/` … タイトル、ゲーム、HUD、エンディング

## 企画資料

- [Swordigo 調査メモ](docs/01_swordigo_research.md)
- [ストーリー設定](docs/02_story.md)
- [ゲームシステム設計](docs/03_game_system.md)
- [マップ設計](docs/04_map_design.md)
- [技術と見た目の方針](docs/05_tech_and_art.md)
