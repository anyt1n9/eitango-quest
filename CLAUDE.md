# eitango-quest

英単語学習アプリ。フロントエンドは React + Vite（`src/`）、バックエンドは Express（`server.ts`）。

## 検証コマンド

```bash
npm run lint      # tsc --noEmit（型チェック）
npm test          # vitest run（ロジックと収録データのテスト）
npm run build     # vite build + server.ts のバンドル
npm run test:e2e  # playwright test（ビルド済みのサーバーを立てて画面を通しで操作）
```

コードを変更したら、コミット前に上記を通すこと。
同じものをプルリクエストと main への push で GitHub Actions が実行する
（`.github/workflows/ci.yml`）。

## 単語データの読み込み

`src/data/vocabulary.ts`（3.1MB）はアプリからは直接 import しない。
静的に読み込むと初期チャンクが 2.8MB になり、解析が終わるまで画面が出ない。
アプリ側は `src/vocabulary.ts` の `loadVocabulary()` で動的に読む
（`App.tsx` が読み込み中の待機画面を出す）。
`scripts/` の生成スクリプトと `tests/*.data.test.ts` は
これまでどおり `src/data/vocabulary.ts` を直接読んでよい。

読み込みが終わるまで単語は0語なので、その状態で保存の副作用を走らせないこと。
走らせると、保存済みの追加単語（AI・CSV・PDF由来）を空で上書きしてしまう。

## テスト

テストは `tests/` に置き、vitest で実行する（`npm run test:watch` で監視実行）。

- **ロジックのテスト** — `src/` の副作用の無いモジュール（`srs` / `pos` / `distractors` /
  `selectQuestions` / `mastery` / `rivalGrowth` / `shuffle` / `storage` / `spelling` /
  `readingQuiz`）を対象にする。乱数を使う関数は `random` 引数か `Math.random` の
  差し替えで決定的にする（`tests/helpers.ts` の `seededRandom`）。
- **データのテスト** — `tests/vocabulary.data.test.ts` と `tests/passages.data.test.ts`。
  収録語 7,700 語超と長文25本を全件検査する。型検査もビルドも通り抜ける不具合
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
  使用割合(`share`)は**品詞単位**の値で、語義ごとの頻度ではない。画面では品詞で
  まとめて見出しに1回だけ出す（`groupSensesByPos`）。語義1行ごとに並べると
  「美しい 100% ／ みごとな 100%」のように意味別の頻度に見えてしまうため。
  語義ごとの手がかりは辞書の重要印(`important`、EJDict の『』)だけで、
  これは実測ではなく辞書編纂者の判断なので割合とは別の見せ方にする。
  `share` の欠落と `0` は意味が違う。欠落は「実測データが無い」、`0` は
  「実測したがその品詞では見つからなかった」。1語の中で片方だけ欠けることはない。
  WordNet が扱わない品詞（`other`）と、全語義が 0% になる語（品詞判定と実測の
  食い違い。never は SemCor では副詞100%だが訳語からは形容詞と判定される）には
  割合を付けない。
  語義は起動時には要らないため
  `src/senses.ts` の `loadSenses()` で遅延読み込みしており、
  単語データ（`vocabulary.ts`）には混ぜない。
- **レベル配分のテスト** — `tests/levels.data.test.ts`。レベルが上がるほど実際の英文に
  出てくる頻度が下がることと、上位語が上級に埋もれていないことを検査する。
  裏取りに使う頻度順位は `tests/data/semcorRank.ts`（`scripts/fix_levels.ts` が
  `.cache/cntlist.rev` から生成する。`.cache/` は git に入れないため書き出している）。
  頻度は難易度そのものではない。SemCor は古い英文のコーパスなので war / wage /
  federal が上位に来るし、the / you のような機能語や onion / carrot のような
  日常語は内容語しか数えない集計に出てこない。だから「順位どおりに並べる」ことは
  せず、外れ値だけを1語ずつ見て直す（一覧は `scripts/fix_levels.ts` の `LEVEL_FIXES`）。
  品詞は `scripts/bake_pos.ts` が綴りと訳から推定して焼き込む。推定なので外れる語があり、
  明らかに違うものだけを `scripts/fix_pos.ts` の `POS_FIXES` に列挙して直す
  （規則をいじると他の語に波及して確かめようがなくなるため）。
  直す基準は「辞書(WordNet)がその品詞を記録しておらず、実測(SemCor)の使用割合が
  別の品詞に50%以上偏っている」こと。ただし**教材が教えている訳**が別の品詞なら残す
  （desert は訳「砂漠」で名詞。動詞69%は「見捨てる」の意味）。残す語は理由を添えて
  `tests/vocabulary.data.test.ts` の `KEPT_ON_PURPOSE` に書く。
  品詞を変えたら、品詞に結び付いた3つのデータも作り直すこと（`fix_pos.ts` がまとめて行う）。
  四択の誤答は同じ品詞から選ばれているので、**その語を誤答に使っている他の語**にも
  別の品詞が混ざる。語義の用例は「教えている品詞の語義には付けない」決まりに引っかかる。
  動詞の文型は動詞として教えている語にしか付けられない。
- **文法のテスト** — `tests/grammar.data.test.ts` と `tests/grammar.render.test.tsx`。
  `src/data/grammar.ts`（中学〜大学レベルの文法34項目）を検査する。
  語義・語法と違い、この解説は辞書やコーパスから作ったデータではなく**書き下ろし**で、
  出典で正しさを担保できない。そのぶん「説明・例文・よくある間違い・練習問題が
  すべての項目にそろっているか」「練習問題の正解が選択肢の中に1つだけあるか」
  といった形の面をテストで固定する。内容そのものは1項目ずつ読んで確かめるほかない。
  各項目は WordNet の文型番号（`verbFrames`）で `wordUsage.ts` と結び付いており、
  「この形をとる動詞」を収録語から引いて画面に出す。
  データは100KB超なので `src/grammar.ts` の `loadGrammar()` で遅延読み込みする。
- **長文と文法の結び付きのテスト** — `tests/passages.data.test.ts` の「文法の印」。
  各長文の `grammarFocus` は `scripts/tag_passage_grammar.ts` が本文の目印から
  **機械的に**付ける（目視で決めると後から確かめられなくなるため）。
  本文を書き換えたらスクリプトを回し直すこと。印が今の本文と一致しなければ落ちる。
- **語法のテスト** — `tests/usage.test.ts`。`src/data/wordUsage.ts`（動詞の文型・
  コロケーション・語族）と `src/usage.ts` のラベルを検査する。生成は
  `scripts/bake_usage.ts`（`.cache/` の WordNet と EJDict を bake_senses と共用）。
  文型は WordNet の sentence frame 番号（1〜35）だけを焼き、日本語のラベルは
  `src/usage.ts` に置く（データを小さく保つため）。文型は**その語のすべての語義を
  まとめた一覧**で、語義ごとの区別は付かない。画面にもその旨を明記する。
  コロケーションと語族は、EJDict に和訳がある語だけを採る
  （英語だけの句を出しても読めないため）。
- **学習アドバイスのテスト** — `tests/advice.test.ts`。`server/advice.ts` の
  「習得状況の読み取り」と文章の組み立てを検査する。この機能は以前、APIキーが無いと
  習得状況によらず同じ固定文を返しており、全レベル9割超の学習者と初学者とで
  文面が1バイトも違わなかった（実測は `docs/advice-behavior.md`）。
  そのため「習得状況が違えば文面も違う」ことを明示的に固定している。
  手元で組み立てた文章は、AIが書いたものと区別できるよう出どころを明記する。
- **サーバーのテスト** — `tests/serverGuards.test.ts` と `tests/serverRoutes.test.ts`。
  前者は `server/guards.ts` の入力検証・レート制限・呼び出し予算という「規則そのもの」を
  対象にし、時刻を `now` で差し替えて窓の経過を待たずに検証する。
  後者はその規則が各エンドポイントに配線されているかを supertest で実際にHTTPを叩いて
  確かめる。`server.ts` は `app` を公開しており、直接実行されたときだけ listen する。
  APIキーが無いときの応答は2種類あり、どちらもテストで固定している
  （長文生成・頻度分析・類義語は 503。機械で代用すると「AIの分析結果」を騙るため。
  苦手分析など集計で作れるものは 200 でフォールバックする）。
- **文枠のテスト** — `tests/sentenceFrames.test.ts`。例文の材料である
  `scripts/rewrite_template_sentences.ts` の文枠を検査する。枠を足すときは
  「穴埋め記号はちょうど1つ」「a/an の直後に穴埋めを置かない」「連体専用の枠は
  穴埋めの直後に名詞が来る」といった決まりをここで確認する。

- **出題形式のテスト** — `tests/quizFormats.test.ts` と `tests/reviewFormat.render.test.tsx`。
  復習（今日の復習・苦手単語の復習）は四択に固定されていたが、形式を選べるようにした
  （`src/quizFormats.ts`）。形式によっては出題できない語がある（綴りはイディオムを、
  文穴埋めは例文の無い語を出せない）ので、出せる語だけに絞り、0語の形式は選べなくする。
  出題対象は配列の**中身**（IDの並び）で見ること。同一性で見ると、呼び出し側が毎レンダーで
  配列を作り直すだけで出題し直しになり、解答の途中で問題がすり替わる。
- **画面の描画テスト** — `tests/*.test.tsx`（`quiz.render` / `verbForms.render` /
  `wordSenses.render` / `wordUsage.render` / `reviewFormat.render`）。React Testing Library + jsdom で、学習者が実際に目にする部分を
  対象にする。「関数は正しいが画面に出ていない」「日→英モードで答えの綴りが見えている」
  「活用表の過去形と過去分詞の列がずれている」といった不具合は、型検査もビルドも
  ロジックのテストもすり抜けるため、この層でしか見つからない。
  読み上げ・`matchMedia`・`ResizeObserver` など jsdom に無いブラウザAPIは
  `tests/setupDom.ts` で最小限だけ埋める。単語は `tests/fixtures.ts` で作り、
  収録データには依存させない（どの語が出題されるかで結果が変わってしまうため）。

- **バックアップのテスト** — `tests/dataBackup.test.ts`。`src/backupKeys.ts` の一覧と、
  `src` の中に書かれた `quest_` で始まる保存キーを機械的に突き合わせる。
  一覧は手で並べたものなので、新しい保存先を足したときに追加を忘れても
  型検査もビルドも通ってしまい、気づくのは「端末を移したらその機能の進捗だけが
  消えていた」ときになる（文法ガイドで実際に起きた）。
  バックアップしないキーは `NON_BACKUP_KEYS` に理由を書いて除外する。
- **読み上げのテスト** — `tests/speech.test.ts` と `tests/listeningFallback.render.test.tsx`。
  リスニングは綴りを隠して再生ボタンだけを見せるので、英語の音声が無い端末では
  手がかりの無い四択になる。`src/speech.ts` の判定は3値で、音声の一覧が空のときは
  `unknown`（＝塞がない）。多くのブラウザが最初の呼び出しで空を返すため、
  ここで「使えない」と断じると実際には鳴る端末からリスニングを取り上げてしまう。
- **画面とURLのテスト** — `tests/routes.test.ts`。画面とパスが往復すること、
  知らないパスでも白い画面にならないことを検査する。
- **入口のテスト** — `tests/dashboardEntry.render.test.tsx`。1回の問題数は
  1か所の設定で、5形式すべてがそれを使う（以前は一問一答だけモーダルを挟み、
  他の4形式は10問固定だった）。スマホで押せる大きさ・縦の長さもここで守る。
- **取り込みのテスト** — `tests/importWords.test.ts`。`src/importWords.ts`（CSV の解析、
  AI・PDF から来た単語の正規化）を検査する。level が `"SENIOR"` のように不正だと
  どのレベルのクイズにも出題されない語ができ、エラーも出ないので気づけない。
- **発音記号のテスト** — `tests/phonetics.test.ts`。通信エラーが続いたときの休止を検査する。
  時計は `__setPhoneticsClock` で差し替える。休止の判定は待ち行列の前後の両方で行う
  （辞書は1ページに50語を同時に描くので、最初の失敗が返る前に50件並んでしまう）。

`tests/*.test.ts` は node 環境、`tests/*.test.tsx` は jsdom 環境で走る
（`vitest.config.ts` の `projects`）。どちらも `npm test` でまとめて実行される。

**画面の通し確認** — `e2e/walkthrough.spec.ts`（Playwright）。`npm run test:e2e` で実行し、
CI でも走る。`vite preview` ではなくビルド済みの `dist/server.cjs` を立てる
（preview は静的ファイルしか返さず API が無いため）。
画面をまたいだときにだけ壊れるもの（状態の持ち越し・遷移・遅延読み込み）を対象にし、
1画面の中の描画は `tests/*.render.test.tsx` に任せる。

**見え方の確認** — 同じ `e2e/walkthrough.spec.ts` の `LOW_CONTRAST`。
画面に出ている文字を全部たどり、明暗どちらのテーマでも WCAG AA
（小さい文字4.5・大きい文字3.0）に届かないものを列挙する。
色は実際のブラウザで計算しないと分からない（半透明の背景は親までさかのぼって重ねる、
`oklch()` は文字列からは読めない）ため、型検査でもロジックのテストでも見つからない。
グラデーションの上と `aria-hidden` の飾りは対象外。
このほか「Tab で移動した先に枠が出るか」「正誤が `role="status"` で読み上げに伝わるか」
「長文の一覧をキーボードだけで開けるか」も同じ層で固定している。

## 暗いテーマの色

`src/index.css` は暗いテーマを **Tailwind の色変数ごと置き換える**ことで作っている
（`--color-white` は紺、`--color-gray-900` は白）。そのため次の点に注意する。

- **`dark:` を足すと二重に反転することがある。** indigo と slate は
  変数の側で明暗を入れ替えてあるので、`dark:text-indigo-300` や `dark:bg-slate-700` は
  「暗いテーマで明るい色」ではなく暗い色・明るい背景になる。
  変数の反転に任せて `dark:` を書かないのが正しい。
- **背景と文字は必ず対で置き換える。** 文字だけ明るくすると、
  対の背景（`bg-*-50` `bg-*-100`）が明るいまま残って逆向きに読めなくなる。
- **透過つきの背景も拾う。** `bg-emerald-50/40` のような指定があるので、
  クラス名を完全一致で書くと漏れる（`[class*="bg-emerald-50/"]` で拾っている）。
- 変数を反転していない色（emerald / rose / amber など）は
  `.dark .text-*-700` のような個別の規則で明るくする。

いずれも上の `LOW_CONTRAST` が落ちる形で気づけるようにしてある。

## 画面とURL

画面ごとに URL を持つ（`src/routes.ts`）。持たせていなかったときは、
ホーム画面に追加して使うと（`display: standalone`）端末の戻るボタンで
アプリごと閉じ、再読み込みでも必ずダッシュボードに戻されていた。

画面は2種類に分ける。
- **持ち回りの画面**（ダッシュボード・辞書・文法・長文など）
  … URLを持ち、再読み込みでもその画面に戻る。
  文法項目と長文は `/grammar/<id>` `/reading/<id>` のように中身まで持つ
- **一時的な画面**（クイズ・復習セッション）
  … 出題は毎回作り直すので URL からは復元しない（`resolveOnEntry`）。
  履歴には積むので、戻るとダッシュボードに帰る

画面の中で開いているものが変わったときは `replaceState`（履歴を積まない）。
積むと、長文を1本ずつ遡らされることになる。

## issue 修正時のワークフロー

issue の修正を依頼されたときは、コードの修正だけで終わらせず、以下まで実施する。

1. 作業ブランチにコミットしてプッシュする
2. プルリクエストを作成する。本文には `Fixes #1, fixes #2` のように、
   対応した issue 番号すべてに `fixes` キーワードを付けて記載する
   （マージ時に issue が自動でクローズされる）
3. 対応した issue をクローズする（`state_reason` は `completed`）。
   クローズ時は、どのプルリクエストで修正したかがわかるコメントを添える
