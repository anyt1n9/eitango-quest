import fs from 'fs';
import { initialVocabulary } from '../src/data/vocabulary.ts';

// 1. Read senior3_raw_words.txt
const rawText = fs.readFileSync('scripts/senior3_raw_words.txt', 'utf8');
const lines = rawText.split(/\r?\n/);

const parsedSenior3Words = [];
let currentItem = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const match = line.match(/^(\d+)\|/);
  if (match) {
    if (currentItem) {
      parsedSenior3Words.push(currentItem);
    }
    currentItem = {
      index: parseInt(match[1]),
      word: '',
      translation: ''
    };
  } else if (currentItem) {
    if (!currentItem.word) {
      currentItem.word = line;
    } else if (!currentItem.translation) {
      currentItem.translation = line;
    } else {
      currentItem.translation += '，' + line;
    }
  }
}
if (currentItem) {
  parsedSenior3Words.push(currentItem);
}

console.log(`Parsed ${parsedSenior3Words.length} senior3 words from raw text file.`);

if (parsedSenior3Words.length !== 660) {
  console.warn("WARNING: Expected exactly 660 items, but got:", parsedSenior3Words.length);
}

// 2. Build distractor pools from existing levels (junior + senior + senior2 + advanced)
const englishPool = new Set();
const japanesePool = new Set();

for (const item of initialVocabulary) {
  englishPool.add(item.word);
  japanesePool.add(item.translation);
}

const englishArray = Array.from(englishPool).filter(w => w && !w.includes('[_____]') && w.length > 2);
const japaneseArray = Array.from(japanesePool).filter(t => t && t.length > 1);

console.log(`Pool counts: English distractors = ${englishArray.length}, Japanese distractors = ${japaneseArray.length}`);

// Helpers to get random distractors
function getJapaneseDistractors(correctTranslation, count = 3) {
  const distractors = [];
  while (distractors.length < count) {
    const rIdx = Math.floor(Math.random() * japaneseArray.length);
    const item = japaneseArray[rIdx];
    if (item !== correctTranslation && !distractors.includes(item)) {
      distractors.push(item);
    }
  }
  return distractors;
}

function getEnglishDistractors(correctWord, count = 3) {
  const distractors = [];
  while (distractors.length < count) {
    const rIdx = Math.floor(Math.random() * englishArray.length);
    const item = englishArray[rIdx];
    if (item.toLowerCase() !== correctWord.toLowerCase() && !distractors.includes(item)) {
      distractors.push(item);
    }
  }
  return distractors;
}

// 3. Define sentence templates for senior3 (high school senior year)
const sentenceTemplates = [
  {
    sentence: "The project has a [_____] impact on our local community.",
    translation: "そのプロジェクトは私たちの地域社会に[_____]な影響を与えています。"
  },
  {
    sentence: "She decided to leave and make progress instead of making another [_____].",
    translation: "彼女はこれ以上の[_____]をする代わりに、立ち去って前進することを選びました。"
  },
  {
    sentence: "The loud noise can [_____] an automatic response in animals.",
    translation: "大きな騒音は動物たちの自動的な反応の[_____]となり得ます。"
  },
  {
    sentence: "To our great [_____], the concert was a spectacular success.",
    translation: "私たちがとても[_____]したことに、コンサートは素晴らしい成功を収めました。"
  },
  {
    sentence: "The earthquake was a major [_____] that affected thousands of lives.",
    translation: "その地震は何千もの人々に影響を与えた重大な[_____]でした。"
  },
  {
    sentence: "We should understand that [_____] options have unique advantages.",
    translation: "私たちは、[_____]の選択肢にそれぞれ独自の利点があることを理解すべきです。"
  },
  {
    sentence: "He explained that we should not believe in this ancient [_____].",
    translation: "彼は私たちがこの古代の[_____]を信じるべきではないと説明しました。"
  },
  {
    sentence: "The computer was infected with a dangerous [_____] yesterday.",
    translation: "そのコンピューターは昨日、危険な[_____]に感染しました。"
  },
  {
    sentence: "Millions of people suffer from [_____] and poverty in that region.",
    translation: "その地域では何百万もの人々が[_____]と貧困に苦しんでいます。"
  },
  {
    sentence: "The major [_____] decided to offer substantial discounts this season.",
    translation: "大手[_____]は、今シーズン大幅な割引を提供することを決定しました。"
  },
  {
    sentence: "The country was prepared to use its legal [_____] for self-defense.",
    translation: "その国は自己防衛のために合法的な[_____]を使用する準備ができていました。"
  },
  {
    sentence: "They arrived [_____] and started working early the next morning.",
    translation: "彼らは[_____]に到着し、翌朝早くから働き始めました。"
  },
  {
    sentence: "This modern [_____] makes it easy to purchase drinks on the street.",
    translation: "この近代的な[_____]のおかげで、路上で飲み物を買うのが簡単になります。"
  },
  {
    sentence: "The temple welcomes every [_____] pilgrimer who visits this historic town.",
    translation: "当寺院は、この歴史ある町を訪れるすべての[_____]の巡礼者を歓迎します。"
  },
  {
    sentence: "They are [_____] interested in researching historical artifacts.",
    translation: "彼らは[_____]、歴史的な工芸品を研究することに関心があります。"
  },
  {
    sentence: "Our team provided [_____] assistance during the complicated procedure.",
    translation: "私たちのチームは、複雑な手順の間に[_____]なサポートを提供しました。"
  },
  {
    sentence: "The police arrested him for a sudden physical [_____].",
    translation: "警察は突然の物理的[_____]の容疑で彼を逮捕しました。"
  },
  {
    sentence: "It is lucky that we did not [_____] each other on the crowded stairs.",
    translation: "混雑した階段で私たちが互いに[_____]しなかったのは幸運でした。"
  },
  {
    sentence: "The teacher placed great [_____] on consistent learning practices.",
    translation: "先生は一貫した学習習慣に大きな[_____]を置きました。"
  },
  {
    sentence: "The school is undergoing a rapid [_____] to digital textbooks.",
    translation: "学校はデジタル教科書への急速な[_____]を進めています。"
  },
  {
    sentence: "A new democratic [_____] was established to maintain peace and order.",
    translation: "平和と秩序を維持するために、新しい民主的な[_____]が樹立されました。"
  },
  {
    sentence: "Your warm [_____] makes you extremely popular among the students.",
    translation: "あなたの温かい[_____]は、あなたを生徒たちの間で絶大的に人気者にしています。"
  },
  {
    sentence: "Do not let minor mistakes [_____] your beautiful experience in Japan.",
    translation: "些細な間違いのせいで日本での素晴らしい体験を[_____]にしてはいけません。"
  },
  {
    sentence: "You can find the [_____] updates and scientific reports on our site.",
    translation: "私たちのサイトで[_____]の更新情報や科学報告書を見つけることができます。"
  },
  {
    sentence: "Eating [_____] fish is a traditional custom in Japanese cuisine.",
    translation: "[_____]魚を食べることは日本料理の伝統的な習慣です。"
  },
  {
    sentence: "The protest group demanded a [_____] change in the current system.",
    translation: "抗議グループは現行システムの[_____]な改革を求めました。"
  },
  {
    sentence: "Completing this challenging project is a worthy [_____].",
    translation: "この挑戦的なプロジェクトを完了させることは、価値ある[_____]です。"
  },
  {
    sentence: "The public [_____] of high-class medical supplies is critical now.",
    translation: "高級医療品の公的な[_____]は、今や極めて重要です。"
  },
  {
    sentence: "Scientists want to find out how this [_____] survives the winter.",
    translation: "科学者たちは、この[_____]がどのように冬を越すのか解明したいと考えています。"
  },
  {
    sentence: "Doctors believe they can [_____] this disease with the new medicine.",
    translation: "医師たちは新しい薬でこの病気を[_____]できると信じています。"
  },
  {
    sentence: "The beautiful scenery will [_____] anyone who visits this park.",
    translation: "美しい景色は、この公園を訪れる誰をも[_____]するでしょう。"
  },
  {
    sentence: "His luxury house and vast [_____] became a valuable asset for the family.",
    translation: "彼の豪華な家と広大な[_____]は、家族にとって貴重な資産となりました。"
  },
  {
    sentence: "They managed to [_____] the leaves and dirt from the backyard.",
    translation: "彼らは裏庭からはっぱやゴミを[_____]ことができました。"
  },
  {
    sentence: "Please check every single [_____] on the inventory checklist.",
    translation: "棚卸しチェックリストの[_____]を一つずつ確認してください。"
  },
  {
    sentence: "He is seeking a [_____] solution to his health problems.",
    translation: "彼は自身の健康上の問題に対する[_____]な解決策を模索しています。"
  },
  {
    sentence: "The newly married couple decided to pay [_____] in advance.",
    translation: "新婚のカップルは[_____]を前もって支払うことに決めました。"
  },
  {
    sentence: "The engineer tried to [_____] the machine settings for efficiency.",
    translation: "技術者は効率を高めるために機械の設定を[_____]しようとしました。"
  },
  {
    sentence: "It takes great [_____] to stand up and speak the absolute truth.",
    translation: "立ち上がって絶対的な真実を語るには、大きな[_____]が必要です。"
  },
  {
    sentence: "The guards were heavily [_____] to protect the presidential castle.",
    translation: "警備員たちは大統領の城を守るために厳重に[_____]していました。"
  },
  {
    sentence: "This museum exhibits both historical and [_____] artworks.",
    translation: "この美術館は、歴史的な芸術作品と[_____]の芸術作品の両方を展示しています。"
  }
];

// Helper to format words properly in sentences
function formatInSentence(word, sentenceTpl) {
  let isCapitalized = false;
  let cleanSentence = sentenceTpl.sentence;
  
  if (cleanSentence.startsWith('[_____]')) {
    isCapitalized = true;
  }
  
  let targetWordForSentence = word;
  if (isCapitalized) {
    targetWordForSentence = word.charAt(0).toUpperCase() + word.slice(1);
  } else {
    targetWordForSentence = word.charAt(0).toLowerCase() + word.slice(1);
  }
  
  return {
    sentence: cleanSentence.replace('[_____]', '[_____]'),
    wordInSentence: targetWordForSentence
  };
}

// 4. Generate objects for senior3 items
const generatedSenior3Words = parsedSenior3Words.map((item, idx) => {
  const word = item.word;
  const translation = item.translation;
  const id = `s3-${idx + 1}`;
  const level = "senior3";
  
  // Options
  const jpDistractors = getJapaneseDistractors(translation, 3);
  const options = [translation, ...jpDistractors];
  
  const enDistractors = getEnglishDistractors(word, 3);
  const sentenceOptions = [word, ...enDistractors];
  
  // Select matching sentence template
  const templateIdx = idx % sentenceTemplates.length;
  const tpl = sentenceTemplates[templateIdx];
  
  const formatted = formatInSentence(word, tpl);
  const sentence = formatted.sentence;
  const sentenceTranslation = tpl.translation.replace('[_____]', `「${translation}」`);
  
  return {
    id,
    word,
    translation,
    level,
    options,
    sentence,
    sentenceTranslation,
    sentenceOptions
  };
});

console.log(`Generated ${generatedSenior3Words.length} senior3 words.`);

// 5. Merge blocks
const juniorWords = initialVocabulary.filter(w => w.level === 'junior');
const seniorWords = initialVocabulary.filter(w => w.level === 'senior');
const senior2Words = initialVocabulary.filter(w => w.level === 'senior2');
const advancedWords = initialVocabulary.filter(w => w.level === 'advanced');

// Clean up any existing senior3 from initialVocabulary to avoid duplicates
const filteredInitial = initialVocabulary.filter(w => w.level !== 'senior3');

console.log(`Retrieved other levels from existing code:`);
console.log(`- junior count: ${juniorWords.length}`);
console.log(`- senior count: ${seniorWords.length}`);
console.log(`- senior2 count: ${senior2Words.length}`);
console.log(`- advanced count: ${advancedWords.length}`);

// Merge in order: junior -> senior -> senior2 -> senior3 -> advanced
const allCombinedVocabulary = [
  ...juniorWords,
  ...seniorWords,
  ...senior2Words,
  ...generatedSenior3Words,
  ...advancedWords
];

console.log(`Total combined vocabulary size: ${allCombinedVocabulary.length}`);

const expectedTotal = juniorWords.length + seniorWords.length + senior2Words.length + generatedSenior3Words.length + advancedWords.length;
if (allCombinedVocabulary.length !== expectedTotal) {
  console.error(`WARNING: Total combined count does not match expected (${expectedTotal})!`);
}

// 6. Write back to src/data/vocabulary.ts
const header = `import { Word } from "../types";\n\nexport const initialVocabulary: Word[] = `;
const outputCode = `${header}${JSON.stringify(allCombinedVocabulary, null, 2)} as any as Word[];\n`;

fs.writeFileSync('src/data/vocabulary.ts', outputCode, 'utf8');
console.log("SUCCESS: Vocabulary file written perfectly!");
