import { PassageQuestion } from "./data/passages";
import { shuffle } from "./shuffle";

/**
 * 長文読解の設問の選択肢を並べ替える。
 *
 * passages.ts の設問は正解を options[0] に置いた形で書かれているため、
 * この並べ替えが無いと「常に1番目を選ぶ」だけで全問正解できてしまう。
 * 並べ替え後の正解位置を追い直すのがこの関数の役割。
 */
export function shuffleQuestion(q: PassageQuestion): PassageQuestion {
  const correctText = q.options[q.correctIndex];
  const options = shuffle(q.options);
  return { question: q.question, options, correctIndex: options.indexOf(correctText) };
}
