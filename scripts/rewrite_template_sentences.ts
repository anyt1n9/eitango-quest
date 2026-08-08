/**
 * 定型例文の差し替えスクリプト。
 *
 * 収録語の約半数（3,879語）が132種類の定型文を共有しており、しかもその多くは
 * 名詞スロットの文に品詞を問わず単語を流し込んでいたため、非文になっていた。
 *   例) "I want to understand this let."   (let = 〜しよう)
 *       "I want to understand this may."   (may = 〜してもよい)
 *       "I want to understand this again." (again = 再び)
 *
 * ここでは各語の品詞（vocabulary.ts に明示済み）に応じた文枠へ差し替える。
 * 動詞は訳語に「を」を含むかどうかで他動詞・自動詞を判別し、目的語の有無を合わせる。
 *
 * 実行: npx tsx scripts/rewrite_template_sentences.ts
 */
import fs from "fs";
import path from "path";

type Frame = { en: string; ja: string };

// ── 名詞 ────────────────────────────────────────────────
const NOUN: Frame[] = [
  { en: "The [_____] in this room belongs to my teacher.", ja: "この部屋の「{}」は先生のものです。" },
  { en: "She wrote about the [_____] in her report.", ja: "彼女はレポートの中で「{}」について書きました。" },
  { en: "We talked about the [_____] for almost an hour.", ja: "私たちは1時間近く「{}」について話しました。" },
  { en: "The [_____] has changed a lot over the past ten years.", ja: "「{}」はこの10年で大きく変わりました。" },
  { en: "He is looking for information about the [_____].", ja: "彼は「{}」に関する情報を探しています。" },
  { en: "This book explains the [_____] in simple words.", ja: "この本は「{}」をやさしい言葉で説明しています。" },
  { en: "The teacher drew a picture of the [_____] on the board.", ja: "先生は黒板に「{}」の絵を描きました。" },
  { en: "Nobody noticed the [_____] until the next morning.", ja: "翌朝まで誰も「{}」に気づきませんでした。" },
  { en: "The [_____] became an important topic in the meeting.", ja: "「{}」は会議で重要な話題になりました。" },
  { en: "I read an article about the [_____] yesterday.", ja: "私は昨日「{}」についての記事を読みました。" },
  { en: "There is a small [_____] near the station.", ja: "駅の近くに小さな「{}」があります。" },
  { en: "The report describes the [_____] in great detail.", ja: "その報告書は「{}」を非常に詳しく説明しています。" },
  { en: "Many people depend on the [_____] every day.", ja: "多くの人が毎日「{}」に頼っています。" },
  { en: "The company announced a new [_____] last week.", ja: "その会社は先週、新しい「{}」を発表しました。" },
  { en: "We should think carefully about the [_____].", ja: "私たちは「{}」について慎重に考えるべきです。" },
  { en: "The [_____] was mentioned twice in the news.", ja: "「{}」はニュースで2回取り上げられました。" },
  { en: "Her question was about the [_____] in chapter three.", ja: "彼女の質問は第3章の「{}」についてでした。" },
  { en: "The [_____] plays an important role in this story.", ja: "「{}」はこの物語で重要な役割を果たします。" },
  { en: "You can find the [_____] on the second floor.", ja: "「{}」は2階にあります。" },
  { en: "The students discussed the [_____] in small groups.", ja: "生徒たちは少人数で「{}」について話し合いました。" },
  { en: "This photograph shows the [_____] very clearly.", ja: "この写真は「{}」をとてもはっきりと写しています。" },
  { en: "The [_____] surprised everyone in the room.", ja: "「{}」はその場の全員を驚かせました。" },
  { en: "He kept a record of the [_____] for three years.", ja: "彼は3年間「{}」の記録をつけていました。" },
  { en: "The museum has a large collection of the [_____].", ja: "その博物館は「{}」を数多く所蔵しています。" },
  { en: "We learned about the [_____] in history class.", ja: "私たちは歴史の授業で「{}」について学びました。" },
  { en: "The [_____] is one of the oldest in this area.", ja: "「{}」はこの地域で最も古いものの一つです。" },
  { en: "A group of experts studied the [_____] last year.", ja: "専門家の集団が昨年「{}」を研究しました。" },
  { en: "The [_____] appears at the beginning of the letter.", ja: "「{}」は手紙の冒頭に出てきます。" },
  { en: "She showed me the [_____] she bought in Kyoto.", ja: "彼女は京都で買った「{}」を見せてくれました。" },
  { en: "The [_____] will be ready by the end of the week.", ja: "「{}」は週末までに用意できます。" },
];

// ── 動詞（自動詞でも成り立つ枠。日本語は終止形に接続する語尾のみ使う）──
const VERB_INTRANS: Frame[] = [
  { en: "We need to [_____] before the deadline.", ja: "締め切りの前に「{}」必要があります。" },
  { en: "They will [_____] together next weekend.", ja: "彼らは来週末、一緒に「{}」予定です。" },
  { en: "She decided to [_____] as soon as possible.", ja: "彼女はできるだけ早く「{}」ことにしました。" },
  { en: "You should [_____] more carefully next time.", ja: "次回はもっと注意して「{}」べきだと思います。" },
  { en: "It is important to [_____] every single day.", ja: "毎日「{}」ことが大切です。" },
  { en: "Many people [_____] when they feel nervous.", ja: "緊張したときに「{}」人が多いです。" },
  { en: "After the training, he was able to [_____] easily.", ja: "訓練の後、彼は簡単に「{}」ことができるようになりました。" },
  { en: "The company plans to [_____] early next year.", ja: "その会社は来年の初めに「{}」予定です。" },
  { en: "We always [_____] before starting the work.", ja: "私たちは作業を始める前に必ず「{}」ようにしています。" },
  { en: "It is not easy to [_____] in a short time.", ja: "短い時間で「{}」のは簡単ではありません。" },
  { en: "The team agreed to [_____] at the next meeting.", ja: "チームは次の会議で「{}」ことに同意しました。" },
  { en: "He learned how to [_____] from his teacher.", ja: "彼は先生から「{}」方法を学びました。" },
  { en: "They did not stop trying to [_____] until midnight.", ja: "彼らは夜中まで「{}」ことをやめませんでした。" },
  { en: "We hope to [_____] again in the near future.", ja: "近い将来もう一度「{}」ことを願っています。" },
  { en: "You can [_____] whenever you have free time.", ja: "時間があるときはいつでも「{}」ことができます。" },
  { en: "The doctor advised him not to [_____] for a week.", ja: "医師は彼に1週間「{}」ことを控えるよう勧めました。" },
  { en: "She promised to [_____] before the end of the month.", ja: "彼女は月末までに「{}」と約束しました。" },
  { en: "It takes a lot of time to [_____] properly.", ja: "きちんと「{}」には多くの時間がかかります。" },
  { en: "They gathered to [_____] as a group.", ja: "彼らは集団で「{}」ために集まりました。" },
  { en: "Students often [_____] during the first week of school.", ja: "生徒は学校の最初の週によく「{}」ものです。" },
];

// ── 動詞（他動詞。訳語に「を」を含むものに使う）──────────
const VERB_TRANS: Frame[] = [
  { en: "We need to [_____] the plan before Friday.", ja: "金曜日までにその計画を「{}」必要があります。" },
  { en: "She wants to [_____] the results with her team.", ja: "彼女はその結果をチームと「{}」ことを望んでいます。" },
  { en: "The company will [_____] the new product in May.", ja: "その会社は5月に新製品を「{}」予定です。" },
  { en: "You should [_____] the document before sending it.", ja: "送る前にその書類を「{}」べきです。" },
  { en: "It is important to [_____] the rules carefully.", ja: "規則を注意深く「{}」ことが大切です。" },
  { en: "He forgot to [_____] the message this morning.", ja: "彼は今朝そのメッセージを「{}」のを忘れました。" },
  { en: "They decided to [_____] the old system.", ja: "彼らは古い制度を「{}」ことにしました。" },
  { en: "We can [_____] the data whenever we need to.", ja: "必要なときはいつでもそのデータを「{}」ことができます。" },
  { en: "The teacher asked us to [_____] the passage again.", ja: "先生は私たちにその文章をもう一度「{}」よう求めました。" },
  { en: "It took two hours to [_____] the whole report.", ja: "報告書全体を「{}」のに2時間かかりました。" },
  { en: "Please [_____] the box before you leave.", ja: "出かける前にその箱を「{}」ようにしてください。" },
  { en: "They promised to [_____] the problem quickly.", ja: "彼らはその問題を速やかに「{}」と約束しました。" },
];

// ── 形容詞（述語用法のみ。「な」は挿入時に取り除く）────────
const ADJ: Frame[] = [
  { en: "This book is very [_____] for beginners.", ja: "この本は初心者にとってとても「{}」です。" },
  { en: "The weather yesterday was surprisingly [_____].", ja: "昨日の天気は驚くほど「{}」でした。" },
  { en: "Her explanation was [_____] to everyone in the class.", ja: "彼女の説明はクラスの全員にとって「{}」でした。" },
  { en: "The room felt [_____] after we opened the window.", ja: "窓を開けた後、部屋は「{}」でした。" },
  { en: "This question is not so [_____] as it looks.", ja: "この問題は見た目ほど「{}」ではありません。" },
  { en: "I think his idea is quite [_____].", ja: "彼の考えはかなり「{}」だと思います。" },
  { en: "The old bridge looked [_____] in the morning light.", ja: "朝の光の中で、その古い橋は「{}」でした。" },
  { en: "Everyone agreed that the plan was [_____].", ja: "その計画は「{}」だと全員が同意しました。" },
  { en: "The results were more [_____] than we expected.", ja: "結果は予想よりも「{}」でした。" },
  { en: "The instructions were clear but rather [_____].", ja: "説明は分かりやすいものの、やや「{}」でした。" },
  { en: "She looked [_____] when she heard the news.", ja: "その知らせを聞いたとき、彼女は「{}」でした。" },
  { en: "This material is easy to carry and also [_____].", ja: "この素材は持ち運びやすく、そして「{}」です。" },
  { en: "Most students found the lecture [_____].", ja: "ほとんどの生徒はその講義が「{}」だと感じました。" },
  { en: "The city becomes very [_____] in summer.", ja: "その都市は夏になるととても「{}」です。" },
  { en: "It is [_____] to finish this by tomorrow.", ja: "これを明日までに終えるのは「{}」です。" },
  { en: "The final result was truly [_____].", ja: "最終的な結果は本当に「{}」でした。" },
  { en: "His answer seemed [_____] at first.", ja: "彼の答えは最初「{}」でした。" },
  { en: "The service at that hotel is always [_____].", ja: "あのホテルのサービスはいつも「{}」です。" },
  { en: "Nobody thought the task would be so [_____].", ja: "その作業がこれほど「{}」とは誰も思いませんでした。" },
  { en: "The atmosphere in the room was [_____].", ja: "部屋の雰囲気は「{}」でした。" },
  { en: "This kind of problem is fairly [_____] in daily life.", ja: "この種の問題は日常生活ではかなり「{}」です。" },
  { en: "The design is simple but very [_____].", ja: "そのデザインは簡素ですが、とても「{}」です。" },
  { en: "Her performance last night was [_____].", ja: "昨夜の彼女の演技は「{}」でした。" },
  { en: "The road ahead was narrow and [_____].", ja: "先の道は狭く、「{}」でした。" },
  { en: "We were told that the water here is [_____].", ja: "ここの水は「{}」だと言われました。" },
];

// ── 副詞 ────────────────────────────────────────────────
const ADV: Frame[] = [
  { en: "She answered the question [_____].", ja: "彼女はその質問に「{}」答えました。" },
  { en: "He closed the door [_____] and left the room.", ja: "彼はドアを「{}」閉めて部屋を出ました。" },
  { en: "The team finished the work [_____].", ja: "チームはその仕事を「{}」終えました。" },
  { en: "They walked [_____] along the river.", ja: "彼らは川沿いを「{}」歩きました。" },
  { en: "The machine started working [_____] again.", ja: "機械は再び「{}」動き始めました。" },
  { en: "She explained the rule [_____] to the new members.", ja: "彼女は新しいメンバーに規則を「{}」説明しました。" },
  { en: "He read the letter [_____] before answering.", ja: "彼は返事をする前に手紙を「{}」読みました。" },
  { en: "The children listened [_____] to the story.", ja: "子どもたちはその話を「{}」聞きました。" },
  { en: "We should prepare [_____] for the test.", ja: "私たちはテストに向けて「{}」準備すべきです。" },
  { en: "The bus arrived [_____] this morning.", ja: "バスは今朝「{}」到着しました。" },
  { en: "He looked at the picture [_____] for a while.", ja: "彼はしばらくその絵を「{}」見ていました。" },
  { en: "She smiled [_____] when she saw us.", ja: "私たちを見て彼女は「{}」ほほえみました。" },
  { en: "The workers moved the boxes [_____].", ja: "作業員たちは箱を「{}」運びました。" },
  { en: "You can change the setting [_____].", ja: "設定は「{}」変更できます。" },
  { en: "The teacher spoke [_____] so that everyone could hear.", ja: "先生は全員に聞こえるよう「{}」話しました。" },
  { en: "They checked the numbers [_____] one more time.", ja: "彼らはもう一度数字を「{}」確認しました。" },
  { en: "The plan was carried out [_____].", ja: "その計画は「{}」実行されました。" },
  { en: "He practiced [_____] every evening.", ja: "彼は毎晩「{}」練習しました。" },
];

// ── その他（前置詞・助動詞・イディオム）──────────────────
// 一般の文スロットに入れられないため、表現そのものを扱うメタ文にする。
// 従来の定型文と形は似ているが、どの品詞でも文法的に成立する点が異なる。
const OTHER: Frame[] = [
  { en: "The expression [_____] is often used in written English.", ja: "「{}」という表現は書き言葉でよく使われます。" },
  { en: "Try using the expression [_____] in a sentence of your own.", ja: "「{}」という表現を自分の文で使ってみましょう。" },
  { en: "Our teacher explained when to use [_____].", ja: "先生は「{}」をいつ使うのかを説明してくれました。" },
  { en: "You will see [_____] many times in this textbook.", ja: "この教科書では「{}」を何度も目にするでしょう。" },
  { en: "Learners often confuse [_____] with similar expressions.", ja: "学習者は「{}」を似た表現と混同しがちです。" },
];

/** 日本語訳から、文中に差し込む形を作る */
function insertForm(pos: string, translation: string): string {
  let s = (translation.split(/[、,，/／;；]/)[0] || "").trim();
  s = s.replace(/[（(][^）)]*[）)]/g, "").replace(/^[〜～]/, "").trim();
  if (pos === "verb") s = s.replace(/^を/, "");
  // 「重要な」「本物の」は「です」に接続できるよう連体修飾の語尾を落とす
  if (pos === "adjective") s = s.replace(/[なの]$/, "");
  return s || translation;
}

function main() {
  const file = path.join(process.cwd(), "src/data/vocabulary.ts");
  const src = fs.readFileSync(file, "utf8");
  const marker = "const rawVocabulary: any[] = ";
  const arrStart = src.indexOf("[", src.indexOf(marker) + marker.length);
  let depth = 0, inStr = false, esc = false, arrEnd = -1;
  for (let i = arrStart; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) { arrEnd = i; break; } }
  }
  const arr: any[] = JSON.parse(src.slice(arrStart, arrEnd + 1));

  // 2語以上で共有されている例文＝定型文
  const count = new Map<string, number>();
  arr.forEach(w => {
    const k = w.sentence.replace(/\[_____\]/g, "◯");
    count.set(k, (count.get(k) || 0) + 1);
  });
  const isTemplate = (w: any) => (count.get(w.sentence.replace(/\[_____\]/g, "◯")) || 0) > 1;

  const pools: Record<string, Frame[]> = {
    noun: NOUN, adjective: ADJ, adverb: ADV, other: OTHER,
    verbT: VERB_TRANS, verbI: VERB_INTRANS,
  };
  const cursor: Record<string, number> = {};
  let replaced = 0;
  const perPos: Record<string, number> = {};

  for (const w of arr) {
    if (!isTemplate(w)) continue;
    const pos: string = w.pos || "noun";
    const key = pos === "verb" ? (/を/.test(w.translation) ? "verbT" : "verbI") : pos;
    const pool = pools[key] || NOUN;
    // 同じ枠が連続しないよう、品詞ごとに順番に配る。
    // 枠の英文に対象語そのものが含まれる場合（museum に "The museum has ..." など）は
    // 答えが問題文に見えてしまうので次の枠へ送る。
    const contains = new RegExp(`\\b${w.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    let frame = pool[0];
    for (let k = 0; k < pool.length; k++) {
      const idx = (cursor[key] = (cursor[key] || 0) + 1) % pool.length;
      frame = pool[idx];
      if (!contains.test(frame.en.replace(/\[_____\]/g, " "))) break;
    }
    w.sentence = frame.en;
    w.sentenceTranslation = frame.ja.replace("{}", insertForm(pos, w.translation));
    replaced++;
    perPos[pos] = (perPos[pos] || 0) + 1;
  }

  fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(arr) + src.slice(arrEnd + 1));
  console.log(`差し替えた語: ${replaced}語`, JSON.stringify(perPos));
}

main();
