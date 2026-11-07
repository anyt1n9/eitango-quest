/**
 * 生き物（マンタ・魚の群れ）が泳ぐ範囲の横の広がり。純粋な関数なので、three.js 無しで確かめられる。
 *
 * 画面の中身（カード）は中央の1列（`max-w-4xl`）に並ぶ。泳ぐ範囲を画面の形によらず同じにしていたときは、
 * PC の横長の画面でマンタも魚の群れもほとんどの時間をカードの真裏で過ごし、
 * 左右の余白は空のまま、生き物がどこにいるのか見えなかった。
 * 横長の画面ほど範囲を左右へ広げ、道筋の端がカードの列の外（余白）に出るようにする。
 *
 * 縦長・正方形に近い画面（スマホ・タブレットの縦）は 1 のまま。カードが幅いっぱいに並ぶので
 * 広げても余白は無く、画面の外へ泳ぎ出て見えている時間が減るだけになる。
 */
export const SWIM_SPREAD_MAX = 1.8;

export function swimSpread(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 1;
  return Math.min(SWIM_SPREAD_MAX, Math.max(1, aspect / 1.1));
}

/** マンタが回る輪の横の半径（広がりが 1 のとき 7） */
export const MANTA_RADIUS = 7;
/** 魚の群れが左右に行き来する幅（広がりが 1 のとき 6） */
export const SCHOOL_SWAY = 6;
/**
 * ウミガメが回る輪の横の半径（広がりが 1 のとき）。マンタより手前（輪の中心は z=-7）の低い所を、ゆっくり回る。
 * 甲羅は長さ1mほどで、手前を通るので小さすぎず、カードの列の外の余白にも出る
 */
export const TURTLE_RADIUS = 5;
/** ナポレオンフィッシュが行き来する横の幅（広がりが 1 のとき）。輪の中心は z=-9。横から見える向きで泳ぐ */
export const WRASSE_RADIUS = 6;
/** ジンベエザメが回る輪の横の半径（広がりが 1 のとき）。体が大きいので遠く（輪の中心は z=-14）を回る */
export const WHALESHARK_RADIUS = 8;
/** チョウチンアンコウが漂う横の幅（広がりが 1 のとき）。輪の中心は z=-7。暗い海で提灯だけが動いて見える */
export const ANGLER_RADIUS = 4.5;
