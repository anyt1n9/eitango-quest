import * as fs from 'fs';
import * as path from 'path';

const vocabPath = path.join(process.cwd(), 'src/data/vocabulary.ts');
const fileContent = fs.readFileSync(vocabPath, 'utf8');

const match = fileContent.match(/const rawVocabulary:\s*any\[\]\s*=\s*(\[[\s\S]*?\]);/);
if (!match) {
  console.log("Could not find rawVocabulary array");
  process.exit(1);
}

const rawVocab = JSON.parse(match[1]);
const juniorWords = rawVocab.filter((item: any) => item.level === 'junior').map((item: any) => item.word.toLowerCase());
console.log(JSON.stringify(juniorWords));
