import { readStoredString, removeStored, writeStored } from "./storage";
import { isSoftwareRenderer } from "./ocean/quality";

/**
 * 海の3D背景を使うかどうか。既定は「使う」（段階②-3で既定にした）。
 *
 * 利用者が背景の設定で選んだときだけ `quest_bg_ocean_choice` に書く。
 * 試験中は App が起動のたびに `quest_bg_ocean` へ "off" を書いていたので、
 * そちらの "off" は本人の選択とは限らない（読むのは "on" だけ）。
 *
 * 本人が選んでいないときは、次の順で決める。
 *   1. 試験中に「使う」を選んでいた人は、そのまま使う
 *   2. 自分の写真を背景にしている人は、写真のままにする（海で写真を隠さない）
 *   3. 端末のデータ節約（Save-Data）がオンなら使わない（three.js と3Dモデルで約2MBを読むため）
 *   4. それ以外は使う
 */
export const OCEAN_CHOICE_KEY = "quest_bg_ocean_choice";
/** 試験中の設定（読むだけ。"on" のときだけ意味を持つ） */
export const OCEAN_LEGACY_KEY = "quest_bg_ocean";

export interface OceanEnv {
  /** 自分の写真を背景にしているか */
  hasImage: boolean;
  /** 端末のデータ節約（navigator.connection.saveData） */
  saveData: boolean;
}

export function currentOceanEnv(hasImage: boolean): OceanEnv {
  let saveData = false;
  try {
    saveData = !!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  } catch {
    saveData = false;
  }
  return { hasImage, saveData };
}

export function initialOcean(env: OceanEnv): boolean {
  const choice = readStoredString(OCEAN_CHOICE_KEY);
  if (choice === "on") return true;
  if (choice === "off") return false;
  if (readStoredString(OCEAN_LEGACY_KEY) === "on") return true;
  if (env.hasImage) return false;
  if (env.saveData) return false;
  return true;
}

/** 利用者が選んだときだけ呼ぶ（起動時に書くと、次から「本人が選んだ」と区別できなくなる） */
export function saveOceanChoice(on: boolean): void {
  writeStored(OCEAN_CHOICE_KEY, on ? "on" : "off");
}

/**
 * 背景の画像を選んだとき。「使わない」を保存するのではなく、保存していた選択を消す。
 * 「使わない」を書くと、本人が選んでいない選択が最優先になり、あとで画像を消しても
 * 海に戻らなくなる。消しておけば、次の起動では「画像のある人は画像のまま」が効き、
 * 画像を消したあとは既定（使う）に戻る。
 */
export function clearOceanChoice(): void {
  removeStored(OCEAN_CHOICE_KEY);
  removeStored(OCEAN_LEGACY_KEY);
}

/**
 * three.js（約700KB）を取りに行く前に、この端末で3Dを描いてよいかを軽く確かめる。
 *
 *   - `failIfMajorPerformanceCaveat` を付けて WebGL を作れない端末は、GPU ではなく
 *     CPU で肩代わりする描き方しか無い（名前を隠すブラウザでもこれで分かる）
 *   - 作れても、描き手の名前が SwiftShader・llvmpipe などなら CPU で描いている
 *
 * 確かめたら WebGL はすぐ手放す（端末の WebGL の数には上限がある）。
 */
export function canRenderOcean(doc: Document = document): boolean {
  try {
    const canvas = doc.createElement("canvas");
    const gl = (canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      null) as WebGLRenderingContext | null;
    if (!gl) return false;
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return !isSoftwareRenderer(name);
  } catch {
    return false;
  }
}
