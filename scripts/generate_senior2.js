import fs from 'fs';
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("FATAL ERROR: GEMINI_API_KEY environment variable is not defined!");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// 1. Parse raw_words.txt
const rawText = fs.readFileSync('scripts/raw_words.txt', 'utf8');
const lines = rawText.split(/\r?\n/);

const allWords = [];
let currentItem = null;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  
  const match = line.match(/^(\d+)\|/);
  if (match) {
    if (currentItem) {
      allWords.push(currentItem);
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
  allWords.push(currentItem);
}

console.log(`Successfully parsed ${allWords.length} words from raw source.`);

// 2. Load progress if exists
let progressData = [];
const progressFile = 'scripts/senior2_progress.json';
if (fs.existsSync(progressFile)) {
  try {
    progressData = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
    console.log(`Loaded ${progressData.length} already-generated items from progress cache.`);
  } catch (err) {
    console.error("Failed to parse progress file, starting fresh:", err);
  }
}

const generatedIds = new Set(progressData.map(w => w.id));

// 3. Batch process missing words
const BATCH_SIZE = 20;

async function generateBatch(wordsBatch) {
  const prompt = `We are designing a learning app for Japanese high-school sophomore students (高校2年生, Level: senior2).
For each of the given English words with its provided Japanese translation, generate a high-quality, professional quiz question object.
You must return a list of exactly ${wordsBatch.length} objects matching the requested schema.

Words to generate:
${JSON.stringify(wordsBatch.map(w => ({ id: `s2_${w.index}`, word: w.word, translation: w.translation }))) }

Detailed guidelines for each property:
- id: Keep as provided (e.g. "s2_1", "s2_2", ...).
- word: Keep as provided.
- translation: Keep as provided (use exactly the text given).
- level: Must be "senior2"
- options: Array of 4 Japanese translations. The first option MUST be the correct translation (matching the translation property). The other 3 must be plausible Japanese translations for sophomore high-schoolers that could serve as distractors. The options will be randomized in the frontend, so keep the first one as correct.
- sentence: A simple, natural, context-rich high-school level English sentence using the word. Replace the word exactly with "[_____]" (5 underscores inside square brackets, e.g. "She gave a highly [_____] design...").
- sentenceTranslation: The natural Japanese translation of that English sentence.
- sentenceOptions: Array of 4 English words/phrases. The first option MUST be the exact target word. The other 3 must be realistic English distractors (same part of speech, similar-looking, or related topic) suitable for sophomore high school level.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            word: { type: Type.STRING },
            translation: { type: Type.STRING },
            level: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            sentence: { type: Type.STRING },
            sentenceTranslation: { type: Type.STRING },
            sentenceOptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["id", "word", "translation", "level", "options", "sentence", "sentenceTranslation", "sentenceOptions"]
        }
      }
    }
  });

  return JSON.parse(response.text);
}

async function main() {
  const remainingWords = allWords.filter(w => !generatedIds.has(`s2_${w.index}`));
  
  if (remainingWords.length === 0) {
    console.log("All words have already been generated!");
    return;
  }

  console.log(`Starting generation for remaining ${remainingWords.length} words...`);

  for (let i = 0; i < remainingWords.length; i += BATCH_SIZE) {
    const chunk = remainingWords.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(remainingWords.length / BATCH_SIZE)} (Items s2_${chunk[0].index} to s2_${chunk[chunk.length - 1].index})...`);
    
    let retries = 3;
    let success = false;
    while (retries > 0 && !success) {
      try {
        const batchResults = await generateBatch(chunk);
        
        // Validate batch results have the correct length
        if (!Array.isArray(batchResults) || batchResults.length === 0) {
          throw new Error("Invalid output received from Gemini API");
        }
        
        // Add to progress
        progressData.push(...batchResults);
        
        // Sort progress by index to maintain structure:
        progressData.sort((a, b) => {
          const idxA = parseInt(a.id.split('_')[1]);
          const idxB = parseInt(b.id.split('_')[1]);
          return idxA - idxB;
        });

        // Write progress file
        fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2), 'utf8');
        console.log(`Saved batch. Cache now contains ${progressData.length} items.`);
        
        success = true;
      } catch (err) {
        retries--;
        console.error(`Error during batch generation (${retries} retries left):`, err.message || err);
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    if (!success) {
      console.error("Failed to complete batch after all retries. Exiting main loop to prevent infinite crash. Run again to resume.");
      process.exit(1);
    }
  }

  console.log("SUCCESS! Generated quiz objects for all 669 senior2 words.");
}

main().catch(console.error);
