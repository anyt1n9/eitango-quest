import { Word } from "./types";

/**
 * 単語データの遅延読み込み。
 *
 * `src/data/vocabulary.ts` は3.1MB あり、これを静的に import していたため
 * 初期チャンクが 2.8MB（gzip で約1,093KB）になっていた。
 * 語義・語法・文法は必要になってから読むようにしてあるのに、
 * いちばん大きい語彙だけが起動時に読み込まれ、解析が終わるまで
 * 画面に何も出ない状態が続いていた。
 *
 * ここを動的 import に変えると、単語データは別のチャンクになり、
 * アプリの外枠は待たずに描ける。単語データはアプリの改修では変わらないので、
 * 二度目以降はブラウザのキャッシュがそのまま効く。
 *
 * 収録データそのものは `src/data/vocabulary.ts` に置いたままにする。
 * scripts/ の生成スクリプトとデータのテストがこのファイルを直接読むため。
 */

let cache: Word[] | null = null;
let loading: Promise<Word[]> | null = null;

export function loadVocabulary(): Promise<Word[]> {
  if (cache) return Promise.resolve(cache);
  // 同時に呼ばれても読み込みは1回にする
  if (!loading) {
    // 失敗したら控えを捨てる。捨てないと、一度きりの通信の失敗や
    // サービスワーカー更新後のチャンク不整合で reject した約束が残り続け、
    // 読み直しても同じ失敗を返すだけになる（＝待機画面から出られない）
    loading = import("./data/vocabulary").then(m => {
      cache = m.initialVocabulary;
      return cache;
    }).catch(err => {
      loading = null;
      throw err;
    });
  }
  return loading;
}

/** 読み込み済みなら同期で返す（テストの後片付け用） */
export function loadedVocabulary(): Word[] | null {
  return cache;
}
