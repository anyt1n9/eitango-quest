import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { BACKUP_KEYS, NON_BACKUP_KEYS } from "../src/backupKeys";

/**
 * 学習データのバックアップ。
 *
 * バックアップ対象は手で並べた一覧なので、新しい保存先を足したときに
 * 追加を忘れても型検査もビルドも通ってしまう。気づくのは
 * 「端末を移したらその機能の進捗だけが消えていた」ときで、そのときには
 * もう元のデータは無い。
 *
 * 実際に文法ガイドを足したとき `quest_grammar_progress` の追加が漏れていた。
 * ここでは src の中に書かれた保存キーを機械的に集め、
 * 「バックアップする」か「理由を書いて除外する」かのどちらかに
 * 必ず分類されていることを確かめる。
 */

const SRC = join(__dirname, "..", "src");

/** src 以下の .ts / .tsx を全部読む */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      // data/ は焼き込んだ単語データなので保存キーは持たない（巨大なので読まない）
      if (name === "data") continue;
      out.push(...sourceFiles(path));
      continue;
    }
    if (/\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** ソースに現れる "quest_..." という文字列リテラルを集める */
function storageKeysInSource(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const path of sourceFiles(SRC)) {
    // 一覧そのものを書いてあるファイルは対象外（自分自身を根拠にできない）
    if (path.endsWith("backupKeys.ts")) continue;
    const text = readFileSync(path, "utf8");
    for (const m of text.matchAll(/"(quest_[a-z0-9_]+)"/g)) {
      const key = m[1];
      const where = found.get(key) ?? [];
      where.push(path.slice(SRC.length + 1));
      found.set(key, where);
    }
  }
  return found;
}

describe("バックアップ対象のキー", () => {
  it("src で使う保存キーが漏れなく分類されている", () => {
    const used = storageKeysInSource();
    const known = new Set<string>([...BACKUP_KEYS, ...Object.keys(NON_BACKUP_KEYS)]);
    const missing = [...used.entries()]
      .filter(([key]) => !known.has(key))
      .map(([key, where]) => `${key} (${where.join(", ")})`);
    expect(missing, "バックアップ対象にも除外理由にも入っていないキー").toEqual([]);
  });

  it("文法ガイドの進捗を書き出す", () => {
    // 追加漏れで実際に失われていた項目。名指しで固定しておく
    expect(BACKUP_KEYS).toContain("quest_grammar_progress");
  });

  it("一覧に重複が無い", () => {
    expect(new Set(BACKUP_KEYS).size).toBe(BACKUP_KEYS.length);
  });

  it("除外したキーには理由が書いてある", () => {
    for (const [key, reason] of Object.entries(NON_BACKUP_KEYS)) {
      expect(reason.length, key).toBeGreaterThan(0);
    }
  });

  it("バックアップ対象と除外が重ならない", () => {
    const both = BACKUP_KEYS.filter(k => k in NON_BACKUP_KEYS);
    expect(both).toEqual([]);
  });

  it("使われていないキーを一覧に残さない", () => {
    // 使わなくなったキーが残っていると、何が保存されているのか読めなくなる
    const used = storageKeysInSource();
    const stale = [...BACKUP_KEYS, ...Object.keys(NON_BACKUP_KEYS)].filter(k => !used.has(k));
    expect(stale, "src のどこからも使われていないキー").toEqual([]);
  });
});
