import fs from 'fs';
import { initialVocabulary } from '../src/data/vocabulary.ts';

// 1. Read senior_raw_words.txt
const rawText = fs.readFileSync('scripts/senior_raw_words.txt', 'utf8');
const lines = rawText.split(/\r?\n/);

const parsedSeniorWords = [];
let currentItem = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const match = line.match(/^(\d+)\|/);
  if (match) {
    if (currentItem) {
      parsedSeniorWords.push(currentItem);
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
  parsedSeniorWords.push(currentItem);
}

console.log(`Parsed ${parsedSeniorWords.length} senior words from raw text file.`);

if (parsedSeniorWords.length !== 670) {
  console.error("WARNING: Expected exactly 670 items, but got:", parsedSeniorWords.length);
}

// 2. Build distractor pools from existing levels
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

// 3. Define high school senior templates (freshman level context)
const sentenceTemplates = [
  {
    sentence: "Could you please explain the meaning of [_____]?",
    translation: "[_____]の意味を説明していただけますか？"
  },
  {
    sentence: "It is essential to understand the term [_____] in this class.",
    translation: "この授業で[_____]という概念を理解することは不可欠です。"
  },
  {
    sentence: "We studied the usage of [_____] in our lecture yesterday.",
    translation: "私たちは昨日、講義で[_____]の使い方を学習しました。"
  },
  {
    sentence: "This textbook provides a clear example of [_____].",
    translation: "この教科書は[_____]の分かりやすい例を示しています。"
  },
  {
    sentence: "Please write a short sentence that includes [_____].",
    translation: "[_____]を含む短い文章を書いてみてください。"
  },
  {
    sentence: "The teacher explained how [_____] can be used in daily life.",
    translation: "先生は[_____]が日常生活でどのように使われるかを説明しました。"
  },
  {
    sentence: "I looked up the word [_____] to verify its exact spelling.",
    translation: "私は正確な綴りを確認するために[_____]という単語を調べました。"
  },
  {
    sentence: "She tried hard to memorize the definition of [_____].",
    translation: "彼女は[_____]の定義を覚えようと一生懸命に努力しました。"
  },
  {
    sentence: "The word [_____] is key to understanding the reading section.",
    translation: "[_____]という単語は、リーディングセクションを理解するための鍵です。"
  },
  {
    sentence: "This course helps you learn new vocabulary, such as [_____].",
    translation: "このコースは、[_____]のような新しい語彙を学ぶのに役立ちます。"
  },
  {
    sentence: "Can you find any synonyms for the expression [_____]?",
    translation: "[_____]という表現の類義語を見つけることができますか？"
  },
  {
    sentence: "He read the article carefully but did not understand [_____].",
    translation: "彼は記事を注意深く読みましたが、[_____]を理解できませんでした。"
  },
  {
    sentence: "Many students found it difficult to spell the word [_____].",
    translation: "多くの生徒が[_____]という単語を綴るのが難しいと感じました。"
  },
  {
    sentence: "You should add [_____] to your study list for the exam.",
    translation: "試験のための勉強リストに[_____]を追加するべきです。"
  },
  {
    sentence: "It is natural to make mistakes when you use [_____] for the first time.",
    translation: "初めて[_____]を使うときに間違えるのは自然なことです。"
  },
  {
    sentence: "Our English teacher gave us a list of key words, including [_____].",
    translation: "私たちの英語の先生は、[_____]を含む重要単語のリストを配ってくれました。"
  },
  {
    sentence: "The library has many books that can help you understand [_____].",
    translation: "図書館には[_____]を理解するのに役立つ本がたくさんあります。"
  },
  {
    sentence: "If you don't know the word [_____], please consult a dictionary.",
    translation: "もし[_____]という単語を知らないなら、辞書を引いてください。"
  },
  {
    sentence: "We had a lively discussion in class about the concept of [_____].",
    translation: "私たちは授業で[_____]という概念について活発な議論をしました。"
  },
  {
    sentence: "Understanding [_____] will improve your reading comprehension skills.",
    translation: "[_____]を理解することは、あなたの読解力を向上させるでしょう。"
  },
  {
    sentence: "She wrote a beautiful essay focusing on the theme of [_____].",
    translation: "彼女は[_____]というテーマに焦点を当てた素晴らしいエッセイを書きました。"
  },
  {
    sentence: "Please pay close attention to the pronunciation of [_____].",
    translation: "[_____]の発音に細心の注意を払ってください。"
  },
  {
    sentence: "After studying abroad, I realized the true importance of [_____].",
    translation: "留学を経験した後、私は[_____]の本当の重要性に気づきました。"
  },
  {
    sentence: "It is extremely important to know how to pronounce [_____] properly.",
    translation: "[_____]を正しく発音する方法を知ることは、極めて重要です。"
  },
  {
    sentence: "The student asked a very interesting question regarding [_____].",
    translation: "その生徒は[_____]に関して非常に興味深い質問をしました。"
  },
  {
    sentence: "He explained the complex idea of [_____] in a very simple way.",
    translation: "彼は[_____]という複雑な考えを、とても簡単な方法で説明しました。"
  },
  {
    sentence: "This exercise is specifically designed to test your knowledge of [_____].",
    translation: "この練習問題は、[_____]に関するあなたの知識をテストするために特別に設計されています。"
  },
  {
    sentence: "The meaning of [_____] can vary depending on the context.",
    translation: "[_____]の意味は文脈によって変化することがあります。"
  },
  {
    sentence: "She gave an informative presentation about the history of [_____].",
    translation: "彼女は[_____]の歴史について、有益なプレゼンテーションを行いました。"
  },
  {
    sentence: "It is essential to learn how [_____] functions in modern English.",
    translation: "現代英語の中で[_____]がどのように機能するかを学ぶことが不可欠です。"
  },
  {
    sentence: "We need to check the exact spelling of [_____] before publishing.",
    translation: "出版する前に、[_____]の正確な綴りを確認する必要があります。"
  },
  {
    sentence: "The professor spoke in detail about the scientific background of [_____].",
    translation: "教授は[_____]の科学的背景について詳細に語りました。"
  },
  {
    sentence: "I found this reference book extremely helpful for understanding [_____].",
    translation: "この参考書は、[_____]を理解するのにとても役立つことが分かりました。"
  },
  {
    sentence: "Let us practice using [_____] in a natural conversation.",
    translation: "自然な会話の中で[_____]を使う練習をしてみましょう。"
  },
  {
    sentence: "She demonstrated a deep and thorough understanding of [_____].",
    translation: "彼女は[_____]に対する深く、徹底した理解を示しました。"
  }
];

// Helper to determine POS-focused or appropriate representation (e.g., capitalize appropriately)
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
  
  // Replace the first match of [_____] in the sentence
  return {
    sentence: cleanSentence.replace('[_____]', '[_____]'),
    wordInSentence: targetWordForSentence
  };
}

// 4. Generate high-quality objects for the 670 senior items
const generatedSeniorWords = parsedSeniorWords.map((item) => {
  const word = item.word;
  const translation = item.translation;
  const id = `s${item.index}`;
  const level = "senior";
  
  // Options
  const jpDistractors = getJapaneseDistractors(translation, 3);
  const options = [translation, ...jpDistractors];
  
  const enDistractors = getEnglishDistractors(word, 3);
  const sentenceOptions = [word, ...enDistractors];
  
  // Select matching sentence template
  const templateIdx = (item.index - 1) % sentenceTemplates.length;
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

console.log(`Generated ${generatedSeniorWords.length} senior words.`);

// 5. Merge blocks:
// Keep "junior" level
const juniorWords = initialVocabulary.filter(w => w.level === 'junior');
// Keep "advanced" level
const advancedWords = initialVocabulary.filter(w => w.level === 'advanced');
// Keep "senior2" level
const senior2Words = initialVocabulary.filter(w => w.level === 'senior2');

console.log(`Retrieved other levels from existing code:`);
console.log(`- junior count: ${juniorWords.length}`);
console.log(`- advanced count: ${advancedWords.length}`);
console.log(`- senior2 count: ${senior2Words.length}`);

// Combine all in correct order: junior -> senior -> advanced -> senior2
const allCombinedVocabulary = [
  ...juniorWords,
  ...generatedSeniorWords,
  ...advancedWords,
  ...senior2Words
];

console.log(`Total combined vocabulary size: ${allCombinedVocabulary.length}`);

// Double check counts are identical to expected sizes
// junior = 220
// senior = 670
// advanced = 200
// senior2 = 669
// total = 1759
if (allCombinedVocabulary.length !== (220 + 670 + 200 + 669)) {
  console.error("WARNING: Total combined count does not match the expectations (1759)!");
}

// 6. Write back to src/data/vocabulary.ts
const header = `import { Word } from "../types";\n\nexport const initialVocabulary: Word[] = `;
const outputCode = `${header}${JSON.stringify(allCombinedVocabulary, null, 2)} as any as Word[];\n`;

fs.writeFileSync('src/data/vocabulary.ts', outputCode, 'utf8');
console.log("SUCCESS: Vocabulary file written perfectly!");
