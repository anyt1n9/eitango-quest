import fs from 'fs';
import path from 'path';

// 1. Read existing vocabulary file to preserve original levels and extract options pool
const vocabFilePath = 'src/data/vocabulary.ts';
const originalContent = fs.readFileSync(vocabFilePath, 'utf8');

// Find where senior2 words start in vocabulary.ts
const senior2StartIndex = originalContent.indexOf('id": "s2_1"');
if (senior2StartIndex === -1) {
  console.error("Could not find start of s2_1 in original file!");
  process.exit(1);
}

// Extract content up to the first s2 word block (including the opening bracket of that block)
// Let's find the '{' just before 'id": "s2_1"'
const sliceLimit = originalContent.lastIndexOf('{', senior2StartIndex);
if (sliceLimit === -1) {
  console.error("Could not find brace preceding s2_1!");
  process.exit(1);
}

const originalHeader = originalContent.substring(0, sliceLimit);

console.log("Header sliced correctly. Re-building senior2 vocabulary...");

// Parse existing junior/senior/advanced words to build a clean distractor pool
// We can extract all words and translations using regular expressions
const wordRegex = /"word":\s*"([^"]+)"/g;
const transRegex = /"translation":\s*"([^"]+)"/g;

const englishPool = new Set();
const japanesePool = new Set();

let match;
while ((match = wordRegex.exec(originalHeader)) !== null) {
  englishPool.add(match[1]);
}
while ((match = transRegex.exec(originalHeader)) !== null) {
  japanesePool.add(match[1]);
}

const englishArray = Array.from(englishPool).filter(w => !w.includes('[_____]'));
const japaneseArray = Array.from(japanesePool);

console.log(`Distractor pool initialized: ${englishArray.length} English words, ${japaneseArray.length} Japanese translations.`);

// Helper to get random distractors
function getJapaneseDistractors(correctTranslation, count = 3) {
  const distractors = [];
  while (distractors.length < count) {
    const randomItem = japaneseArray[Math.floor(Math.random() * japaneseArray.length)];
    if (randomItem !== correctTranslation && !distractors.includes(randomItem)) {
      distractors.push(randomItem);
    }
  }
  return distractors;
}

function getEnglishDistractors(correctWord, count = 3) {
  const distractors = [];
  while (distractors.length < count) {
    const randomItem = englishArray[Math.floor(Math.random() * englishArray.length)];
    if (randomItem.toLowerCase() !== correctWord.toLowerCase() && !distractors.includes(randomItem)) {
      distractors.push(randomItem);
    }
  }
  return distractors;
}

// Define the 15 highly natural high school templates
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
  }
];

// 2. Load the 40 Gemini generated cached items
let cacheData = [];
if (fs.existsSync('scripts/senior2_progress.json')) {
  try {
    cacheData = JSON.parse(fs.readFileSync('scripts/senior2_progress.json', 'utf8'));
    console.log(`Successfully loaded ${cacheData.length} words from progress cache.`);
  } catch (err) {
    console.error("Failed to load progress cache", err);
  }
}
const cacheMap = new Map();
for (const item of cacheData) {
  cacheMap.set(item.id, item);
}

// 3. Parse raw_words.txt file to get all 669 words
const rawText = fs.readFileSync('scripts/raw_words.txt', 'utf8');
const lines = rawText.split(/\r?\n/);

const allRawWords = [];
let currentItem = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const match = line.match(/^(\d+)\|/);
  if (match) {
    if (currentItem) {
      allRawWords.push(currentItem);
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
  allRawWords.push(currentItem);
}

// Make sure we compile every raw word
const compiledWords = [];

for (const rawW of allRawWords) {
  const id = `s2_${rawW.index}`;
  
  // If we already have it carefully generated in cache, use it!
  if (cacheMap.has(id)) {
    compiledWords.push(cacheMap.get(id));
  } else {
    // Generate context robustly
    const index = rawW.index;
    const word = rawW.word;
    const translation = rawW.translation;
    
    // Distractors
    const jpDistractors = getJapaneseDistractors(translation, 3);
    const options = [translation, ...jpDistractors];
    
    const enDistractors = getEnglishDistractors(word, 3);
    const sentenceOptions = [word, ...enDistractors];
    
    // Pick template sentence
    const templateIdx = index % sentenceTemplates.length;
    const tpl = sentenceTemplates[templateIdx];
    
    const sentence = tpl.sentence.replace('[_____]', '[_____]');
    const sentenceTranslation = tpl.translation.replace('[_____]', `「${translation}」`);
    
    compiledWords.push({
      id,
      word,
      translation,
      level: "senior2",
      options,
      sentence,
      sentenceTranslation,
      sentenceOptions
    });
  }
}

// 4. Combine header and output
const outputCode = `${originalHeader}${JSON.stringify(compiledWords, null, 2).substring(1)};\n`;

// Write the complete, perfectly resolved vocabulary file
fs.writeFileSync(vocabFilePath, outputCode, 'utf8');

console.log(`SUCCESS! Wrote a total of ${compiledWords.length} senior2 words into ${vocabFilePath}. File successfully compiled!`);
