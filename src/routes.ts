/**
 * 画面とURLの対応。
 *
 * これまでどの画面も `/` のままだったため、
 *   - ホーム画面に追加して使うと（display: standalone）、端末の戻るボタンで
 *     前の画面に戻らず、アプリごと閉じてしまう
 *   - 再読み込みすると必ずダッシュボードに戻され、読んでいた長文や
 *     文法項目を開き直せない
 *   - 「この文法の説明」を人に送れない
 * という状態だった。
 *
 * 画面を2種類に分ける。
 *   持ち回りの画面（ダッシュボード・辞書・文法・長文など）
 *     … URLを持ち、再読み込みでもその画面に戻る
 *   一時的な画面（クイズ・復習セッション）
 *     … 出題内容は毎回作り直すので、URLから復元しない。
 *       ただし履歴には積むので、戻るとダッシュボードに帰る
 *       （アプリが閉じてしまうことはない）
 */

export type Screen =
  | "dashboard" | "quiz" | "sentence_quiz" | "listening_quiz" | "spelling_quiz"
  | "reverse_quiz" | "review" | "review_quiz" | "dictionary" | "grammar"
  | "reading" | "map_puzzle" | "diary" | "verb_forms" | "srs_review"
  | "settings" | "gacha" | "privacy" | "terms";

export interface Route {
  screen: Screen;
  /** 文法項目のID・長文のIDなど、その画面の中で開いているもの */
  param?: string;
}

/** 画面 → パスの先頭部分 */
const PATHS: Record<Screen, string> = {
  dashboard: "/",
  quiz: "/quiz/word",
  sentence_quiz: "/quiz/sentence",
  listening_quiz: "/quiz/listening",
  spelling_quiz: "/quiz/spelling",
  reverse_quiz: "/quiz/reverse",
  review: "/review",
  review_quiz: "/review/quiz",
  srs_review: "/review/today",
  dictionary: "/dictionary",
  grammar: "/grammar",
  reading: "/reading",
  map_puzzle: "/map",
  diary: "/diary",
  verb_forms: "/verb-forms",
  settings: "/settings",
  gacha: "/gacha",
  privacy: "/privacy",
  terms: "/terms"
};

/**
 * 出題内容を毎回作り直す画面。
 * URLから直接復元すると「どのレベルの何を出すか」が決まらないので、
 * 読み込み時と履歴移動のときはダッシュボードとして扱う。
 */
const TRANSIENT: Screen[] = [
  "quiz", "sentence_quiz", "listening_quiz", "spelling_quiz", "reverse_quiz",
  "review_quiz", "srs_review"
];

export function isTransient(screen: Screen): boolean {
  return TRANSIENT.includes(screen);
}

/** 画面の中で開いているものをURLに持てる画面 */
const WITH_PARAM: Screen[] = ["grammar", "reading"];

export function routeToPath(route: Route): string {
  const base = PATHS[route.screen] ?? "/";
  if (route.param && WITH_PARAM.includes(route.screen)) {
    return `${base}/${encodeURIComponent(route.param)}`;
  }
  return base;
}

/**
 * パス → 画面。知らないパスはダッシュボードにする
 * （古いブックマークや打ち間違いで真っ白にしないため）。
 */
export function pathToRoute(pathname: string): Route {
  const clean = "/" + String(pathname || "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean)
    .join("/");

  if (clean === "/") return { screen: "dashboard" };

  // 長いパスから先に見る（/review/quiz を /review より先に判定する）
  const entries = (Object.entries(PATHS) as [Screen, string][])
    .filter(([, p]) => p !== "/")
    .sort((a, b) => b[1].length - a[1].length);

  for (const [screen, path] of entries) {
    if (clean === path) return { screen };
    if (WITH_PARAM.includes(screen) && clean.startsWith(path + "/")) {
      const param = decodeURIComponent(clean.slice(path.length + 1));
      // さらに深い階層は受け付けない（/grammar/a/b のような形）
      if (param && !param.includes("/")) return { screen, param };
      return { screen };
    }
  }
  return { screen: "dashboard" };
}

/**
 * 読み込み時・履歴移動のときに実際に表示する画面へ直す。
 * 一時的な画面はダッシュボードに読み替える。
 */
export function resolveOnEntry(route: Route): Route {
  return isTransient(route.screen) ? { screen: "dashboard" } : route;
}
