import { test, expect, Page } from "@playwright/test";

/**
 * 主要な画面をひととおり操作する。
 *
 * 画面をまたいだときにだけ壊れるもの（状態の持ち越し、遷移、遅延読み込み）を
 * 対象にする。1画面の中の細かい描画は tests/*.render.test.tsx が見ている。
 */

/** 学習の記録を仕込む。習得済み・苦手単語・期日超過の復習 */
async function seedProgress(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const solved: Record<string, unknown> = {};
    const srs: Record<string, unknown> = {};
    const wrong: string[] = [];
    for (let i = 1; i <= 250; i++) {
      solved["j" + i] = { correctCount: 3, attemptCount: 3 };
      srs["j" + i] = { box: 3, dueDate: "2020-01-01", lastReview: "2020-01-01", reps: 3, lapses: 0 };
    }
    for (let i = 251; i <= 280; i++) wrong.push("j" + i);
    localStorage.setItem("quest_solved_history", JSON.stringify(solved));
    localStorage.setItem("quest_srs", JSON.stringify(srs));
    localStorage.setItem("quest_wrong_words", JSON.stringify(wrong));
  });
  await page.reload();
  await waitForVocabulary(page);
}

/** ヘッダーのハンバーガーメニューを開く */
async function openNavMenu(page: Page) {
  await page.locator("#btn_nav_menu").click();
  await expect(page.locator("#nav_menu_panel")).toBeVisible();
}

/** 単語データは遅延読み込みなので、ダッシュボードが出るまで待つ */
async function waitForVocabulary(page: Page) {
  await expect(page.locator("#vocabulary_loading_screen")).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator("#btn_junior_reverse")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
});

test("単語データを読み込んでダッシュボードが出る", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
});

test("学習アドバイスが習得状況を反映する", async ({ page }) => {
  await seedProgress(page);
  await page.locator("#tab_btn_ai").click();
  await page.locator("#btn_get_advice").click();
  // APIキーの有無にかかわらず、実際の記録の数字が出る
  await expect(page.getByText(/習得済みは\d+語/)).toBeVisible();
  await expect(page.locator("#advice_source")).toBeVisible();
});

test("文法ガイドを開いて練習問題を解ける", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#tab_btn_reference").click();
  await page.locator("#btn_reference_grammar").click();

  const list = page.locator('[data-testid="grammar_topic_list"] button');
  await expect(list.first()).toBeVisible({ timeout: 30_000 });
  expect(await list.count()).toBeGreaterThanOrEqual(34);

  await page.locator("#grammar_topic_g_present_perfect").click();
  await expect(page.locator('[data-testid="grammar_sections"]')).toBeVisible();
  await expect(page.locator('[data-testid="grammar_examples"]')).toBeVisible();
  await expect(page.locator('[data-testid="grammar_questions"]')).toBeVisible();
  // その文法が出てくる長文へ辿れる
  await expect(page.locator('[data-testid="grammar_readings"] li').first()).toBeVisible();

  await page.locator("#grammar_q0_opt0").click();
  await expect(page.getByText(/正解/).first()).toBeVisible();
});

test("長文を読み、音読と文法の解説へ辿れる", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#btn_toggle_study_menu").click();
  await page.locator("#dashboard_open_reading_btn").click();

  await page.getByText("The Secret of the Old Library").first().click();
  await expect(page.locator("#passage_text_container")).toBeVisible();
  // 音読（この環境の Chromium は音声を持つ）
  await expect(page.locator("#btn_passage_read_all")).toBeVisible();
  await expect(page.locator("#btn_passage_read_0")).toBeVisible();

  // 本文に出てくる文法から解説へ跳ぶ
  const chip = page.locator('[data-testid="passage_grammar"] button').first();
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.locator("#grammar_detail")).toBeVisible({ timeout: 30_000 });
});

test("長文の重要語を苦手単語に入れられる", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#btn_toggle_study_menu").click();
  await page.locator("#dashboard_open_reading_btn").click();
  await page.getByText("The Secret of the Old Library").first().click();

  // 右の重要語リストから1語選ぶ
  await page.locator('[id="passage_text_container"]').waitFor();
  await page.getByRole("button", { name: /beautiful/ }).first().click();
  await page.locator("#btn_reading_add_wrong").click();

  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("quest_wrong_words") || "[]").length
  );
  expect(stored).toBeGreaterThan(0);
});

test("辞書で語義・語法を見て、文法の解説へ跳べる", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#tab_btn_reference").click();
  await page.locator("#btn_reference_dictionary").click();
  await page.locator('input[type="text"]').first().fill("tell");
  await page.getByText(/^tell$/).first().click();

  await expect(page.locator('[data-testid="sense_groups"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="word_usage"]')).toBeVisible();

  const link = page.locator('[data-testid="usage_grammar_links"] button').first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();
  await expect(page.locator("#grammar_detail")).toBeVisible();
});

test("苦手単語の復習を形式を選んで始められる", async ({ page }) => {
  await seedProgress(page);
  await page.getByText("復習をスタートする").first().click();
  await expect(page.locator('[data-testid="quiz_format_picker"]')).toBeVisible();
  await expect(page.locator('[data-testid="quiz_format_picker"] button')).toHaveCount(5);

  await page.locator("#review_format_spelling").click();
  await expect(page.locator('input[type="text"]').first()).toBeVisible();
});

test("今日の復習でも形式を選べる", async ({ page }) => {
  await seedProgress(page);
  await openNavMenu(page);
  await page.locator("#nav_srs_review_btn").click();
  await expect(page.locator('[data-testid="quiz_format_picker"]')).toBeVisible();
  await page.locator("#review_format_sentence").click();
  await expect(page.locator("#sentence_quiz_options_grid")).toBeVisible();
});

test("日→英クイズで答えの綴りを見せない", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#btn_junior_reverse").click();

  const heading = page.locator("#quiz_running_card h2").first();
  await expect(heading).toBeVisible();
  const text = (await heading.textContent())?.trim() || "";
  // 出題は日本語訳。英字だけの見出し（＝答えの綴り）が出ていてはいけない
  expect(text).not.toMatch(/^[a-zA-Z\s'-]+$/);
});

test("画面ごとにURLが変わり、戻るでアプリが閉じない", async ({ page }) => {
  // ホーム画面に追加して使う（standalone）ため、端末の戻るで
  // 前の画面に戻らないとアプリごと閉じてしまう
  await page.goto("/");
  await waitForVocabulary(page);

  await page.locator("#tab_btn_reference").click();
  await page.locator("#btn_reference_grammar").click();
  await expect(page).toHaveURL(/\/grammar$/);

  await page.locator("#grammar_topic_g_present_perfect").click();
  await expect(page).toHaveURL(/\/grammar\/g_present_perfect$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#btn_junior_reverse")).toBeVisible();
});

test("リンクから文法項目を直接開ける", async ({ page }) => {
  await page.goto("/grammar/g_present_perfect");
  await expect(page.locator("#grammar_detail")).toBeVisible({ timeout: 30_000 });
});

test("読んでいた長文は再読み込みしても開いたまま", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#btn_toggle_study_menu").click();
  await page.locator("#dashboard_open_reading_btn").click();
  await page.getByText("The Secret of the Old Library").first().click();
  await expect(page).toHaveURL(/\/reading\/p1$/);

  await page.reload();
  await expect(page.locator("#passage_text_container")).toBeVisible({ timeout: 30_000 });
});

test("アプリケーション説明は、利用規約と同じく1枚の画面で開く", async ({ page }) => {
  // 以前はフッターの中で開く小さなパネルだった。長い説明を読むには向かず、
  // URLを持てないので人に送ることもできなかった
  await page.goto("/");
  await waitForVocabulary(page);

  await page.locator("#btn_about_app").click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { name: /Eigorira（エイゴリラ）とは/ })).toBeVisible({ timeout: 30_000 });
  // 中身が「何がどれだけ入っているか」まで書いてある
  await expect(page.getByText(/英単語 7,730語/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /5つの出題形式/ })).toBeVisible();

  // 規約と同じ戻り方。「ダッシュボードに戻る」で帰れて、端末の戻るで開き直せる
  await page.getByRole("button", { name: "ダッシュボードに戻る" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#btn_junior_reverse")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { name: /Eigorira（エイゴリラ）とは/ })).toBeVisible();

  // 再読み込みしても説明のまま
  await page.reload();
  await expect(page.getByRole("heading", { name: /Eigorira（エイゴリラ）とは/ })).toBeVisible({ timeout: 30_000 });
});

test("アプリの名前とエイ・ゴリラのしるしはヘッダーに出る", async ({ page }) => {
  // ダッシュボードの帯にも同じ名前を出していたが、帯ごと外したので
  // ここが唯一の出どころになる。名前が消えても誰も気づけない状態にしない
  await page.goto("/");
  await waitForVocabulary(page);

  const nav = page.locator("#navigation_bar");
  await expect(nav).toContainText("Eigorira");
  // 由来のしるしは2つとも出ている（読み上げには渡さない飾り）
  const marks = page.getByTestId("brand_icons_header");
  await expect(marks.locator("svg")).toHaveCount(2);
  await expect(marks).toHaveAttribute("aria-hidden", "true");

  // 古い名前が残っていない
  await expect(page.locator("body")).not.toContainText("英単語 Quest");
});

test("ヘッダーはハンバーガーにまとめ、開くと入口が並ぶ", async ({ page }) => {
  // 以前は機能ボタンを7つ横に並べ、スマホでは2段に折り返して
  // ヘッダーだけで 150px 近くあった
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await waitForVocabulary(page);

  const nav = page.locator("#navigation_bar");
  expect((await nav.boundingBox())!.height).toBeLessThan(80);

  // 畳んでいる間は入口が出ていない
  await expect(page.locator("#nav_menu_panel")).toHaveCount(0);
  await expect(page.locator("#nav_srs_review_btn")).toHaveCount(0);

  // テーマの切り替えは開かずに押せる場所（ヘッダー）にある
  await expect(page.locator("#theme_toggle_btn")).toBeVisible();

  await openNavMenu(page);
  for (const id of ["nav_srs_review_btn", "nav_map_puzzle_toggle_btn", "nav_gacha_btn", "nav_settings_btn"]) {
    await expect(page.locator("#" + id), id).toBeVisible();
  }
  await expect(page.getByTestId("header_points")).toBeVisible();

  // Esc で閉じる
  await page.keyboard.press("Escape");
  await expect(page.locator("#nav_menu_panel")).toHaveCount(0);

  // 選ぶと閉じて、その画面へ移る
  await openNavMenu(page);
  await page.locator("#nav_gacha_btn").click();
  await expect(page).toHaveURL(/\/gacha$/);
  await expect(page.locator("#nav_menu_panel")).toHaveCount(0);
});

test("合計スコアと連続日数は、どの画面でもヘッダーに出る", async ({ page }) => {
  // ダッシュボードの帯に置いていたので、他の画面へ移ると見えなくなり、
  // 同じ画面を下へスクロールしても見えなくなっていた
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("quest_stats", JSON.stringify({
      score: 3550, currentStreak: 4, lastLoginDate: null,
      completedQuestions: 0, correctAnswers: 0
    }));
  });
  await page.reload();
  await waitForVocabulary(page);

  const stats = page.getByTestId("header_stats");
  await expect(stats).toContainText("3550");
  await expect(stats).toContainText("4日");
  // 同じ数字がダッシュボードの本文にも並んでいない
  await expect(page.locator("#main_payload")).not.toContainText("3550");

  // 別の画面でも見えたまま
  await page.goto("/dictionary");
  await expect(page.getByTestId("header_stats")).toContainText("3550");
});

test("背景の飾りは出るが、出題中は出さない", async ({ page }) => {
  // 視界のすみで何かが動くと、単語より先にそちらへ目が行く。
  // 飾りは押す操作も奪わない（pointer-events: none）
  await page.goto("/");
  await waitForVocabulary(page);
  const scene = page.locator('[data-testid="background_scene"]');
  await expect(scene).toHaveCount(1);
  expect(await scene.evaluate(e => getComputedStyle(e).pointerEvents)).toBe("none");

  await page.locator("#btn_junior_word").click();
  await expect(page.locator("#quiz_options_container")).toBeVisible();
  await expect(scene, "出題中に背景が出ている").toHaveCount(0);

  // 戻れば また出る
  await page.locator("#btn_quit_quiz").click();
  await expect(page.locator('[data-testid="background_scene"]')).toHaveCount(1);
});

test("背景の画像はメニューから選べ、消せば もとの飾りに戻る", async ({ page }) => {
  // 画像は端末の中だけに置く（どこにも送らない）。
  // 選ぶところはファイル選択なので、ここでは保存済みの状態から見る
  const photo = "data:image/svg+xml;base64," + Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#c026d3"/></svg>'
  ).toString("base64");

  await page.goto("/");
  await waitForVocabulary(page);
  await openNavMenu(page);
  await page.locator("#nav_background_btn").click();
  await expect(page.locator("#background_settings_screen")).toBeVisible();
  await expect(page).toHaveURL(/\/background$/);

  // 画像を入れた状態にして、背景が画像に替わることを見る
  await page.evaluate(url => localStorage.setItem("quest_bg_image", url), photo);
  await page.goto("/");
  await waitForVocabulary(page);
  const scene = page.locator('[data-testid="background_scene"]');
  await expect(scene).toHaveAttribute("data-kind", "image");
  // 写真の上には幕をかける。
  // コントラストの実測（LOW_CONTRAST）は背景が画像の要素を測れない
  // （何色の上にあるか決まらないため飛ばす）ので、幕の濃さを直接見る
  const veil = await page.evaluate(() => {
    const el = document.querySelector(".bg-photo-veil");
    if (!el) return null;
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const parts = m[1].split(",").map(v => Number(v.trim()));
    return parts.length > 3 ? parts[3] : 1;
  });
  expect(veil, "写真の上の幕が無い・薄すぎる").toBeGreaterThanOrEqual(0.6);
  // カードの中の文字は、これまでどおり読める
  expect(await page.evaluate(LOW_CONTRAST), "画像の背景で文字が読めない").toEqual([]);

  // 消せば もとの飾りに戻る
  await openNavMenu(page);
  await page.locator("#nav_background_btn").click();
  await page.locator("#btn_clear_background").click();
  await expect(page.locator('[data-testid="background_scene"]')).toHaveAttribute("data-kind", "scene");
  expect(await page.evaluate(() => localStorage.getItem("quest_bg_image"))).toBeNull();
});

test("知らないパスでも白い画面にならない", async ({ page }) => {
  await page.goto("/no-such-page");
  await expect(page.locator("#btn_junior_reverse")).toBeVisible({ timeout: 30_000 });
});

test("5つの形式がどれも同じ手順で始まる", async ({ page }) => {
  // 一問一答だけ問題数のモーダルを挟んでいた
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#btn_question_count_50").click();
  await page.locator("#btn_junior_word").click();
  await expect(page.locator("#quiz_options_container")).toBeVisible();
  await expect(page.getByText("Q: 1 / 50")).toBeVisible();
});

test("ヘッダーのポイントは、ガチャで使える額と一致する", async ({ page }) => {
  // stats.score は「これまでに稼いだ合計」で、ガチャを引いても減らない。
  // ヘッダーがその合計を「P」として出していたため、ガチャ画面には
  // 「3,000 P」（ヘッダー）と「使えるポイント: 2,550P」が同時に並んでいた。
  // 使い切りかけている人には、3,000P と表示されたまま「足りません」と断られる。
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("quest_stats", JSON.stringify({
      score: 3000, currentStreak: 0, lastLoginDate: null,
      completedQuestions: 0, correctAnswers: 0
    }));
    localStorage.setItem("quest_gacha_spent", "450");
  });
  await page.reload();
  await waitForVocabulary(page);

  await openNavMenu(page);
  const header = page.getByTestId("header_points");
  await expect(header).toContainText("2550");
  await expect(header).not.toContainText("3000");

  // ガチャ画面の「使えるポイント」と同じ数字であること
  await page.locator("#nav_gacha_btn").click();
  await expect(page.locator("#gacha_shop_root")).toContainText("使えるポイント: 2550P");
  await openNavMenu(page);
  await expect(page.getByTestId("header_points")).toContainText("2550");

  // 稼いだ合計は消さない。ヘッダーの合計スコアが受け持つ
  await page.goto("/");
  await waitForVocabulary(page);
  await expect(page.getByTestId("header_stats")).toContainText("3000");
});

test("どの幅でも、見出しとその選択肢が同じ行に並ぶ", async ({ page }) => {
  // 「レベル」と「1回の問題数」を1つの flex に平らに並べていたため、
  // 幅によっては「1回の問題数」だけがレベルの行の末尾に残り、
  // 選択肢（10問・50問・100問）が次の行に落ちていた。
  // 折り返しの位置は実際に並べてみないと分からないので、ここで測る。
  for (const width of [360, 390, 500, 640, 768, 900, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await waitForVocabulary(page);

    const rows = await page.evaluate(() => {
      // 行の判定は中心の高さで見る。見出しの文字とボタンでは高さが違い、
      // 同じ行に並んでいても上端は揃わない（items-center で中心が揃う）
      const line = (el: Element) => {
        const r = el.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      };
      const group = (testId: string) => {
        const root = document.querySelector(`[data-testid="${testId}"]`)!;
        return {
          label: line(root.querySelector("span")!),
          buttons: [...root.querySelectorAll("button")].map(line)
        };
      };
      return { level: group("level_picker"), count: group("count_picker") };
    });

    // 見出しが「相手側の」ボタンと同じ行に混ざっていない。
    // 選択肢が3つとも次の行に落ちる幅（360px など）では、見出しだけが
    // レベルの行の末尾に取り残されて、何の見出しなのか分からなくなっていた
    expect(rows.level.buttons, `${width}px: 「1回の問題数」がレベルの行に混ざっている`)
      .not.toContain(rows.count.label);
    expect(rows.count.buttons, `${width}px: 「レベル」が問題数の行に混ざっている`)
      .not.toContain(rows.level.label);

    // 見出しは自分の選択肢の行か、その1行上にある（離れていない）
    expect(rows.count.label, `${width}px: 「1回の問題数」が選択肢から離れている`)
      .toBeLessThanOrEqual(Math.min(...rows.count.buttons));
    expect(rows.level.label, `${width}px: 「レベル」が選択肢から離れている`)
      .toBeLessThanOrEqual(Math.min(...rows.level.buttons));
  }
});

test("狭い画面でも横にはみ出さない", async ({ page }) => {
  // タップ領域を広げたときに whitespace-nowrap を付けて、
  // 360〜390px で3〜18px はみ出していた（測り直していなかった）。
  // 横スクロールが出ると、読むたびに指で戻すことになる
  for (const width of [360, 375, 390, 414]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await waitForVocabulary(page);
    const size = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth
    }));
    expect(size.doc, `${width}px`).toBeLessThanOrEqual(size.win + 1);
  }
});

test("「調べる」タブから辞書・活用表・文法ガイドへ移れる", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#tab_btn_reference").click();

  const panel = page.getByTestId("reference_tab");
  await expect(panel).toBeVisible();
  for (const label of ["単語一覧辞書", "動詞の活用表", "文法ガイド"]) {
    await expect(panel.getByText(label, { exact: true })).toBeVisible();
  }

  await page.locator("#btn_reference_verb_forms").click();
  await expect(page).toHaveURL(/\/verb-forms$/);
  await expect(page.locator("#verb_forms_screen")).toBeVisible();
});

/** 文字と背景の明暗差（WCAG のコントラスト比）。半透明の背景は下の色と重ねてから測る */
const CONTRAST = (selector: string) => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d")!;
  const toRGBA = (c: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (fg: number[], bg: number[]) =>
    [0, 1, 2].map(i => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3])));
  const stack = (e: Element) => {
    const layers: number[][] = [];
    let x: Element | null = e;
    while (x) {
      const v = toRGBA(getComputedStyle(x).backgroundColor);
      if (v[3] > 0) layers.push(v);
      x = x.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], [...base, 1]);
    return base;
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  // 測る相手は呼び出し側が指定する。
  // 以前は「英字だけで 18px 以上の span のうち最初のもの」を拾っていたが、
  // これはページ上に他の英字の見出しが無いことに頼っていた。
  // アプリ名を Eigorira にした途端、ヘッダーのロゴ（グラデーション文字なので
  // color は透明）を拾って 1.18 で落ちた。
  const el = document.querySelector(selector);
  if (!el) return null;
  const fg = toRGBA(getComputedStyle(el).color);
  const bg = stack(el);
  const l1 = lum([fg[0], fg[1], fg[2]]), l2 = lum(bg);
  return {
    text: (el.textContent || "").trim(),
    ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  };
};

test("不正解のときの正しい綴りが、明暗どちらのテーマでも読める", async ({ page }) => {
  // 暗いテーマでは色の変数そのものが置き換わる（--color-white は紺になる）。
  // そのため誤答カードは明るい背景のまま、中の文字だけ明るくなり、
  // 「正しい綴り」が明るい背景に明るい文字で載って読めなくなっていた（実測 1.05）
  for (const theme of ["light", "dark"]) {
    await page.goto("/");
    await page.evaluate(t => localStorage.setItem("quest_theme", t), theme);
    await page.reload();
    await waitForVocabulary(page);

    await page.locator("#btn_junior_spelling").click();
    const input = page.locator('input[type="text"]').first();
    await input.fill("zzzzz");
    await input.press("Enter");
    await expect(page.getByText("おしい！正しい綴りはこちら")).toBeVisible();

    const measured = await page.evaluate(CONTRAST, "#spelling_correct_answer");
    expect(measured, theme).not.toBeNull();
    // 大きな文字の基準は 3.0。ここは答えそのものなので余裕を持って確かめる
    expect(measured!.ratio, `${theme} / ${measured!.text}`).toBeGreaterThanOrEqual(4.5);
  }
});

/**
 * 画面に出ている文字を全部たどって、基準（WCAG AA）に届かないものを挙げる。
 *
 * 1か所ずつ測っていると、直した色の隣で新しく壊れたものに気づけない。
 * 実際、暗いテーマ用に文字を明るくしたとき、対になる背景を明るいまま
 * 残してしまい、明るい地に明るい文字という逆向きの不具合を作っている。
 *
 * - 半透明の背景は親までさかのぼって重ねてから測る
 * - グラデーションの上は1色に決まらないので測らない
 * - aria-hidden の飾り（区切りの「|」など）は読ませる文字ではないので外す
 */
const LOW_CONTRAST = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d")!;
  const toRGBA = (c: string) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const over = (fg: number[], bg: number[]) =>
    [0, 1, 2].map(i => Math.round(fg[i] * fg[3] + bg[i] * (1 - fg[3])));
  const skip = (e: Element) => {
    for (let x: Element | null = e; x; x = x.parentElement) {
      if (x.getAttribute("aria-hidden") === "true") return true;
    }
    // グラデーションの上は1色に決まらないので測らない。
    // ただし「グラデーションのカードの上に置いた、自前の背景を持つボタン」は
    // 色が決まるので測る。ここを「先祖にグラデーションがあれば除外」と
    // 書いていたため、バナーの白いボタンが検査から漏れ、
    // 暗いテーマで紺地に紺の文字（実測 1.2）になっていたのを見逃した
    for (let x: Element | null = e; x; x = x.parentElement) {
      const s = getComputedStyle(x);
      if (s.backgroundImage !== "none") return true;
      // 不透明な背景に行き当たったら、そこで色は決まる
      if (toRGBA(s.backgroundColor)[3] >= 1) return false;
    }
    return false;
  };
  const stack = (e: Element) => {
    const layers: number[][] = [];
    let x: Element | null = e;
    while (x) {
      const v = toRGBA(getComputedStyle(x).backgroundColor);
      if (v[3] > 0) layers.push(v);
      x = x.parentElement;
    }
    let base = [255, 255, 255];
    for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], [...base, 1]);
    return base;
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const bad: string[] = [];
  for (const e of document.querySelectorAll("*")) {
    if (e.children.length) continue;
    const t = (e.textContent || "").trim();
    if (!t) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 6) continue;
    const s = getComputedStyle(e);
    if (s.visibility === "hidden" || s.opacity === "0" || skip(e)) continue;
    const fg = toRGBA(s.color);
    if (fg[3] === 0) continue;
    const size = parseFloat(s.fontSize), weight = Number(s.fontWeight) || 400;
    // 大きな文字（24px以上、または太字18.66px以上）だけ基準がゆるい
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const l1 = lum([fg[0], fg[1], fg[2]]), l2 = lum(stack(e));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio >= need) continue;
    bad.push(`${ratio.toFixed(2)}（要 ${need}） ${size}px「${t.slice(0, 20)}」`);
  }
  return [...new Set(bad)];
};

test("どの画面も、明暗どちらのテーマでも文字が読める", async ({ page }) => {
  test.slow();
  for (const theme of ["light", "dark"]) {
    await page.goto("/");
    await page.evaluate(t => localStorage.setItem("quest_theme", t), theme);

    for (const [name, path, anchor] of [
      ["ダッシュボード", "/", "#btn_junior_reverse"],
      ["辞書", "/dictionary", "#dictionary_words_container"],
      ["文法ガイド", "/grammar", "#grammar_screen"],
      ["長文一覧", "/reading", "#passages_grid_container"],
      ["活用表", "/verb-forms", "#verb_forms_screen"]
    ]) {
      await page.goto(path);
      await expect(page.locator("#vocabulary_loading_screen")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.locator(anchor)).toBeVisible();
      expect(await page.evaluate(LOW_CONTRAST), `${theme} / ${name}`).toEqual([]);
    }

    // AIアドバイスと弱点分析の欄。紫と赤で塗られていた場所なので、
    // テーマの色に替えたあとも読めることを見る
    await page.goto("/");
    await waitForVocabulary(page);
    await page.locator("#tab_btn_ai").click();
    await expect(page.locator("#ai_advisor_section")).toBeVisible();
    expect(await page.evaluate(LOW_CONTRAST), `${theme} / AIアドバイス`).toEqual([]);

    // ログインボーナスの欄（スタンプ・受け取りの案内・学習カレンダー）。
    // ダッシュボードは最初のタブしか出ていないので、開いてから測る
    await page.goto("/");
    await waitForVocabulary(page);
    await page.locator("#tab_btn_bonus").click();
    await expect(page.locator("#bonus_section")).toBeVisible();
    expect(await page.evaluate(LOW_CONTRAST), `${theme} / ログインボーナス`).toEqual([]);

    // 出題中と、答え合わせの直後
    await page.goto("/");
    await waitForVocabulary(page);
    await page.locator("#btn_junior_word").click();
    await expect(page.locator("#quiz_options_container")).toBeVisible();
    expect(await page.evaluate(LOW_CONTRAST), `${theme} / 出題中`).toEqual([]);
    await page.locator("#quiz_options_container button").last().click();
    await page.waitForTimeout(500);
    expect(await page.evaluate(LOW_CONTRAST), `${theme} / 答え合わせ`).toEqual([]);
  }
});

test("キーボードで移動した先が分かる", async ({ page }) => {
  // ブラウザ既定の outline は auto 1px のほぼ黒で、暗いテーマでは見えない
  for (const theme of ["light", "dark"]) {
    await page.goto("/");
    await page.evaluate(t => localStorage.setItem("quest_theme", t), theme);
    await page.reload();
    await waitForVocabulary(page);

    await page.keyboard.press("Tab");
    const ring = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return { tag: el.tagName, width: parseFloat(s.outlineWidth), style: s.outlineStyle };
    });
    expect(ring, theme).not.toBeNull();
    expect(ring!.style, theme).not.toBe("none");
    expect(ring!.width, theme).toBeGreaterThanOrEqual(2);
  }
});

test("解答の正誤が読み上げにも伝わる", async ({ page }) => {
  // 〇×は絵で見せているだけなので、読み上げには言葉が要る
  await page.goto("/");
  await waitForVocabulary(page);
  await page.locator("#btn_junior_word").click();
  await expect(page.locator("#quiz_options_container")).toBeVisible();
  await page.locator("#quiz_options_container button").first().click();

  const status = page.locator('[role="status"]').first();
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toContainText(/正解|不正解/);
});

test("長文はキーボードだけで開ける", async ({ page }) => {
  // 一覧のカードは div なので、Tab では素通りしていた
  await page.goto("/reading");
  await expect(page.locator("#vocabulary_loading_screen")).toHaveCount(0, { timeout: 30_000 });
  const open = page.locator("#passages_grid_container button").first();
  await open.focus();
  await open.press("Enter");
  await expect(page.locator("#passage_detail_screen")).toBeVisible();
});

test("起動時に、まだ開いていない画面の JS を読み込まない", async ({ page }) => {
  // すべての画面を静的に import していたため、最初の JS が 862KB あった。
  // 開いた画面だけを読み込むようにして 496KB に減らしている（src/App.tsx）。
  // 分割は「どのチャンクを取りに行ったか」で確かめる。大きさで見ると
  // 誤差で落ちるし、静的 import に戻したことにも気づけない
  const loaded: string[] = [];
  page.on("response", res => {
    const url = res.url();
    if (url.endsWith(".js")) loaded.push(url.split("/").pop()!);
  });

  await page.goto("/");
  await waitForVocabulary(page);

  const deferred = ["Dictionary", "Reading", "Grammar", "AIDiary", "MapAndPuzzle", "passages"];
  for (const name of deferred) {
    expect(loaded.filter(f => f.startsWith(name)), `${name} を起動時に読み込んでいる`).toEqual([]);
  }

  // 開いたときに初めて取りに行く
  await page.locator("#tab_btn_reference").click();
  await page.locator("#btn_reference_dictionary").click();
  await expect(page.locator("#dictionary_words_container")).toBeVisible();
  expect(loaded.some(f => f.startsWith("Dictionary")), "辞書を開いても読み込まれない").toBe(true);
});

test("起動時に読み込む JS が大きくなりすぎていない", async ({ page }) => {
  // 単語データ（vocabulary）は別枠で遅れて読み込むので、ここでは数えない
  let bytes = 0;
  page.on("response", async res => {
    const name = res.url().split("/").pop() || "";
    if (!name.endsWith(".js") || name.startsWith("vocabulary")) return;
    const body = await res.body().catch(() => null);
    if (body) bytes += body.length;
  });

  await page.goto("/");
  await waitForVocabulary(page);

  // 実測 496KB。戻り始めたら気づけるよう、少しだけ余裕を持たせた線
  expect(bytes / 1024, `起動時の JS が ${(bytes / 1024).toFixed(0)}KB`).toBeLessThan(600);
});

test("ビルド済みのファイルを配り、オフラインでも開ける", async ({ page, context }) => {
  // ビルド済みかどうかの判定を NODE_ENV だけで見ていたため、
  // npm start（node dist/server.cjs）でも開発用の Vite ミドルウェアが動き、
  // /sw.js にも index.html が返ってサービスワーカーが登録されていなかった。
  // 判定そのものは tests/serverMode.test.ts が見る。ここは実際の結果を見る
  const sw = await page.request.get("/sw.js");
  expect(sw.headers()["content-type"], "/sw.js が JavaScript として配られていない")
    .toContain("javascript");
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.headers()["content-type"]).toContain("manifest");

  await page.goto("/");
  await waitForVocabulary(page);
  // サービスワーカーが「配り終える」まで待ってから回線を切る。
  //
  // ここは以前 `waitForFunction(async () => ...)` で待っていたが、
  // waitForFunction は async の述語を待たない。返ってきた Promise を
  // そのまま「真」と見なすため、1回目の判定で必ず通っていた。
  // つまり何も待っておらず、前の行までにたまたま時間が経っていたから
  // 通っていただけだった（実測: 切った時点で 38 件中 10 件しか
  // 入っていない）。非同期の判定は expect.poll を使う。
  //
  // 待つ条件は「オフラインで開ける」の前提そのもの:
  //   - このページを制御下に置いている
  //   - 新しいワーカーの入れ替えが済んでいる
  //   - index.html が手元にある
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const reg = await navigator.serviceWorker.getRegistration();
          if (!reg || reg.installing || reg.waiting) return false;
          if (!navigator.serviceWorker.controller) return false;
          const key = (await caches.keys()).find(k => k.includes("precache"));
          if (!key) return false;
          const cache = await caches.open(key);
          return !!(await cache.match("/index.html", { ignoreSearch: true }));
        }),
      { timeout: 30_000, message: "サービスワーカーが配り終えない" }
    )
    .toBe(true);

  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator("#btn_junior_word")).toBeVisible({ timeout: 30_000 });
  } finally {
    await context.setOffline(false);
  }
});

test("学習データを書き出すと、文法の進捗も含まれる", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.evaluate(() =>
    localStorage.setItem("quest_grammar_progress", JSON.stringify({ g_present_perfect: [0, 1] }))
  );
  await page.reload();
  await waitForVocabulary(page);

  await openNavMenu(page);
  await page.locator("#nav_settings_btn").click();
  const download = page.waitForEvent("download");
  await page.getByText("エクスポート（書き出し）").click();
  const file = await download;
  const path = await file.path();
  const body = JSON.parse(await (await import("fs/promises")).readFile(path!, "utf8"));
  expect(Object.keys(body.data)).toContain("quest_grammar_progress");
  expect(body.data.quest_grammar_progress).toContain("g_present_perfect");
});
