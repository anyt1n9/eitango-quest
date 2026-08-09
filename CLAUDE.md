# eitango-quest

英単語学習アプリ。フロントエンドは React + Vite（`src/`）、バックエンドは Express（`server.ts`）。

## 検証コマンド

```bash
npm run lint    # tsc --noEmit（型チェック）
npm test        # vitest run（ロジックと収録データのテスト）
npm run build   # vite build + server.ts のバンドル
```

コードを変更したら、コミット前に上記3つを通すこと。
同じ3つをプルリクエストと main への push で GitHub Actions が実行する
（`.github/workflows/ci.yml`）。

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
- **動詞の活用のテスト** — `tests/verbForms.test.ts`。`src/verbForms.ts` の不規則動詞表と
  規則変化の綴りを検査する。語末の子音を重ねるかは強勢の位置で決まり綴りからは分からないため
  （prefer→preferred だが offer→offered）、`DOUBLE_FINAL` の一覧で持っている。
  規則変化は米つづりに揃える（travel→traveled）。
- **語義のテスト** — `tests/senses.test.ts`。`src/data/senses.ts`（多義語の語義と
  品詞ごとの使用割合）を検査する。生成は `scripts/bake_senses.ts`（通信が必要。
  取得結果は `.cache/` に置かれる。WordNet は `cntlist.rev` に加えて
  `data.*` / `index.*` も使うので、展開時にそれらも取り出すこと）。
  辞書に見出しが無い派生語は基本形の語義を借り、`from` に由来の語を入れる。
  「使い方の例」(`usage`) は WordNet の用例をそのまま使う（機械訳は付けない）。
  語義は起動時には要らないため
  `src/senses.ts` の `loadSenses()` で遅延読み込みしており、
  単語データ（`vocabulary.ts`）には混ぜない。
- **サーバーのテスト** — `tests/serverGuards.test.ts`。`server/guards.ts` の入力検証・
  レート制限・呼び出し予算を対象にする。画面には現れないがAIの利用料に直結するため、
  時刻を `now` で差し替えて窓の経過を待たずに検証する。
- **文枠のテスト** — `tests/sentenceFrames.test.ts`。例文の材料である
  `scripts/rewrite_template_sentences.ts` の文枠を検査する。枠を足すときは
  「穴埋め記号はちょうど1つ」「a/an の直後に穴埋めを置かない」「連体専用の枠は
  穴埋めの直後に名詞が来る」といった決まりをここで確認する。

画面の描画テストは未導入。UI は Playwright で手動確認している。

## issue 修正時のワークフロー

issue の修正を依頼されたときは、コードの修正だけで終わらせず、以下まで実施する。

1. 作業ブランチにコミットしてプッシュする
2. プルリクエストを作成する。本文には `Fixes #1, fixes #2` のように、
   対応した issue 番号すべてに `fixes` キーワードを付けて記載する
   （マージ時に issue が自動でクローズされる）
3. 対応した issue をクローズする（`state_reason` は `completed`）。
   クローズ時は、どのプルリクエストで修正したかがわかるコメントを添える
