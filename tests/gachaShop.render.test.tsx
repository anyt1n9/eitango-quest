import type { ComponentProps } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import GachaShop from "../src/components/GachaShop";
import { REWARD_POOL } from "../src/data/rewards";

/**
 * ごほうびガチャの描画。
 *
 * ここは学習で貯めたポイントを実際に減らす唯一の画面なので、
 * 数え違いがそのまま「貯めたポイントが消えた」になる。
 *   - 足りないのに引けてしまう
 *   - 重複したのに返金されない
 *   - 引いていないのに減る
 * いずれも型検査では見つからない。演出のために 900ms 待つので、
 * 時計は差し替えて確かめる。
 */

const SINGLE_COST = 150;
const TEN_COST = 1400;
const DUPLICATE_REFUND = 20;

function renderShop(props: Partial<ComponentProps<typeof GachaShop>> = {}) {
  const setOwnedRewardIds = vi.fn();
  const setGachaSpent = vi.fn();
  const setEquipped = vi.fn();
  const onBackToDashboard = vi.fn();

  render(
    <GachaShop
      availablePoints={10_000}
      totalScore={10_000}
      ownedRewardIds={[]}
      setOwnedRewardIds={setOwnedRewardIds}
      gachaSpent={0}
      setGachaSpent={setGachaSpent}
      equipped={{}}
      setEquipped={setEquipped}
      onBackToDashboard={onBackToDashboard}
      {...props}
    />
  );

  return { setOwnedRewardIds, setGachaSpent, setEquipped, onBackToDashboard };
}

/** 抽選の演出（900ms）を進める */
function finishPull() {
  act(() => { vi.advanceTimersByTime(1000); });
}

/** setGachaSpent(prev => ...) に渡された更新関数を、0から適用した結果 */
function spentFrom(setGachaSpent: ReturnType<typeof vi.fn>): number {
  const updater = setGachaSpent.mock.calls.at(-1)![0];
  return typeof updater === "function" ? updater(0) : updater;
}

/**
 * setOwnedRewardIds(prev => ...) に渡された更新関数を、いまの所持一覧から適用した結果。
 *
 * 所持一覧は「足す」形で書き戻す（配列を丸ごと渡すと、待っているあいだに
 * 増えた分を消してしまう）。テスト側もその形に合わせて中身を取り出す。
 */
function ownedFrom(setOwnedRewardIds: ReturnType<typeof vi.fn>, prev: string[] = []): string[] {
  const updater = setOwnedRewardIds.mock.calls.at(-1)![0];
  return typeof updater === "function" ? updater(prev) : updater;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("引けるかどうか", () => {
  it("使えるポイントを表示する", () => {
    renderShop({ availablePoints: 320 });
    expect(screen.getByText(/使えるポイント: 320P/)).toBeInTheDocument();
  });

  it("ポイントが足りなければ引けない", () => {
    const { setGachaSpent, setOwnedRewardIds } = renderShop({ availablePoints: SINGLE_COST - 1 });
    fireEvent.click(document.getElementById("btn_gacha_single")!);
    finishPull();

    expect(screen.getByText(/ポイントが足りません/)).toBeInTheDocument();
    expect(setGachaSpent).not.toHaveBeenCalled();
    expect(setOwnedRewardIds).not.toHaveBeenCalled();
  });

  it("ちょうど足りていれば引ける", () => {
    const { setGachaSpent } = renderShop({ availablePoints: SINGLE_COST });
    fireEvent.click(document.getElementById("btn_gacha_single")!);
    finishPull();
    expect(spentFrom(setGachaSpent)).toBe(SINGLE_COST);
  });

  it("10連は単発10回より安く、重複したぶんだけ戻る", () => {
    // 1回の10連の中で同じものが出ることもある。そのぶんも返金の対象
    const { setGachaSpent } = renderShop();
    fireEvent.click(document.getElementById("btn_gacha_ten")!);
    finishPull();
    const duplicates = screen.queryAllByText(/重複/).length;
    expect(spentFrom(setGachaSpent)).toBe(TEN_COST - DUPLICATE_REFUND * duplicates);
    expect(TEN_COST).toBeLessThan(SINGLE_COST * 10);
  });
});

describe("結果", () => {
  it("単発は1つ、10連は10個出る", () => {
    renderShop();
    fireEvent.click(document.getElementById("btn_gacha_ten")!);
    finishPull();
    const panel = document.getElementById("gacha_result_panel")!;
    // 出た景品はすべて収録済みのもの
    const names = REWARD_POOL.map(r => r.value);
    const shown = names.filter(v => (panel.textContent || "").includes(v));
    expect(shown.length).toBeGreaterThan(0);
  });

  it("引いたものを所持済みに加える", () => {
    const { setOwnedRewardIds } = renderShop();
    fireEvent.click(document.getElementById("btn_gacha_single")!);
    finishPull();
    const owned = ownedFrom(setOwnedRewardIds);
    expect(owned).toHaveLength(1);
    expect(REWARD_POOL.map(r => r.id)).toContain(owned[0]);
  });

  it("全部持っていれば、10連ぶんまるごと返金される", () => {
    // 重複は1つ 20P 戻る。全種類持っていれば 10個とも重複になる
    const { setGachaSpent, setOwnedRewardIds } = renderShop({
      ownedRewardIds: REWARD_POOL.map(r => r.id)
    });
    fireEvent.click(document.getElementById("btn_gacha_ten")!);
    finishPull();

    expect(spentFrom(setGachaSpent)).toBe(TEN_COST - DUPLICATE_REFUND * 10);
    // 持ち物は増えない
    const owned = ownedFrom(setOwnedRewardIds, REWARD_POOL.map(r => r.id));
    expect(owned).toHaveLength(REWARD_POOL.length);
  });

  it("重複は重複と分かるように出す", () => {
    renderShop({ ownedRewardIds: REWARD_POOL.map(r => r.id) });
    fireEvent.click(document.getElementById("btn_gacha_single")!);
    finishPull();
    expect(screen.getAllByText(/重複/).length).toBeGreaterThan(0);
  });
});

describe("コレクション", () => {
  it("持っていないものは中身を見せない", () => {
    renderShop({ ownedRewardIds: [] });
    const grid = document.getElementById("gacha_collection_grid")!;
    const avatars = REWARD_POOL.filter(r => r.type === "avatar");
    for (const r of avatars.slice(0, 3)) {
      expect(within(grid).queryByText(r.value), r.value).not.toBeInTheDocument();
    }
  });

  it("持っているものは中身が出て、装備できる", () => {
    const first = REWARD_POOL.find(r => r.type === "avatar")!;
    const { setEquipped } = renderShop({ ownedRewardIds: [first.id] });
    const grid = document.getElementById("gacha_collection_grid")!;
    const cell = within(grid).getByText(first.value);
    fireEvent.click(cell);
    expect(setEquipped).toHaveBeenCalled();
  });
});

/**
 * 連打したとき。
 *
 * disabled が効くのは再描画のあとなので、その前に2回押されると
 * handlePull が2本走る。どちらも押した時点の所持一覧を抱えたまま900ms待つため、
 * あとから終わったほうが先に当たった新アイテムを消した状態で上書きしていた。
 * ポイントは関数形の更新で両方きちんと引かれるので、
 * 「払ったのに片方の排出物が残らない」という取り返しのつかない形になる。
 */
describe("連打", () => {
  /**
   * 再描画を挟まずに2回押す。
   *
   * fireEvent は1回ごとに React を再描画させてしまい、2回目は
   * disabled が効いた状態になる＝連打の再現にならない。
   * 同じ act の中で続けて押すと、押した時点ではまだ
   * disabled が当たっておらず、実際の連打と同じ形になる。
   */
  function doubleClick(id: string, times = 2) {
    const btn = document.getElementById(id)!;
    act(() => {
      for (let i = 0; i < times; i++) btn.click();
    });
  }

  it("2回押しても抽選は1回だけ", () => {
    const { setGachaSpent, setOwnedRewardIds } = renderShop();
    doubleClick("btn_gacha_single");
    finishPull();

    expect(setGachaSpent).toHaveBeenCalledTimes(1);
    expect(setOwnedRewardIds).toHaveBeenCalledTimes(1);
    expect(spentFrom(setGachaSpent)).toBeLessThanOrEqual(SINGLE_COST);
  });

  it("所持一覧は「足す」形で書き戻す（先に手に入れた分を消さない）", () => {
    const { setOwnedRewardIds } = renderShop();
    fireEvent.click(document.getElementById("btn_gacha_single")!);
    finishPull();

    const updater = setOwnedRewardIds.mock.calls.at(-1)![0];
    expect(typeof updater, "配列を丸ごと渡すと、待っているあいだに増えた分を消す").toBe("function");

    // 待っているあいだに別の経路で増えた分が残ること
    const merged: string[] = updater(["earlier_reward"]);
    expect(merged).toContain("earlier_reward");
    expect(merged.length).toBeGreaterThan(1);

    // 同じ更新が二度呼ばれても結果が変わらない（和集合）
    expect(updater(merged).sort()).toEqual(merged.sort());
  });

  it("10連でも連打は1回分だけ引く", () => {
    const { setGachaSpent } = renderShop();
    doubleClick("btn_gacha_ten", 3);
    finishPull();

    expect(setGachaSpent).toHaveBeenCalledTimes(1);
    expect(spentFrom(setGachaSpent)).toBeLessThanOrEqual(TEN_COST);
  });

  it("引き終わればまた引ける", () => {
    const { setGachaSpent } = renderShop();
    const btn = document.getElementById("btn_gacha_single")!;
    fireEvent.click(btn);
    finishPull();
    fireEvent.click(btn);
    finishPull();
    expect(setGachaSpent).toHaveBeenCalledTimes(2);
  });
});
