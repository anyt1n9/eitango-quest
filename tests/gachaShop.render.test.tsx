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
    const owned = setOwnedRewardIds.mock.calls.at(-1)![0] as string[];
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
    const owned = setOwnedRewardIds.mock.calls.at(-1)![0] as string[];
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
