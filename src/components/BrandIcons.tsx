/**
 * アプリ名「エイゴリラ」の由来を出す2つのしるし（エイとゴリラ）。
 *
 * lucide-react に該当の絵が無いので手で描いている。
 * 画面の他のアイコンと揃うよう、塗らずに線で描く（lucide と同じ作り）。
 * 色は currentColor に任せる。暗いテーマでは親の文字色が入れ替わるため、
 * ここで色を決め打ちすると片方のテーマで沈む。
 */

interface IconProps {
  className?: string;
}

/** エイ（マンタ）を上から見た形 */
export function RayIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 胸びれ（左右に広がる翼）と胴 */}
      <path d="M12 5.2c1.4 0 2.6.9 3.1 2.1 3.2 1.1 6 3.5 7.3 6.4.5 1.2-.7 2.3-1.9 1.8-2.2-1-4.6-1.3-6.5-.8-.4 1.1-1.1 1.9-2 1.9s-1.6-.8-2-1.9c-1.9-.5-4.3-.2-6.5.8-1.2.5-2.4-.6-1.9-1.8C2.9 10.8 5.7 8.4 8.9 7.3 9.4 6.1 10.6 5.2 12 5.2Z" />
      {/* 頭の左右にある小さなひれ */}
      <path d="M10.6 5.7 9.9 3.6M13.4 5.7l.7-2.1" />
      {/* 尾 */}
      <path d="M12 16.6v3.8" />
      {/* 目 */}
      <path d="M10.8 8h.01M13.2 8h.01" strokeWidth={2.3} />
    </svg>
  );
}

/** ゴリラの顔を正面から見た形 */
export function GorillaIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 耳 */}
      <circle cx="4.4" cy="10.4" r="2.2" />
      <circle cx="19.6" cy="10.4" r="2.2" />
      {/* 頭 */}
      <path d="M12 3.2c4.1 0 6.9 2.9 6.9 7.1 0 5.8-3.1 10.2-6.9 10.2s-6.9-4.4-6.9-10.2c0-4.2 2.8-7.1 6.9-7.1Z" />
      {/* 目。眉の線も描いてみたが、小さく出すと目とくっついて潰れる */}
      <path d="M9.3 10.4h.01M14.7 10.4h.01" strokeWidth={2.5} />
      {/* 口もと */}
      <path d="M12 12.9c2.4 0 3.9 1.3 3.9 3.1s-1.7 2.7-3.9 2.7-3.9-.9-3.9-2.7 1.5-3.1 3.9-3.1Z" />
      {/* 鼻の穴 */}
      <path d="M10.9 15.2h.01M13.1 15.2h.01" strokeWidth={2} />
    </svg>
  );
}
