# ルミナブレード ― 灯火の剣 ―

Swordigo に影響を受けた、横スクロールのアクションアドベンチャーゲームです。
プロローグから第6章・エンディングまで遊べます（全45部屋、ボス10体、サブクエスト12個）。

## 遊び方

```bash
npm install
npm run dev      # 表示されたアドレス（http://localhost:5173）をブラウザで開く
```

タッチ操作かキーボード操作かは自動で見分けます。キーを押すとキーボード用、画面に触るとタッチ用の表示に切り替わり、看板や説明の文章もそれぞれに合わせて変わります。スマホでは、話せる相手や宝箱の前に「話す」「開ける」などのボタンが出ます。

| 操作 | キーボード | スマホ |
|---|---|---|
| 移動（2回押しでダッシュ） | ← → | 左下の ◀ ▶（指をすべらせて切り返しOK） |
| ジャンプ（長押しで高く・空中でもう一度で二段ジャンプ） | Z / スペース | ジャンプ |
| 剣（連打で3段斬り・長押しで溜め斬り） | X | 剣 |
| 上斬り／下突き（空中） | ↑ + X ／ ↓ + X | ▲／▼ + 剣 |
| 話す・調べる・扉に入る | ↑ | 「話す」などのボタン／▲ |
| 魔法 ／ 魔法の切り替え | C ／ A・S | 魔法 ／ 切替 |
| 回復薬 ／ 星の粉（MP） | Q ／ E | 回復 ／ MP |
| メニュー（装備・持ち物・ステータス・記録・設定） | Esc / Tab | メニュー |
| 足場から降りる | ↓ + Z | ▼ + ジャンプ |
| デバッグ：すべての能力を解放 | F1 | ― |

メニューの「設定」タブで、スマホのボタンを好みに変えられます（設定はセーブデータとは別に端末に保存）。

- 移動ボタンの種類：◀ ▶ ボタン／十字キー（上下・斜めも押せる）
- ボタンの大きさ（小・中・大・特大）と濃さ（うすい・ふつう・こい）
- 配置の編集：ボタンと HP・灯貨の表示をドラッグで好きな場所へ。選んだボタンだけ大きさを変えることもできる

## 開発

```bash
npm test           # 単体テスト（部屋データの検査・成長・装備・セーブ）
npm run typecheck  # 型チェック
npm run build      # dist/ に書き出し
```

### リリース

`main` か開発ブランチに push するたびに、GitHub Actions が Android 版と iPad 版を作って Releases に公開します（`.github/workflows/release.yml`）。説明文は `CHANGELOG.md` のいちばん上の項目です。

### Android版（APK）

Capacitor で Web 版をそのままアプリにしています（`android/`）。Java 21 と Android SDK（`ANDROID_HOME`）が必要です。

```bash
npm run apk   # → android/app/build/outputs/apk/debug/app-debug.apk
```

- 横画面固定・全画面（ステータスバーとナビゲーションバーを隠し、カメラの切り欠き部分まで使う）。
- 画面（ウィンドウ）の形に合わせて見える範囲を変えるので、どの端末でも黒い余白が出ません（Web 版も同じ）。
- 署名鍵 `android/app/debug.keystore` を固定しているので、新しい APK をそのまま上書きインストールでき、セーブも残ります。

### iPad版（Swift Playgrounds）

`ios/Luminablade.swiftpm` は Swift Playgrounds で開けるアプリです。中身は Web 版を全画面の WebView で表示するもの。

```bash
npm run ios   # dist/ を作って ios/Luminablade.swiftpm/Web/ にコピー
```

- `Luminablade.swiftpm` フォルダごと iPad に送り（iCloud Drive など）、Swift Playgrounds で開いて ▶ で遊べます。
- ウィンドウの形に合わせて見える範囲を変えるので、ステージマネージャのウィンドウでも黒い余白が出ません。縦長のときは「横にしてください」と表示します。
- セーブは iPad 側（UserDefaults）にも保存します。

開発サーバーで `/art.html` を開くと、コードで描いたドット絵を一覧できます。

| 場所 | 中身 |
|---|---|
| `src/art/` | ドット絵の生成（人物・敵・ボス・地形・背景・小物・アイコン） |
| `src/data/rooms/` | 部屋の地図（章ごと） |
| `src/data/npcs*.ts` / `events*.ts` | 会話・サブクエスト・ストーリー |
| `src/data/items.ts` | 装備・道具・お店・魔法 |
| `src/entities/` | 主人公・敵・ボス |
| `src/scenes/` | タイトル・ゲーム・HUD・エンディング |
| `src/world/parse.ts` | 文字で描いた地図の読み込み |

## 企画資料

- [Swordigo 調査メモ](docs/01_swordigo_research.md)
- [ストーリー設定](docs/02_story.md)
- [ゲームシステム設計](docs/03_game_system.md)
- [マップ設計](docs/04_map_design.md)
- [技術と見た目の方針](docs/05_tech_and_art.md)
- [実装メモ（本編 v1）](docs/06_implementation.md)
