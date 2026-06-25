# 英単語クエスト 🗡️📚

中学生・高校生・大学生・社会人レベルに対応した、ゲーム感覚で学べる英単語学習アプリです。

## 主な機能

- **レベル別の英単語学習** — 一問一答および穴埋め例文形式
- **復習リスト** — 間違えた単語を自動でリストアップして再挑戦
- **習熟度グラフ** — 学習の進捗を可視化
- **デイリーログインボーナス** — 継続学習をサポート
- **ランキング機能** — スコアを競ってモチベーションUP
- **AI 連携** — Google Gemini API を利用した機能を搭載

## 技術スタック

- React 19 + TypeScript
- Vite（フロントエンドのビルド）
- Express（サーバー）
- Tailwind CSS
- Google Gemini API（`@google/genai`）

## ローカルでの実行方法

**前提:** [Node.js](https://nodejs.org/) がインストールされていること

1. 依存パッケージをインストール:
   ```bash
   npm install
   ```

2. 環境変数を設定:
   `.env.example` をコピーして `.env` を作成し、自分の Gemini API キーを設定します。
   ```bash
   cp .env.example .env
   ```
   `.env` 内の `GEMINI_API_KEY` を、ご自身の API キーに置き換えてください。
   （API キーは [Google AI Studio](https://ai.studio/) で取得できます）

3. 開発サーバーを起動:
   ```bash
   npm run dev
   ```

## ビルド

```bash
npm run build   # 本番用にビルド
npm run start   # ビルドしたサーバーを起動
```

## 注意

`.env` には API キーなどの秘密情報が含まれます。`.gitignore` で除外しているため Git には含まれません。**絶対に公開しないでください。**
