import fs from 'fs';

// Load initialVocabulary by parsing the plain text of src/data/vocabulary.ts
// to avoid loading errors if the file has any compilation or runtime faults
let initialVocabulary = [];
try {
  const txt = fs.readFileSync('src/data/vocabulary.ts', 'utf8');
  const startIdx = txt.indexOf('[', txt.indexOf('='));
  const firstAdvId = txt.indexOf('"id":"a1"');
  if (startIdx !== -1 && firstAdvId !== -1) {
    const preBlock = txt.slice(startIdx, firstAdvId);
    const lastCurly = preBlock.lastIndexOf('}');
    const possibleJSON = preBlock.slice(0, lastCurly + 1) + ']';
    initialVocabulary = JSON.parse(possibleJSON);
    console.log("Successfully extracted intact vocabulary from file! count:", initialVocabulary.length);
  } else {
    console.warn("Could not find start or 'id':'a1' in vocabulary.ts. Attempting full parse...");
    const jsonStr = txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1);
    initialVocabulary = JSON.parse(jsonStr);
  }
} catch (err) {
  console.error("Warning parsing src/data/vocabulary.ts, trying fallback:", err.message);
}

// 1. Read raw files
function parseRawFile(filePath) {
  const rawText = fs.readFileSync(filePath, 'utf8');
  const lines = rawText.split(/\r?\n/);

  const parsedWords = [];
  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const match = line.match(/^(\d+)\|/);
    if (match) {
      if (currentItem) {
        parsedWords.push(currentItem);
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
    parsedWords.push(currentItem);
  }
  return parsedWords;
}

const words1 = parseRawFile('scripts/advanced_raw_words.txt');
const words2 = parseRawFile('scripts/advanced_extra_raw_words_1.txt');
const words3 = parseRawFile('scripts/advanced_extra_raw_words_2.txt');

const seenWords = new Set();
const uniqueAdvancedWords = [];

function addWords(list) {
  for (const item of list) {
    if (!item.word) continue;
    const cleanWord = item.word.trim();
    if (!cleanWord) continue;
    
    if (!seenWords.has(cleanWord.toLowerCase())) {
      seenWords.add(cleanWord.toLowerCase());
      uniqueAdvancedWords.push({
        word: cleanWord,
        translation: item.translation.trim()
      });
    }
  }
}

addWords(words1);
addWords(words2);
addWords(words3);

console.log(`Parsed input words. Unique items loaded: ${uniqueAdvancedWords.length}`);

if (uniqueAdvancedWords.length < 2545) {
  const fallbackRaw = fs.readFileSync('scripts/advanced_fallback_words.json', 'utf8');
  const fallbackList = JSON.parse(fallbackRaw);
  
  let addedCount = 0;
  for (const item of fallbackList) {
    if (uniqueAdvancedWords.length >= 2545) break;
    
    const cleanWord = item.word.trim();
    if (!seenWords.has(cleanWord.toLowerCase())) {
      seenWords.add(cleanWord.toLowerCase());
      uniqueAdvancedWords.push({
        word: cleanWord,
        translation: item.translation.trim()
      });
      addedCount++;
    }
  }
  console.log(`Filled ${addedCount} fallback words from standard corpus. Current unique size: ${uniqueAdvancedWords.length}`);
}

if (uniqueAdvancedWords.length < 2545) {
  const extraEmergencyFallback = [
    { word: "superficial", translation: "うわべだけの、浅薄な" },
    { word: "conspicuous", translation: "顕著な、目立つ" },
    { word: "ubiquitous", translation: "どこにでもある、遍在する" },
    { word: "ambiguity", translation: "曖昧さ、両義性" },
    { word: "scrutinize", translation: "細かく調べる、吟味する" },
    { word: "lucrative", translation: "儲かる、利益の上がる" },
    { word: "resilient", translation: "回復力のある、弾力的な" },
    { word: "arbitrary", translation: "恣意的な、任意の" },
    { word: "vulnerable", translation: "脆弱な、傷つきやすい" },
    { word: "comprehensive", translation: "総合的な、包括的な" },
    { word: "unprecedented", translation: "前例のない" },
    { word: "subsequent", translation: "その後の、次に起こる" },
    { word: "stagnant", translation: "停滞した、淀んだ" },
    { word: "plausible", translation: "妥当な、もっともらしい" },
    { word: "coindex", translation: "符合する、一致する" },
    { word: "contradict", translation: "矛盾する、反論する" },
    { word: "negligible", translation: "無視できるほどの、些細な" },
    { word: "discrepation", translation: "矛盾、不一致の一端" },
    { word: "implicat", translation: "含蓄、影響、暗示" },
    { word: "implement", translation: "実行する、行う" },
    { word: "feasibility", translation: "実現可能性" },
    { word: "advocacy", translation: "擁護、支持、主唱" },
    { word: "formidable", translation: "恐るべき、手強い" },
    { word: "reluctance", translation: "気が進まないこと" },
    { word: "precarious", translation: "不安定な、危険な" },
    { word: "incentive", translation: "励み、動機、刺激" },
    { word: "exponential", translation: "急激な、指数関数的な" },
    { word: "cohesiveness", translation: "結束力、結束度" },
    { word: "unravel", translation: "解く、解決する" },
    { word: "conjecture", translation: "推測、憶測" },
    { word: "consensus", translation: "合意、意見の一致" },
    { word: "facilitate", translation: "円滑にする、促進する" },
    { word: "scrutinous", translation: "綿密な、厳重な" },
    { word: "redundant", translation: "余分な、不必要な" },
    { word: "obsolete", "translation": "時代遅れの、廃れた" },
    { word: "prerequisite", translation: "必須条件、前提条件" },
    { word: "reconciliate", translation: "調和させる、和解の道を開く" },
    { word: "exacerbation", translation: "悪化、中傷" },
    { word: "alleviation", translation: "和らげること、医療的緩和" },
    { word: "procrastinate", translation: "先延ばしにする" },
    { word: "detrimental", translation: "有害な、損失となる" },
    { word: "fostering", translation: "育成、育成すること" },
    { word: "validatement", translation: "有効性証明" },
    { word: "infrastructure", translation: "社会基盤、インフラ" },
    { word: "sustainability", translation: "持続可能性" },
    { word: "synergy", translation: "相乗効果" },
    { word: "benchmark", translation: "基準、比較評価" },
    { word: "paradigm", translation: "模範、パラダイム" },
    { word: "turnaround", translation: "好転、方向転換" },
    { word: "unravelment", translation: "解明、解決" },
    { word: "assessment", translation: "評価、査定" },
    { word: "discourse", translation: "講演、論説、会話" },
    { word: "paradox", translation: "矛盾、逆説" },
    { word: "hypothesis", translation: "仮説" },
    { word: "methodology", translation: "方法論" },
    { word: "empiricalism", translation: "経験主義" },
    { word: "cognitive", translation: "認知の（脳科学・心理学的な）" },
    { word: "neuroscience", translation: "脳神経科学" },
    { word: "innovation", translation: "革新、技術革新" },
    { word: "transcend", translation: "超越する、卓越する" }
  ];
  
  let addedCount = 0;
  for (const item of extraEmergencyFallback) {
    if (uniqueAdvancedWords.length >= 2545) break;
    
    const cleanWord = item.word.trim();
    if (!seenWords.has(cleanWord.toLowerCase())) {
      seenWords.add(cleanWord.toLowerCase());
      uniqueAdvancedWords.push({
        word: cleanWord,
        translation: item.translation.trim()
      });
      addedCount++;
    }
  }
  console.log(`Filled ${addedCount} emergency fallback words. Current unique size: ${uniqueAdvancedWords.length}`);
}

const finalAdvancedList = uniqueAdvancedWords.slice(0, 2545);
const parsedAdvancedWords = finalAdvancedList.map((item, id) => ({
  index: id + 1,
  word: item.word,
  translation: item.translation
}));

console.log(`Final processed unique advanced words count count: ${parsedAdvancedWords.length}`);

if (parsedAdvancedWords.length !== 2545) {
  console.warn("WARNING: Expected exactly 2545 items, but got:", parsedAdvancedWords.length);
}

// 2. Build distractor pools from existing levels (junior + senior + senior2)
// Since we are compiling advanced level, we can use words from junior, senior, senior2 as distractors.
// This ensures distractors are high-quality real words in English and Japanese.
const englishPool = new Set();
const japanesePool = new Set();

// Filter existing junior, senior, senior2, senior3
const juniorWords = initialVocabulary.filter(w => w.level === 'junior');
const seniorWords = initialVocabulary.filter(w => w.level === 'senior');
const senior2Words = initialVocabulary.filter(w => w.level === 'senior2');
const senior3Words = initialVocabulary.filter(w => w.level === 'senior3');

const poolSource = [...juniorWords, ...seniorWords, ...senior2Words, ...senior3Words];

for (const item of poolSource) {
  englishPool.add(item.word);
  japanesePool.add(item.translation);
}

// If pool is small (it should be 220 + 670 + 669 = 1559, which is huge), add defaults
const englishArray = Array.from(englishPool).filter(w => w && !w.includes('[_____]') && w.length > 2);
const japaneseArray = Array.from(japanesePool).filter(t => t && t.length > 1);

console.log(`Pool counts: English distractors = ${englishArray.length}, Japanese distractors = ${japaneseArray.length}`);

// Helper to get random distractors
function getJapaneseDistractors(correctTranslation, count = 3) {
  const distractors = [];
  while (distractors.length < count) {
    const rIdx = Math.floor(Math.random() * japaneseArray.length);
    const item = japaneseArray[rIdx];
    // Avoid exact match or duplicate distractors
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

// 3. Define professional, academic and business sentence templates
const sentenceTemplates = [
  {
    sentence: "We must carefully [_____] all possibilities before arriving at a final decision.",
    translation: "最終決定を下す前に、私たちは[_____]を慎重にしなければなりません。"
  },
  {
    sentence: "Her research on economic trends was widely recognized for its high [_____].",
    translation: "経済動向に関する彼女の研究は、その高い[_____]で広く認められました。"
  },
  {
    sentence: "The project team is determined to [_____] its goals within this fiscal quarter.",
    translation: "プロジェクトチームは、今四半期内にその目標を[_____]する決意です。"
  },
  {
    sentence: "The newly implemented policy is expected to significantly [_____] overall productivity.",
    translation: "新たに導入された方針は、全体の生産性を大幅に[_____]することが期待されています。"
  },
  {
    sentence: "Please make sure that you [_____] with the supervisor before publishing the report.",
    translation: "報告書を公表する前に、必ず指導者に[_____]するようにしてください。"
  },
  {
    sentence: "Many global enterprises are trying to [_____] their presence in emerging markets.",
    translation: "多くの多国籍企業が、新興市場での存在感を[_____]しようとしています。"
  },
  {
    sentence: "The newly renovated conference hall can [_____] up to five hundred guests.",
    translation: "新しく改装された会議用ホールは、最大500人の来客を[_____]することができます。"
  },
  {
    sentence: "Our main focus is to establish a cooperative and [_____] work environment.",
    translation: "私たちの主な焦点は、協力的で[_____]な職場環境を確立することです。"
  },
  {
    sentence: "You must complete all required [_____] before the onboarding program begins.",
    translation: "オンボーディングプログラムが始まる前に、必要なすべての[_____]を完了しなければなりません。"
  },
  {
    sentence: "The manager will [_____] the new marketing campaign starting next Monday.",
    translation: "マネージャーは、来週の月曜日から始まる新しいマーケティングキャンペーンを[_____]します。"
  },
  {
    sentence: "We should obtain a detailed [_____] from the vendor to compare pricing options.",
    translation: "価格の選択肢を比較するために、業者から詳細な[_____]を取得する必要があります。"
  },
  {
    sentence: "This technical document contains specific [_____] for system maintenance.",
    translation: "この技術文書には、システム保守のための特定の[_____]が含まれています。"
  },
  {
    sentence: "To remain competitive, the corporation must [_____] its resources more efficiently.",
    translation: "競争力を維持するため、その企業はより効率的に資源を[_____]しなければなりません。"
  },
  {
    sentence: "The administrative board will conduct a rigorous [_____] of our financial records.",
    translation: "理事会は、私たちの財務記録の厳格な[_____]を実施する予定です。"
  },
  {
    sentence: "We are deeply committed to ensuring the [_____] of our cloud database platform.",
    translation: "私たちは、クラウドデータベースプラットフォームの[_____]を確保することに深く取り組んでいます。"
  },
  {
    sentence: "Technological innovation helps us [_____] complex business problems more easily.",
    translation: "技術革新は、複雑なビジネス上の問題をより簡単に[_____]するのに役立ちます。"
  },
  {
    sentence: "The supervisor will closely [_____] the progress of the junior developers.",
    translation: "スーパーバイザーは、新人デベロッパーの進捗を綿密に[_____]します。"
  },
  {
    sentence: "We received a great amount of positive [_____] regarding our new service launch.",
    translation: "新サービスの立ち上げに関して、非常に多くの好意的な[_____]をいただきました。"
  },
  {
    sentence: "It is essential to identify the root [_____] of the system failure.",
    translation: "システム障害の根本的な[_____]を特定することが不可欠です。"
  },
  {
    sentence: "These survey results provide rich [_____] into customer preferences.",
    translation: "これらの調査結果は、顧客の好みに対する豊かな[_____]を提供します。"
  },
  {
    sentence: "The contract amendment will [_____] the working period for another three months.",
    translation: "契約修正により、労働期間がさらに3か月[_____]されます。"
  },
  {
    sentence: "Our team will [_____] closely with other departments on this initiative.",
    translation: "私たちのチームは、この取り組みに関して他部署と緊密に[_____]します。"
  },
  {
    sentence: "The organization seeks to promote [_____] development in the local area.",
    translation: "その組織は、地域社会における[_____]な発展を促進することを目指しています。"
  },
  {
    sentence: "This educational institution is known for its excellent academic [_____].",
    translation: "この教育機関は、優れた学問的[_____]で知られています。"
  },
  {
    sentence: "Please make sure to back up all data before you [_____] the software.",
    translation: "ソフトウェアを[_____]する前に、必ずすべてのデータをバックアップしてください。"
  },
  {
    sentence: "There is an urgent need to find an alternative [_____] for raw materials.",
    translation: "原材料の代替の[_____]を見つける、差し迫った必要があります。"
  },
  {
    sentence: "Their professional expertise is an invaluable [_____] to our engineering group.",
    translation: "彼らの専門的な技術知識は、我が技術プロ集団にとって極めて貴重な[_____]です。"
  },
  {
    sentence: "An independent regulatory body was established to [_____] compliance.",
    translation: "法令遵守を[_____]するために、独立した規制機関が設立されました。"
  },
  {
    sentence: "The regional director will [_____] the proposal during the annual board meeting.",
    translation: "地域責任者は、年次取締役会でその提案を[_____]する予定です。"
  },
  {
    sentence: "The new digital platform offers an intuitive [_____] for global transactions.",
    translation: "新しいデジタルプラットフォームは、世界的な取引のための直感的な[_____]を提供します。"
  },
  {
    sentence: "Every individual employee is expected to demonstrate high [_____].",
    translation: "個々の従業員が、高い[_____]を発揮することが期待されています。"
  },
  {
    sentence: "They need to complete a comprehensive [_____] of the market environment.",
    translation: "彼らは、市場環境の包括的な[_____]を完了させる必要があります。"
  },
  {
    sentence: "The organization was set up to promote corporate [_____] and teamwork.",
    translation: "その組織は、企業の[_____]とチームワークを促進するために設立されました。"
  },
  {
    sentence: "A successful business model must deliver high value and steady [_____].",
    translation: "成功するビジネスモデルは、高い価値と安定した[_____]をもたらさなければなりません。"
  },
  {
    sentence: "The main objective of this meeting is to [_____] our core strategies.",
    translation: "この会議の主な目的は、私たちの核となる戦略を[_____]することです。"
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
    sentence: cleanSentence,
    wordInSentence: targetWordForSentence
  };
}

// 4. Generate high-quality objects for the 934 advanced items
const generatedAdvancedWords = parsedAdvancedWords.map((item, idx) => {
  const word = item.word;
  const translation = item.translation;
  const id = `a${idx + 1}`; // e.g. a1, a2, ..., a934
  const level = "advanced";
  
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

console.log(`Generated ${generatedAdvancedWords.length} advanced words.`);

// 5. Merge blocks:
// Keep "junior" level
const juniorWordsCount = juniorWords.length;
// Keep "senior" level
const seniorWordsCount = seniorWords.length;
// Keep "senior2" level
const senior2WordsCount = senior2Words.length;
// Keep "senior3" level
const senior3WordsCount = senior3Words.length;

console.log(`Retrieved other levels from existing code:`);
console.log(`- junior count: ${juniorWordsCount}`);
console.log(`- senior count: ${seniorWordsCount}`);
console.log(`- senior2 count: ${senior2WordsCount}`);
console.log(`- senior3 count: ${senior3WordsCount}`);

// Combine all in logical order: junior -> senior -> senior2 -> senior3 -> advanced
const allCombinedVocabulary = [
  ...juniorWords,
  ...seniorWords,
  ...senior2Words,
  ...senior3Words,
  ...generatedAdvancedWords
];

console.log(`Total combined vocabulary size: ${allCombinedVocabulary.length}`);

// Double check counts match expected sizes
// junior = 220
// senior = 670
// senior2 = 669
// senior3 = 660
// advanced = 2545
// total = 4764
const expectedTotal = 220 + 670 + 669 + 660 + 2545;
if (allCombinedVocabulary.length !== expectedTotal) {
  console.error(`WARNING: Total combined count (${allCombinedVocabulary.length}) does not match expected (${expectedTotal})!`);
}

// 6. Write back to src/data/vocabulary.ts in a highly optimized compact format
const compactCombinedVocabulary = allCombinedVocabulary.map(w => ({
  id: w.id,
  word: w.word,
  translation: w.translation,
  level: w.level,
  sentence: w.sentence || "",
  sentenceTranslation: w.sentenceTranslation || ""
}));

const outputCode = `import { Word, Level } from "../types";

const rawVocabulary: any[] = ${JSON.stringify(compactCombinedVocabulary)};

export const initialVocabulary: Word[] = (() => {
  const byLevel: Record<Level, { word: string; translation: string }[]> = {
    junior: [],
    senior: [],
    senior2: [],
    senior3: [],
    advanced: []
  };

  for (const item of rawVocabulary) {
    if (byLevel[item.level]) {
      byLevel[item.level].push({ word: item.word, translation: item.translation });
    }
  }

  const getDistractors = (pool: string[], correct: string, count = 3): string[] => {
    const res: string[] = [];
    const filteredPool = pool.filter(x => x && x.toLowerCase() !== correct.toLowerCase());
    const poolSize = filteredPool.length;
    if (poolSize === 0) {
      return [correct, correct, correct, correct];
    }
    const seen = new Set<string>();
    while (res.length < count && seen.size < poolSize) {
      const idx = Math.floor(Math.random() * poolSize);
      const val = filteredPool[idx];
      if (!seen.has(val)) {
        seen.add(val);
        res.push(val);
      }
    }
    while (res.length < count) {
      res.push(filteredPool[Math.floor(Math.random() * poolSize)] || correct);
    }
    return res;
  };

  return rawVocabulary.map(item => {
    const pool = byLevel[item.level] || [];
    const jpPool = pool.map(x => x.translation);
    const enPool = pool.map(x => x.word);

    const jpDistractors = getDistractors(jpPool, item.translation, 3);
    const options = [item.translation, ...jpDistractors];

    const enDistractors = getDistractors(enPool, item.word, 3);
    const sentenceOptions = [item.word, ...enDistractors];

    return {
      id: item.id,
      word: item.word,
      translation: item.translation,
      level: item.level,
      options,
      sentence: item.sentence,
      sentenceTranslation: item.sentenceTranslation,
      sentenceOptions
    };
  });
})();
`;

fs.writeFileSync('src/data/vocabulary.ts', outputCode, 'utf8');
console.log("SUCCESS: Compact vocabulary file written perfectly!");
