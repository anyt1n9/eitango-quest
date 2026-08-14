import express from "express";
import path from "path";
import { Type } from "@google/genai";
import dotenv from "dotenv";
import { sampleArray } from "./src/shuffle";
import { MAX_WORD_LEN, MAX_MEANING_LEN, isValidShortText } from "./server/guards";
import { AdviceInput, LevelStat, buildLocalAdvice, buildAnalysisForPrompt } from "./server/advice";
import { POS_JP_LABELS, buildFallbackWeaknessAnalysis } from "./server/weakness";
import { aiRateLimiter, getGeminiClient } from "./server/gemini";

dotenv.config();

// テストから読み込めるよう app を公開する。
// エンドポイントの入力検証・レート制限・エラー応答は、
// 実際にHTTPで叩かないと「配線されているか」が確かめられない。
export const app = express();

// Render/Cloud Run などのリバースプロキシ配下では、実クライアントのIPは
// X-Forwarded-For ヘッダに入る。これを信頼して req.ip を正しく解決する
// （レート制限をIP単位で機能させるために必須。信頼しないと全員が同一IP扱いになる）
app.set("trust proxy", 1);

// フレームワーク名の露出を避ける（攻撃者への情報提供を減らす）
app.disable("x-powered-by");

// 基本的なセキュリティヘッダ
app.use((_req, res, next) => {
  // Content-Type偽装によるスクリプト実行を防ぐ
  res.setHeader("X-Content-Type-Options", "nosniff");
  // iframe埋め込みによるクリックジャッキングを防ぐ
  res.setHeader("X-Frame-Options", "DENY");
  // 外部サイトへ遷移する際のURL情報の漏えいを抑える
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // 使用しないブラウザ機能を明示的に無効化
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    // Render は常時TLSのため、HTTPへのダウングレードを禁止（180日）
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});

// ボディサイズ制限:
// PDFアップロードだけが大きなボディを必要とするため、そのルートのみ15MBを許可し、
// それ以外は1MBに抑える。以前は全ルート一律50MBで、巨大JSONの連投による
// メモリ枯渇(DoS)の余地があった。
app.use("/api/gemini/parse-pdf", express.json({ limit: "15mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "100kb", extended: true }));

// 入力バリデーション・レート制限・予算上限は server/guards.ts に切り出してある
// （AIの利用料に直結するため、画面や外部通信から独立してテストできる形にした）。

// デプロイ環境(Cloud Run など)は PORT 環境変数でリッスンするポートを指定するため、それを優先する
const PORT = Number(process.env.PORT) || 3000;

// すべての /api/gemini/* エンドポイントにレート制限を適用（ルート定義より前に置く）
app.use("/api/gemini", aiRateLimiter);

/**
 * AI を呼べないときの応答。
 *
 * 以前は generate-word / connection-map / diary / parse-pdf が、
 * APIキーが無いときに**作り置きの中身**を 200 で返していた。
 * 画面はそれを本物のAI出力として表示するため、
 *   - 単語追加では訳が「AI生成の訳 (仮)」の偽データが単語帳に保存され、
 *     そのままクイズに出題される（学習データが壊れる）
 *   - つながりマップは何を調べても同じ作り置きの図が出る
 *   - 英語日記は毎回まったく同じ書き置きの文章が「あなたの単語で書いた日記」
 *     として出る
 * という状態だった。実測でも isFallback が付いておらず、
 * 利用者には見分けがつかない。
 *
 * 集計で作れるもの（学習アドバイス・苦手分析）はこれまでどおり
 * 手元で組み立てて出どころを明記するが、AIにしか作れないものは断る。
 */
const AI_UNAVAILABLE = "AIを呼び出せませんでした。この機能には Gemini APIキーの設定が必要です。";

// 1. API: 新しい単語を分析・生成
app.post("/api/gemini/generate-word", async (req, res) => {
  const { word } = req.body;
  if (!isValidShortText(word, MAX_WORD_LEN)) {
    return res.status(400).json({ error: "英単語が正しく指定されていません。(最大64文字)" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: AI_UNAVAILABLE });
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
    // 適当な訳を作って返すと、偽のデータが単語帳に保存されてクイズに出てしまう
    return res.status(502).json({
      error: "AIの応答を受け取れませんでした。時間をおいて再度お試しください。"
    });
  }
});

// 1.5. API: 単語のつながりマップ＆派生語パズルの作成
app.post("/api/gemini/connection-map", async (req, res) => {
  const { word } = req.body;
  if (!isValidShortText(word, MAX_WORD_LEN)) {
    return res.status(400).json({ error: "英単語が正しく指定されていません。(最大64文字)" });
  }

  const queryWord = word.trim().toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: AI_UNAVAILABLE });
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
    // 作り置きの図を返すと、何を調べても同じ内容が「AIの分析」として出る
    return res.status(502).json({
      error: "AIの応答を受け取れませんでした。時間をおいて再度お試しください。"
    });
  }
});

// 1.8. API: 単語の使用頻度分析
app.post("/api/gemini/word-frequency", async (req, res) => {
  const { word } = req.body;
  if (!isValidShortText(word, MAX_WORD_LEN)) {
    return res.status(400).json({ error: "英単語が正しく指定されていません。(最大64文字)" });
  }

  const queryWord = word.trim().toLowerCase();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    // 語尾ヒューリスティックの擬似データを本物のAI分析のように返さない
    return res.status(503).json({ error: AI_UNAVAILABLE });
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
  // 進捗スタッツはプロンプトへ埋め込むため、数値のみに正規化する
  // （文字列を送り込んでプロンプトを汚染・肥大化させる攻撃を防ぐ）
  const toSafeCount = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(Math.round(n), 1_000_000)) : 0;
  };
  // 割合は0〜100に収める。範囲外の値をそのまま流すと
  // 「習得度9999%」のような分析をAIに書かせてしまう
  const toSafeRate = (v: unknown): number => Math.min(100, toSafeCount(v));
  // 習得数は収録数を超えられない。独立に丸めるだけでは
  // correct=5000000 / total=1 のような値が通り、「全体の500000000%」と書いてしまう
  const toLevel = (label: string, s: any): LevelStat => {
    const total = toSafeCount(s?.total);
    return { label, total, correct: Math.min(toSafeCount(s?.correct), total), rate: toSafeRate(s?.rate) };
  };

  // 学習順に並べる。分析側は「最初に未達のレベル」を次の目標とするので順序が意味を持つ
  const adviceInput: AdviceInput = {
    levels: [
      toLevel("中学生", req.body?.juniorStats),
      toLevel("高校1年生", req.body?.seniorStats),
      toLevel("高校2年生", req.body?.senior2Stats),
      toLevel("高校3年生", req.body?.senior3Stats),
      toLevel("大学生・社会人", req.body?.advancedStats)
    ],
    wrongWordsCount: toSafeCount(req.body?.wrongWordsCount)
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // AIは呼べないが、手元の数値からは十分に具体的な助言が作れる。
    // 固定文を返すと、習得を終えた学習者にも初学者と同じ文面が出てしまう
    return res.json({ advice: buildLocalAdvice(adviceInput), source: "local" });
  }

  try {
    const client = getGeminiClient();
    // 数値だけを渡すと一般論が返ってくるので、読み取れることまでこちらで書いて渡す
    const prompt = `学習者の進捗分析:
${buildAnalysisForPrompt(adviceInput)}

レベル別の内訳:
${adviceInput.levels.map(l => `- ${l.label}レベル: 習得 ${l.correct}/${l.total}語 (${l.rate}%)`).join("\n")}

アドバイスの仕様:
- 上の分析に書かれている事実だけを根拠にすること。書かれていないことを推測で断定しない。
- 「いま取り組むべきレベル」を必ず名前で挙げ、具体的な次の一手を示すこと。
- 苦手単語の数に触れ、その量に見合った扱い方を勧めること。
- 親しみやすい、インテリジェントな英語学習マスターのトーン(先生風)で回答して。
- 200〜300文字程度で、Markdown形式に整形してください。`;

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    const text = response.text;
    if (!text || !text.trim()) {
      // 空の応答をそのまま出すと画面が白くなるので、手元の分析に切り替える
      return res.json({ advice: buildLocalAdvice(adviceInput), source: "local" });
    }
    res.json({ advice: text, source: "ai" });
  } catch (error: any) {
    console.error("Gemini Advice Error: ", error);
    console.warn("AIアドバイスの生成に失敗したため、手元の分析に切り替えます。");
    return res.json({ advice: buildLocalAdvice(adviceInput), source: "local" });
  }
});

// 1.85. API: 間違えた単語の傾向から弱点分野を自動分析
app.post("/api/gemini/weakness-analysis", async (req, res) => {
  const { wrongWords } = req.body;
  if (!Array.isArray(wrongWords) || wrongWords.length === 0) {
    return res.status(400).json({ error: "分析対象の間違えた単語がありません。" });
  }

  // プロンプトへ埋め込む各項目を長さ制限付きで正規化する
  // （巨大な文字列や制御文字によるトークン浪費・プロンプト汚染を防ぐ）
  // 先頭60件を固定で取ると、苦手単語が増えたユーザーほど古い間違いばかりが
  // 分析対象になり続けるため、全体からランダムに代表を抽出する。
  const sample = sampleArray(wrongWords, 60)
    .map((w: any) => ({
      word: isValidShortText(w?.word, MAX_WORD_LEN) ? w.word.trim() : "",
      translation: isValidShortText(w?.translation, MAX_MEANING_LEN) ? w.translation.trim() : "",
      pos: typeof w?.pos === "string" && POS_JP_LABELS[w.pos] ? w.pos : undefined
    }))
    .filter(w => w.word !== "");
  if (sample.length === 0) {
    return res.status(400).json({ error: "分析対象の間違えた単語がありません。" });
  }
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
  if (!isValidShortText(word, MAX_WORD_LEN)) {
    return res.status(400).json({ error: "英単語が正しく指定されていません。(最大64文字)" });
  }
  // 任意項目の訳語は、長さ・形式が正当な場合のみプロンプトに含める
  const safeTranslation = isValidShortText(translation, MAX_MEANING_LEN) ? translation.trim() : "";

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: AI_UNAVAILABLE });
  }

  try {
    const client = getGeminiClient();
    const prompt = `分析対象の英単語: "${word.trim()}"${safeTranslation ? `（日本語訳: ${safeTranslation}）` : ""}

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
    return res.status(503).json({ error: AI_UNAVAILABLE });
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

// 3. API: ユーザーの覚えている単語リストに基づいた英語日記の自動生成
app.post("/api/gemini/diary", async (req, res) => {
  const rawWords = req.body?.words;
  if (!rawWords || !Array.isArray(rawWords)) {
    return res.status(400).json({ error: "習得した英単語リストがありません。" });
  }
  // プロンプトへ埋め込む単語リストを正規化する。
  // 形式・長さの正当な英単語のみ最大300語まで（巨大配列によるトークン浪費を防ぐ）。
  // 先頭から切り出すと習得語数が多いユーザーほど毎回同じ単語しか使われないため、
  // 全体からランダムに抽出する。
  const words: string[] = sampleArray(
    rawWords
      .filter((w: unknown) => isValidShortText(w, MAX_WORD_LEN))
      .map((w: string) => w.trim()),
    300
  );

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: AI_UNAVAILABLE });
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
    // 書き置きの文章を返すと、毎回同じものが「あなたの単語で書いた日記」として出る
    return res.status(502).json({
      error: "AIの応答を受け取れませんでした。時間をおいて再度お試しください。"
    });
  }
});

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

  // アップロードサイズの上限（base64で約13.4MB ≒ バイナリ10MB）
  const MAX_PDF_BASE64_LEN = 14 * 1024 * 1024;
  if (pdfBase64.length > MAX_PDF_BASE64_LEN) {
    return res.status(413).json({ error: "PDFファイルが大きすぎます。10MB以下のファイルをご利用ください。" });
  }

  // base64形式と、先頭バイトのPDFマジックナンバー(%PDF)を検証する
  // （PDF以外の任意データをGeminiへ中継させない）
  if (!/^[A-Za-z0-9+/=\s]+$/.test(pdfBase64)) {
    return res.status(400).json({ error: "PDFデータの形式が正しくありません。" });
  }
  try {
    const head = Buffer.from(pdfBase64.slice(0, 12), "base64").toString("latin1");
    if (!head.startsWith("%PDF")) {
      return res.status(400).json({ error: "PDFファイルとして認識できませんでした。有効なPDFをアップロードしてください。" });
    }
  } catch {
    return res.status(400).json({ error: "PDFデータの形式が正しくありません。" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // PDFと関係のない単語を返すと、読み取れたように見えて中身が別物になる
    return res.status(503).json({ error: AI_UNAVAILABLE });
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
    return res.status(502).json({
      error: "AIの応答を受け取れませんでした。時間をおいて再度お試しください。"
    });
  }
});


/**
 * 開発中かどうか。
 *
 * これまで `NODE_ENV !== "production"` で判定していたが、
 * `npm start`（node dist/server.cjs）は NODE_ENV を設定しないため、
 * ビルド済みのファイルを配るつもりで開発用の Vite ミドルウェアが動いていた。
 * その結果、本番でも
 *   - dist/index.html ではなく開発用のHTMLが返る（@react-refresh 入り）
 *   - /sw.js と /manifest.webmanifest まで index.html が返り、
 *     サービスワーカーが登録されない＝オフラインで開けない
 *   - 実行時に不要なはずの vite（devDependency）が必要になる
 * という状態だった。
 *
 * 判定は「TypeScript のまま実行しているか」で行う。
 * npm run dev は tsx server.ts、本番は node dist/server.cjs なので取り違えない。
 * 環境変数で上書きしたいときのために NODE_ENV も見る。
 */
export function isDevServer(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.NODE_ENV === "development") return true;
  return /\.tsx?$/.test(process.argv[1] || "");
}

// ExpressサーバーでViteミドルウェア（開発時）の設定、または静的なビルドファイルの配信
async function main() {
  if (isDevServer()) {
    // Vite は開発時のミドルウェアにしか使わないため、ここで動的に読み込む。
    // 静的 import にすると本番のバンドルでも require("vite") が走るので、
    // 実行時には使わない開発用パッケージを本番環境へ入れる必要が出てしまう。
    const { createServer: createViteServer } = await import("vite");
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

// テストから読み込んだときにサーバーを起動しないよう、直接実行されたときだけ動かす
if (process.argv[1] && /server\.(ts|cjs|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error("Server execution failed:", err);
  });
}
