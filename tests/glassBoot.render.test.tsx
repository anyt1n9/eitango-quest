import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GLASS_KEY, glassRegime, parseGlass } from "../src/glass";

/**
 * 起動直後の透明度（index.html の先頭のスクリプト）。
 *
 * React を待たずに当てているので、読み方を src/glass.ts と別に書いている。
 * 片方だけ変えると、起動の一瞬だけ別の濃さで描かれ、地の色の200msの遷移でちらつく
 * （「透明」を選んだ人には、起動のたびに不透明なカードが光ってから透ける）。
 * ここでは本物のスクリプトを走らせ、同じ保存値から同じ結果になるかを突き合わせる。
 */

const html = readFileSync(join(__dirname, "..", "index.html"), "utf8");
const boot = /<script>([\s\S]*?)<\/script>/.exec(html)![1];

function runBoot(saved: string | null) {
  localStorage.clear();
  if (saved !== null) localStorage.setItem(GLASS_KEY, saved);
  const root = document.documentElement;
  delete root.dataset.glass;
  root.style.removeProperty("--glass-t");
  new Function(boot)();
  return { regime: root.dataset.glass, t: root.style.getPropertyValue("--glass-t") };
}

beforeEach(() => {
  document.documentElement.className = "";
});

describe("起動直後の透明度", () => {
  for (const saved of [null, "0", "1", "18", "19", "55", "100", "off", "light", "strong", "clear",
    "", "-1", "101", "0.5", "on", "toString", "__proto__", "constructor"]) {
    it(`保存値 ${JSON.stringify(saved)} を src/glass.ts と同じに読む`, () => {
      const expected = parseGlass(saved);
      expect(runBoot(saved)).toEqual({ regime: glassRegime(expected), t: String(expected) });
    });
  }
});
