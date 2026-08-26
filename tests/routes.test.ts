import { describe, it, expect } from "vitest";
import { routeToPath, pathToRoute, resolveOnEntry, isTransient, Screen } from "../src/routes";

/**
 * 画面とURLの対応。
 *
 * これまで全画面が `/` だったため、ホーム画面に追加して使うと
 * 端末の戻るボタンでアプリごと閉じていた（実測：文法ガイドで戻ると
 * アプリの外へ出る）。再読み込みでも必ずダッシュボードに戻され、
 * 読んでいた長文や文法項目を開き直せなかった。
 *
 * ここで固定するのは「画面とパスが往復できること」と、
 * 「知らないパスでも白い画面にならないこと」。
 */

const ALL: Screen[] = [
  "dashboard", "quiz", "sentence_quiz", "listening_quiz", "spelling_quiz",
  "reverse_quiz", "review", "review_quiz", "dictionary", "grammar",
  "reading", "map_puzzle", "diary", "verb_forms", "srs_review",
  "settings", "gacha", "privacy", "terms", "about", "background"
];

describe("画面とパスの往復", () => {
  it("すべての画面が固有のパスを持つ", () => {
    const paths = ALL.map(s => routeToPath({ screen: s }));
    expect(new Set(paths).size).toBe(ALL.length);
  });

  it("パスから元の画面に戻せる", () => {
    for (const screen of ALL) {
      expect(pathToRoute(routeToPath({ screen })).screen, screen).toBe(screen);
    }
  });

  it("ダッシュボードは / にする", () => {
    expect(routeToPath({ screen: "dashboard" })).toBe("/");
    expect(pathToRoute("/")).toEqual({ screen: "dashboard" });
  });
});

describe("画面の中で開いているもの", () => {
  it("文法項目をパスに持てる", () => {
    const path = routeToPath({ screen: "grammar", param: "g_present_perfect" });
    expect(path).toBe("/grammar/g_present_perfect");
    expect(pathToRoute(path)).toEqual({ screen: "grammar", param: "g_present_perfect" });
  });

  it("長文をパスに持てる", () => {
    const path = routeToPath({ screen: "reading", param: "p1" });
    expect(pathToRoute(path)).toEqual({ screen: "reading", param: "p1" });
  });

  it("持てない画面では無視する", () => {
    expect(routeToPath({ screen: "dictionary", param: "beautiful" })).toBe("/dictionary");
  });

  it("記号を含むIDでも往復できる", () => {
    const path = routeToPath({ screen: "reading", param: "aip_あ い/う" });
    expect(pathToRoute(path).screen).toBe("reading");
  });

  it("さらに深い階層は受け付けない", () => {
    // /grammar/a/b のような形。項目が見つからず白い画面になるより、
    // 一覧を出したほうがよい
    expect(pathToRoute("/grammar/a/b")).toEqual({ screen: "grammar" });
  });
});

describe("紛らわしいパス", () => {
  it("長いパスを先に判定する", () => {
    // /review/quiz が /review に吸われてはいけない
    expect(pathToRoute("/review/quiz").screen).toBe("review_quiz");
    expect(pathToRoute("/review/today").screen).toBe("srs_review");
    expect(pathToRoute("/review").screen).toBe("review");
  });

  it("末尾のスラッシュを気にしない", () => {
    expect(pathToRoute("/grammar/").screen).toBe("grammar");
    expect(pathToRoute("/dictionary//").screen).toBe("dictionary");
  });

  it("クエリとフラグメントを落とす", () => {
    expect(pathToRoute("/grammar?from=mail").screen).toBe("grammar");
    expect(pathToRoute("/dictionary#top").screen).toBe("dictionary");
  });

  it("知らないパスはダッシュボードにする", () => {
    // 古いブックマークや打ち間違いで真っ白にしない
    for (const p of ["/nope", "/quiz", "/grammarx", "", "///"]) {
      expect(pathToRoute(p).screen, p).toBe("dashboard");
    }
  });
});

describe("一時的な画面", () => {
  it("クイズと復習セッションは一時的とみなす", () => {
    for (const s of ["quiz", "sentence_quiz", "listening_quiz", "spelling_quiz",
      "reverse_quiz", "review_quiz", "srs_review"] as Screen[]) {
      expect(isTransient(s), s).toBe(true);
    }
  });

  it("読む画面は一時的ではない", () => {
    for (const s of ["dashboard", "dictionary", "grammar", "reading",
      "verb_forms", "settings"] as Screen[]) {
      expect(isTransient(s), s).toBe(false);
    }
  });

  it("読み込み時に一時的な画面へは入らない", () => {
    // 出題内容は毎回作り直すので、URLからは復元できない。
    // 復元しようとすると0問のクイズが開いてしまう
    expect(resolveOnEntry({ screen: "quiz" })).toEqual({ screen: "dashboard" });
    expect(resolveOnEntry({ screen: "review_quiz" })).toEqual({ screen: "dashboard" });
  });

  it("読む画面はそのまま復元する", () => {
    expect(resolveOnEntry({ screen: "grammar", param: "g_past" }))
      .toEqual({ screen: "grammar", param: "g_past" });
  });
});
