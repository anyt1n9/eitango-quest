/**
 * ブラウザの上の帯（`<meta name="theme-color">`）の色。画面の地と同じにする。
 *
 * `media="(prefers-color-scheme: …)"` で明暗の2つを置くと、帯は**端末の設定**で選ばれる。
 * アプリの明暗は利用者が選んだもの（`quest_theme`）が優先されるので、端末が暗く
 * アプリを明るくしている人では、暗い帯の下に紙の色の画面が出ていた。
 * そこで `media` の無い1つだけを置き、実際のテーマに合わせて中身を書き換える。
 *
 * `index.html` の先頭のスクリプトも同じ色を書いている（React を待たずに決めるため）。
 * 値をそろえていることは tests/themeColor.test.ts が見る。
 */
export const THEME_COLORS = {
  /** 紙（--color-slate-50） */
  light: "#fafaf7",
  /** 深い海（暗いテーマの --color-slate-50） */
  dark: "#03121d"
} as const;

export function applyThemeColor(dark: boolean, doc: Document = document): void {
  let meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.name = "theme-color";
    doc.head.appendChild(meta);
  }
  meta.removeAttribute("media");
  meta.content = dark ? THEME_COLORS.dark : THEME_COLORS.light;
}
