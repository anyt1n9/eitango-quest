/**
 * 効果音用の共有 AudioContext。
 * 以前は効果音を鳴らすたびに new AudioContext() していたが、ブラウザは
 * 1ページあたりの AudioContext 数に上限（Chrome では約6個）があるため、
 * 数回クイズに答えると音が鳴らなくなる不具合があった。
 * ここでシングルトンとして1つだけ生成し、全コンポーネントで使い回す。
 */

let sharedCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AC();
    }
    if (sharedCtx.state === "suspended") {
      // ユーザー操作後に再開できるように試みる（失敗しても無視）
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch {
    return null;
  }
}
