# eitango-quest

英単語学習アプリ。フロントエンドは React + Vite（`src/`）、バックエンドは Express（`server.ts`）。

## 検証コマンド

```bash
npm run lint    # tsc --noEmit（型チェック）
npm run build   # vite build + server.ts のバンドル
```

コードを変更したら、コミット前に上記2つを通すこと。テストランナーは未導入。

## issue 修正時のワークフロー

issue の修正を依頼されたときは、コードの修正だけで終わらせず、以下まで実施する。

1. 作業ブランチにコミットしてプッシュする
2. プルリクエストを作成する。本文には `Fixes #1, fixes #2` のように、
   対応した issue 番号すべてに `fixes` キーワードを付けて記載する
   （マージ時に issue が自動でクローズされる）
3. 対応した issue をクローズする（`state_reason` は `completed`）。
   クローズ時は、どのプルリクエストで修正したかがわかるコメントを添える
