import express from "express";
import { GoogleGenAI } from "@google/genai";
import { createRateLimiter, createBudget } from "./guards";

/**
 * AIエンドポイントの流量制御と Gemini クライアント。
 *
 * 制御そのもの（窓の数え方・予算）は guards.ts にあり、
 * ここはそれを Express と Gemini に配線する層。
 * server.ts から切り出したのは、ルートの並びの中に
 * 課金と流量の話が挟まっていて読みづらかったため。
 * 規則は tests/serverGuards.test.ts、配線は
 * tests/serverRoutes.test.ts が確かめる。
 */

// ───────────────────────────────────────────────────────────
// AIエンドポイントのレート制限（IP単位・スライディングウィンドウ）
// 公開エンドポイントの「ただ乗り」による Gemini 利用枠の浪費を防ぐ。
// 依存追加なしのメモリ内実装。プロセス再起動でリセットされるが、
// 悪用の連続大量アクセスを弾く目的には十分。
// ───────────────────────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分
// 1分あたり最大40リクエスト/IP。辞書で単語を開くと画像・頻度分析で2回発火するため、
// 通常の辞書学習(1語ごとに2回×十数語)を妨げない一方、悪用(毎分数百回)は確実に弾く水準。
const RATE_LIMIT_MAX = 40;
const rateLimiter = createRateLimiter({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX });

// メモリ肥大を防ぐため、古い記録を定期的に掃除する
setInterval(() => rateLimiter.sweep(), RATE_LIMIT_WINDOW_MS).unref();

export function aiRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const { allowed, retryAfterSec } = rateLimiter.check(ip);

  if (!allowed) {
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: `リクエストが多すぎます。${retryAfterSec}秒ほど待ってから再度お試しください。`
    });
  }

  next();
}

// ───────────────────────────────────────────────────────────
// サーバー全体のGemini呼び出し予算（1時間あたりの上限）
// IP単位のレート制限は多数のIPに分散した攻撃(プロキシ/ボットネット)には
// 効かないため、全体の呼び出し回数にも上限を設けてAPI課金の暴走を防ぐ。
// 上限超過時は getGeminiClient が例外を投げ、各エンドポイントの
// 既存のcatch節がローカルフォールバック応答に切り替える（ユーザーには
// 「一時的な自動調整モード」として振る舞い、サービス自体は継続する）。
// ───────────────────────────────────────────────────────────
const GEMINI_BUDGET_WINDOW_MS = 60 * 60 * 1000; // 1時間
const GEMINI_HOURLY_BUDGET = Math.max(1, Number(process.env.GEMINI_HOURLY_BUDGET) || 600);
const geminiBudget = createBudget({ windowMs: GEMINI_BUDGET_WINDOW_MS, limit: GEMINI_HOURLY_BUDGET });

export function consumeGeminiBudget(): void {
  geminiBudget.consume();
}

// Gemini API の安全な初期化
let ai: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  // 呼び出しごとに全体予算を消費する（超過時はここで例外 → 各エンドポイントのフォールバックへ）
  consumeGeminiBudget();
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      // 開発中、APIキーが設定されていない場合でもクラッシュさせず穏やかにエラー返却できるようにする
      console.warn("警告: GEMINI_API_KEY がセットされていません。AI機能はモックモード、またはエラー応答になります。");
    }
    ai = new GoogleGenAI({
      apiKey: key || "DUMMY_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}
