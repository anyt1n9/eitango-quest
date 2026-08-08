# eitango-quest

英単語学習アプリ。フロントエンドは React + Vite（`src/`）、バックエンドは Express（`server.ts`）。

## 検証コマンド

```bash
npm run lint    # tsc --noEmit（型チェック）
npm test        # vitest run（ロジックと収録データのテスト）
npm run build   # vite build + server.ts のバンドル
```

コードを変更したら、コミット前に上記3つを通すこと。

## テスト

テストは `tests/` に置き、vitest で実行する（`npm run test:watch` で監視実行）。

- **ロジックのテスト** — `src/` の副作用の無いモジュール（`srs` / `pos` / `distractors` /
  `selectQuestions` / `mastery` / `rivalGrowth` / `shuffle` / `storage` / `spelling` /
  `readingQuiz`）を対象にする。乱数を使う関数は `random` 引数か `Math.random` の
  差し替えで決定的にする（`tests/helpers.ts` の `seededRandom`）。
- **データのテスト** — `tests/vocabulary.data.test.ts` と `tests/passages.data.test.ts`。
  収録語 7,700 語超と長文15本を全件検査する。型検査もビルドも通り抜ける不具合
  （四択に正解が2つある、例文に答えが露出している、実在しない綴りが混ざる、など）は
  この層でしか見つからない。`scripts/` の生成スクリプトを回したあとは必ず実行する。

画面の描画テストは未導入。UI は Playwright で手動確認している。

## issue 修正時のワークフロー

issue の修正を依頼されたときは、コードの修正だけで終わらせず、以下まで実施する。

1. 作業ブランチにコミットしてプッシュする
2. プルリクエストを作成する。本文には `Fixes #1, fixes #2` のように、
   対応した issue 番号すべてに `fixes` キーワードを付けて記載する
   （マージ時に issue が自動でクローズされる）
3. 対応した issue をクローズする（`state_reason` は `completed`）。
   クローズ時は、どのプルリクエストで修正したかがわかるコメントを添える
