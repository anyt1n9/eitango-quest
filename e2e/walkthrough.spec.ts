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
  await page.locator("#nav_grammar_toggle_btn").click();

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
  await page.getByText("長文読破 Quest").first().click();

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
  await page.getByText("長文読破 Quest").first().click();
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
  await page.locator("#nav_dictionary_toggle_btn").click();
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

test("学習データを書き出すと、文法の進捗も含まれる", async ({ page }) => {
  await page.goto("/");
  await waitForVocabulary(page);
  await page.evaluate(() =>
    localStorage.setItem("quest_grammar_progress", JSON.stringify({ g_present_perfect: [0, 1] }))
  );
  await page.reload();
  await waitForVocabulary(page);

  await page.locator("#nav_settings_btn").click();
  const download = page.waitForEvent("download");
  await page.getByText("エクスポート（書き出し）").click();
  const file = await download;
  const path = await file.path();
  const body = JSON.parse(await (await import("fs/promises")).readFile(path!, "utf8"));
  expect(Object.keys(body.data)).toContain("quest_grammar_progress");
  expect(body.data.quest_grammar_progress).toContain("g_present_perfect");
});
