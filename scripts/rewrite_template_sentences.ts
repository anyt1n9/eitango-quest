/**
 * 定型例文の差し替えスクリプト。
 *
 * 収録語の約半数が定型文を共有しており、しかも品詞を問わず同じ文枠に流し込んでいたため
 * 非文が量産されていた。品詞別の文枠を導入して文法の破綻は解消したが、
 * 次の2つが残っていた。
 *
 *   1. 意味が噛み合わない
 *      "The room felt international after we opened the window."  (international=国際的な)
 *      "The old bridge looked electric in the morning light."     (electric=電気の)
 *      形容詞用の枠が「温度・雰囲気」「見た目」「人の感情」に限定されるのに、
 *      すべての形容詞を流し込んでいたため。
 *
 *   2. 使い回しが激しい
 *      111枠しか無く、1つの枠を最大57語が共有していた。
 *
 * ここでは
 *   - 形容詞を訳語の語尾で3分類し、それぞれ用法の合う枠に配る
 *       「〜の」   → 連体専用（the [_____] system）。述語にすると不自然になる関係形容詞
 *       「〜た/て」 → 人や物の状態（He looked [_____] after the trip）
 *       「〜な/い」 → 一般的な性質。述語・連体どちらも可
 *   - 枠の総数を111→258に増やし、1枠あたりの共有語数を下げる
 * という2点で対処する。
 *
 * 冠詞の都合上、穴埋めの直前に a/an を置く枠は作らない
 * （"a important plan" のように冠詞を誤る枠を生まないため）。
 *
 * 実行: npx tsx scripts/rewrite_template_sentences.ts
 */
import fs from "fs";
import path from "path";

/** form は日本語訳の差し込み形。attr は「重要な」、pred は「重要」 */
export type Frame = { en: string; ja: string; form?: "attr" | "pred" };

// ── 名詞 ────────────────────────────────────────────────
export const NOUN: Frame[] = [
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
  { en: "My grandfather often talks about the [_____].", ja: "祖父はよく「{}」の話をします。" },
  { en: "The [_____] was left on the table by mistake.", ja: "「{}」がうっかりテーブルに置き忘れられていました。" },
  { en: "Please write the [_____] at the top of the page.", ja: "ページの上部に「{}」を書いてください。" },
  { en: "The village is famous for its [_____].", ja: "その村は「{}」で有名です。" },
  { en: "We compared the [_____] with an older one.", ja: "私たちは「{}」を古いものと比べました。" },
  { en: "The [_____] arrived three days later than planned.", ja: "「{}」は予定より3日遅れて届きました。" },
  { en: "He explained the [_____] to the new members.", ja: "彼は新しいメンバーに「{}」を説明しました。" },
  { en: "The [_____] is kept in a locked cabinet.", ja: "「{}」は鍵のかかった棚に保管されています。" },
  { en: "Several visitors asked about the [_____].", ja: "何人かの来訪者が「{}」について尋ねました。" },
  { en: "The newspaper printed a photo of the [_____].", ja: "新聞は「{}」の写真を載せました。" },
  { en: "I could not remember the [_____] at first.", ja: "最初は「{}」を思い出せませんでした。" },
  { en: "The [_____] costs more than we expected.", ja: "「{}」は思っていたより高くつきます。" },
  { en: "She keeps the [_____] beside her bed.", ja: "彼女はベッドのそばに「{}」を置いています。" },
  { en: "The children made the [_____] out of paper.", ja: "子どもたちは紙で「{}」を作りました。" },
  { en: "The [_____] disappeared during the night.", ja: "「{}」は夜のうちに姿を消しました。" },
  { en: "Our class chose the [_____] for the festival.", ja: "私たちのクラスは祭りのために「{}」を選びました。" },
  { en: "The [_____] is described on page forty.", ja: "「{}」は40ページで説明されています。" },
  { en: "He borrowed the [_____] from his neighbour.", ja: "彼は隣人から「{}」を借りました。" },
  { en: "The shop sells the [_____] at a low price.", ja: "その店は「{}」を安い値段で売っています。" },
  { en: "The [_____] belongs to the school library.", ja: "「{}」は学校の図書館のものです。" },
  { en: "Doctors have studied the [_____] for many years.", ja: "医師たちは長年「{}」を研究してきました。" },
  { en: "The letter mentions the [_____] only once.", ja: "その手紙は「{}」に一度だけ触れています。" },
  { en: "We found the [_____] behind the old building.", ja: "私たちは古い建物の裏で「{}」を見つけました。" },
  { en: "The [_____] takes up most of the room.", ja: "「{}」が部屋の大部分を占めています。" },
  { en: "My sister collects the [_____] as a hobby.", ja: "姉は趣味で「{}」を集めています。" },
  { en: "The [_____] was broken when it arrived.", ja: "「{}」は届いたときには壊れていました。" },
  { en: "Workers moved the [_____] to another floor.", ja: "作業員が「{}」を別の階へ移しました。" },
  { en: "The guide pointed at the [_____] and smiled.", ja: "ガイドは「{}」を指さして微笑みました。" },
  { en: "The [_____] has a long history in this country.", ja: "「{}」はこの国で長い歴史を持っています。" },
  { en: "She placed the [_____] carefully in the box.", ja: "彼女は「{}」を丁寧に箱へ入れました。" },
  { en: "Everyone in the office knows about the [_____].", ja: "職場の全員が「{}」について知っています。" },
  { en: "The [_____] is not available at the moment.", ja: "「{}」は今のところ利用できません。" },
  { en: "He wrote a long essay about the [_____].", ja: "彼は「{}」について長い文章を書きました。" },
  { en: "The [_____] can be seen from the window.", ja: "窓から「{}」が見えます。" },
  { en: "They built the [_____] more than fifty years ago.", ja: "彼らは50年以上前に「{}」を造りました。" },
  { en: "The [_____] was the first thing I noticed.", ja: "最初に目に入ったのは「{}」でした。" },
  { en: "She asked me to bring the [_____] tomorrow.", ja: "彼女は明日「{}」を持ってくるよう私に頼みました。" },
  { en: "The [_____] is used in almost every household.", ja: "「{}」はほとんどの家庭で使われています。" },
  { en: "The council decided to protect the [_____].", ja: "議会は「{}」を守ることを決めました。" },
  { en: "I have never seen such a large [_____].", ja: "あれほど大きな「{}」は見たことがありません。" },
  { en: "The [_____] was hidden under a white cloth.", ja: "「{}」は白い布の下に隠されていました。" },
  { en: "Our teacher brought the [_____] to class.", ja: "先生が「{}」を授業に持ってきました。" },
  { en: "The [_____] appears in many old paintings.", ja: "「{}」は多くの古い絵画に描かれています。" },
  { en: "He spent all morning cleaning the [_____].", ja: "彼は午前中ずっと「{}」を掃除していました。" },
  { en: "The [_____] is much heavier than it looks.", ja: "「{}」は見た目よりずっと重いです。" },
  { en: "They are still arguing about the [_____].", ja: "彼らはまだ「{}」について議論しています。" },
  { en: "The [_____] made the whole plan possible.", ja: "「{}」のおかげで計画全体が実現しました。" },
  { en: "She keeps a photograph of the [_____] in her wallet.", ja: "彼女は財布に「{}」の写真を入れています。" },
  { en: "The [_____] should be checked once a month.", ja: "「{}」は月に一度点検すべきです。" },
  { en: "Local people are proud of the [_____].", ja: "地元の人々は「{}」を誇りに思っています。" },
  { en: "The [_____] was donated by a former student.", ja: "「{}」は卒業生から寄贈されました。" },
  { en: "I finally understood the [_____] after the lecture.", ja: "講義の後、ようやく「{}」が理解できました。" },
  { en: "The [_____] lay forgotten in the corner.", ja: "「{}」は隅で忘れられたままになっていました。" },
  { en: "Visitors are not allowed to touch the [_____].", ja: "来訪者は「{}」に触れることができません。" },
];

// ── 動詞（自動詞でも成り立つ枠。日本語は終止形に接続する語尾のみ使う）──
export const VERB_INTRANS: Frame[] = [
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
  { en: "My brother started to [_____] last summer.", ja: "兄は去年の夏に「{}」ようになりました。" },
  { en: "Nobody expected them to [_____] so quickly.", ja: "彼らがそれほど早く「{}」とは誰も思いませんでした。" },
  { en: "We were too tired to [_____] any longer.", ja: "私たちは疲れすぎて、もう「{}」ことができませんでした。" },
  { en: "She continued to [_____] even after dark.", ja: "彼女は日が暮れてからも「{}」続けました。" },
  { en: "The children love to [_____] in the garden.", ja: "子どもたちは庭で「{}」のが大好きです。" },
  { en: "He refused to [_____] without an explanation.", ja: "彼は説明もなく「{}」ことを拒みました。" },
];

// ── 動詞（他動詞。訳語に「を」を含むものに使う）──────────
export const VERB_TRANS: Frame[] = [
  { en: "We need to [_____] the plan before Friday.", ja: "金曜日までにその計画を「{}」必要があります。" },
  { en: "She decided to [_____] the report herself.", ja: "彼女は自分でその報告書を「{}」ことにしました。" },
  { en: "They will [_____] the building next spring.", ja: "彼らは来春その建物を「{}」予定です。" },
  { en: "You should [_____] the results one more time.", ja: "結果をもう一度「{}」べきです。" },
  { en: "It is difficult to [_____] the whole list in one day.", ja: "一日でリスト全体を「{}」のは難しいです。" },
  { en: "The team agreed to [_____] the schedule.", ja: "チームは日程を「{}」ことに同意しました。" },
  { en: "He tried to [_____] the machine without help.", ja: "彼は助けを借りずにその機械を「{}」うとしました。" },
  { en: "Our teacher asked us to [_____] the passage carefully.", ja: "先生は私たちにその文章を丁寧に「{}」よう求めました。" },
  { en: "The company plans to [_____] the old system.", ja: "その会社は古いシステムを「{}」予定です。" },
  { en: "I could not [_____] the message in time.", ja: "私はその伝言を間に合うように「{}」ことができませんでした。" },
  { en: "They refused to [_____] the agreement.", ja: "彼らはその合意を「{}」ことを拒みました。" },
  { en: "We must [_____] the problem before it grows.", ja: "問題が大きくなる前に「{}」なければなりません。" },
  { en: "She promised to [_____] the letter tomorrow.", ja: "彼女は明日その手紙を「{}」と約束しました。" },
  { en: "The workers began to [_____] the road at dawn.", ja: "作業員は夜明けに道路を「{}」始めました。" },
  { en: "It took three hours to [_____] the whole room.", ja: "部屋全体を「{}」のに3時間かかりました。" },
  { en: "He offered to [_____] the boxes for us.", ja: "彼は私たちのために箱を「{}」と申し出ました。" },
  { en: "The committee voted to [_____] the proposal.", ja: "委員会はその提案を「{}」ことを可決しました。" },
  { en: "We should [_____] the data before the meeting.", ja: "会議の前にデータを「{}」べきです。" },
  { en: "She managed to [_____] the situation calmly.", ja: "彼女は落ち着いてその状況を「{}」ことができました。" },
  { en: "The government hopes to [_____] the law this year.", ja: "政府は今年その法律を「{}」ことを望んでいます。" },
  { en: "I forgot to [_____] the window last night.", ja: "昨夜、窓を「{}」のを忘れました。" },
  { en: "They continued to [_____] the same method.", ja: "彼らは同じ方法を「{}」続けました。" },
  { en: "He learned how to [_____] the equipment safely.", ja: "彼は器具を安全に「{}」方法を学びました。" },
  { en: "Nobody wanted to [_____] the bad news.", ja: "誰もその悪い知らせを「{}」たがりませんでした。" },
  { en: "We were told to [_____] the form in black ink.", ja: "私たちは黒いインクで用紙を「{}」よう言われました。" },
  { en: "She helped me [_____] the heavy bags.", ja: "彼女は私が重い荷物を「{}」のを手伝ってくれました。" },
  { en: "They failed to [_____] the deadline again.", ja: "彼らはまたも締め切りを「{}」ことができませんでした。" },
  { en: "You can [_____] the file whenever you like.", ja: "好きなときにそのファイルを「{}」ことができます。" },
  { en: "The council decided to [_____] the old bridge.", ja: "議会は古い橋を「{}」ことを決めました。" },
  { en: "He spent the afternoon trying to [_____] the engine.", ja: "彼は午後じゅうエンジンを「{}」うとしていました。" },
];

// ── 形容詞A：一般的な性質（訳語が「〜な」「〜い」で終わるもの）─────
// 述語にも連体にも使える語が集まる。attr の枠では「重要な」の形のまま差し込む。
export const ADJ_QUALITY: Frame[] = [
  { en: "This book is very [_____] for beginners.", ja: "この本は初心者にとってとても「{}」です。" },
  { en: "Everyone agreed that the plan was [_____].", ja: "その計画は「{}」だと全員が同意しました。" },
  { en: "His answer seemed [_____] at first.", ja: "彼の答えは最初「{}」ように思えました。" },
  { en: "The results were more [_____] than we expected.", ja: "結果は予想よりも「{}」でした。" },
  { en: "This question is not so [_____] as it looks.", ja: "この問題は見た目ほど「{}」ではありません。" },
  { en: "I think his idea is quite [_____].", ja: "彼の考えはかなり「{}」だと思います。" },
  { en: "The instructions were clear but rather [_____].", ja: "説明は分かりやすいものの、やや「{}」でした。" },
  { en: "This kind of problem is fairly [_____] in daily life.", ja: "この種の問題は日常生活ではわりと「{}」です。" },
  { en: "The design is simple but very [_____].", ja: "そのデザインは簡素ですが、とても「{}」です。" },
  { en: "We were told that the water here is [_____].", ja: "ここの水は「{}」と聞かされました。" },
  { en: "Nobody thought the task would be so [_____].", ja: "その作業がこれほど「{}」とは誰も思いませんでした。" },
  { en: "The city becomes very [_____] in summer.", ja: "その街は夏になるととても「{}」です。" },
  { en: "Her explanation was surprisingly [_____].", ja: "彼女の説明は驚くほど「{}」でした。" },
  { en: "The second half of the film was less [_____].", ja: "その映画の後半はそれほど「{}」ではありませんでした。" },
  { en: "Compared with the old model, this one is more [_____].", ja: "旧型と比べると、こちらの方が「{}」です。" },
  { en: "The teacher said the essay was [_____] overall.", ja: "先生はその作文が全体として「{}」と言いました。" },
  { en: "In my opinion the rule is too [_____].", ja: "私の考えでは、その規則は「{}」すぎます。" },
  { en: "The weather yesterday was surprisingly [_____].", ja: "昨日の天気は驚くほど「{}」でした。" },
  { en: "Their reaction was completely [_____].", ja: "彼らの反応は完全に「{}」でした。" },
  { en: "The building looks [_____] from the outside.", ja: "その建物は外から見ると「{}」です。" },
  { en: "Everything about the trip was [_____].", ja: "その旅行はすべてが「{}」でした。" },
  { en: "The food at that restaurant is always [_____].", ja: "あの店の料理はいつも「{}」です。" },
  { en: "This method is [_____] enough for beginners.", ja: "この方法は初心者には十分「{}」です。" },
  { en: "The final report was much more [_____].", ja: "最終報告書ははるかに「{}」でした。" },
  { en: "I found the whole process rather [_____].", ja: "私はその過程全体をやや「{}」と感じました。" },
  { en: "The room was [_____] even in the afternoon.", ja: "その部屋は午後でも「{}」でした。" },
  { en: "His writing style is famously [_____].", ja: "彼の文体は「{}」だと広く知られています。" },
  { en: "The situation is becoming more [_____] every year.", ja: "状況は年々ますます「{}」です。" },
  { en: "Most people find the rules quite [_____].", ja: "たいていの人はその規則をかなり「{}」と感じます。" },
  { en: "The result was not as [_____] as we hoped.", ja: "結果は期待したほど「{}」ではありませんでした。" },
  { en: "We are looking for the most [_____] solution.", ja: "私たちは最も「{}」解決策を探しています。", form: "attr" },
  { en: "She gave the [_____] answer without hesitating.", ja: "彼女はためらわずに「{}」答えを返しました。", form: "attr" },
  { en: "This is the [_____] example I could find.", ja: "これが私に見つけられた「{}」例です。", form: "attr" },
  { en: "He explained his [_____] decision to the team.", ja: "彼はチームに自分の「{}」決断を説明しました。", form: "attr" },
  { en: "The report ends with the [_____] explanation.", ja: "その報告書は「{}」説明で終わっています。", form: "attr" },
  { en: "It was the [_____] experience of my life.", ja: "それは私の人生で「{}」経験でした。", form: "attr" },
  { en: "They chose the [_____] method for the test.", ja: "彼らはその試験に「{}」方法を選びました。", form: "attr" },
  { en: "The company introduced the [_____] system last year.", ja: "その会社は昨年「{}」制度を導入しました。", form: "attr" },
  { en: "We need the [_____] plan ready by next term.", ja: "来学期までに「{}」計画を用意する必要があります。", form: "attr" },
  { en: "She sent the [_____] letter to the newspaper.", ja: "彼女は新聞社に「{}」手紙を送りました。", form: "attr" },
  { en: "The museum shows the [_____] side of the city.", ja: "その博物館は街の「{}」一面を見せてくれます。", form: "attr" },
  { en: "That was the [_____] moment of the match.", ja: "あれが試合で「{}」瞬間でした。", form: "attr" },
  { en: "Our teacher gave us the [_____] task first.", ja: "先生はまず私たちに「{}」課題を出しました。", form: "attr" },
  { en: "They live in the [_____] house near the river.", ja: "彼らは川の近くの「{}」家に住んでいます。", form: "attr" },
  { en: "He is known for his [_____] approach to work.", ja: "彼は仕事への「{}」取り組み方で知られています。", form: "attr" },
  { en: "The village has kept its [_____] atmosphere.", ja: "その村は「{}」雰囲気を保ち続けています。", form: "attr" },
  { en: "This is one of the most [_____] books I own.", ja: "これは私が持っている中で最も「{}」本の一つです。", form: "attr" },
  { en: "Our group produced the [_____] result in the class.", ja: "私たちの班はクラスで「{}」結果を出しました。", form: "attr" },
];

// ── 形容詞B：関係形容詞（訳語が「〜の」で終わるもの）───────────
// 「電気の」「医学の」「社会の」など。述語に置くと不自然になるため連体用法だけを使う。
// 日本語も「電気の」の形のまま差し込む。
export const ADJ_ATTR: Frame[] = [
  { en: "We are studying the [_____] system in class.", ja: "私たちは授業で「{}」仕組みを学んでいます。", form: "attr" },
  { en: "The book explains the [_____] background of the war.", ja: "その本は戦争の「{}」背景を説明しています。", form: "attr" },
  { en: "She works in the [_____] department of a large company.", ja: "彼女は大企業の「{}」部門で働いています。", form: "attr" },
  { en: "The [_____] test results arrived this morning.", ja: "「{}」検査結果が今朝届きました。", form: "attr" },
  { en: "He wrote a paper on the [_____] history of the region.", ja: "彼はその地域の「{}」歴史について論文を書きました。", form: "attr" },
  { en: "The government announced the [_____] policy last week.", ja: "政府は先週「{}」方針を発表しました。", form: "attr" },
  { en: "The [_____] equipment is kept in the second room.", ja: "「{}」機材は2番目の部屋に置かれています。", form: "attr" },
  { en: "They discussed the [_____] side of the problem.", ja: "彼らはその問題の「{}」側面について話し合いました。", form: "attr" },
  { en: "The [_____] records go back to the last century.", ja: "「{}」記録は前世紀までさかのぼります。", form: "attr" },
  { en: "Our school offers the [_____] course every autumn.", ja: "私たちの学校は毎秋「{}」講座を開いています。", form: "attr" },
  { en: "The [_____] conditions have improved since last year.", ja: "「{}」状況は昨年より改善しました。", form: "attr" },
  { en: "The museum displays the [_____] tools of that period.", ja: "その博物館は当時の「{}」道具を展示しています。", form: "attr" },
  { en: "She is an expert on the [_____] structure of cities.", ja: "彼女は都市の「{}」構造の専門家です。", form: "attr" },
  { en: "The [_____] report was published in March.", ja: "「{}」報告書は3月に公表されました。", form: "attr" },
  { en: "The [_____] method has been used for decades.", ja: "「{}」手法は何十年も使われてきました。", form: "attr" },
  { en: "Students learn the [_____] terms in the first week.", ja: "学生は最初の週に「{}」用語を学びます。", form: "attr" },
  { en: "The [_____] situation changed after the election.", ja: "「{}」情勢は選挙の後で変わりました。", form: "attr" },
  { en: "He belongs to the [_____] committee of the town.", ja: "彼は町の「{}」委員会に所属しています。", form: "attr" },
  { en: "The [_____] effects were studied by two teams.", ja: "「{}」影響は2つの班によって研究されました。", form: "attr" },
  { en: "The library keeps the [_____] documents on the third floor.", ja: "図書館は「{}」資料を3階に保管しています。", form: "attr" },
  { en: "Their [_____] research was funded by the city.", ja: "彼らの「{}」研究は市から資金を受けました。", form: "attr" },
  { en: "The [_____] question was raised again at the meeting.", ja: "「{}」問題が会議で再び取り上げられました。", form: "attr" },
  { en: "The [_____] figures are printed at the end of the book.", ja: "「{}」数値は本の末尾に印刷されています。", form: "attr" },
  { en: "We visited the [_____] centre near the harbour.", ja: "私たちは港の近くの「{}」施設を訪ねました。", form: "attr" },
  { en: "The [_____] rules apply to everyone in the building.", ja: "「{}」規則は建物内の全員に適用されます。", form: "attr" },
  { en: "Doctors examined the [_____] causes of the illness.", ja: "医師たちはその病気の「{}」原因を調べました。", form: "attr" },
];

// ── 形容詞C：状態（訳語が「〜た」「〜して」で終わるもの）─────────
// 「疲れた」「怒った」「孤立した」など、人や物が置かれた状態を表す。
export const ADJ_STATE: Frame[] = [
  { en: "After the long trip he looked [_____].", ja: "長旅の後、彼は「{}」様子でした。" },
  { en: "She seemed [_____] when we met her at the station.", ja: "駅で会ったとき、彼女は「{}」様子でした。" },
  { en: "The whole team felt [_____] after the match.", ja: "試合の後、チーム全体が「{}」状態でした。" },
  { en: "He remained [_____] for the rest of the evening.", ja: "彼はその晩ずっと「{}」ままでした。" },
  { en: "By the end of the day everyone was [_____].", ja: "一日の終わりには全員が「{}」状態でした。" },
  { en: "The visitors appeared [_____] as they left the hall.", ja: "来訪者たちは会場を出るとき「{}」様子でした。" },
  { en: "My grandmother became [_____] after hearing the news.", ja: "祖母はその知らせを聞いて「{}」状態になりました。" },
  { en: "The children were [_____] on the way home.", ja: "子どもたちは帰り道で「{}」状態でした。" },
  { en: "He sounded [_____] on the telephone.", ja: "電話越しの彼は「{}」様子でした。" },
  { en: "She stayed [_____] even after the meeting ended.", ja: "会議が終わった後も彼女は「{}」ままでした。" },
  { en: "The passengers grew [_____] during the delay.", ja: "遅延の間、乗客は次第に「{}」状態になりました。" },
  { en: "Everyone in the room looked [_____] at that moment.", ja: "その瞬間、部屋の全員が「{}」様子でした。" },
  { en: "He was still [_____] the next morning.", ja: "翌朝も彼はまだ「{}」ままでした。" },
  { en: "The players seemed [_____] before the final round.", ja: "選手たちは最終戦の前に「{}」様子でした。" },
  { en: "She looked [_____] when she heard the news.", ja: "その知らせを聞いたとき、彼女は「{}」様子でした。" },
  { en: "Nobody expected him to be so [_____].", ja: "彼がそれほど「{}」状態だとは誰も思いませんでした。" },
];

// ── 副詞 ────────────────────────────────────────────────
export const ADV: Frame[] = [
  { en: "The plan was carried out [_____].", ja: "計画は「{}」実行されました。" },
  { en: "He read the letter [_____] before answering.", ja: "彼は返事を書く前に手紙を「{}」読みました。" },
  { en: "The team finished the work [_____].", ja: "チームは仕事を「{}」終えました。" },
  { en: "They checked the numbers [_____] one more time.", ja: "彼らは数字をもう一度「{}」確認しました。" },
  { en: "The machine started working [_____] again.", ja: "その機械は再び「{}」動き始めました。" },
  { en: "We should prepare [_____] for the test.", ja: "私たちは試験に向けて「{}」準備すべきです。" },
  { en: "She answered the question [_____].", ja: "彼女はその質問に「{}」答えました。" },
  { en: "The workers moved the boxes [_____].", ja: "作業員は箱を「{}」運びました。" },
  { en: "He closed the door [_____] behind him.", ja: "彼は後ろ手にドアを「{}」閉めました。" },
  { en: "The train arrived [_____] at the station.", ja: "列車は「{}」駅に到着しました。" },
  { en: "They discussed the matter [_____] after lunch.", ja: "彼らは昼食後にその件を「{}」話し合いました。" },
  { en: "She wrote the address [_____] on the envelope.", ja: "彼女は封筒に住所を「{}」書きました。" },
  { en: "The results were announced [_____] this morning.", ja: "結果は今朝「{}」発表されました。" },
  { en: "He explained the rules [_____] to the new members.", ja: "彼は新入りに規則を「{}」説明しました。" },
];

// ── その他（前置詞句・接続表現・限定詞など、文中の語スロットに入らないもの）──
// 語そのものを話題にする文にすることで、どんな品詞・語形でも成り立つようにしている。
export const OTHER: Frame[] = [
  { en: "The expression [_____] is often used in written English.", ja: "「{}」という表現は書き言葉でよく使われます。" },
  { en: "Try using the expression [_____] in a sentence of your own.", ja: "「{}」という表現を自分の文で使ってみましょう。" },
  { en: "Our teacher explained when to use [_____].", ja: "先生は「{}」をいつ使うのかを説明してくれました。" },
  { en: "You will see [_____] many times in this textbook.", ja: "この教科書では「{}」を何度も目にするでしょう。" },
  { en: "Learners often confuse [_____] with similar expressions.", ja: "学習者は「{}」を似た表現と混同しがちです。" },
  { en: "The phrase [_____] appears twice on this page.", ja: "「{}」という語句はこのページに2回出てきます。" },
  { en: "Write a short sentence that uses the word [_____].", ja: "「{}」という語を使って短い文を書いてみましょう。" },
  { en: "Many students find the expression [_____] difficult at first.", ja: "多くの学生は最初「{}」という表現を難しく感じます。" },
  { en: "The textbook introduces the phrase [_____] in the second chapter.", ja: "教科書は第2章で「{}」という語句を扱います。" },
  { en: "Note how [_____] is used in the example below.", ja: "下の例で「{}」がどう使われているかに注目しましょう。" },
  { en: "We practised the expression [_____] until everyone understood it.", ja: "全員が理解するまで「{}」という表現を練習しました。" },
  { en: "The teacher underlined the word [_____] on the blackboard.", ja: "先生は黒板の「{}」という語に下線を引きました。" },
  { en: "Look carefully at the position of [_____] in the sentence.", ja: "文の中での「{}」の位置をよく見てください。" },
  { en: "This exercise focuses on the expression [_____] and similar forms.", ja: "この練習は「{}」という表現とその類似形を扱います。" },
];

/**
 * 冠詞を伴えない限定詞的な語。
 * 形容詞と判定されるが "the several system" のように連体枠へ入れると非文になるため、
 * その他の枠（語そのものを話題にする文）へ回す。
 */
export const DETERMINER_LIKE = new Set([
  "several", "some", "each", "every", "another", "countless", "various", "both", "either", "neither",
  "certain", "any", "no", "much", "many", "few", "little", "all", "most", "such"
]);

/** 訳語の第一語義を取り出す（括弧書きと先頭の「〜」を除く） */
export function firstSense(translation: string): string {
  return (translation.split(/[、,，/／;；]/)[0] || "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/^[〜～]/, "")
    .trim();
}

/** 日本語訳から、文中に差し込む形を作る */
export function insertForm(pos: string, translation: string, form: "attr" | "pred"): string {
  let s = firstSense(translation);
  if (pos === "verb") s = s.replace(/^を/, "");
  // 述語で使う枠では「重要な」「本物の」の語尾を落として「です」に接続できるようにする。
  // 連体で使う枠では「重要な計画」となるよう、そのままの形を使う。
  if (pos === "adjective" && form === "pred") s = s.replace(/[なの]$/, "");
  return s || translation;
}

/** 形容詞を訳語の語尾で3つに分ける */
export function adjectivePoolKey(word: string, translation: string): string {
  if (DETERMINER_LIKE.has(word.trim().toLowerCase())) return "other";
  const s = firstSense(translation);
  if (/の$/.test(s)) return "adjAttr";      // 電気の・医学の（連体専用）
  if (/[たて]$/.test(s)) return "adjState"; // 疲れた・孤立した（状態）
  return "adjQuality";                      // 重要な・美しい（一般の性質）
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
    noun: NOUN, adverb: ADV, other: OTHER,
    verbT: VERB_TRANS, verbI: VERB_INTRANS,
    adjQuality: ADJ_QUALITY, adjAttr: ADJ_ATTR, adjState: ADJ_STATE,
  };
  const cursor: Record<string, number> = {};
  let replaced = 0;
  const perPool: Record<string, number> = {};

  for (const w of arr) {
    if (!isTemplate(w)) continue;
    const pos: string = w.pos || "noun";
    let key: string;
    if (pos === "verb") key = /を/.test(w.translation) ? "verbT" : "verbI";
    else if (pos === "adjective") key = adjectivePoolKey(w.word, w.translation);
    else key = pos;
    const pool = pools[key] || NOUN;
    // 同じ枠が連続しないよう、プールごとに順番に配る。
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
    w.sentenceTranslation = frame.ja.replace("{}", insertForm(pos, w.translation, frame.form || "pred"));
    replaced++;
    perPool[key] = (perPool[key] || 0) + 1;
  }

  fs.writeFileSync(file, src.slice(0, arrStart) + JSON.stringify(arr) + src.slice(arrEnd + 1));
  const total = Object.values(pools).reduce((n, p) => n + p.length, 0);
  console.log(`差し替えた語: ${replaced}語 / 文枠: ${total}種類`, JSON.stringify(perPool));
  for (const [k, p] of Object.entries(pools)) {
    const n = perPool[k] || 0;
    console.log(`  ${k.padEnd(11)} ${String(n).padStart(5)}語 / ${String(p.length).padStart(3)}枠 = 1枠あたり ${(n / p.length).toFixed(1)}語`);
  }
}

// テストからこのファイルを読み込んでも書き換えが走らないようにする
if (process.argv[1] && process.argv[1].includes("rewrite_template_sentences")) main();
