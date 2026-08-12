import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getPhonetic, __setPhoneticsClock } from "../src/phonetics";

/**
 * 発音記号の取得。
 *
 * 通信エラーをキャッシュしないのは「オフラインから戻ったら取り直せるように」で、
 * 意図としては正しい。ただし歯止めが無いため、外部に出られない環境では
 * 単語を1つ描画するたびに外へ出ては失敗し、コンソールがエラーで埋まる
 * （実測：辞書の一覧を開くだけで8件のエラー）。
 *
 * 失敗が続いたら休み、休みが明けたら再開することを固定する。
 * 「休んだきり再開しない」と、オフラインから戻っても発音記号が
 * 二度と出なくなるので、そちらも合わせて確かめる。
 */

// node 環境には localStorage が無い。キャッシュの読み書きだけできれば足りる
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); }
};

let now = 0;
const advance = (ms: number) => { now += ms; };

/** 常に通信エラーになる fetch */
function failingFetch() {
  return vi.fn(async () => { throw new TypeError("Failed to fetch"); });
}

/** 発音記号を返す fetch */
function okFetch(ipa: string) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => [{ phonetic: ipa }]
  } as unknown as Response));
}

beforeEach(() => {
  now = 1_000_000;
  __setPhoneticsClock(() => now);
  localStorage.clear();
});

afterEach(() => {
  __setPhoneticsClock(null);
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("通信できないとき", () => {
  it("失敗が続いたら外に出るのをやめる", async () => {
    const fetchMock = failingFetch();
    vi.stubGlobal("fetch", fetchMock);

    // 3回までは試す
    for (const w of ["alpha", "bravo", "charlie"]) {
      expect(await getPhonetic(w)).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // 4語目以降は休止中なので外に出ない
    for (const w of ["delta", "echo", "foxtrot", "golf"]) {
      expect(await getPhonetic(w)).toBeNull();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("休みが明けたら再開する", async () => {
    vi.stubGlobal("fetch", failingFetch());
    for (const w of ["alpha", "bravo", "charlie", "delta"]) await getPhonetic(w);

    // 回線が戻った
    const ok = okFetch("/ˈɛn.tər/");
    vi.stubGlobal("fetch", ok);

    // 休止中はまだ出ない
    expect(await getPhonetic("enter")).toBeNull();
    expect(ok).not.toHaveBeenCalled();

    advance(31_000);
    expect(await getPhonetic("enter")).toBe("/ˈɛn.tər/");
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("休みが明けても失敗するなら、休みを延ばす", async () => {
    const fail = failingFetch();
    vi.stubGlobal("fetch", fail);
    for (const w of ["aa", "ab", "ac"]) await getPhonetic(w);
    expect(fail).toHaveBeenCalledTimes(3);

    advance(31_000);
    await getPhonetic("ad");          // 4回目の失敗 → 次は60秒
    expect(fail).toHaveBeenCalledTimes(4);

    advance(31_000);                  // まだ明けていない
    await getPhonetic("ae");
    expect(fail).toHaveBeenCalledTimes(4);

    advance(31_000);                  // 合わせて62秒経過
    await getPhonetic("af");
    expect(fail).toHaveBeenCalledTimes(5);
  });

  it("休みには上限がある（永久に止まらない）", async () => {
    const fail = failingFetch();
    vi.stubGlobal("fetch", fail);
    // 十分な回数を失敗させる
    for (let i = 0; i < 20; i++) {
      advance(10 * 60_000);
      await getPhonetic(String.fromCharCode(107 + i) + "word");
    }
    const before = fail.mock.calls.length;
    advance(5 * 60_000 + 1_000);
    await getPhonetic("last");
    expect(fail.mock.calls.length).toBe(before + 1);
  });

  it("成功したら数え上げを消す", async () => {
    const fail = failingFetch();
    vi.stubGlobal("fetch", fail);
    await getPhonetic("xa");
    await getPhonetic("xb");          // ここまで2回失敗

    vi.stubGlobal("fetch", okFetch("/ok/"));
    expect(await getPhonetic("good")).toBe("/ok/");

    // 数え上げが消えているので、また3回試せる
    const fail2 = failingFetch();
    vi.stubGlobal("fetch", fail2);
    for (const w of ["ya", "yb", "yc"]) await getPhonetic(w);
    expect(fail2).toHaveBeenCalledTimes(3);
  });
});

describe("休止しないとき", () => {
  it("辞書に無い語(404)は通信の失敗として数えない", async () => {
    // 応答が返っている以上、通信そのものは生きている。
    // ここを失敗と数えると、収録語に無い語が並んだだけで休んでしまう
    const notFound = vi.fn(async () => ({ ok: false, status: 404 } as unknown as Response));
    vi.stubGlobal("fetch", notFound);
    for (const w of ["zza", "zzb", "zzc", "zzd", "zze"]) {
      expect(await getPhonetic(w)).toBeNull();
    }
    expect(notFound).toHaveBeenCalledTimes(5);
  });

  it("キャッシュ済みの語は休止中でも返せる", async () => {
    vi.stubGlobal("fetch", okFetch("/kæʃ/"));
    expect(await getPhonetic("cache")).toBe("/kæʃ/");

    vi.stubGlobal("fetch", failingFetch());
    for (const w of ["ba", "bb", "bc", "bd"]) await getPhonetic(w);

    // 休止中でも、既に取れている語は出る
    expect(await getPhonetic("cache")).toBe("/kæʃ/");
  });
});

describe("一度に大量の語を描いたとき", () => {
  it("順番待ちの分も休止で打ち切る", async () => {
    // 辞書の一覧は1ページに50語を同時に描く。
    // 待ち行列に入る前だけを見ていると、最初の失敗が返るより先に
    // 50件すべてが並んでしまい、歯止めがまったく効かなかった（実測：50件）
    const fail = failingFetch();
    vi.stubGlobal("fetch", fail);
    const words = Array.from({ length: 50 }, (_, i) =>
      String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)) + "x"
    );
    await Promise.all(words.map(w => getPhonetic(w)));
    // 同時実行の上限が4なので、多くても「上限 + 失敗の閾値」程度で止まる
    expect(fail.mock.calls.length).toBeLessThanOrEqual(8);
  });
});
