import fs from 'fs';
import path from 'path';

// Load existing vocabulary
const vocabPath = path.join(process.cwd(), 'src/data/vocabulary.ts');
const fileContent = fs.readFileSync(vocabPath, 'utf8');

// Find rawVocabulary declaration
const match = fileContent.match(/(const rawVocabulary:\s*any\[\]\s*=\s*)(\[[\s\S]*?\]);/);
if (!match) {
  console.error("Could not find rawVocabulary array in vocabulary.ts!");
  process.exit(1);
}

const rawVocabPrefix = match[1];
const rawVocabArrayJson = match[2];
const rawVocab = JSON.parse(rawVocabArrayJson);

// Get set of existing lowercase words to prevent duplicates
const existingWordsSet = new Set(rawVocab.map((item: any) => item.word.toLowerCase().trim()));

console.log(`Current rawVocabulary count: ${rawVocab.length}`);
console.log(`Existing lowercase words count: ${existingWordsSet.size}`);

// Define rich list of candidate words from Level 2, 3, 4, 5 of "ターゲット中学英単語 1800"
const candidates = [
  // --- Level 2 (401 ~ 800) ---
  { word: "cannot", translation: "〜できない" },
  { word: "Monday", translation: "月曜日" },
  { word: "Tuesday", translation: "火曜日" },
  { word: "Wednesday", translation: "水曜日" },
  { word: "Thursday", translation: "木曜日" },
  { word: "Friday", translation: "金曜日" },
  { word: "Saturday", translation: "土曜日" },
  { word: "January", translation: "1月" },
  { word: "February", translation: "2月" },
  { word: "March", translation: "3月" },
  { word: "April", translation: "4月" },
  { word: "May", translation: "5月" },
  { word: "June", translation: "6月" },
  { word: "July", translation: "7月" },
  { word: "August", translation: "8月" },
  { word: "September", translation: "9月" },
  { word: "October", translation: "10月" },
  { word: "November", translation: "11月" },
  { word: "December", translation: "12月" },
  { word: "thousand", translation: "千" },
  { word: "million", translation: "百万" },
  { word: "marker", translation: "マーカーペン" },
  { word: "ruler", translation: "定規" },
  { word: "rubber", translation: "ゴム、消しゴム" },
  { word: "notebook", translation: "ノート" },
  { word: "textbook", translation: "教科書" },
  { word: "grade", translation: "学年、成績" },
  { word: "term", translation: "学期、期間" },
  { word: "score", translation: "得点、スコア" },
  { word: "absent", translation: "欠席の" },
  { word: "match", translation: "試合、マッチ" },
  { word: "field", translation: "分野、野原、競技場" },
  { word: "stadium", translation: "競技場、スタジアム" },
  { word: "athlete", translation: "運動選手、アスリート" },
  { word: "coach", translation: "指導者、コーチ" },
  { word: "audience", translation: "聴衆、観客" },
  { word: "captain", translation: "キャプテン、主将" },
  { word: "opponent", translation: "対戦相手" },
  { word: "referee", translation: "審判、レフェリー" },
  { word: "exercise", translation: "運動、練習問題" },
  { word: "glass", translation: "コップ、ガラス" },
  { word: "brush", translation: "ブラシ、筆" },
  { word: "soap", translation: "石鹸" },
  { word: "towel", translation: "タオル" },
  { word: "shampoo", translation: "シャンプー" },
  { word: "curtain", translation: "カーテン" },
  { word: "carpet", translation: "カーペット、じゅうたん" },
  { word: "blanket", translation: "毛布、ブランケット" },
  { word: "cushion", translation: "クッション" },
  { word: "cabbage", translation: "キャベツ" },
  { word: "lettuce", translation: "レタス" },
  { word: "cucumber", translation: "キュウリ" },
  { word: "garlic", translation: "ニンニク" },
  { word: "spinach", translation: "ホウレンソウ" },
  { word: "mushroom", translation: "キノコ" },
  { word: "pumpkin", translation: "カボチャ" },
  { word: "strawberry", translation: "イチゴ" },
  { word: "peach", translation: "桃" },
  { word: "cherry", translation: "サクランボ" },
  { word: "lemon", translation: "レモン" },
  { word: "melon", translation: "メロン" },
  { word: "watermelon", translation: "スイカ" },
  { word: "pineapple", translation: "パイナップル" },
  { word: "coconut", translation: "ココナッツ" },

  // --- Level 3 (801 ~ 1100) ---
  { word: "dictionary", translation: "辞書" },
  { word: "spell", translation: "〜をつづる" },
  { word: "error", translation: "誤り、エラー" },
  { word: "translation", translation: "翻訳" },
  { word: "definition", translation: "定義" },
  { word: "vocabulary", translation: "語彙、ボキャブラリー" },
  { word: "pronunciation", translation: "発音" },
  { word: "alphabet", translation: "アルファベット" },
  { word: "grammar", translation: "文法" },
  { word: "noun", translation: "名詞" },
  { word: "verb", translation: "動詞" },
  { word: "adjective", translation: "形容詞" },
  { word: "adverb", translation: "副詞" },
  { word: "pronoun", translation: "代名詞" },
  { word: "preposition", translation: "前置詞" },
  { word: "conjunction", translation: "接続詞" },
  { word: "interjection", translation: "間投詞" },
  { word: "comma", translation: "カンマ、読点" },
  { word: "period", translation: "ピリオド、終止符、期間" },
  { word: "sentence", translation: "文" },
  { word: "paragraph", translation: "段落、パラグラフ" },
  { word: "chapter", translation: "章" },
  { word: "line", translation: "線、行、列" },
  { word: "author", translation: "著者、作家" },
  { word: "novel", translation: "小説" },
  { word: "poem", translation: "詩" },
  { word: "poet", translation: "詩人" },
  { word: "essay", translation: "随筆、エッセイ" },
  { word: "article", translation: "記事、論説" },
  { word: "journal", translation: "専門誌、日誌" },
  { word: "dialogue", translation: "対話、ダイアログ" },
  { word: "expression", translation: "表現" },
  { word: "phrase", translation: "句、フレーズ" },
  { word: "idiom", translation: "慣用句、イディオム" },
  { word: "accent", translation: "アクセント、なまり" },
  { word: "fluency", translation: "流暢さ" },
  { word: "slang", translation: "俗語、スラング" },
  { word: "proverb", translation: "ことわざ" },
  { word: "metaphor", translation: "隠喩、メタファー" },
  { word: "simile", translation: "直喩、シミリ" },
  { word: "communication", translation: "伝達、コミュニケーション" },
  { word: "conversation", translation: "会話" },
  { word: "discussion", translation: "討論、ディスカッション" },
  { word: "debate", translation: "討論、ディベート" },
  { word: "lecture", translation: "講義、レクチャー" },
  { word: "presentation", translation: "発表、プレゼンテーション" },
  { word: "interview", translation: "面接、インタビュー" },
  { word: "report", translation: "報告、レポート" },
  { word: "culture", translation: "文化" },
  { word: "traditional", translation: "伝統的な" },
  { word: "history", translation: "歴史" },
  { word: "modern", translation: "現代の、近代的な" },
  { word: "ancient", translation: "古代の" },
  { word: "society", translation: "社会" },
  { word: "custom", translation: "習わし、習慣" },

  // --- Level 4 & 5 (1101 ~ 1800) ---
  { word: "album", translation: "アルバム" },
  { word: "dancer", translation: "ダンサー、踊り手" },
  { word: "ghost", translation: "お化け、幽霊" },
  { word: "guitar", translation: "ギター" },
  { word: "shadow", translation: "影、シャドウ" },
  { word: "track", translation: "トラック、競技路、足跡" },
  { word: "project", translation: "計画、プロジェクト" },
  { word: "pilot", translation: "水先案内人、パイロット" },
  { word: "message", translation: "伝言、メッセージ" },
  { word: "machine", translation: "機械" },
  { word: "style", translation: "様式、スタイル" },
  { word: "plastic", translation: "プラスチックの、ビニール製の" },
  { word: "coin", translation: "硬貨、コイン" },
  { word: "metal", translation: "金属" },
  { word: "block", translation: "ブロック、区画" },
  { word: "gas", translation: "気体、ガス、ガソリン" },
  { word: "symbol", translation: "記号、象徴、シンボル" },
  { word: "pattern", translation: "模様、パターン、型" },
  { word: "source", translation: "源、情報源、原因" },
  { word: "scale", translation: "規模、目盛り、音階" },
  { word: "signal", translation: "合図、信号、シグナル" },
  { word: "scene", translation: "場面、情景、シーン" },
  { word: "series", translation: "連続、シリーズ" },
  { word: "tool", translation: "道具、工具、ツール" },
  { word: "energy", translation: "精力、エネルギー" },
  { word: "power", translation: "力、権力、電力" },
  { word: "balance", translation: "調和、均衡、バランス" },
  { word: "surface", translation: "表面" },
  { word: "section", translation: "部分、部門、区画" },
  { word: "wave", translation: "波、ウェーブ" },
  { word: "element", translation: "要素、元素" },
  { word: "structure", translation: "構造、建造物" },
  { word: "basic", translation: "基本的な、基礎的な" },
  { word: "design", translation: "デザイン、設計" },
  { word: "process", translation: "過程、プロセス、工程" },
  { word: "local", translation: "地元の、地方の、局所の" },
  { word: "official", translation: "公式の、公務員、役員" },
  { word: "general", translation: "一般的な、全般的な、大将" },
  { word: "active", translation: "活動的な、積極的な" },
  { word: "silent", translation: "無言の、静かな" },
  { word: "loud", translation: "大声の、騒々しい" },
  { word: "wet", translation: "濡れた、湿った" },
  { word: "tight", translation: "引き締まった、きつい、しっかり固定された" },
  { word: "loose", translation: "ゆったりした、緩んだ" },
  { word: "separate", translation: "分離した、個々の、を分ける" },
  { word: "classic", translation: "古典的な、一流の" },
  { word: "flat", translation: "平らな、パンクした、アパート" },
  { word: "blank", translation: "空白の、白紙の、空欄" },
  { word: "regular", translation: "規則正しい、定期的な、通常の" },
  { word: "odd", translation: "奇妙な、奇数の、半端な" },
  { word: "chief", translation: "名立たる、主要な、長官" },
  { word: "actual", translation: "実際の、現実の" },
  { word: "virtual", translation: "仮想の、実質上の" },
  { word: "global", translation: "世界的な、地球規模の" },
  { word: "organic", translation: "有機の、有機体の、組織の" },
  { word: "physical", translation: "身体の、物理的な、物質の" },
  { word: "chemical", translation: "化学の、化学物質" },
  { word: "digital", translation: "デジタルの" },
  { word: "private", translation: "私的な、私立の、個人兵" },
  { word: "personal", translation: "個人の、私的な" },
  { word: "final", translation: "最後の、決勝の、ファイナル" },
  { word: "perfect", translation: "完全な、文句なしの" },
  { word: "complete", translation: "完全な、を完成させる" },
  { word: "total", translation: "総計の、完全な、総計" },
  { word: "complex", translation: "複雑な" },
  { word: "broad", translation: "広い、広範囲な" },
  { word: "narrow", translation: "狭い、を狭める" },
  { word: "deep", translation: "深い" },
  { word: "shallow", translation: "浅い、浅はかな" },
  { word: "middle", translation: "中央の、中間の、中央" },
  { word: "male", translation: "男の、雄の" },
  { word: "female", translation: "女の、雌の" },
  { word: "professional", translation: "プロの、本職の" },
  { word: "social", translation: "社会的な、社交の" },
  { word: "cultural", translation: "文化的な" },
  { word: "national", translation: "国家の、国民の" },
  { word: "native", translation: "母国の、現地生まれの、独自の" },
  { word: "peaceful", translation: "平和な、穏やかな" },
  { word: "calm", translation: "穏やかな、冷静な" },
  { word: "gentle", translation: "優しい、穏やかな" },
  { word: "mild", translation: "温和な、軽い" },
  { word: "wild", translation: "野生の、荒々しい" },
  { word: "brave", translation: "勇敢な、勇気のある" },
  { word: "plain", translation: "平易な、明らかな、無地の" },
  { word: "obvious", translation: "明白な、明らかな" },
  { word: "evident", translation: "明白な、はっきりした" },
  { word: "apparent", translation: "一目瞭然の、明白な" },
  { word: "distinct", translation: "明確に異なる、めだつ" },
  { word: "accurate", translation: "正確な、精密な" },
  { word: "exact", translation: "正確な、厳密な" },
  { word: "precise", translation: "精密な、緻密な" },
  { word: "proper", translation: "適切な、相応しい" },
  { word: "realistic", translation: "現実的な" },
  { word: "practical", translation: "実用的な" },
  { word: "original", translation: "独創的な、最初の" },
  { word: "average", translation: "平均の、平均" },
  { word: "universal", translation: "普遍的な、万国共通の" },
  { word: "electronic", translation: "電子の、電子的な" },
  { word: "vacant", translation: "空いている、空ろな" },
  { word: "normal", translation: "標準の、通常の" }
];

// Determine the next ID index for junior items
let maxJuniorIndex = 495;
for (const item of rawVocab) {
  if (item.level === 'junior' && item.id.startsWith('j')) {
    const idx = parseInt(item.id.substring(1));
    if (!isNaN(idx) && idx > maxJuniorIndex) {
      maxJuniorIndex = idx;
    }
  }
}

console.log(`Max junior index found in existing database: ${maxJuniorIndex}`);

// Pools for options/distractors
const allTranslations = rawVocab.map((item: any) => item.translation);
const allWords = rawVocab.map((item: any) => item.word);

function getJapaneseDistractors(correctTranslation: string, count = 3) {
  const distractors: string[] = [];
  while (distractors.length < count) {
    const randomIdx = Math.floor(Math.random() * allTranslations.length);
    const item = allTranslations[randomIdx];
    if (item !== correctTranslation && !distractors.includes(item)) {
      distractors.push(item);
    }
  }
  return distractors;
}

function getEnglishDistractors(correctWord: string, count = 3) {
  const distractors: string[] = [];
  while (distractors.length < count) {
    const randomIdx = Math.floor(Math.random() * allWords.length);
    const item = allWords[randomIdx];
    if (item.toLowerCase() !== correctWord.toLowerCase() && !distractors.includes(item)) {
      distractors.push(item);
    }
  }
  return distractors;
}

// Highly elegant sentence templates with corresponding Japanese translation where [_____] gets replaced
const sentenceTemplates = [
  {
    sentence: "We should learn the word [_____] because it is very useful.",
    translation: "「[_____]」という単語はとても役に立つので学ぶべきです。"
  },
  {
    sentence: "Could you give me an example sentence containing [_____]?",
    translation: "「[_____]」を含む例文を教えてもらえますか？"
  },
  {
    sentence: "The teacher asked us to find the meaning of [_____] today.",
    translation: "先生は今日、私たちに「[_____]」の意味を調べるように言いました。"
  },
  {
    sentence: "I wrote down the word [_____] in my vocabulary notebook.",
    translation: "私は新しい単語「[_____]」を単語帳に書き留めました。"
  },
  {
    sentence: "She was able to translate [_____] into Japanese correctly.",
    translation: "彼女は「[_____]」を正しく日本語に翻訳することができました。"
  },
  {
    sentence: "It is important to remember how to spell the word [_____].",
    translation: "「[_____]」という単語のスペル（つづり）を覚えることは重要です。"
  },
  {
    sentence: "Do you know how to use the word [_____] in a sentence?",
    translation: "文章の中で「[_____]」という単語をどう使うか知っていますか？"
  },
  {
    sentence: "I read a story that included the word [_____] yesterday.",
    translation: "私は昨日、「[_____]」という言葉が含まれる物語を読みました。"
  },
  {
    sentence: "We studied the definition of [_____] during our school class.",
    translation: "私たちは学校の授業で「[_____]」の定義を勉強しました。"
  },
  {
    sentence: "This dictionary provides a clear explanation of [_____].",
    translation: "この辞書は「[_____]」のわかりやすい説明を提供しています。"
  }
];

// Add unique non-duplicate cards
let addedCount = 0;
const newWordsAddedList: any[] = [];

for (const candidate of candidates) {
  const word = candidate.word.trim();
  const lowerWord = word.toLowerCase();

  // Skip duplicate spelling
  if (existingWordsSet.has(lowerWord)) {
    continue;
  }

  // Add word
  existingWordsSet.add(lowerWord);
  maxJuniorIndex++;
  
  const id = `j${maxJuniorIndex}`;
  
  // Pick random sentence template
  const templIdx = Math.floor(Math.random() * sentenceTemplates.length);
  const templ = sentenceTemplates[templIdx];
  
  const enSentence = templ.sentence.replace("[_____]", word);
  const jaSentence = templ.translation.replace("[_____]", candidate.translation);

  const wordEntry: any = {
    id,
    word,
    translation: candidate.translation,
    level: "junior",
    sentence: enSentence,
    sentenceTranslation: jaSentence
  };

  newWordsAddedList.push(wordEntry);
  addedCount++;
}

console.log(`Unique words prepared to be added: ${addedCount}`);

// Now find where standard rawVocabulary list ends (before `];`)
const lastBraceIndex = fileContent.lastIndexOf('];');
if (lastBraceIndex === -1) {
  console.error("Could not find closing bracket ]; of rawVocabulary!");
  process.exit(1);
}

// Format new entries cleanly
const jsonString = JSON.stringify(newWordsAddedList, null, 2);
// Keep formatting exact. Remove starting [ and ending ] to fit inside array
const innerJson = jsonString.trim().substring(1, jsonString.length - 1).trim();

// Combine everything
const newContent = fileContent.substring(0, lastBraceIndex).trim() + ',\n  ' + innerJson + '\n];\n';

fs.writeFileSync(vocabPath, newContent, 'utf8');
console.log(`Successfully appended ${addedCount} unique junior words to ${vocabPath}!`);
