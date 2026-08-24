/**
 * 画面の中で使うアイコン。
 *
 * もとは lucide-react の汎用アイコンを当てていたが、中身と結びついていなかった。
 * とくに「学習メニュー」と、その中の「長文ストーリー」が同じコンパスの絵で、
 * 見出しと中の1項目が見分けられなかった。
 * AIを使う機能はどれもキラキラ（Sparkles）で、日記なのか分析なのかも分からない。
 *
 * ここでは、その場所が何をするところなのかを描く。
 * 線の太さ・角の丸めは lucide に揃えてあるので、残りのアイコンと並べても浮かない。
 * 色は currentColor に任せる（暗いテーマは色変数ごと入れ替わるため）。
 */

interface IconProps {
  className?: string;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true
};

/** 学習メニュー ＝ 今日やることの一覧 */
export function StudyListIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.2" y="4.4" width="4" height="4" rx="1.2" />
      <path d="M9.8 6.4h10.4" />
      <rect x="3.2" y="10" width="4" height="4" rx="1.2" />
      <path d="M9.8 12h10.4" />
      <rect x="3.2" y="15.6" width="4" height="4" rx="1.2" />
      <path d="M9.8 17.6h7.2" />
    </svg>
  );
}

/** 長文ストーリー ＝ 読み進める本。しおりで「途中まで読む」を表す */
export function ReadingIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5.5 3.6h12a1.4 1.4 0 0 1 1.4 1.4v14.4a1.4 1.4 0 0 1-1.4 1.4h-12A1.9 1.9 0 0 1 3.6 18.9V5.5a1.9 1.9 0 0 1 1.9-1.9Z" />
      <path d="M3.6 17.4h15.3" />
      <path d="M8.6 3.6v6.4l2.3-1.8 2.3 1.8V3.6" />
    </svg>
  );
}

/** AI英語日記 ＝ 書く側に回る。ページとペン */
export function DiaryIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M15.4 12.9v6.3a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19.2V5.2a1.4 1.4 0 0 1 1.4-1.4h6.2" />
      <path d="M7 12.4h4.4M7 16h3.2" />
      <path d="M18.3 3.6a1.8 1.8 0 0 1 2.5 2.5l-7 7-3.3.8.8-3.3Z" />
    </svg>
  );
}

/** 今日の復習 ＝ その日ぶんの再出題。単なる「やり直し」ではないので日付を入れる */
export function ReviewIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.4 5.6h15.2a1.2 1.2 0 0 1 1.2 1.2v12.6a1.2 1.2 0 0 1-1.2 1.2H4.4a1.2 1.2 0 0 1-1.2-1.2V6.8a1.2 1.2 0 0 1 1.2-1.2Z" />
      <path d="M8 3.2v4.4M16 3.2v4.4M3.2 10h17.6" />
      <path d="M14.6 15.4a2.9 2.9 0 1 1-.9-2.1" />
      <path d="M14.2 11.4v2.2h-2.2" />
    </svg>
  );
}

/** 辞書 ＝ 引く場所。本と虫めがね */
export function DictionaryIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 6.4c-2.2-1.5-4.6-1.8-7.6-1.1a1 1 0 0 0-.8 1v10.4a1 1 0 0 0 1.2 1c2.6-.6 4.9-.3 7.2 1.1" />
      <path d="M12 6.4c1.3-.9 2.7-1.4 4.3-1.5" />
      <circle cx="17.3" cy="13.2" r="3.2" />
      <path d="M19.7 15.6 21.9 17.8" />
    </svg>
  );
}

/** リスニング ＝ 聞いて答える。綴りは隠すので、耳で受け取ることを描く */
export function ListeningIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.6 14.2v-2a7.4 7.4 0 0 1 14.8 0v2" />
      <path d="M4.6 13.4h1.6a1.4 1.4 0 0 1 1.4 1.4v3a1.4 1.4 0 0 1-1.4 1.4H5.8a1.6 1.6 0 0 1-1.6-1.6v-3.2a1 1 0 0 1 .4-1Z" />
      <path d="M19.4 13.4h-1.6a1.4 1.4 0 0 0-1.4 1.4v3a1.4 1.4 0 0 0 1.4 1.4h.4a1.6 1.6 0 0 0 1.6-1.6v-3.2a1 1 0 0 0-.4-1Z" />
    </svg>
  );
}

/** 綴りを書く ＝ 自分で書く。書いている行と、その上を走る鉛筆 */
export function SpellingIcon({ className = "w-5 h-5" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.6 20.6h16.8" />
      <path d="M15.6 3.4a1.9 1.9 0 0 1 2.7 2.7l-8.5 8.5-3.6.9.9-3.6Z" />
      <path d="M13.9 5.1l2.7 2.7" />
      <path d="M3.6 16.6h5.6" />
    </svg>
  );
}
