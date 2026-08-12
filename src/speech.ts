/**
 * 読み上げ（Web Speech API）の可否判定と共通の再生処理。
 *
 * リスニング形式は綴りを隠して再生ボタンだけを見せるため、
 * 読み上げが使えない端末では「手がかりが何も無い四択」になってしまう。
 * 出題形式を選ぶ画面でも無効にならず、入ってから初めて詰む。
 * 使えるかどうかを値として持ち、出題側と選択側の両方で見る。
 *
 * 判定は3値にする。音声の一覧はブラウザによっては非同期で埋まるため、
 * 空の一覧を「使えない」と断じると、実際には鳴る端末でリスニングを
 * 塞いでしまう。分からないうちは塞がない。
 */

export type SpeechAvailability = "ok" | "unavailable" | "unknown";

/** window に読み上げの API があるか */
function hasApi(): boolean {
  return typeof window !== "undefined"
    && typeof window.speechSynthesis !== "undefined"
    && typeof (window as any).SpeechSynthesisUtterance === "function";
}

/**
 * 読み上げが使えるか。
 *
 * - API が無い → unavailable
 * - 音声の一覧が空 → unknown（まだ読み込まれていない可能性がある）
 * - 英語の音声がひとつも無い → unavailable（英単語を読ませられない）
 */
export function speechAvailability(): SpeechAvailability {
  if (!hasApi()) return "unavailable";
  let voices: SpeechSynthesisVoice[] = [];
  try {
    voices = window.speechSynthesis.getVoices() || [];
  } catch {
    return "unknown";
  }
  if (voices.length === 0) return "unknown";
  return voices.some(v => /^en\b|^en-/i.test(v.lang || "")) ? "ok" : "unavailable";
}

/** リスニング形式を出してよいか（分からないうちは出す） */
export function canUseSpeech(): boolean {
  return speechAvailability() !== "unavailable";
}

/**
 * 音声の一覧が後から埋まるブラウザのために、変化を購読する。
 * 返り値は購読を解除する関数。
 */
export function onVoicesChanged(listener: () => void): () => void {
  if (!hasApi()) return () => {};
  const target = window.speechSynthesis as unknown as EventTarget;
  try {
    target.addEventListener("voiceschanged", listener);
    return () => target.removeEventListener("voiceschanged", listener);
  } catch {
    return () => {};
  }
}

export interface SpeakOptions {
  /** 読み上げの速さ（1.0が標準） */
  rate?: number;
  /** 読み終わったとき */
  onEnd?: () => void;
  /** 直前の読み上げを止めるか（既定は止める） */
  cancelPrevious?: boolean;
}

/**
 * 英語を読み上げる。使えない環境では何もせず false を返す。
 * 例外は握りつぶす（読み上げが失敗しても学習は続けられるべきなので）。
 */
export function speak(text: string, options: SpeakOptions = {}): boolean {
  const body = String(text || "").trim();
  if (!body || !hasApi()) return false;
  try {
    if (options.cancelPrevious !== false) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(body);
    u.lang = "en-US";
    u.rate = options.rate ?? 0.9;
    if (options.onEnd) {
      u.onend = options.onEnd;
      // 失敗したときも呼ぶ。呼ばれないと「読み上げ中」の表示が残り続ける
      u.onerror = options.onEnd;
    }
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** 読み上げを止める */
export function stopSpeaking(): void {
  if (!hasApi()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // 停止できなくても支障はない
  }
}
