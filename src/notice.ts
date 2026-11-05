import { useSyncExternalStore } from "react";

/**
 * 画面の中に出す短い知らせ（ログインボーナスを受け取った・長文を読破した、など）。
 *
 * 以前はブラウザの確認窓（alert）で出していた。確認窓は画面全体を止め、「OK」を押すまで
 * 何もできず、文面には絵文字（🎉 ✨）が混ざり、アプリの見た目とも合っていなかった。
 * いまは画面の下（タブの上）に重ねて出し、少しすると消える（NoticeHost）。
 *
 * 値は App の state にしない（知らせを出すたびに画面全体を描き直さないため。glass.ts と同じ形）。
 * 削除・上書きの前に聞く確認（confirm）は、押して答える必要があるのでここでは扱わない。
 */
export type NoticeTone = "success" | "info" | "warning";

export interface Notice {
  id: number;
  message: string;
  tone: NoticeTone;
}

/** 同時に出すのはここまで（古いものから消す） */
export const MAX_NOTICES = 3;

let notices: Notice[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function notify(message: string, tone: NoticeTone = "info"): number {
  const id = nextId++;
  notices = [...notices, { id, message, tone }].slice(-MAX_NOTICES);
  emit();
  return id;
}

export function dismissNotice(id: number): void {
  if (!notices.some(n => n.id === id)) return;
  notices = notices.filter(n => n.id !== id);
  emit();
}

export function getNotices(): Notice[] {
  return notices;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNotices(): Notice[] {
  return useSyncExternalStore(subscribe, getNotices, getNotices);
}

/** テスト用。出ている知らせを消す */
export function __resetNoticesForTest(): void {
  notices = [];
  emit();
}
