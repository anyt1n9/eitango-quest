/**
 * 広告（Google AdSense）設定。
 *
 * ▼リリース手順:
 * 1. https://adsense.google.com/ で AdSense アカウントを作成し、このサイトを追加して審査に出す。
 * 2. 承認後、発行される「パブリッシャーID」(ca-pub-XXXXXXXXXXXXXXXX) を ADSENSE_CLIENT に設定。
 * 3. AdSense 管理画面で「広告ユニット（ディスプレイ広告・レスポンシブ）」を作成し、
 *    発行される「広告スロットID」(数字10桁) を ADSENSE_SLOT_FOOTER に設定。
 * 4. public/ads.txt の pub-XXXX も同じIDに置き換える。
 *
 * 設定が未完了（プレースホルダーのまま）の間は広告は一切読み込まれず、
 * 枠も表示されないため、開発・審査前でも安全に動作します。
 */

// TODO(リリース時に差し替え): あなたの AdSense パブリッシャーID
export const ADSENSE_CLIENT = "ca-pub-XXXXXXXXXXXXXXXX";

// TODO(リリース時に差し替え): フッター広告ユニットのスロットID
export const ADSENSE_SLOT_FOOTER = "XXXXXXXXXX";

// プレースホルダーのままか（=まだ設定されていないか）を判定
const isPlaceholder = (v: string) => !v || v.includes("XXXX");

// 実際に広告を有効化してよいか（正しい ca-pub- 形式のIDが設定済みのときだけ true）
export const ADS_ENABLED =
  ADSENSE_CLIENT.startsWith("ca-pub-") && !isPlaceholder(ADSENSE_CLIENT);
