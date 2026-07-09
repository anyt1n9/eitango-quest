import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { PREBAKED_WORD_IMAGES } from "./src/data/wordImages";

dotenv.config();

const app = express();

// Render/Cloud Run などのリバースプロキシ配下では、実クライアントのIPは
// X-Forwarded-For ヘッダに入る。これを信頼して req.ip を正しく解決する
// （レート制限をIP単位で機能させるために必須。信頼しないと全員が同一IP扱いになる）
app.set("trust proxy", 1);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// デプロイ環境(Cloud Run など)は PORT 環境変数でリッスンするポートを指定するため、それを優先する
const PORT = Number(process.env.PORT) || 3000;

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
const rateLimitBuckets = new Map<string, number[]>();

// メモリ肥大を防ぐため、古いバケットを定期的に掃除する
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitBuckets) {
    const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (recent.length === 0) {
      rateLimitBuckets.delete(ip);
    } else {
      rateLimitBuckets.set(ip, recent);
    }
  }
}, RATE_LIMIT_WINDOW_MS).unref();

function aiRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const timestamps = (rateLimitBuckets.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= RATE_LIMIT_MAX) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldest)) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(429).json({
      error: `リクエストが多すぎます。${retryAfterSec}秒ほど待ってから再度お試しください。`
    });
  }

  timestamps.push(now);
  rateLimitBuckets.set(ip, timestamps);
  next();
}

// すべての /api/gemini/* エンドポイントにレート制限を適用（ルート定義より前に置く）
app.use("/api/gemini", aiRateLimiter);

// Gemini API の安全な初期化
let ai: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
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

// 1. API: 新しい単語を分析・生成
app.post("/api/gemini/generate-word", async (req, res) => {
  const { word } = req.body;
  if (!word || typeof word !== "string" || word.trim() === "") {
    return res.status(400).json({ error: "英単語が正しく指定されていません。" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // APIキーがない場合のフォールバック（動作保証用）
    return res.json({
      id: "ai_" + Date.now(),
      word: word.trim(),
      translation: "AI生成の訳 (仮)",
      level: "senior",
      options: ["AI生成の訳 (仮)", "無関係の選択肢1", "無関係の選択肢2", "無関係の選択肢3"],
      sentence: `This is an example sentence featuring the word [_____].`,
      sentenceTranslation: `これは単語「${word.trim()}」を使用した例文です。`,
      sentenceOptions: [word.trim(), "create", "observe", "reject"]
    });
  }

  try {
    const client = getGeminiClient();
    const prompt = `分析対象の英単語: "${word.trim()}"

この英単語について、以下の各項目を含む完全なJSONを出荷してください:
1. translation (日本語訳、代表的な意味を簡潔に、例: "～を達成する")
2. level ("junior" | "senior" | "senior2" | "senior3" | "advanced" のいずれかに分類。中学生、高校1年生、高校2年生、高校3年生、大学生・社会人レベルの目安)
3. options (日本語訳の4択選択肢。正解(translationと完全に一致するもの)が配列に必ず含まれ、他の3つの選択肢は混同しやすい、または一般的な日本語訳であること。順序はランダムにシャッフルして格納してください。)
4. sentence (この単語を使用した1文の英語例文。ただし対象の英単語の部分は "[_____]" (半角の角括弧とアンダースコア5つ) に完全に置き換えて穴埋め問題にしてください。)
5. sentenceTranslation (その英文の日本語訳)
6. sentenceOptions (英文の穴埋めクイズ用の4択。正解(対象単語)が必ず含まれ、品詞が同じで文法的に当てはまりやすそうな他の英単語3つを厳選して格納してください。対象単語を含む全4つの単語が入った配列とし、ランダムにシャッフルしてください。)
7. pos (この単語の代表的な品詞。"verb" | "noun" | "adjective" | "adverb" | "other" のいずれか)

必ず有効なJSONオブジェクトのみを返却し、マークダウンの \`\`\`json などのタグも使用しないでください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["translation", "level", "options", "sentence", "sentenceTranslation", "sentenceOptions", "pos"],
          properties: {
            translation: { type: Type.STRING, description: "Japansese main translation" },
            level: { type: Type.STRING, description: "junior or senior or senior2 or senior3 or advanced" },
            pos: { type: Type.STRING, description: "part of speech: verb or noun or adjective or adverb or other" },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4 translation options in Japanese, must include translating string"
            },
            sentence: { type: Type.STRING, description: "English sentence with target word replaced by [_____]" },
            sentenceTranslation: { type: Type.STRING, description: "Japanese translation of the sentence" },
            sentenceOptions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4 english vocabulary options for filling, must include target word"
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini");
    }

    const data = JSON.parse(text.trim());
    // クライアントで一意に特定できるIDを追加
    data.id = "ai_" + Math.random().toString(36).substr(2, 9);
    data.word = word.trim();
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Generate Word Error: ", error);
    console.warn("AI単語生成に失敗したため、ローカルフォールバックモードで動作します。(429などのクォータ制限対策)");
    return res.json({
      id: "ai_" + Math.random().toString(36).substr(2, 9),
      word: word.trim(),
      translation: `「${word.trim()}」の意味を学ぶ (ローカル)`,
      level: "senior",
      options: [`「${word.trim()}」の意味を学ぶ (ローカル)`, "～を実行する", "～を観察する", "～を拒否する"],
      sentence: `This is an example sentence featuring the word [_____].`,
      sentenceTranslation: `これは英単語「${word.trim()}」を含む例文です。`,
      sentenceOptions: [word.trim(), "create", "observe", "reject"],
      isFallback: true
    });
  }
});

// 1.5. API: 単語のつながりマップ＆派生語パズルの作成
app.post("/api/gemini/connection-map", async (req, res) => {
  const { word } = req.body;
  if (!word || typeof word !== "string" || word.trim() === "") {
    return res.status(400).json({ error: "英単語が正しく指定されていません。" });
  }

  const queryWord = word.trim().toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // APIキーがない場合の賢いモックフォールバック（動作保証用）
    const isActRelated = queryWord.includes("act") || queryWord.includes("play");
    const mockedConnections = isActRelated ? [
      { word: "act", type: "動詞/名詞", meaning: "行動する、演じる/舞台の幕", connectionReason: "パズルの基本となる行動のコアルートです。" },
      { word: "action", type: "名詞", meaning: "行動、活動、働き", connectionReason: "act に名詞尾 -ion が結合し、継続的な活動を意味します。" },
      { word: "activate", type: "動詞", meaning: "活性化する、起動する", connectionReason: "active に「～化する」を意味する -ate が結合した進化的動詞。" },
      { word: "transaction", type: "名詞", meaning: "取引、処理、やり取り", connectionReason: "trans-(横切って、相互に) + action(行動) = 互いの間で行われる商取引手続き。" },
      { word: "interaction", type: "名詞", meaning: "相互作用、交流", connectionReason: "inter-(～の間で) + action(行動) = 関係者が互いに影響を及ぼしあうこと。" }
    ] : [
      { word: queryWord, type: "キー単語", meaning: "探索の基点", connectionReason: "分析のメインとして指定された英単語。" },
      { word: "construct", type: "動詞", meaning: "組み立てる、建設する", connectionReason: "ルーツ「struere (積み重ねる、建てる)」を同じくする代表語。" },
      { word: "structure", type: "名詞", meaning: "構造、構成物、建物", connectionReason: "ラテン語「建てる」から直接名詞化され、骨組みを示します。" },
      { word: "instruct", type: "動詞", meaning: "指示する、教える", connectionReason: "in-(〜の中に) + struct(組み立てる) ＝ 知の建築。" },
      { word: "destruction", type: "名詞", meaning: "破壊、非建設", connectionReason: "de-(下へ、引き剥がす) + struct(組み立てる) ＝ 既存建築の崩壊。" }
    ];

    const mockedPuzzle = isActRelated ? [
      { word: "act", partOfSpeech: "動詞", meaning: "行動する、演じる", masked: false },
      { word: "action", partOfSpeech: "名詞", meaning: "行動、活動", masked: true },
      { word: "active", partOfSpeech: "形容詞", meaning: "活動的な、積極的な", masked: false },
      { word: "activity", partOfSpeech: "名詞", meaning: "活動、活気", masked: true },
      { word: "activate", partOfSpeech: "動詞", meaning: "活性化する、起動する", masked: true }
    ] : [
      { word: "construct", partOfSpeech: "動詞", meaning: "組み立てる、建設する", masked: false },
      { word: "construction", partOfSpeech: "名詞", meaning: "建設、工事", masked: true },
      { word: "constructive", partOfSpeech: "形容詞", meaning: "建設的な、前向きな", masked: true },
      { word: "reconstruct", partOfSpeech: "動詞", meaning: "再建する、再現する", masked: false },
      { word: "reconstruction", partOfSpeech: "名詞", meaning: "再建、復興", masked: true }
    ];

    return res.json({
      focusWord: word.trim(),
      connections: mockedConnections,
      puzzle: mockedPuzzle,
      distractors: isActRelated 
        ? ["acting", "actor", "activation", "inactive"]
        : ["constructively", "constructor", "structural", "deconstruct"]
    });
  }

  try {
    const client = getGeminiClient();
    const prompt = `分析対象の英単語: "${word.trim()}"

この単語から広がる「① 単語のつながりマップ」と「② 関連する品詞・ルーツをつなげる派生語パズル」に関するJSONデータを出荷してください。

① 単語のつながりマップ (Connections Map):
対象単語(または代表的な同一語源や強く意味関連した単語)をスタートとし、語源（接頭辞・接尾辞、ラテン・ギリシャ語源など）や意味関係の展開に沿って、有機的につながる英単語を5つの連続ステップで作成してください（例: construct → structure → instruct → destruction → constructive のような展開）。
品詞や意味、なぜその単語が繋がっているのかの納得感ある「解説理由(connectionReason)」を付加してください。1ステップ目は必ず、指定された対象単語 or 語源の中心単語にしてください。

② 派生語パズル (Word Derivative Puzzle):
対象単語そのもの、もしく密接な基本根から始まる、語幹が共通で品詞が切り替わる派生語の「ステップ配列（4〜5語）」を綺麗に構築してください（例: act → action → active → activity → activate）。
各要素には（word, partOfSpeech: 品詞名称("動詞"|"名詞"|"形容詞"|"副詞"など), meaning: 日本語訳, masked: ユーザーに当ててもらう箇所かどうかの真偽値）を含めてください。
配列中、必ず2つ〜3つの要素で 「masked: true」を設定してください。品詞が程よくばらける位置をマスクすると効果的です。
また、ユーザーがそのマスクされた空欄を選ぶための選択肢として「distractors（パズルの答え候補に混ぜる、ひっかけ用の本物の派生形英単語・関連語）」を3〜4つ配列で追加してください。

必ず有効なJSONオブジェクトのみを返却し、マークダウンの \`\`\`json などのタグも使用しないでください。また、エラーなくデコード可能に整形してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["focusWord", "connections", "puzzle", "distractors"],
          properties: {
            focusWord: { type: Type.STRING },
            connections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["word", "type", "meaning", "connectionReason"],
                properties: {
                  word: { type: Type.STRING, description: "Spelled connected word" },
                  type: { type: Type.STRING, description: "e.g. root/verb/noun/etc" },
                  meaning: { type: Type.STRING, description: "Brief translation in Japanese" },
                  connectionReason: { type: Type.STRING, description: "Why this word attaches to previous in Japanese" }
                }
              }
            },
            puzzle: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["word", "partOfSpeech", "meaning", "masked"],
                properties: {
                  word: { type: Type.STRING },
                  partOfSpeech: { type: Type.STRING },
                  meaning: { type: Type.STRING },
                  masked: { type: Type.BOOLEAN }
                }
              }
            },
            distractors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini for connection map");
    }

    const data = JSON.parse(text.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Connection Map Error: ", error);
    console.warn("つながりマップ生成に失敗したため、ローカルフォールバックモードで動作します。");
    const isActRelated = queryWord.includes("act") || queryWord.includes("play");
    const mockedConnections = isActRelated ? [
      { word: "act", type: "動詞/名詞", meaning: "行動する、演じる/舞台の幕", connectionReason: "パズルの基本となる行動のコアルートです。" },
      { word: "action", type: "名詞", meaning: "行動、活動、働き", connectionReason: "act に名詞尾 -ion が結合し、継続的な活動を意味します。" },
      { word: "activate", type: "動詞", meaning: "活性化する、起動する", connectionReason: "active に「～化する」を意味する -ate が結合した進化的動詞。" },
      { word: "transaction", type: "名詞", meaning: "取引、処理、やり取り", connectionReason: "trans-(横切って、相互に) + action(行動) = 互いの間で行われる商取引手続き。" },
      { word: "interaction", type: "名詞", meaning: "相互作用、交流", connectionReason: "inter-(～の間で) + action(行動) = 関係者が互いに影響を及ぼしあうこと。" }
    ] : [
      { word: queryWord, type: "キー単語", meaning: "探索の基点", connectionReason: "分析のメインとして指定された英単語。" },
      { word: "construct", type: "動詞", meaning: "組み立てる、建設する", connectionReason: "ルーツ「struere (積み重ねる、建てる)」を同じくする代表語。" },
      { word: "structure", type: "名詞", meaning: "構造、構成物、建物", connectionReason: "ラテン語「建てる」から直接名詞化され、骨組みを示します。" },
      { word: "instruct", type: "動詞", meaning: "指示する、教える", connectionReason: "in-(〜の中に) + struct(組み立てる) ＝ 知の建築。" },
      { word: "destruction", type: "名詞", meaning: "破壊、非建設", connectionReason: "de-(下へ、引き剥がす) + struct(組み立てる) ＝ 既存建築の崩壊。" }
    ];

    const mockedPuzzle = isActRelated ? [
      { word: "act", partOfSpeech: "動詞", meaning: "行動する、演じる", masked: false },
      { word: "action", partOfSpeech: "名詞", meaning: "行動、活動", masked: true },
      { word: "active", partOfSpeech: "形容詞", meaning: "活動的な、積極的な", masked: false },
      { word: "activity", partOfSpeech: "名詞", meaning: "活動、活気", masked: true },
      { word: "activate", partOfSpeech: "動詞", meaning: "活性化する、起動する", masked: true }
    ] : [
      { word: "construct", partOfSpeech: "動詞", meaning: "組み立てる、建設する", masked: false },
      { word: "construction", partOfSpeech: "名詞", meaning: "建設、工事", masked: true },
      { word: "constructive", partOfSpeech: "形容詞", meaning: "建設的な、前向きな", masked: true },
      { word: "reconstruct", partOfSpeech: "動詞", meaning: "再建する、再現する", masked: false },
      { word: "reconstruction", partOfSpeech: "名詞", meaning: "再建、復興", masked: true }
    ];

    return res.json({
      focusWord: word.trim(),
      connections: mockedConnections,
      puzzle: mockedPuzzle,
      distractors: isActRelated 
        ? ["acting", "actor", "activation", "inactive"]
        : ["constructively", "constructor", "structural", "deconstruct"],
      isFallback: true
    });
  }
});

// 1.8. API: 単語の使用頻度分析
app.post("/api/gemini/word-frequency", async (req, res) => {
  const { word } = req.body;
  if (!word || typeof word !== "string" || word.trim() === "") {
    return res.status(400).json({ error: "英単語が正しく指定されていません。" });
  }

  const queryWord = word.trim().toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // 語尾ヒューリスティックの擬似データを本物のAI分析のように返さない
    return res.status(503).json({ error: "AI頻度分析にはGemini APIキーの設定が必要です。" });
  }

  try {
    const client = getGeminiClient();
    const prompt = `分析対象の英単語: "${word.trim()}"
この英単語の使用頻度（1〜5点、everyday, academic, businessの各文脈）と、その簡単な理由説明、全体コメント、および各文脈での例文と日本語訳をJSON形式で返却してください。

JSON形式:
{
  "word": "${word.trim()}",
  "frequencies": {
    "everyday": { "score": 3, "percentage": 60, "label": "普通", "description": "日常会話での説明" },
    "academic": { "score": 4, "percentage": 80, "label": "高い", "description": "学術的な説明" },
    "business": { "score": 4, "percentage": 80, "label": "高い", "description": "ビジネスでの説明" }
  },
  "overallComment": "全体のコメント説明",
  "usageExamples": {
    "everyday": { "sentence": "Everyday English sentence with standard spelling and structure", "translation": "日本語訳" },
    "academic": { "sentence": "Academic English sentence", "translation": "日本語訳" },
    "business": { "sentence": "Business English sentence", "translation": "日本語訳" }
  }
}

注意事項: マークダウンの \`\`\`json タグなどを一切付加せず、純粋なJSONオブジェクトのみを返却してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["word", "frequencies", "overallComment", "usageExamples"],
          properties: {
            word: { type: Type.STRING },
            frequencies: {
              type: Type.OBJECT,
              required: ["everyday", "academic", "business"],
              properties: {
                everyday: {
                  type: Type.OBJECT,
                  required: ["score", "percentage", "label", "description"],
                  properties: {
                    score: { type: Type.INTEGER },
                    percentage: { type: Type.INTEGER },
                    label: { type: Type.STRING },
                    description: { type: Type.STRING }
                  }
                },
                academic: {
                  type: Type.OBJECT,
                  required: ["score", "percentage", "label", "description"],
                  properties: {
                    score: { type: Type.INTEGER },
                    percentage: { type: Type.INTEGER },
                    label: { type: Type.STRING },
                    description: { type: Type.STRING }
                  }
                },
                business: {
                  type: Type.OBJECT,
                  required: ["score", "percentage", "label", "description"],
                  properties: {
                    score: { type: Type.INTEGER },
                    percentage: { type: Type.INTEGER },
                    label: { type: Type.STRING },
                    description: { type: Type.STRING }
                  }
                }
              }
            },
            overallComment: { type: Type.STRING },
            usageExamples: {
              type: Type.OBJECT,
              required: ["everyday", "academic", "business"],
              properties: {
                everyday: {
                  type: Type.OBJECT,
                  required: ["sentence", "translation"],
                  properties: {
                    sentence: { type: Type.STRING },
                    translation: { type: Type.STRING }
                  }
                },
                academic: {
                  type: Type.OBJECT,
                  required: ["sentence", "translation"],
                  properties: {
                    sentence: { type: Type.STRING },
                    translation: { type: Type.STRING }
                  }
                },
                business: {
                  type: Type.OBJECT,
                  required: ["sentence", "translation"],
                  properties: {
                    sentence: { type: Type.STRING },
                    translation: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini for frequency analysis");
    }

    const data = JSON.parse(text.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Frequency analysis Error: ", error);
    console.warn("単語頻度分析に失敗したため、語尾パターンによる簡易推定を返します。");
    const len = queryWord.length;
    const isAcademic = len > 8 || queryWord.endsWith("tion") || queryWord.endsWith("ity") || queryWord.endsWith("ive") || queryWord.includes("struct");
    const isBusiness = queryWord.includes("act") || queryWord.includes("project") || queryWord.includes("strategy") || queryWord.includes("meet") || queryWord.includes("sign") || queryWord.includes("serve") || queryWord.includes("offer") || queryWord.includes("press");

    const everydayScore = isAcademic ? 2 : 4;
    const academicScore = isAcademic ? 5 : 2;
    const businessScore = isBusiness ? 5 : (isAcademic ? 3 : 2);
    const estimateNote = "（綴りの語尾パターンからの簡易推定值であり、AIによる分析ではありません）";

    return res.json({
      word: word.trim(),
      frequencies: {
        everyday: {
          score: everydayScore,
          percentage: everydayScore * 20,
          label: everydayScore >= 4 ? "高い(推定)" : (everydayScore >= 3 ? "普通(推定)" : "低い(推定)"),
          description: `日常会話で使用される頻度の簡易推定です${estimateNote}。`
        },
        academic: {
          score: academicScore,
          percentage: academicScore * 20,
          label: academicScore >= 4 ? "高い(推定)" : (academicScore >= 3 ? "普通(推定)" : "低い(推定)"),
          description: `学術文献・講義での頻度の簡易推定です${estimateNote}。`
        },
        business: {
          score: businessScore,
          percentage: businessScore * 20,
          label: businessScore >= 4 ? "高い(推定)" : (businessScore >= 3 ? "普通(推定)" : "低い(推定)"),
          description: `ビジネス文脈での頻度の簡易推定です${estimateNote}。`
        }
      },
      overallComment: `AI分析に接続できなかったため、綴りの語尾パターンにもとづく簡易推定を表示しています。正確な頻度分析を見るには、時間をおいて「再分析」をお試しください。`,
      usageExamples: {
        everyday: {
          sentence: `I'll try to find a natural way to use "${word.trim()}" in daily chat.`,
          translation: `日常会話の中で「${word.trim()}」を自然に使う方法を探してみるよ。（汎用の例文です）`
        },
        academic: {
          sentence: `This study focuses primarily on the analytical factors surrounding "${word.trim()}".`,
          translation: `この研究は主に「${word.trim()}」を取り巻く分析的要因に焦点を当てています。（汎用の例文です）`
        },
        business: {
          sentence: `We need to analyze how we can leverage "${word.trim()}" in our operations.`,
          translation: `私たちは業務の中で「${word.trim()}」をいかに活用できるかを分析する必要があります。（汎用の例文です）`
        }
      },
      isFallback: true
    });
  }
});

// 2. API: 学習アドバイスの作成
app.post("/api/gemini/advice", async (req, res) => {
  const { juniorStats, seniorStats, senior2Stats, senior3Stats, advancedStats, wrongWordsCount } = req.body;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const defaultAdvice = `### 🎉 AI学習アドバイスへようこそ！

現在、**中学生レベル**は習得度高めですが、**高校レベル以上**の難単語に挑戦すると語彙力アップの伸びしろが大きく広がります。

**💡 今後のおすすめ勉強法:**
- 新規の単語クイズを毎日10〜20問続け、知っている単語を増やしましょう。
- 「間違えた単語の復習」タブに現在 **${wrongWordsCount || 0} 個** 溜まっています。ここを空っぽにすることを最初の目標にして繰り返してください。
- 覚えた単語が200語を超えると、**「AI英語日記モード」**が自動開放されます！学んだ単語を日常エッセイで使い切る快感をぜひ体験してください。`;
    return res.json({ advice: defaultAdvice });
  }

  try {
    const client = getGeminiClient();
    const prompt = `進捗スタッツ:
- 中学生レベル: 正解数 ${juniorStats.correct}/${juniorStats.total} (${juniorStats.rate}%)
- 高校1年生レベル: 正解数 ${seniorStats.correct}/${seniorStats.total} (${seniorStats.rate}%)
- 高校2年生レベル: 正解数 ${senior2Stats.correct}/${senior2Stats.total} (${senior2Stats.rate}%)
- 高校3年生レベル: 正解数 ${senior3Stats.correct}/${senior3Stats.total} (${senior3Stats.rate}%)
- 大学生・社会人レベル: 正解数 ${advancedStats.correct}/${advancedStats.total} (${advancedStats.rate}%)
- 現在登録されている、間違えた単語(復習が必要な単語)の数: ${wrongWordsCount}個

アドバイスの仕様:
- 挨拶と、現在の進捗に対する温かいフィードバック。
- 得意そうなレベルと、改善のための具体的な英単語学習テクニック。
- 学びを楽しく継続するための応援メッセージ。
- 親しみやすい、インテリジェントな英語学習マスターのトーン(先生風)で回答して。
- 150〜200文字程度で、Markdown形式に整形してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ advice: response.text || "アドバイスの生成に失敗しました。" });
  } catch (error: any) {
    console.error("Gemini Advice Error: ", error);
    console.warn("AIアドバイスの生成に失敗したため、ローカルフォールバックデータを使用します。");
    const defaultAdvice = `### 🎉 AI学習アドバイスへようこそ！ (ローカルAI)
    
現在、**中学生レベル**は習得度高めですが、**高校レベル以上**の難単語に挑戦すると語彙力アップの伸びしろが大きく広がります。

**💡 今後のおすすめ勉強法:**
- 新規 of 単語クイズを毎日10〜20問続け、知っている単語を増やしましょう。
- 「間違えた単語の復習」タブに現在 **${wrongWordsCount || 0} 個** 溜まっています。ここを空っぽにすることを最初の目標にして繰り返してください。
- 覚えた単語が200語を超えると、**「AI英語日記モード」**が自動開放されます！学んだ単語を日常エッセイで使い切る快感をぜひ体験してください。 (APIクォータ制限のため一時的なローカル補助を表示しています)`;
    return res.json({ advice: defaultAdvice, isFallback: true });
  }
});

// 1.85. API: 間違えた単語の傾向から弱点分野を自動分析
const POS_JP_LABELS: Record<string, string> = {
  verb: "動詞",
  noun: "名詞",
  adjective: "形容詞",
  adverb: "副詞",
  other: "その他"
};

function heuristicPosStats(words: { word: string; pos?: string }[]) {
  const counts: Record<string, number> = { "動詞": 0, "名詞": 0, "形容詞": 0, "副詞": 0, "その他": 0 };
  for (const w of words) {
    // クライアントが品詞を明示してきた場合はそれを優先する
    if (w.pos && POS_JP_LABELS[w.pos]) {
      counts[POS_JP_LABELS[w.pos]]++;
      continue;
    }
    const lw = w.word.toLowerCase();
    if (lw.endsWith("ly")) counts["副詞"]++;
    else if (lw.endsWith("tion") || lw.endsWith("ity") || lw.endsWith("ment") || lw.endsWith("ness")) counts["名詞"]++;
    else if (lw.endsWith("ive") || lw.endsWith("ous") || lw.endsWith("al") || lw.endsWith("ful")) counts["形容詞"]++;
    else if (lw.endsWith("ed") || lw.endsWith("ing") || lw.endsWith("ize") || lw.endsWith("ise")) counts["動詞"]++;
    else counts["その他"]++;
  }
  const total = words.length || 1;
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count, percentage: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function buildFallbackWeaknessAnalysis(words: { word: string }[]) {
  const partOfSpeechStats = heuristicPosStats(words);
  const topPos = partOfSpeechStats[0];
  return {
    summary: topPos
      ? `間違えた単語の中では「${topPos.label}」が最も多く(${topPos.percentage}%)、ここが伸びしろのポイントです。`
      : "分析できる間違えた単語がまだ十分にありません。",
    partOfSpeechStats,
    topicStats: [{ label: "総合", count: words.length, percentage: 100 }],
    recommendations: [
      "間違えた単語の復習リストを毎日少しずつ解き、定着させましょう。",
      "似た品詞の単語をまとめて覚えると、語形の違いを整理しやすくなります。",
      "例文ごと音読して、単語を文脈の中で覚える習慣をつけましょう。"
    ],
    isFallback: true
  };
}

app.post("/api/gemini/weakness-analysis", async (req, res) => {
  const { wrongWords } = req.body;
  if (!Array.isArray(wrongWords) || wrongWords.length === 0) {
    return res.status(400).json({ error: "分析対象の間違えた単語がありません。" });
  }

  const sample = wrongWords.slice(0, 60);
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.json(buildFallbackWeaknessAnalysis(sample));
  }

  try {
    const client = getGeminiClient();
    const list = sample
      .map((w: any, i: number) => {
        const posHint = w.pos && POS_JP_LABELS[w.pos] ? ` [品詞: ${POS_JP_LABELS[w.pos]}]` : "";
        return `${i + 1}. ${w.word} (${w.translation || ""})${posHint}`;
      })
      .join("\n");

    const prompt = `以下は、あるユーザーが英単語クイズで間違えた単語の一覧です(${wrongWords.length}語中、代表${sample.length}語を抜粋)。

${list}

これらの単語を分析し、以下を行ってください:
1. 各単語の品詞(動詞・名詞・形容詞・副詞・その他)を判定し、品詞ごとの出現数と割合(%、合計100前後になるように整数で)を集計する。
2. 各単語が属する分野・テーマ(例: 学術, ビジネス, 日常会話, 感情表現, 抽象概念など、実態に即して自由に命名してよい)を判定し、分野ごとの出現数と割合(%、合計100前後になるように整数で)を集計する。
3. 上記の集計結果から見える、このユーザーの英単語学習における「弱点」を1〜2文で明確に要約する。
4. その弱点を克服するための具体的な学習アドバイスを3つ、箇条書きで提案する。

JSON形式で返却してください。マークダウンの \`\`\`json タグなどを一切付加せず、純粋なJSONオブジェクトのみを返却してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["summary", "partOfSpeechStats", "topicStats", "recommendations"],
          properties: {
            summary: { type: Type.STRING },
            partOfSpeechStats: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["label", "count", "percentage"],
                properties: {
                  label: { type: Type.STRING },
                  count: { type: Type.INTEGER },
                  percentage: { type: Type.INTEGER }
                }
              }
            },
            topicStats: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["label", "count", "percentage"],
                properties: {
                  label: { type: Type.STRING },
                  count: { type: Type.INTEGER },
                  percentage: { type: Type.INTEGER }
                }
              }
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini for weakness analysis");
    }

    const data = JSON.parse(text.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Weakness Analysis Error: ", error);
    console.warn("弱点分析に失敗したため、ローカルフォールバックモードで動作します。");
    res.json(buildFallbackWeaknessAnalysis(sample));
  }
});

// 1.86. API: 類義語・反意語・コロケーションの分析
app.post("/api/gemini/word-relations", async (req, res) => {
  const { word, translation } = req.body;
  if (!word || typeof word !== "string" || word.trim() === "") {
    return res.status(400).json({ error: "英単語が正しく指定されていません。" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "類義語・反意語の分析にはGemini APIキーの設定が必要です。" });
  }

  try {
    const client = getGeminiClient();
    const prompt = `分析対象の英単語: "${word.trim()}"${translation ? `（日本語訳: ${translation}）` : ""}

この英単語について、上級英語学習者向けに以下をJSON形式で返却してください:
1. synonyms: 類義語を2〜4個。各要素は { "word": 英単語, "translation": 日本語訳, "nuance": 対象単語との使い分け・ニュアンスの違いの簡潔な説明(日本語) }
2. antonyms: 反意語を1〜3個。各要素は { "word": 英単語, "translation": 日本語訳 }。明確な反意語が存在しない場合は空配列。
3. collocations: この単語を使った頻出コロケーション（よく一緒に使われる語の組み合わせ）を3〜5個。各要素は { "phrase": 英語フレーズ, "translation": 日本語訳 }

実際の英語で自然に使われるもののみを厳選してください。
マークダウンの \`\`\`json タグなどを一切付加せず、純粋なJSONオブジェクトのみを返却してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["synonyms", "antonyms", "collocations"],
          properties: {
            synonyms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["word", "translation", "nuance"],
                properties: {
                  word: { type: Type.STRING },
                  translation: { type: Type.STRING },
                  nuance: { type: Type.STRING }
                }
              }
            },
            antonyms: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["word", "translation"],
                properties: {
                  word: { type: Type.STRING },
                  translation: { type: Type.STRING }
                }
              }
            },
            collocations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["phrase", "translation"],
                properties: {
                  phrase: { type: Type.STRING },
                  translation: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini for word relations");
    }

    const data = JSON.parse(text.trim());
    data.word = word.trim();
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Word Relations Error: ", error);
    res.status(502).json({ error: "類義語・反意語の分析に失敗しました。時間をおいて再度お試しください。" });
  }
});

// 1.87. API: レベル別のオリジナル英語長文（理解度チェック付き）をAIが生成
app.post("/api/gemini/generate-passage", async (req, res) => {
  const { level } = req.body;
  const validLevels = ["junior", "senior", "senior2", "senior3", "advanced"];
  if (!level || !validLevels.includes(level)) {
    return res.status(400).json({ error: "レベルが正しく指定されていません。" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: "AI長文の生成にはGemini APIキーの設定が必要です。" });
  }

  const levelInfo: Record<string, { label: string; cefr: string; reward: number; words: string }> = {
    junior: { label: "中学生", cefr: "A1-A2", reward: 50, words: "80〜120語" },
    senior: { label: "高校1年生", cefr: "A2-B1", reward: 60, words: "100〜150語" },
    senior2: { label: "高校2年生", cefr: "B1", reward: 70, words: "120〜180語" },
    senior3: { label: "高校3年生", cefr: "B2", reward: 80, words: "150〜220語" },
    advanced: { label: "大学生・社会人", cefr: "C1-C2", reward: 100, words: "180〜260語" }
  };
  const info = levelInfo[level];

  try {
    const client = getGeminiClient();
    const prompt = `あなたは英語教材の作成者です。日本の${info.label}レベル(CEFR ${info.cefr})の英語学習者向けに、オリジナルの英語長文読解教材を1つ作成してください。

要件:
1. title: 英語のタイトル（魅力的で内容を表すもの）
2. englishParagraphs: 英語本文を2〜3段落の配列で。合計${info.words}程度。このレベルの学習者が知っているべき語彙を中心に、少し挑戦的な重要単語を5〜8個自然に織り込むこと。
3. japaneseParagraphs: 各英語段落に対応する自然な日本語訳の配列（englishParagraphsと同じ要素数）。
4. vocabularyHighlight: 本文中に登場する、このレベルで重要な英単語5〜8個と日本語訳の配列。単語は本文中の表記と完全に一致させること（活用形も本文のまま）。
5. description: この長文の内容と学べる語彙を紹介する日本語の説明文（1〜2文）。
6. questions: 本文の内容理解を問う設問を2〜3問。各設問は日本語で、選択肢(options)は日本語4つ、correctIndexは正解選択肢のインデックス(0〜3)。本文を読まないと答えられない設問にすること。

トピックは日常・科学・文化・歴史・自然などから自由に選び、教育的で前向きな内容にしてください。
マークダウンの \`\`\`json タグなどを一切付加せず、純粋なJSONオブジェクトのみを返却してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "englishParagraphs", "japaneseParagraphs", "vocabularyHighlight", "description", "questions"],
          properties: {
            title: { type: Type.STRING },
            englishParagraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
            japaneseParagraphs: { type: Type.ARRAY, items: { type: Type.STRING } },
            vocabularyHighlight: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["word", "translation"],
                properties: {
                  word: { type: Type.STRING },
                  translation: { type: Type.STRING }
                }
              }
            },
            description: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["question", "options", "correctIndex"],
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctIndex: { type: Type.INTEGER }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini for passage generation");
    }

    const data = JSON.parse(text.trim());
    data.id = "aip_" + Math.random().toString(36).substr(2, 9);
    data.level = level;
    data.pointReward = info.reward;
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Generate Passage Error: ", error);
    res.status(502).json({ error: "AI長文の生成に失敗しました。時間をおいて再度お試しください。" });
  }
});

// 1.9. API: 単語のイメージ（SVGイラスト）の自動生成
// 生成済みSVGのサーバー内キャッシュ。全ユーザーで共有され、同じ単語の再生成を防ぐ
// （プロセス再起動までの間有効。1枚目の生成後は誰が開いても即座に返る）
const wordImageCache = new Map<string, string>();
const WORD_IMAGE_CACHE_MAX = 5000;

/**
 * Geminiが生成したSVG文字列から、フロントエンドで dangerouslySetInnerHTML により
 * そのまま描画しても安全なように危険な要素・属性を除去する。
 * LLM出力は外部入力とみなし、<script>やイベントハンドラ属性によるXSSを防ぐ。
 */
function sanitizeInlineSvg(rawSvg: string): string | null {
  if (typeof rawSvg !== "string" || rawSvg.trim() === "") return null;
  let svg = rawSvg;

  // <script>...</script> を完全に除去
  svg = svg.replace(/<script[\s\S]*?<\/script\s*>/gi, "");
  // 実行可能な埋め込みを許すタグを丸ごと除去
  svg = svg.replace(/<(foreignObject|iframe|object|embed|link|meta)[\s\S]*?<\/\1\s*>/gi, "");
  svg = svg.replace(/<(foreignObject|iframe|object|embed|link|meta)[^>]*\/?>/gi, "");
  // onXxx="..." / onXxx='...' のイベントハンドラ属性を除去
  svg = svg.replace(/\son\w+\s*=\s*"(?:[^"]*)"/gi, "");
  svg = svg.replace(/\son\w+\s*=\s*'(?:[^']*)'/gi, "");
  // href/xlink:href/src が javascript: や data:text/html を指すものを除去
  svg = svg.replace(/\s(?:xlink:href|href|src)\s*=\s*"(?:\s*javascript:|\s*data:text\/html)[^"]*"/gi, "");
  svg = svg.replace(/\s(?:xlink:href|href|src)\s*=\s*'(?:\s*javascript:|\s*data:text\/html)[^']*'/gi, "");
  // <style> 内の expression()/javascript: を含むブロックごと除去（安全性を優先しCSSは失われてもよい）
  svg = svg.replace(/<style[\s\S]*?<\/style\s*>/gi, (block) =>
    /expression\s*\(|javascript:/i.test(block) ? "" : block
  );

  // ルートに <svg ...> タグが存在しない場合は信頼できないため破棄する
  if (!/<svg[\s>]/i.test(svg)) return null;

  return svg;
}

app.post("/api/gemini/word-image-svg", async (req, res) => {
  const { word, meaning } = req.body;
  if (!word || typeof word !== "string" || word.trim() === "") {
    return res.status(400).json({ error: "英単語が正しく指定されていません。" });
  }

  const queryWord = word.trim();
  const cacheKey = queryWord.toLowerCase();

  // 事前生成(手作り)イメージがあれば最優先で即返却（生成待ち・API消費なし）
  const prebaked = PREBAKED_WORD_IMAGES[cacheKey];
  if (prebaked) {
    return res.json({ word: queryWord, svg: prebaked, prebaked: true });
  }

  // キャッシュ命中時は生成せず即返却
  const cachedSvg = wordImageCache.get(cacheKey);
  if (cachedSvg) {
    return res.json({ word: queryWord, svg: cachedSvg, cached: true });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // APIキーがない場合の、美しく、それらしいフラット風SVGフォールバック
    const char = queryWord.charAt(0).toUpperCase();
    const colors = [
      { bg1: "#818cf8", bg2: "#4f46e5", accent: "#fef08a" }, // Indigo
      { bg1: "#34d399", bg2: "#059669", accent: "#fde047" }, // Emerald
      { bg1: "#f59e0b", bg2: "#d97706", accent: "#38bdf8" }, // Amber
      { bg1: "#fb7185", bg2: "#e11d48", accent: "#a7f3d0" }, // Rose
      { bg1: "#a78bfa", bg2: "#7c3aed", accent: "#fbcfe8" }, // Violet
    ];
    // 文字列のハッシュ値からカラーパレットを選択
    let hash = 0;
    for (let i = 0; i < queryWord.length; i++) {
      hash = queryWord.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];

    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="fallbackGrad_${queryWord}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color.bg1}" />
      <stop offset="100%" stop-color="${color.bg2}" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="32" fill="url(#fallbackGrad_${queryWord})" />
  <circle cx="100" cy="100" r="50" fill="#ffffff" opacity="0.1" />
  <circle cx="100" cy="100" r="35" fill="#ffffff" opacity="0.15" />
  <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="76" fill="#ffffff">
    ${char}
  </text>
  <circle cx="45" cy="45" r="6" fill="${color.accent}" opacity="0.8" />
  <circle cx="155" cy="155" r="8" fill="${color.accent}" opacity="0.8" />
  <circle cx="155" cy="45" r="4" fill="#ffffff" opacity="0.6" />
  <circle cx="45" cy="155" r="4" fill="#ffffff" opacity="0.6" />
  <rect x="70" y="142" width="60" height="4" rx="2" fill="#ffffff" opacity="0.4" />
</svg>`;

    return res.json({ word: queryWord, svg: fallbackSvg, isFallback: true });
  }

  try {
    const client = getGeminiClient();
    const prompt = `分析対象の英単語: "${queryWord}" (日本語の意味: ${meaning || "英単語"})

この英単語のビジュアルイメージを直感的に表す、美しく、シンプルでモダンなミニマリスト風のSVGイラスト（Scalable Vector Graphics）を生成してください。

デザイン要件:
1. viewBox は "0 0 200 200" としてください。インラインで伸縮自在にレンダリングされます。
2. 背景には、上品でモダンな角丸長方形（rx="32"）を配置し、目に優しい色合いまたは綺麗な2色のグラデーションを設定してください（例: インディゴからバイオレット、ミントからエメラルド、アンバーからローズなど、スタイリッシュなグラデーション）。
3. 中央に、この英単語の示す意味（例えば「achieve」ならトロフィーや登頂、「observe」なら望遠鏡や目、「innovate」ならひらめく電球など）を象徴する、フラットデザインまたはセミフラット風の、洗練されたSVGパス・シンボルを描写してください。
4. 英単語自体（"${queryWord}"）やその意味を示す文字は、画像内（SVG内）にテキストとして描画しないでください（ビジュアルその目でイメージしてもらうため）。
5. コードはシンプルに保ち、複雑すぎる何万ノードのポリゴン、base64エンコードされた外部の巨大画像、外部フォントなどは含めないでください。標準的な <path>, <circle>, <rect>, <ellipse>, <g>, <defs>, <linearGradient> などの標準SVGタグのみを使用してください。

出力形式の指定:
有効なJSONオブジェクトのみを返却してください。JSONスキーマの "svg" フィールドに、 \`<svg ...>...</svg>\` の生のSVGコード文字列そのものを格納してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["svg"],
          properties: {
            svg: { type: Type.STRING, description: "Raw responsive inline XML SVG string representing the concept of the word" }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini for SVG generation");
    }

    const data = JSON.parse(text.trim());
    const safeSvg = sanitizeInlineSvg(data.svg);
    if (!safeSvg) {
      throw new Error("Gemini returned an SVG that failed safety sanitization");
    }

    // 無害化済みの生成結果のみキャッシュ（フォールバック画像はキャッシュしない）
    if (wordImageCache.size >= WORD_IMAGE_CACHE_MAX) {
      const oldestKey = wordImageCache.keys().next().value;
      if (oldestKey !== undefined) wordImageCache.delete(oldestKey);
    }
    wordImageCache.set(cacheKey, safeSvg);

    res.json({ word: queryWord, svg: safeSvg });
  } catch (error: any) {
    console.error("Gemini SVG Generation Error: ", error);
    console.warn("SVGイメージ自動生成に失敗したため、角丸カードSVGをフォールバックとして出力します。");
    const char = queryWord.charAt(0).toUpperCase();
    const colors = [
      { bg1: "#818cf8", bg2: "#4f46e5", accent: "#fef08a" }, // Indigo
      { bg1: "#34d399", bg2: "#059669", accent: "#fde047" }, // Emerald
      { bg1: "#f59e0b", bg2: "#d97706", accent: "#38bdf8" }, // Amber
      { bg1: "#fb7185", bg2: "#e11d48", accent: "#a7f3d0" }, // Rose
      { bg1: "#a78bfa", bg2: "#7c3aed", accent: "#fbcfe8" }, // Violet
    ];
    let hash = 0;
    for (let i = 0; i < queryWord.length; i++) {
      hash = queryWord.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];

    const fallbackSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%">
  <defs>
    <linearGradient id="fallbackGrad_${queryWord}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color.bg1}" />
      <stop offset="100%" stop-color="${color.bg2}" />
    </linearGradient>
  </defs>
  <rect width="200" height="200" rx="32" fill="url(#fallbackGrad_${queryWord})" />
  <circle cx="100" cy="100" r="50" fill="#ffffff" opacity="0.1" />
  <circle cx="100" cy="100" r="35" fill="#ffffff" opacity="0.15" />
  <text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="'Inter', system-ui, sans-serif" font-weight="900" font-size="76" fill="#ffffff">
    ${char}
  </text>
  <circle cx="45" cy="45" r="6" fill="${color.accent}" opacity="0.8" />
  <circle cx="155" cy="155" r="8" fill="${color.accent}" opacity="0.8" />
  <circle cx="155" cy="45" r="4" fill="#ffffff" opacity="0.6" />
  <circle cx="45" cy="155" r="4" fill="#ffffff" opacity="0.6" />
  <rect x="70" y="142" width="60" height="4" rx="2" fill="#ffffff" opacity="0.4" />
</svg>`;

    return res.json({ word: queryWord, svg: fallbackSvg, isFallback: true });
  }
});

// 3. API: ユーザーの覚えている単語リストに基づいた英語日記の自動生成
app.post("/api/gemini/diary", async (req, res) => {
  const { words } = req.body;
  if (!words || !Array.isArray(words)) {
    return res.status(400).json({ error: "習得した英単語リストがありません。" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // APIキーがない場合の、文脈的に美しく自然に流れる日記のダミーフォールバック
    const sampleWords = words.length > 0 ? words.slice(0, 15) : ["achieve", "collaborate", "constant", "improve", "glorious", "journey", "observe", "active", "creative", "challenge"];
    const diaryText = `It was high time for me to reflect on my daily study and creative challenges. Looking back, I realize that constant efforts are what truly help us achieve our goals. On this glorious learning journey, I always want to stay active, keep improving my skills, and collaborate with inspiring friends from around the world. Every small success we observe along the way is a milestone worth celebrating. Let's keep moving forward with passion!`;
    const diaryTranslation = `日々の学習やクリエイティブな挑戦について振り返る時期がやってきました。振り返ってみると、絶え間ない努力こそが目標を達成するための本当の原動力なのだと気づかされます。この輝かしい学びの旅路において、私は常にアクティブでいたいし、スキルを向上させ続け、世界中の刺激的な友人たちと協力し合いたいと願っています。その途上で私たちが目にする一つひとつの小さな成功こそが、お祝いするに値するマイルストーンです。これからも情熱を持って前へと進み続けましょう！`;
    
    // 実際に使われた単語をマッチ
    const usedWords = words.filter(w => {
      const lower = w.toLowerCase().trim();
      return diaryText.toLowerCase().includes(lower);
    });

    return res.json({
      title: "Reflections on My Learning Journey",
      diaryText: diaryText,
      diaryTranslation: diaryTranslation,
      usedWords: usedWords.length > 0 ? usedWords : sampleWords
    });
  }

  try {
    const client = getGeminiClient();
    const prompt = `あなたは親切で極めて流暢なAI英語コーチです。ユーザーが学習して覚えた以下の英単語のリストから、今日のストーリー展開やシチュエーションに深くマッチする言葉をAIが自由に選抜（目安として少なくとも5〜25語、あるいは可能であればそれ以上）して、それらの単語を文法的に美しく自然に織り交ぜた、1本の読み応えのある素晴らしい日記（エッセイ）を作成してください。

ユーザーが覚えている単語リスト:
${JSON.stringify(words)}

要件:
1. 【最重要・羅列の禁止】: 単語をただリストアップしただけの文や、角括弧の中に並べたような不自然な文面（例: "I learned [word1, word2, word3]" や "Words: word1, word2, word3..." のような不自然な詰め込み方）にするのは【絶対に厳禁】です。各単語がエッセイの中で、主語、目的語、動詞、修飾語などとして完全に自然な文脈の中で呼吸するように使用してください。
2. 【文字数制限の完全撤廃】: 英語日記の長さや文字数の制限（上限・下限）は一切ありません。ストーリーとして驚くほど美しく、情緒豊かで、かつ読み応えのある最高品質の英文を作成してください（短く済ませず、十分にボリュームのある充実した内容にすることを推奨します）。
3. 日記の内容は、ユーザーが毎日の学習を振り返り成長を実感するストーリー、日常生活での感動、将来の夢、旅、仕事、あるいは趣味などに関するポジティブで心温まるトピックにしてください。
4. 日記の中で使用した英単語（スペルの一般的な語尾変化形 -ed, -s, -ing も対象）を 'usedWords' 配列に正確にリストアップして返却してください（原型表記）。
5. 返却されるJSONオブジェクトには以下を含めてください：
   - title: 日記の展開に合う、簡潔で魅力的な英語のタイトル（例: "A Step Toward My Dream"、"Quiet Morning Reflections" など）
   - diaryText: 作成した英語の日記本文。文字数制限なし、羅列感ゼロの自然なエッセイ。
   - diaryTranslation: 日記全体の極めて自然で美しい日本語訳。
   - usedWords: 実際に使用した、ユーザーの覚えている単語リストに由来する英単語の配列（原型表記）。

注意事項: 
マークダウンの \`\`\`json タグなどを一切付加せず、純粋なJSONオブジェクトのみを返却してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "diaryText", "diaryTranslation", "usedWords"],
          properties: {
            title: { type: Type.STRING, description: "Elegant title of the diary entry in English" },
            diaryText: { type: Type.STRING, description: "An extensive, beautifully written English diary entry story incorporating selected words naturally without any length limits" },
            diaryTranslation: { type: Type.STRING, description: "A highly natural and eloquent Japanese translation of the diary text" },
            usedWords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of words from the user's mastered list that were actually incorporated into the text"
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini for diary generation.");
    }

    const data = JSON.parse(text.trim());
    res.json(data);
  } catch (error: any) {
    console.error("Gemini Diary Error: ", error);
    console.warn("AI英語日記の生成に失敗したため（クォータ制限等）、ローカルフォールバックデータを出力します。");
    const sampleWords = words.length > 0 ? words.slice(0, 15) : ["achieve", "collaborate", "constant", "improve", "glorious", "journey", "observe", "active", "creative", "challenge"];
    const diaryText = `It was high time for me to reflect on my daily study and creative challenges. Looking back, I realize that constant efforts are what truly help us achieve our goals. On this glorious learning journey, I always want to stay active, keep improving my skills, and collaborate with inspiring friends from around the world. Every small success we observe along the way is a milestone worth celebrating. Let's keep moving forward with passion!`;
    const diaryTranslation = `日々の学習やクリエイティブな挑戦について振り返る時期がやってきました。振り返ってみると、絶え間ない努力こそが目標を達成するための本当の原動力なのだと気づかされます。この輝かしい学びの旅路において、私は常にアクティブでいたいし、スキルを向上させ続け、世界中の刺激的な友人たちと協力し合いたいと願っています。その途上で私たちが目にする一つひとつの小さな成功こそが、お祝いするに値するマイルストーンです。これからも情熱を持って前へと進み続けましょう！`;
    const usedWords = words.filter(w => {
      const lower = w.toLowerCase().trim();
      return diaryText.toLowerCase().includes(lower);
    });
    return res.json({
      title: "Reflections on My Learning Journey",
      diaryText: diaryText,
      diaryTranslation: diaryTranslation,
      usedWords: usedWords.length > 0 ? usedWords : sampleWords,
      isFallback: true
    });
  }
});

// PDF読み込み時のフォールバック用重要英単語
function getPdfMockWords(): any[] {
  const mockBase = [
    {
      word: "significant",
      translation: "重要な、意義深い",
      level: "senior3",
      options: ["重要な、意義深い", "一時的な", "表面的な", "不十分な"],
      sentence: "The project had a [_____] impact on our environmental footprint.",
      sentenceTranslation: "そのプロジェクトは私たちの環境フットプリントに重要な影響を与えました。",
      sentenceOptions: ["significant", "minor", "synthetic", "vague"]
    },
    {
      word: "evaluate",
      translation: "～を評価する、査定する",
      level: "advanced",
      options: ["～を評価する、査定する", "～を破壊する", "～を無視する", "～を維持する"],
      sentence: "We need more data to [_____] the effectiveness of this system.",
      sentenceTranslation: "このシステムの有効性を評価するためにはさらなるデータが必要です。",
      sentenceOptions: ["evaluate", "demolish", "disregard", "stabilize"]
    },
    {
      word: "infrastructure",
      translation: "社会的基盤、インフラ",
      level: "advanced",
      options: ["社会的基盤、インフラ", "農業、農耕", "娯楽施設", "通信エラー"],
      sentence: "The government is investing heavily in rural communication [_____].",
      sentenceTranslation: "政府は農村部の通信インフラに多大な投資を行っています。",
      sentenceOptions: ["infrastructure", "agriculture", "recreation", "obstacle"]
    },
    {
      word: "analyze",
      translation: "～を分析する",
      level: "senior2",
      options: ["～を分析する", "～を要約する", "～を誇張する", "～を否定する"],
      sentence: "Our research team will [_____] the chemical composition of the water.",
      sentenceTranslation: "私たちの研究チームは水の化学組成を分析する予定です。",
      sentenceOptions: ["analyze", "summarize", "exaggerate", "deny"]
    },
    {
      word: "collaborate",
      translation: "共同で取り組む、協力する",
      level: "senior3",
      options: ["共同で取り組む、協力する", "対立する、喧嘩する", "孤立する", "～を妨害する"],
      sentence: "Scientists around the world [_____] to find a cure for the disease.",
      sentenceTranslation: "世界中の科学者たちがその病気の治療法を見つけるために協力しています。",
      sentenceOptions: ["collaborate", "compete", "isolate", "interfere"]
    },
    {
      word: "comprehensive",
      translation: "包括的な、総合的な",
      level: "advanced",
      options: ["包括的な、総合的な", "部分的な、限定的な", "単純な、初歩的な", "理解困難な"],
      sentence: "The book provides a [_____] guide to organic chemistry.",
      sentenceTranslation: "その本は有機化学への包括的なガイドを提供しています。",
      sentenceOptions: ["comprehensive", "fractional", "elementary", "incomprehensible"]
    },
    {
      word: "acquire",
      translation: "～を獲得する、身につける",
      level: "senior3",
      options: ["～を獲得する、身につける", "～を紛失する", "～を引き渡す", "～を拒絶する"],
      sentence: "It takes years of practice to [_____] a new language perfectly.",
      sentenceTranslation: "新しい言語を完璧に身につけるには、何年もの練習が必要です。",
      sentenceOptions: ["acquire", "abandon", "deliver", "reject"]
    },
    {
      word: "innovation",
      translation: "革新、技術革新",
      level: "senior3",
      options: ["革新、技術革新", "伝統、慣習", "模倣、コピー", "停滞、沈滞"],
      sentence: "Technological [_____] drives economic growth in modern societies.",
      sentenceTranslation: "技術革新は現代社会における経済成長を牽引しています。",
      sentenceOptions: ["innovation", "custom", "imitation", "stagnation"]
    },
    {
      word: "precise",
      translation: "正確な、精密な",
      level: "senior2",
      options: ["正確な、精密な", "曖昧な、適当な", "巨大な", "大まかな"],
      sentence: "The surgeon made a [_____] incision to remove the tumor.",
      sentenceTranslation: "外科医は腫瘍を取り除くために正確な切開を行いました。",
      sentenceOptions: ["precise", "vague", "mammoth", "rough"]
    },
    {
      word: "hypothesis",
      translation: "仮説",
      level: "advanced",
      options: ["仮説", "定説、定説的な事実", "反論、抗議", "実験装置"],
      sentence: "The scientist formulated a [_____] to explain the observed phenomenon.",
      sentenceTranslation: "その科学者は観察された現象を説明するための仮説を立てました。",
      sentenceOptions: ["hypothesis", "dogma", "protest", "apparatus"]
    }
  ];
  return mockBase;
}

// 6. API: PDFファイルからの英単語スマート抽出
app.post("/api/gemini/parse-pdf", async (req, res) => {
  let { pdfBase64 } = req.body;
  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return res.status(400).json({ error: "PDFデータが正しく指定されていません。" });
  }

  // base64のデータスキームプレフィックスを除去
  if (pdfBase64.includes("base64,")) {
    pdfBase64 = pdfBase64.split("base64,")[1];
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("APIキーがないため、PDF解析のフォールバックデータを出力します。");
    const mockWords = getPdfMockWords().map((w, index) => ({
      ...w,
      id: `pdf_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${index}`
    }));
    return res.json({ words: mockWords, isFallback: true });
  }

  try {
    const client = getGeminiClient();
    const prompt = `このPDFドキュメントを詳細に分析し、学習者が覚えるべき重要度や実用性が高い英単語、あるいはPDF内のトピックに関連が深い特徴的な英単語を10〜20語ほど厳選（抽出）してください。

各英単語について、以下の各項目を含む完全なJSONを出荷してください:
1. word (英単語、原形。例: "evaluate", "innovation")
2. translation (代表的な日本語訳を簡潔に、例: "～を評価する")
3. level ("junior" | "senior" | "senior2" | "senior3" | "advanced" のいずれかに分類。中学生、高校1年生、高校2年生、高校3年生、大学生・社会人レベルの目安)
4. options (日本語訳の4択選択肢。正解(translationと完全に一致するもの)が配列に必ず含まれ、他の3つの選択肢は混同しやすい、または一般的な日本語訳であること。順序はランダムにシャッフルして格納してください。)
5. sentence (この単語を使用した1文の英語例文。ただし対象の英単語の部分は "[_____]" (半角の角括弧とアンダースコア5つ) に完全に置き換えて穴埋め問題にしてください。)
6. sentenceTranslation (その英文の日本語訳)
7. sentenceOptions (英文の穴埋めクイズ用の4択。正解(対象単語)が必ず含まれ、品詞が同じで文法的に当てはまりやすそうな他の英単語3つを厳選して格納してください。対象単語を含む全4つの単語が入った配列とし、ランダムにシャッフルしてください。)

必ず [ { "word": ..., "translation": ..., "level": ..., ... }, ... ] のJSON配列形式のみを返却し、マークダウンの \`\`\`json などのタグも使用しないでください。非互換文字などがないよう完全にエスケープされた綺麗なJSONにしてください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            data: pdfBase64,
            mimeType: "application/pdf"
          }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            required: ["word", "translation", "level", "options", "sentence", "sentenceTranslation", "sentenceOptions"],
            properties: {
              word: { type: Type.STRING },
              translation: { type: Type.STRING },
              level: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              sentence: { type: Type.STRING },
              sentenceTranslation: { type: Type.STRING },
              sentenceOptions: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from Gemini for PDF analysis.");
    }

    const words = JSON.parse(text.trim());
    const processedWords = words.map((w: any, index: number) => ({
      ...w,
      id: `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${index}`
    }));

    return res.json({ words: processedWords });

  } catch (error: any) {
    console.error("Gemini PDF Parse Error: ", error);
    console.warn("AI PDF解析に失敗したため、ローカルフォールバックモードで動作します。(429などのクォータ制限対策)");
    const mockWords = getPdfMockWords().map((w, index) => ({
      ...w,
      id: `pdf_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${index}`
    }));
    return res.json({ words: mockWords, isFallback: true });
  }
});


// ExpressサーバーでViteミドルウェア（開発時）の設定、または静的なビルドファイルの配信
async function main() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server is working on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Server execution failed:", err);
});
