import React, { useState, useEffect, useRef } from "react";
import { 
  Trophy, 
  Calendar, 
  Sparkles, 
  Plus, 
  ArrowRight, 
  RotateCcw, 
  Brain, 
  Award, 
  PlusCircle, 
  Activity, 
  Trash2,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Loader2,
  ThumbsUp,
  FileSpreadsheet,
  FileText,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  Copy,
  Check,
  HelpCircle,
  BookMarked,
  Repeat
} from "lucide-react";
import { Level, Word, UserStats, RankingUser, PartOfSpeech } from "../types";
import SimpleMarkdown from "./SimpleMarkdown";
import { todayStr, SrsState } from "../srs";
import { isMastered, countMastered } from "../mastery";
import { parseCSV, buildDistractors, normalizeImportedWord } from "../importWords";
import { writeStored } from "../storage";
import { getAudioContext } from "../sound";
import { shuffle } from "../shuffle";
import { getWordPos, inferPartOfSpeech } from "../pos";
import StudyCalendar from "./StudyCalendar";
import { StudyListIcon, ReadingIcon, DiaryIcon, ReviewIcon, DictionaryIcon, ListeningIcon, SpellingIcon } from "./AppIcons";
import { toFillInSentence } from "../fillIn";
import { LEVEL_TONE, LEVEL_STYLE } from "../levelTheme";

/**
 * 「調べる」タブに並べる資料。
 * 上部のナビに散らばっていたものをここへ集めた。
 */
const REFERENCE_ENTRIES = [
  {
    id: "dictionary",
    title: "単語一覧辞書",
    description: "収録語を検索し、語義・使用割合・文型・語族・例文を確かめる",
    icon: BookOpen,
    tone: "bg-indigo-50 text-indigo-600"
  },
  {
    id: "verb_forms",
    title: "動詞の活用表",
    description: "原形 → 過去形 → 過去分詞 → ing形 を一覧で確かめる",
    icon: Repeat,
    tone: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300"
  },
  {
    id: "grammar",
    title: "文法ガイド",
    description: "中学から大学レベルまでの文法34項目。説明・例文・練習問題つき",
    icon: BookMarked,
    tone: "bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300"
  }
] as const;

/**
 * レベルの一覧。
 *
 * 以前は5レベルのカードを縦に並べており、スマホ幅で 1,894px（画面2.2枚ぶん）あった。
 * 中学以外を使う人は毎回そこまでスクロールする必要があり、
 * 「レベルへ移動」というページ内リンクで補っていた。
 * いまはレベルを先に選び、選んだレベルのカードだけを出す。
 *
 * 色は文字列のまま持つ。`bg-${color}-100` のように組み立てると
 * Tailwind がクラスを見つけられず、色が付かなくなる。
 */
const LEVELS: {
  level: Level;
  /** 選ぶボタンに出す短い名前 */
  short: string;
  /** カードの見出し */
  title: string;
  /** 収録語の例（このレベルの雰囲気を掴むため） */
  examples: string;
  badge: string;
  rate: string;
  bar: string;
  primaryBtn: string;
  subBtn: string;
  /** レベルを選ぶボタン（選んでいないとき／選んでいるとき） */
  chip: string;
  chipOn: string;
}[] = [
  {
    level: "junior", short: "中学", title: "初級 (中学生レベル)",
    examples: "beautiful, library, important, station...",
    badge: `${LEVEL_TONE.junior} ${LEVEL_STYLE.badge}`,
    rate: `${LEVEL_TONE.junior} ${LEVEL_STYLE.text}`,
    bar: `${LEVEL_TONE.junior} ${LEVEL_STYLE.bar}`,
    primaryBtn: `${LEVEL_TONE.junior} ${LEVEL_STYLE.solid}`,
    subBtn: `${LEVEL_TONE.junior} ${LEVEL_STYLE.soft}`,
    chip: `${LEVEL_TONE.junior} ${LEVEL_STYLE.soft}`,
    chipOn: `${LEVEL_TONE.junior} ${LEVEL_STYLE.solid} border-[var(--lv-solid)]`
  },
  {
    level: "senior", short: "高1", title: "中級 (高校1年生レベル)",
    examples: "environment, achieve, technology, protect...",
    badge: `${LEVEL_TONE.senior} ${LEVEL_STYLE.badge}`,
    rate: `${LEVEL_TONE.senior} ${LEVEL_STYLE.text}`,
    bar: `${LEVEL_TONE.senior} ${LEVEL_STYLE.bar}`,
    primaryBtn: `${LEVEL_TONE.senior} ${LEVEL_STYLE.solid}`,
    subBtn: `${LEVEL_TONE.senior} ${LEVEL_STYLE.soft}`,
    chip: `${LEVEL_TONE.senior} ${LEVEL_STYLE.soft}`,
    chipOn: `${LEVEL_TONE.senior} ${LEVEL_STYLE.solid} border-[var(--lv-solid)]`
  },
  {
    level: "senior2", short: "高2", title: "中級 (高校2年生レベル)",
    examples: "skill, tragedy, knowledge, establish...",
    badge: `${LEVEL_TONE.senior2} ${LEVEL_STYLE.badge}`,
    rate: `${LEVEL_TONE.senior2} ${LEVEL_STYLE.text}`,
    bar: `${LEVEL_TONE.senior2} ${LEVEL_STYLE.bar}`,
    primaryBtn: `${LEVEL_TONE.senior2} ${LEVEL_STYLE.solid}`,
    subBtn: `${LEVEL_TONE.senior2} ${LEVEL_STYLE.soft}`,
    chip: `${LEVEL_TONE.senior2} ${LEVEL_STYLE.soft}`,
    chipOn: `${LEVEL_TONE.senior2} ${LEVEL_STYLE.solid} border-[var(--lv-solid)]`
  },
  {
    level: "senior3", short: "高3", title: "中級 (高校3年生レベル)",
    examples: "significant, sacrifice, trigger, delight...",
    badge: `${LEVEL_TONE.senior3} ${LEVEL_STYLE.badge}`,
    rate: `${LEVEL_TONE.senior3} ${LEVEL_STYLE.text}`,
    bar: `${LEVEL_TONE.senior3} ${LEVEL_STYLE.bar}`,
    primaryBtn: `${LEVEL_TONE.senior3} ${LEVEL_STYLE.solid}`,
    subBtn: `${LEVEL_TONE.senior3} ${LEVEL_STYLE.soft}`,
    chip: `${LEVEL_TONE.senior3} ${LEVEL_STYLE.soft}`,
    chipOn: `${LEVEL_TONE.senior3} ${LEVEL_STYLE.solid} border-[var(--lv-solid)]`
  },
  {
    level: "advanced", short: "大学・社会人", title: "上級 (大学生・社会人)",
    examples: "comprehensive, architecture, constraint, execution...",
    badge: `${LEVEL_TONE.advanced} ${LEVEL_STYLE.badge}`,
    rate: `${LEVEL_TONE.advanced} ${LEVEL_STYLE.text}`,
    bar: `${LEVEL_TONE.advanced} ${LEVEL_STYLE.bar}`,
    primaryBtn: `${LEVEL_TONE.advanced} ${LEVEL_STYLE.solid}`,
    subBtn: `${LEVEL_TONE.advanced} ${LEVEL_STYLE.soft}`,
    chip: `${LEVEL_TONE.advanced} ${LEVEL_STYLE.soft}`,
    chipOn: `${LEVEL_TONE.advanced} ${LEVEL_STYLE.solid} border-[var(--lv-solid)]`
  }
];

/** レベルの中で選べる出題形式。並びは5レベルで共通 */
const QUIZ_FORMS: {
  form: "sentence" | "listening" | "reverse" | "spelling";
  label: string;
  /** 絵。他の画面と同じ線画を使う（src/components/AppIcons.tsx） */
  Icon?: (props: { className?: string }) => React.ReactElement;
}[] = [
  { form: "sentence", label: "例文穴埋めを解く" },
  { form: "listening", label: "リスニングを解く", Icon: ListeningIcon },
  { form: "reverse", label: "🇯🇵 日本語→英単語" },
  { form: "spelling", label: "綴りを書く", Icon: SpellingIcon }
];

/** 1回のクイズで出す問題数の選択肢 */
const QUESTION_COUNTS = [
  { count: 10, label: "10問", desc: "1分ほど" },
  { count: 50, label: "50問", desc: "5分ほど" },
  { count: 100, label: "100問", desc: "10分ほど" }
];

interface WeaknessStat {
  label: string;
  count: number;
  percentage: number;
}

interface WeaknessAnalysis {
  summary: string;
  partOfSpeechStats: WeaknessStat[];
  topicStats: WeaknessStat[];
  recommendations: string[];
  isFallback?: boolean;
}

// 簡単なシンセサイザー音の実装
const playAudio = (type: "correct" | "incorrect" | "bonus") => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    if (type === "correct") {
      // ピポーン♪ (高音のファンファーレ)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = "sine";
      osc2.type = "sine";
      
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.15); // C6
      
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start();
      osc2.start();
      
      osc1.stop(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.45);
    } else if (type === "incorrect") {
      // ブブー (低音で濁ったトーン)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "bonus") {
      // シャララララン♪ (光が散るようなメロディ)
      const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        
        gain.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + idx * 0.08 + 0.3);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.3);
      });
    }
  } catch (e) {
    console.warn("Audio Context is not initialized yet or not supported.", e);
  }
};

interface DashboardProps {
  stats: UserStats;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  vocabulary: Word[];
  setVocabulary: React.Dispatch<React.SetStateAction<Word[]>>;
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  srsData: Record<string, SrsState>;
  wrongWords: string[];
  onStartQuiz: (level: Level, type: "word" | "sentence" | "listening" | "spelling" | "reverse", count?: number) => void;
  onStartReview: () => void;
  onOpenDictionary: () => void;
  onStartReading: () => void;
  onOpenDiary: () => void;
  onOpenVerbForms: () => void;
  onOpenGrammar: () => void;
  /** 今日の復習（忘却曲線）の対象語数 */
  dueCount: number;
  /** 今日の復習を始める */
  onStartSrsReview: () => void;
  ranking: RankingUser[];
  setRanking: React.Dispatch<React.SetStateAction<RankingUser[]>>;
  dailyLog: Record<string, { count: number; correct: number }>;
  dailyGoal: number;
  equipped: { avatar?: string; title?: string };
  onOpenGachaShop: () => void;
}

export default function Dashboard({
  stats,
  setStats,
  vocabulary,
  setVocabulary,
  solvedHistory,
  srsData,
  wrongWords,
  onStartQuiz,
  onStartReview,
  onOpenDictionary,
  onStartReading,
  onOpenDiary,
  onOpenVerbForms,
  onOpenGrammar,
  dueCount,
  onStartSrsReview,
  ranking,
  setRanking,
  dailyLog,
  dailyGoal,
  equipped,
  onOpenGachaShop
}: DashboardProps) {
  const [newWord, setNewWord] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [addingError, setAddingError] = useState("");

  // CSV一括アップロード用ステート
  const [csvError, setCsvError] = useState("");
  const [csvSuccess, setCsvSuccess] = useState("");
  const [isCsvDragging, setIsCsvDragging] = useState(false);
  const [defaultCsvLevel, setDefaultCsvLevel] = useState<Level>("junior");
  const [showCsvTemplateModal, setShowCsvTemplateModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [csvTemplateType, setCsvTemplateType] = useState<"full" | "min">("full");

  // インポートモード（CSV vs PDF）とPDFアップロード用ステート
  const [importMode, setImportMode] = useState<"csv" | "pdf">("csv");
  const [isPdfParsing, setIsPdfParsing] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfSuccess, setPdfSuccess] = useState("");
  const [isPdfDragging, setIsPdfDragging] = useState(false);

  const handleDownloadTemplate = (type: "full" | "min" = "full") => {
    const fullContent = "word,translation,level,sentence,sentenceTranslation\nevaluate,評価する,advanced,We must carefully evaluate our options before deciding.,決定する前に、私たちは選択肢を慎重に評価しなければなりません。\npinnacle,頂点、極致,advanced,Winning the award was the pinnacle of her career.,その賞を受けることは、彼女のキャリアの頂点でした。\ncomply,従う、遵守する,senior3,All staff members must comply with safety regulations.,全職員が安全規則に従わなければなりません。\ncuriosity,好奇心,junior,His eyes were full of childish curiosity.,彼の目は子供のような好奇心に満ちていました。";
    const minContent = "word,translation\naccomplish,成し遂げる\ncollaborate,共同で取り組む\nhypothesis,仮説\nnegotiation,交渉";
    
    const csvContent = type === "full" ? fullContent : minContent;
    const fileName = type === "full" ? "word_list_template_full.csv" : "word_list_template_simple.csv";

    // Excelなどでの文字化け用のBOM (UTF-8)
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // CSVファイルの解析と単語追加
  const handleCsvUpload = (file: File) => {
    setCsvError("");
    setCsvSuccess("");

    if (!file.name.endsWith(".csv")) {
      setCsvError("CSVファイル（.csv）を選択してください。");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          throw new Error("ファイルが空、または読み込めませんでした。");
        }

        const rows = parseCSV(text);
        if (rows.length === 0) {
          throw new Error("有効なデータが見つかりませんでした。");
        }

        let startIndex = 0;
        const firstRow = rows[0];
        const isHeader = firstRow.some(cell => 
          /^(word|translation|level|sentence|english|japanese|単語|訳|意味|レベル|例文|日本語訳)$/i.test(cell)
        );
        if (isHeader) {
          startIndex = 1;
        }

        const newWords: Word[] = [];
        let duplicateCount = 0;
        let tempVocabulary = [...vocabulary];

        for (let i = startIndex; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 2) continue;

          const rawWord = row[0].trim();
          const rawTranslation = row[1].trim();

          if (!rawWord || !rawTranslation) continue;

          const isDuplicate = tempVocabulary.some(w => w.word.toLowerCase() === rawWord.toLowerCase());
          if (isDuplicate) {
            duplicateCount++;
            continue;
          }

          let level: Level = defaultCsvLevel;
          if (row[2]) {
            const rawLevel = row[2].trim().toLowerCase();
            const validLevels = ["junior", "senior", "senior2", "senior3", "advanced"];
            if (validLevels.includes(rawLevel)) {
              level = rawLevel as Level;
            }
          }

          // 穴あけは共通の toFillInSentence に任せる。
          // ここに独自の処理を持っていたため、次の2つが起きていた。
          //   - 例文に最初から [_____] があると穴あけを丸ごと省き、
          //     答えの綴りが本文に残ったまま出題されていた
          //   - 単語境界を見ずに置換していたため、"art" を取り込むと
          //     "start" の一部まで穴になっていた
          const rawSentence = row[3] ? row[3].trim() : "";
          const sentence = toFillInSentence(rawSentence, rawWord);
          // 訳は、例文が空だったときだけ定型で補う。
          // 例文があるのに定型の訳を付けると、本文と訳が食い違う
          const sentenceTranslation = row[4]
            ? row[4].trim()
            : rawSentence
              ? ""
              : "私は今日、[_____]を勉強したいです。";

          const csvPos = inferPartOfSpeech(rawWord, rawTranslation);
          const options = shuffle([
            rawTranslation,
            ...buildDistractors({ word: rawWord, translation: rawTranslation, level, pos: csvPos }, vocabulary, "translation", 3)
          ]);
          const sentenceOptions = shuffle([
            rawWord,
            ...buildDistractors({ word: rawWord, translation: rawTranslation, level, pos: csvPos }, vocabulary, "word", 3)
          ]);

          const wordObject: Word = {
            id: `csv_${Date.now()}_${Math.random().toString(36).substr(2, 5)}_${i}`,
            word: rawWord,
            translation: rawTranslation,
            level,
            options,
            sentence,
            sentenceTranslation,
            sentenceOptions
          };

          newWords.push(wordObject);
          tempVocabulary.push(wordObject);
        }

        if (newWords.length === 0) {
          if (duplicateCount > 0) {
            throw new Error(`追加された単語がありません（${duplicateCount}件の重複単語がスキップされました）。`);
          } else {
            throw new Error("インポートできる有効なデータがありませんでした。1列目が英単語、2列目が日本語訳であるかご確認ください。");
          }
        }

        setVocabulary(prev => [...prev, ...newWords]);
        
        const scoreBonus = Math.min(newWords.length * 20, 1000);
        setStats(prev => {
          const nScore = prev.score + scoreBonus;
          setRanking(rk => {
            const updated = rk.map(u => u.isMe ? { ...u, score: nScore } : u);
            return updated.sort((a, b) => b.score - a.score);
          });
          return {
            ...prev,
            score: nScore
          };
        });

        playAudio("bonus");
        setCsvSuccess(
          `インポート成功！🎉 ${newWords.length}件の単語を新しく登録しました！ (重複スキップ: ${duplicateCount}件, 獲得スコア: +${scoreBonus})`
        );
      } catch (err: any) {
        console.error(err);
        setCsvError(err.message || "CSVファイルのインポートに失敗しました。ファイル形式をご確認ください。");
      }
    };
    reader.onerror = () => {
      setCsvError("ファイルの読み込み中にエラーが発生しました。");
    };
    reader.readAsText(file, "UTF-8");
  };

  // ファイル入力が変更されたとき
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを続けて選択してもonChangeが発火するよう値をリセット
    e.target.value = "";
    if (file) {
      handleCsvUpload(file);
    }
  };

  // ドラッグ進入
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(true);
  };

  // ドラッグ中
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(true);
  };

  // ドラッグ退出
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(false);
  };

  // ドロップ
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsCsvDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleCsvUpload(file);
    }
  };

  // PDFファイルのアップロードとスマート解析
  const handlePdfUpload = async (file: File) => {
    setPdfError("");
    setPdfSuccess("");

    if (!file.name.endsWith(".pdf") && file.type !== "application/pdf") {
      setPdfError("PDFファイル（.pdf）を選択してください。");
      return;
    }

    setIsPdfParsing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Result = reader.result as string;
          
          const response = await fetch("/api/gemini/parse-pdf", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ pdfBase64: base64Result })
          });

          // 先に本文を読む。ここで通信エラーとして丸めてしまうと、
          // 「AIを呼び出せませんでした」というサーバーの理由が利用者に届かない
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.error) {
            throw new Error(
              data.error || "サーバーとの通信に失敗しました。快適な接続環境下で再度お試しください。"
            );
          }

          const rawWords: any[] = Array.isArray(data.words) ? data.words : [];
          // AIの抽出結果を保存できる形に整える（不正なレベルや選択肢を補正する）
          const words: Word[] = rawWords
            .map((w, i) => normalizeImportedWord(w, "pdf", i, vocabulary))
            .filter((w): w is Word => w !== null);
          if (words.length === 0) {
            throw new Error("PDFから学習用英単語をうまく抽出できませんでした。テキストが読み取れるドキュメントかご確認ください。");
          }

          let duplicateCount = 0;
          const newWordsToAdd: Word[] = [];
          const tempVocabulary = [...vocabulary];

          for (const w of words) {
            const isDuplicate = tempVocabulary.some(tv => tv.word.toLowerCase() === w.word.toLowerCase());
            if (isDuplicate) {
              duplicateCount++;
            } else {
              newWordsToAdd.push(w);
              tempVocabulary.push(w);
            }
          }

          if (newWordsToAdd.length === 0) {
            throw new Error(`追加された単語はありません（抽出された ${duplicateCount} 件の単語はすべて既に登録されています）。`);
          }

          setVocabulary(prev => [...prev, ...newWordsToAdd]);

          const scoreBonus = Math.min(newWordsToAdd.length * 25, 1200);
          setStats(prev => {
            const nScore = prev.score + scoreBonus;
            setRanking(rk => {
              const updated = rk.map(u => u.isMe ? { ...u, score: nScore } : u);
              return updated.sort((a, b) => b.score - a.score);
            });
            return {
              ...prev,
              score: nScore
            };
          });

          playAudio("bonus");
          setPdfSuccess(
            `解析・インポートに成功しました！🎉\nAIがPDFの文脈から ${newWordsToAdd.length}件 の重要単語を自動抽出しました！${duplicateCount > 0 ? ` [重複スキップ: ${duplicateCount}件]` : ""} (獲得スコア: +${scoreBonus})`
          );

        } catch (err: any) {
          console.error(err);
          setPdfError(err.message || "PDFファイルの解析に失敗しました。");
        } finally {
          setIsPdfParsing(false);
        }
      };

      reader.onerror = () => {
        setPdfError("ファイルの読み込み中にエラーが発生しました。");
        setIsPdfParsing(false);
      };

    } catch (err: any) {
      console.error(err);
      setPdfError("ファイルの登録プロセスで問題が発生しました。");
      setIsPdfParsing(false);
    }
  };

  // PDF用マニュアルインプット選択
  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 同じファイルを続けて選択してもonChangeが発火するよう値をリセット
    e.target.value = "";
    if (file) {
      handlePdfUpload(file);
    }
  };

  // PDF用ドラッグ＆ドロップ用イベント
  const handlePdfDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPdfDragging(true);
  };

  const handlePdfDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPdfDragging(true);
  };

  const handlePdfDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPdfDragging(false);
  };

  const handlePdfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPdfDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handlePdfUpload(file);
    }
  };
  
  const [advice, setAdvice] = useState<string>("");
  // AIが書いたのか、アプリが学習記録から組み立てたのか。
  // 出どころを伏せると、固定文をAIの分析だと誤解させることになる
  const [adviceSource, setAdviceSource] = useState<"ai" | "local" | null>(null);
  const [isFetchingAdvice, setIsFetchingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  const [weaknessAnalysis, setWeaknessAnalysis] = useState<WeaknessAnalysis | null>(null);
  const [isFetchingWeakness, setIsFetchingWeakness] = useState(false);
  const [weaknessError, setWeaknessError] = useState("");

  const [activeTab, setActiveTab] = useState<"progress" | "reference" | "ai" | "ranking" | "bonus">("progress");

  // 出題単語数選択用のステート
  /**
   * 1回のクイズで出す問題数。
   *
   * 以前は「一問一答」だけモーダルで毎回選ばせ、他の4形式は10問固定だった。
   * 同じ並びのボタンなのに片方だけ手順が増え、しかも他の形式では
   * 問題数を選べないという不揃いになっていた。
   * 設定を1つ持ち、5形式すべてがそれを使う。
   */
  /** 単語の取り込み（AI・CSV・PDF）の手順を開いているか。既定は畳む */
  const [showImportPanel, setShowImportPanel] = useState(false);

  /**
   * 学習メニュー（長文・AI日記・今日の復習）を開いているか。既定は畳む。
   *
   * 3つを大きな案内カードとして縦に積んでいたときは、スマホ幅で
   * 合わせて約800pxあり、その下にある出題ボタンまで遠かった。
   * 畳んだままでも「今日の復習が何語あるか」は見出しの側に出す。
   * 数が見えないと、いちばん効く復習に気づかないまま閉じられてしまう。
   */
  const [showStudyMenu, setShowStudyMenu] = useState(false);

  const [questionCount, setQuestionCount] = useState<number>(() => {
    const v = Number(localStorage.getItem("quest_question_count"));
    return QUESTION_COUNTS.some(c => c.count === v) ? v : 10;
  });

  useEffect(() => {
    writeStored("quest_question_count", String(questionCount));
  }, [questionCount]);

  /**
   * どのレベルを開いているか。
   *
   * 覚えておかないと、中学以外で学習している人は
   * アプリを開くたびに選び直すことになる。
   */
  const [selectedLevel, setSelectedLevel] = useState<Level>(() => {
    const saved = localStorage.getItem("quest_selected_level");
    return LEVELS.some(l => l.level === saved) ? (saved as Level) : "junior";
  });

  useEffect(() => {
    writeStored("quest_selected_level", selectedLevel);
  }, [selectedLevel]);

  // 各レベルの単語カウントと習熟度計算
  const getLevelCounts = (level: Level) => {
    const levelWords = vocabulary.filter(w => w.level === level);
    const total = levelWords.length;
    const completed = levelWords.filter(w => solvedHistory[w.id] && solvedHistory[w.id].attemptCount > 0).length;
    // 習得済み＝間隔反復のボックス2以上（1回の偶然の正解では到達しない）
    const correct = levelWords.filter(w => isMastered(w.id, solvedHistory, srsData)).length;
    const masterRate = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    return { total, completed, correct, masterRate };
  };

  // AI英語日記の解放判定に使う習得語数
  const masteredTotal = countMastered(vocabulary.map(w => w.id), solvedHistory, srsData);

  const juniorStats = getLevelCounts("junior");
  const seniorStats = getLevelCounts("senior");
  const senior2Stats = getLevelCounts("senior2");
  const senior3Stats = getLevelCounts("senior3");
  const advancedStats = getLevelCounts("advanced");

  // デイリーログインボーナスの定義
  const bonusDays = Array.from({ length: 7 }, (_, i) => ({
    day: i + 1,
    points: (i + 1) * 100 + (i === 6 ? 500 : 0) // 最終日はスペシャル
  }));

  // 今日ログイン可能か判定
  const checkCanClaimToday = () => {
    return stats.lastLoginDate !== todayStr();
  };

  /**
   * 受け取りの二重実行よけ。
   *
   * checkCanClaimToday() は描画時点の stats を見るので、
   * 素早く2回押すと（React が再描画する前に）どちらも通ってしまう。
   * 実際、3連打すると受け取りの処理が3回走ってお知らせも3つ出ていた。
   * 加算が二重にならなかったのは newScore を絶対値で書いていたためで、
   * 関数形（prev.score + points）に直した瞬間に二重加算になる書き方だった。
   */
  const claimingRef = useRef(false);

  const handleClaimLoginBonus = () => {
    if (claimingRef.current || !checkCanClaimToday()) return;
    claimingRef.current = true;

    playAudio("bonus");
    const today = todayStr();

    // スコア追加
    const rawIndex = stats.currentStreak % 7;
    const points = bonusDays[rawIndex].points;
    const nextStreak = (stats.lastLoginDate === getYesterdayString()) ? stats.currentStreak + 1 : 1;

    // 加算は関数形で行い、すでに今日受け取っていれば何もしない。
    // 別の経路（別タブなど）から更新されていても二重に足さない
    setStats(prev => (
      prev.lastLoginDate === today
        ? prev
        : { ...prev, score: prev.score + points, currentStreak: nextStreak, lastLoginDate: today }
    ));

    // ランキングの更新
    setRanking(prev => {
      const updated = prev.map(u => u.isMe ? { ...u, score: u.score + points } : u);
      return updated.sort((a, b) => b.score - a.score);
    });

    alert(`ログインボーナス獲得！\n【+${points} P】を獲得しました！連続ログイン ${nextStreak}日目！ 🎉`);
  };

  const getYesterdayString = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayStr(d);
  };

  // AI単語追加
  const handleAddAIWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    setIsAdding(true);
    setAddingError("");
    
    try {
      const response = await fetch("/api/gemini/generate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: newWord.trim() })
      });
      
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "単語の追加に失敗しました。");
      }
      
      // AIの応答を保存できる形に整える（不正なレベルや選択肢を補正する）
      const newWordObject = normalizeImportedWord(data, "ai", 0, vocabulary);
      if (!newWordObject) {
        throw new Error("AIの応答を解釈できませんでした。もう一度お試しください。");
      }

      // 既存の単語と同じ英単語があれば重複追加を防ぐ
      const isDuplicate = vocabulary.some(w => w.word.toLowerCase() === newWordObject.word.toLowerCase());
      if (isDuplicate) {
        setAddingError(`「${newWordObject.word}」は既に登録されています！`);
        setIsAdding(false);
        return;
      }

      setVocabulary(prev => [...prev, newWordObject]);
      setNewWord("");
      playAudio("bonus");
      
      // スコア小ボーナス
      setStats(prev => {
        const nScore = prev.score + 50;
        setRanking(rk => {
          const updated = rk.map(u => u.isMe ? { ...u, score: nScore } : u);
          return updated.sort((a, b) => b.score - a.score);
        });
        return {
          ...prev,
          score: nScore
        };
      });

      // AIを呼べなかったときは 503/502 で断るようになったので、
      // ここに来るのは本当にAIが分析した結果だけ
      const msg = `AIが英単語「${data.word}」の分析を完了しました！\n難易度: ${
        data.level === "junior" ? "中学生" : data.level === "senior" ? "高校1年生" : data.level === "senior2" ? "高校2年生" : data.level === "senior3" ? "高校3年生" : "大学生・社会人"
      }\n自動分析された例文と選択肢がクイズに追加されました！ (獲得スコア: +50)`;
      alert(msg);
    } catch (err: any) {
      console.error(err);
      setAddingError(err.message || "ネットワークに接続できない、またはAPIの制限により取得に失敗しました。");
    } finally {
      setIsAdding(false);
    }
  };

  // AIアドバイスの取得
  const handleFetchAdvice = async () => {
    setIsFetchingAdvice(true);
    setAdviceError("");
    try {
       const response = await fetch("/api/gemini/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          juniorStats: { correct: juniorStats.correct, total: juniorStats.total, rate: juniorStats.masterRate },
          seniorStats: { correct: seniorStats.correct, total: seniorStats.total, rate: seniorStats.masterRate },
          senior2Stats: { correct: senior2Stats.correct, total: senior2Stats.total, rate: senior2Stats.masterRate },
          senior3Stats: { correct: senior3Stats.correct, total: senior3Stats.total, rate: senior3Stats.masterRate },
          advancedStats: { correct: advancedStats.correct, total: advancedStats.total, rate: advancedStats.masterRate },
          wrongWordsCount: wrongWords.length
        })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "アドバイスの取得に失敗しました。");
      }
      // SimpleMarkdown は text.split() を呼ぶため、文字列でないと描画時に例外になる
      if (typeof data.advice !== "string") {
        throw new Error("AIの応答を解釈できませんでした。もう一度お試しください。");
      }
      setAdvice(data.advice);
      setAdviceSource(data.source === "ai" ? "ai" : "local");
      playAudio("bonus");
    } catch (err: any) {
      console.error(err);
      // 再分析に失敗したときに前回の結果を残すと、更新されていない古い文章に
      // 「Gemini AI が生成しました」の札が付いたまま見えてしまう
      setAdvice("");
      setAdviceSource(null);
      setAdviceError(err.message || "AIアドバイスの作成に失敗しました。");
    } finally {
      setIsFetchingAdvice(false);
    }
  };

  // 弱点分野の自動分析（間違えた単語の傾向をAIが分析）
  const handleFetchWeaknessAnalysis = async () => {
    setIsFetchingWeakness(true);
    setWeaknessError("");
    try {
      const targetWords = wrongWords
        .map(id => vocabulary.find(w => w.id === id))
        .filter((w): w is Word => !!w)
        .map(w => ({ word: w.word, translation: w.translation, level: w.level, pos: getWordPos(w) }));

      if (targetWords.length === 0) {
        throw new Error("まだ間違えた単語が記録されていません。クイズに挑戦して苦手単語を集めましょう。");
      }

      const response = await fetch("/api/gemini/weakness-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrongWords: targetWords })
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "弱点分析の取得に失敗しました。");
      }
      // 描画側は partOfSpeechStats / topicStats / recommendations を無条件に map するため、
      // AIの応答がスキーマ通りでないと描画中に例外が投げられ、画面が失われる。
      // 足りない配列は空配列で補い、描画が壊れないようにする。
      const toStats = (v: any): WeaknessStat[] =>
        Array.isArray(v) ? v.filter(s => s && typeof s === "object") : [];
      setWeaknessAnalysis({
        summary: typeof data?.summary === "string" ? data.summary : "",
        partOfSpeechStats: toStats(data?.partOfSpeechStats),
        topicStats: toStats(data?.topicStats),
        // 文字列以外が混ざると React が「Objects are not valid as a React child」で落ちる
        recommendations: Array.isArray(data?.recommendations)
          ? data.recommendations.filter((r: any) => typeof r === "string")
          : [],
        isFallback: !!data?.isFallback
      });
      playAudio("bonus");
    } catch (err: any) {
      console.error(err);
      // 前回の結果を残さない。残すと、更新されていない分析に
      // 出どころの札（AIが分析／アプリが組み立て）が付いたまま見える
      setWeaknessAnalysis(null);
      setWeaknessError(err.message || "弱点分析の作成に失敗しました。");
    } finally {
      setIsFetchingWeakness(false);
    }
  };

  // 単語追加時に自動的な入力チェック
  const handleWordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 英字・スペース・ハイフンに加えて、アポストロフィ（don't, o'clock）と
    // アクセント付きラテン文字（café, naïve）も許容する。
    // 以前はこれらを黙って削除しており、"don't" が "dont"、"café" が "caf" として
    // 登録されてしまっていた（サーバー側は制御文字以外を受け付けるため、
    // 制限していたのはこの入力欄だけだった）。
    setNewWord(e.target.value.replace(/[^a-zA-ZÀ-ɏ\s'’-]/g, ""));
  };

  return (
    <div className="space-y-6" id="dashboard_page">
      {/* ヒーローヘッダー */}
      {/* 「Dashboard」の札は、いま見ている画面の名前を繰り返すだけで
          何も足していなかったので外した。あわせて余白を詰める
          （縦を削るほど、下にある出題の入口が早く見える） */}
      {/*
        先頭の帯（アプリ名・説明・スコア）は外した。
        名前とエイ・ゴリラのしるしはヘッダーに、合計スコアと連続日数も
        ヘッダーに出している。どの画面でも見えるぶん、
        ダッシュボードでは同じものを繰り返すことになっていた。
        アプリの説明は「アプリケーション説明」の画面が受け持つ。
      */}

      {/* タブ切り替え（Bento Gridスタイッシュ） */}
      <div className="grid grid-cols-3 lg:grid-cols-5 bg-gray-100 p-1 rounded-xl gap-1" data-testid="dashboard_tabs">
        <button
          onClick={() => setActiveTab("progress")}
          className={`py-3 text-xs md:text-sm font-bold rounded-lg transition-all ${
            activeTab === "progress" 
              ? "bg-white text-indigo-700 shadow-sm" 
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
          }`}
          id="tab_btn_progress"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            <span>習熟度 & クイズ</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("reference")}
          className={`py-3 text-xs md:text-sm font-bold rounded-lg transition-all ${
            activeTab === "reference"
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
          }`}
          id="tab_btn_reference"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-1.5">
            <DictionaryIcon className="w-4 h-4 text-sky-600" />
            <span>調べる</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          className={`py-3 text-xs md:text-sm font-bold rounded-lg transition-all ${
            activeTab === "ai" 
              ? "bg-white text-indigo-700 shadow-sm" 
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
          }`}
          id="tab_btn_ai"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-purple-500 fill-purple-100" />
            <span>AIアドバイス</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("ranking")}
          className={`py-3 text-xs md:text-sm font-bold rounded-lg transition-all ${
            activeTab === "ranking" 
              ? "bg-white text-indigo-700 shadow-sm" 
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
          }`}
          id="tab_btn_ranking"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500 fill-amber-150" />
            <span>記録</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("bonus")}
          className={`py-3 text-xs md:text-sm font-bold rounded-lg transition-all ${
            activeTab === "bonus" 
              ? "bg-white text-indigo-700 shadow-sm" 
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
          }`}
          id="tab_btn_bonus"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span>ログインボーナス</span>
          </div>
        </button>
      </div>

      {/* タブコンテンツ */}
      {activeTab === "progress" && (
        <div className="space-y-6">
          {/* 復習セクション (間違えた単語がある場合のみ表示) */}
          {wrongWords.length > 0 && (
            <div className="bg-rose-50 border border-rose-200/60 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4" id="review_banner">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-rose-500 rounded-xl text-white shadow-md animate-bounce">
                  <Brain className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-rose-950 font-extrabold text-lg flex items-center gap-2">
                    復習が必要な苦手な単語があります！
                  </h3>
                  <p className="text-rose-700 text-sm mt-0.5">
                    間違えた単語が <span className="font-extrabold font-mono text-base">{wrongWords.length}語</span> 記録されています。復習クイズを解いて完璧に定着させましょう。
                  </p>
                </div>
              </div>
              <button
                onClick={onStartReview}
                className="bg-rose-700 text-white font-bold hover:bg-rose-800 transition px-6 py-3 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap group text-sm md:text-base"
                id="btn_start_review"
              >
                <span>復習をスタートする</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/*
            長文・AI日記・今日の復習の3つの入口。

            それぞれを大きな案内カードとして縦に積んでいたときは、
            スマホ幅で合わせて約800pxあり、その下の出題ボタンまで遠かった。
            1つにまとめ、押したときだけ中身を出す。
            畳んでいる間も、復習の語数だけは見出しの側に出しておく。
          */}
          <div
            className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-2xs"
            id="study_menu"
          >
            <button
              type="button"
              onClick={() => setShowStudyMenu(v => !v)}
              aria-expanded={showStudyMenu}
              aria-controls="study_menu_list"
              id="btn_toggle_study_menu"
              className="w-full text-left px-4 py-3.5 min-h-11 flex items-center justify-between gap-3 hover:bg-gray-50 transition cursor-pointer"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 border border-indigo-500/20">
                  <StudyListIcon className="w-5 h-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-extrabold text-sm text-gray-900">学習メニュー</span>
                  <span className="block text-[11px] font-bold text-gray-500 truncate">
                    長文ストーリー ・ AI 英語日記 ・ 今日の復習
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {dueCount > 0 && (
                  <span className="bg-rose-700 text-white text-[10px] font-black px-2 py-1 rounded-full whitespace-nowrap">
                    復習 {dueCount} 語
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 text-gray-500 transition-transform ${showStudyMenu ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            </button>

            {showStudyMenu && (
              <div
                className="border-t border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800"
                id="study_menu_list"
                data-testid="study_menu_list"
              >
                {/* 1. 長文ストーリー */}
                <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" data-testid="study_menu_reading">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="p-2 bg-violet-600 text-white rounded-xl shrink-0 border border-violet-500/20">
                      <ReadingIcon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-gray-900">長文ストーリーを読破しよう</h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed font-medium">
                        各レベルの重要単語だけで書き下ろした長文を読みます。単語にふれると訳が出て、読み切るとボーナスポイントが入ります。
                      </p>
                    </div>
                  </div>
                  {onStartReading && (
                    <button
                      onClick={onStartReading}
                      className="bg-violet-700 hover:bg-violet-800 text-white text-xs font-black px-4.5 min-h-11 rounded-xl shadow-2xs transition shrink-0 cursor-pointer"
                      id="dashboard_open_reading_btn"
                    >
                      長文を読む ➔
                    </button>
                  )}
                </div>

                {/* 2. AI英語日記 */}
                <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" data-testid="study_menu_diary">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="p-2 bg-amber-600 text-white rounded-xl shrink-0 border border-amber-500/20">
                      <DiaryIcon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 flex-wrap">
                        <span>AI 英語日記</span>
                        {masteredTotal >= 200 ? (
                          <span className="bg-emerald-700 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">解放済み</span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">習得200語で解放</span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed font-medium">
                        覚えた単語を使って、AIが英語の日記を書き下ろします。読むだけでなく書く側に回る練習に。
                        <span className="block mt-0.5 font-mono text-[10px] text-gray-400 font-extrabold">
                          現在の習得数: {masteredTotal} / 200 単語
                        </span>
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onOpenDiary}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-black px-4.5 min-h-11 rounded-xl shadow-2xs transition shrink-0 cursor-pointer"
                    id="dashboard_open_diary_btn"
                  >
                    {masteredTotal >= 200 ? "日記を書く/読む ➔" : "進捗を確認する ➔"}
                  </button>
                </div>

                {/* 3. 今日の復習 */}
                <div className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3" data-testid="study_menu_srs">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="p-2 bg-emerald-700 text-white rounded-xl shrink-0 border border-emerald-600/20">
                      <ReviewIcon className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-gray-900 flex items-center gap-2 flex-wrap">
                        <span>今日の復習</span>
                        {dueCount > 0 ? (
                          <span className="bg-rose-700 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {dueCount} 語が復習日
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">今日は完了</span>
                        )}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed font-medium">
                        一度覚えた単語は時間とともに忘れます。忘れかけたころに出し直すのがいちばん効きます。
                        正解するほど次に出るまでの間隔が延び、間違えるとすぐ戻ってきます。形式も選べます。
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onStartSrsReview}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black px-4.5 min-h-11 rounded-xl shadow-2xs transition shrink-0 cursor-pointer"
                    id="dashboard_open_srs_review_btn"
                  >
                    {dueCount > 0 ? "復習を始める ➔" : "復習の状況を見る ➔"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 辞書へのバナーは外した。「調べる」タブから開けるので、
              同じ入口を2つ置いていることになっていた */}

          {/* 1回の問題数。5形式すべてに効く。
              以前は一問一答だけモーダルで毎回選ばせ、他の4形式は10問固定だった */}
          {/* 見出しとボタンは1つの塊にして、まとめて折り返す。
              「1回の問題数」だけをレベルの行の末尾に置いていたときは、
              画面の幅によって見出しと選択肢が別の行に離れていた */}
          <div
            className="flex items-start gap-x-6 gap-y-3 flex-wrap bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl px-4 py-3"
            data-testid="question_count_picker"
          >
            {/* レベルを選ぶ。選んだレベルのカードだけを下に出す */}
            <div className="flex items-center gap-1.5 flex-wrap" data-testid="level_picker">
              <span className="text-xs font-black text-gray-500 dark:text-slate-400">レベル</span>
              {LEVELS.map(item => (
                <button
                  key={item.level}
                  onClick={() => setSelectedLevel(item.level)}
                  id={`btn_level_${item.level}`}
                  aria-pressed={selectedLevel === item.level}
                  // ボタンの色はレベルの色に合わせる（中学は青、高1は緑…）。
                  // カードの見出し・進捗バー・出題ボタンと同じ色にしておくと、
                  // どのレベルを開いているかが色でも分かる
                  className={`min-h-11 px-3 rounded-xl text-xs font-black border transition cursor-pointer whitespace-nowrap ${
                    selectedLevel === item.level ? item.chipOn : item.chip
                  }`}
                >
                  {item.short}
                  {/* 習熟度。opacity で薄くすると、色の付いた地の上で読みにくくなる */}
                  <span className="ml-1.5 font-bold font-mono">
                    {getLevelCounts(item.level).masterRate}%
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap" data-testid="count_picker">
              <span className="text-xs font-black text-gray-500 dark:text-slate-400">1回の問題数</span>
              {QUESTION_COUNTS.map(item => (
                <button
                  key={item.count}
                  onClick={() => setQuestionCount(item.count)}
                  id={`btn_question_count_${item.count}`}
                  aria-pressed={questionCount === item.count}
                  className={`min-h-11 px-4 rounded-xl text-xs font-black border transition cursor-pointer ${
                    questionCount === item.count
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100"
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 font-bold opacity-70">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 選んだレベルのカード。5レベルぶんを並べていたときは
              スマホ幅で 1,894px あった */}
          {(() => {
            const conf = LEVELS.find(l => l.level === selectedLevel) || LEVELS[0];
            const s = getLevelCounts(conf.level);
            return (
              <div
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative flex flex-col justify-between"
                id="level_selection_section"
                data-testid={`level_card_${conf.level}`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className={`${conf.badge} text-xs px-3 py-1 rounded-full font-bold`}>
                      {conf.title}
                    </span>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">習熟度</span>
                      <p className={`text-lg font-black font-mono ${conf.rate}`}>{s.masterRate}%</p>
                    </div>
                  </div>

                  {/* 進捗バー */}
                  <div className="mt-4 bg-gray-100 w-full h-2 rounded-full overflow-hidden">
                    <div
                      className={`${conf.bar} h-full rounded-full transition-all duration-1000`}
                      style={{ width: `${s.masterRate}%` }}
                    />
                  </div>

                  <div className="mt-3 flex justify-between text-xs text-gray-500 font-mono">
                    <span>覚えた: {s.correct} 語</span>
                    <span>全 {s.total} 語</span>
                  </div>
                  <p className="mt-3 pt-3 border-t border-gray-50 font-mono text-[11px] text-gray-400 truncate">
                    例: {conf.examples}
                  </p>
                </div>

                <div className="mt-6 flex flex-col gap-2" data-testid="level_quiz_buttons">
                  <button
                    onClick={() => onStartQuiz(conf.level, "word", questionCount)}
                    className={`w-full ${conf.primaryBtn} text-white font-bold min-h-11 rounded-xl text-xs shadow-sm hover:shadow transition`}
                    id={`btn_${conf.level}_word`}
                  >
                    一問一答を解く
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {QUIZ_FORMS.map(f => (
                      <button
                        key={f.form}
                        onClick={() => onStartQuiz(conf.level, f.form, questionCount)}
                        className={`${conf.subBtn} font-bold min-h-11 px-2 rounded-xl text-xs transition border flex items-center justify-center gap-1.5`}
                        id={`btn_${conf.level}_${f.form}`}
                      >
                        {f.Icon && <f.Icon className="w-4 h-4 shrink-0" />}
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* AI単語・CSVインポートセクション (Explore and Learn) */}
          <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6 mt-6 relative overflow-hidden" id="ai_word_creation_bento">
            <div className="absolute right-0 bottom-0 opacity-10 blur-sm flex scale-150 rotate-12 pointer-events-none">
              <Sparkles className="w-32 h-32 text-indigo-500" />
            </div>
            
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 bg-indigo-100 rounded-xl text-indigo-700">
                  <Sparkles className="w-4 h-4 fill-indigo-200" />
                </span>
                <span className="text-xs font-black tracking-wider uppercase font-mono text-indigo-700">Explore and Learn</span>
              </div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight font-sans">
                オリジナル単語リストの拡張
              </h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                自分で追加したい英単語をAIで精密分析して1件ずつ追加するか、CSVやPDFファイルを使ってあなた独自の辞書を劇的に拡張できます！
              </p>

              {/* 取り込みの手順は縦に1,200px あり、毎日の学習では使わない。
                  既定では畳んでおき、必要なときだけ開く */}
              <button
                type="button"
                onClick={() => setShowImportPanel(v => !v)}
                aria-expanded={showImportPanel}
                id="btn_toggle_import_panel"
                className="mt-4 w-full min-h-11 px-4 rounded-xl border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100 text-indigo-800 text-xs font-black transition cursor-pointer flex items-center justify-center gap-2"
              >
                {showImportPanel ? "追加の手順を閉じる" : "単語を自分で追加する（AI・CSV・PDF）"}
              </button>

              {showImportPanel && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6 pt-6 border-t border-gray-100" data-testid="import_panel">
                {/* 左側：AIで個別追加 */}
                <div className="flex flex-col justify-between pr-0 lg:pr-8 lg:border-r lg:border-gray-100">
                  <div>
                    <h3 className="text-base font-extrabold text-gray-800 flex items-center gap-2 mb-2 font-sans">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      <span>AIで単語を1件ずつ自動追加</span>
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed mb-4">
                      英単語を入力すると、AIがレベル分類、日本語訳、4択の誤選択肢、分かりやすい例文、例文用の穴埋め四択まで一撃で瞬時に構築し、クイズに自動追加します。
                    </p>

                    <form onSubmit={handleAddAIWord} className="mt-4 flex gap-2 w-full" id="add_word_form">
                      <input
                        type="text"
                        placeholder="英単語を入力 (例: collaborate)"
                        value={newWord}
                        onChange={handleWordInputChange}
                        disabled={isAdding}
                        className="flex-1 px-4 min-h-11 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold font-mono text-sm placeholder-gray-400"
                        id="input_new_word"
                      />
                      <button
                        type="submit"
                        disabled={isAdding || !newWord.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-600 text-white font-bold px-5 min-h-11 rounded-xl transition flex items-center gap-1.5 shadow hover:shadow-md cursor-pointer text-xs whitespace-nowrap"
                        id="btn_submit_add_word"
                      >
                        {isAdding ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>分析中...</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>AI追加</span>
                          </>
                        )}
                      </button>
                    </form>

                    {addingError && (
                      <div className="text-xs text-rose-500 font-medium mt-3 bg-rose-50 rounded-lg border border-rose-100 p-2.5 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{addingError}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-4 mt-6 border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-700 mb-1.5">💡 個別学習 of コツ</h4>
                    <p className="text-[11px] text-gray-600 leading-relaxed">
                      AI追加機能は、読書中や仕事中に出会った新しい専門用語、フレーズ、時事用語を追加するのに最適です。瞬時に関連データがクイズに組み込まれ、あなたの学習を全方位でサポートします。
                    </p>
                  </div>
                </div>

                {/* 右側：一括追加（CSV / PDF対応） */}
                <div className="flex flex-col justify-between pl-0 lg:pl-2">
                  <div>
                    {/* インポート方法選択用のタブ */}
                    <div className="flex bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl mb-4 max-w-sm border border-gray-200/50">
                      <button
                        type="button"
                        onClick={() => setImportMode("csv")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          importMode === "csv"
                            ? "bg-white text-emerald-700 dark:text-emerald-400 shadow-3xs"
                            : "text-gray-600 hover:text-gray-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>CSVインポート</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportMode("pdf")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          importMode === "pdf"
                            ? "bg-white text-indigo-700 dark:text-indigo-400 shadow-3xs"
                            : "text-gray-600 hover:text-gray-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>PDFからAI抽出 (NEW)</span>
                      </button>
                    </div>

                    {importMode === "csv" ? (
                      <>
                        <h3 className="text-base font-extrabold text-gray-800 flex items-center gap-2 mb-2">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          <span>CSVファイルから一括インポート</span>
                        </h3>
                        <p className="text-xs text-gray-400 leading-relaxed mb-4">
                          お持ちのExcelや単語帳テキストなどから作成したCSVファイルをドラッグ＆ドロップするだけで、大量の独自単語リストを一撃でアプリに一括インポートできます。
                        </p>

                        {/* CSVデフォルトレベル選択 */}
                        <div className="flex items-center gap-3.5 mb-4 text-xs">
                          <span className="font-bold text-gray-700 text-xs">所属レベルを選んでから追加:</span>
                          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                            {(["junior", "senior", "senior2", "senior3", "advanced"] as Level[]).map(lvl => (
                              <button
                                key={lvl}
                                type="button"
                                onClick={() => setDefaultCsvLevel(lvl)}
                                className={`px-3 min-h-11 rounded-md text-[11px] font-black transition cursor-pointer ${
                                  defaultCsvLevel === lvl 
                                    ? "bg-white text-emerald-700 shadow-sm" 
                                    : "text-gray-600 hover:text-gray-800"
                                }`}
                              >
                                {lvl === "junior" ? "中学" : lvl === "senior" ? "高1" : lvl === "senior2" ? "高2" : lvl === "senior3" ? "高3" : "上級"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* CSVドラッグ＆ドロップゾーン */}
                        <div
                          id="csv_drop_zone"
                          onDragEnter={handleDragEnter}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById("csv_file_input")?.click()}
                          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition ${
                            isCsvDragging 
                              ? "border-emerald-500 bg-emerald-50/55" 
                              : "border-gray-200 hover:border-emerald-400 hover:bg-gray-50/50"
                          }`}
                        >
                          <input
                            type="file"
                            id="csv_file_input"
                            aria-label="単語リスト（CSV）を選ぶ"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <Upload className={`w-8 h-8 mb-2 transition ${isCsvDragging ? "text-emerald-600 scale-110" : "text-gray-400"}`} />
                          <p className="text-xs font-bold text-gray-700 text-center">
                            CSVファイルをドラッグ＆ドロップ、またはクリックして選択
                          </p>
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">
                            UTF-8形式の .csv のみ対応
                          </p>
                        </div>

                        {csvSuccess && (
                          <div className="text-xs text-emerald-600 font-medium mt-3 bg-emerald-50 rounded-lg border border-emerald-100 p-2.5 flex items-center gap-2 animate-fade-in">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" />
                            <span className="whitespace-pre-line">{csvSuccess}</span>
                          </div>
                        )}

                        {csvError && (
                          <div className="text-xs text-rose-500 font-medium mt-3 bg-rose-50 rounded-lg border border-rose-100 p-2.5 flex items-center gap-2 animate-fade-in">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{csvError}</span>
                          </div>
                        )}

                        {/* CSV仕様アコーディオン/ガイド */}
                        <div className="bg-emerald-50/40 border border-emerald-100/50 rounded-2xl p-4 mt-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <h4 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>💡 CSVファイルの書き方仕様</span>
                            </h4>
                            <button
                              type="button"
                              onClick={() => setShowCsvTemplateModal(true)}
                              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-150 hover:border-indigo-300 bg-white px-2 py-1 rounded-lg transition flex items-center gap-1.5 shadow-3xs cursor-pointer"
                            >
                              <Info className="w-3 h-3 text-indigo-500" />
                              <span>テンプレートを見る / DL</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-600 leading-relaxed mb-2 font-sans">
                            以下の形式で、カンマ区切りのテキストファイルをご用意ください。
                          </p>
                          <div className="bg-white/80 border border-emerald-100 p-2 rounded-lg font-mono text-[10px] text-slate-600 overflow-x-auto leading-relaxed shadow-inner">
                            <div><span className="text-emerald-700 font-bold">1列目:</span> 英単語 (例: evaluate)  <span className="text-[9px] text-rose-700 font-bold">[必須]</span></div>
                            <div><span className="text-emerald-700 font-bold">2列目:</span> 日本語訳 (例: 評価する)  <span className="text-[9px] text-rose-700 font-bold">[必須]</span></div>
                            <div><span className="text-emerald-700 font-bold">3列目:</span> レベル (junior/senior/senior2...) <span className="text-[9px] text-gray-600 font-bold">[任意]</span></div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <h3 className="text-base font-extrabold text-indigo-900 dark:text-slate-200 flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>PDFファイルから重要英単語を自動抽出</span>
                        </h3>
                        <p className="text-xs text-gray-400 leading-relaxed mb-4">
                          学校教材や洋書、ビジネス文書、試験対策PDFなどをアップロードすると、AIが内容を要約し、重要な英語学習キーワードを10〜20件抽出してクイズに一発登録します！
                        </p>

                        {/* PDFドラッグ＆ドロップゾーン */}
                        <div
                          id="pdf_drop_zone"
                          onDragEnter={handlePdfDragEnter}
                          onDragOver={handlePdfDragOver}
                          onDragLeave={handlePdfDragLeave}
                          onDrop={handlePdfDrop}
                          onClick={() => !isPdfParsing && document.getElementById("pdf_file_input")?.click()}
                          className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center transition select-none ${
                            isPdfParsing ? "border-gray-250 bg-gray-50/50 cursor-not-allowed" :
                            isPdfDragging 
                              ? "border-indigo-500 bg-indigo-50/55 cursor-pointer" 
                              : "border-gray-205 hover:border-indigo-400 hover:bg-gray-50/50 cursor-pointer"
                          }`}
                        >
                          <input
                            type="file"
                            id="pdf_file_input"
                            accept=".pdf"
                            onChange={handlePdfFileChange}
                            disabled={isPdfParsing}
                            className="hidden"
                          />
                          {isPdfParsing ? (
                            <div className="flex flex-col items-center justify-center py-2 text-center">
                              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-2" />
                              <p className="text-xs font-black text-indigo-800 dark:text-indigo-400 animate-pulse">
                                AIがドキュメントを読み取り中...
                              </p>
                              <p className="text-[9px] text-gray-600 mt-1">
                                最適な問題セット（4択クイズ、文脈例文）を自動で作成しています
                              </p>
                            </div>
                          ) : (
                            <>
                              <FileText className={`w-8 h-8 mb-2 transition ${isPdfDragging ? "text-indigo-600 scale-110" : "text-gray-400"}`} />
                              <p className="text-xs font-bold text-gray-700 text-center">
                                PDFファイルをドラッグ＆ドロップ、またはクリックして選択
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1 font-mono">
                                テキスト情報を含む PDF（.pdf）に対応
                              </p>
                            </>
                          )}
                        </div>

                        {pdfSuccess && (
                          <div className="text-xs text-indigo-700 font-semibold mt-3 bg-indigo-50 rounded-lg border border-indigo-100 p-2.5 flex items-center gap-2 animate-fade-in shadow-inner">
                            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-indigo-500" />
                            <span className="whitespace-pre-line leading-relaxed">{pdfSuccess}</span>
                          </div>
                        )}

                        {pdfError && (
                          <div className="text-xs text-rose-500 font-medium mt-3 bg-rose-50 rounded-lg border border-rose-100 p-2.5 flex items-center gap-2 animate-fade-in">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                            <span>{pdfError}</span>
                          </div>
                        )}

                        {/* PDF処理のメリット紹介 */}
                        <div className="bg-indigo-50/40 border border-indigo-100/50 rounded-2xl p-4 mt-4 shadow-3xs">
                          <h4 className="text-xs font-black text-indigo-800 flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                            <span>💡 PDF AIスマートインポート</span>
                          </h4>
                          <p className="text-[11px] text-gray-600 leading-relaxed font-sans">
                            <b>Gemini</b>がお手元のPDFから学術・日常シーンで役立つ英単語を抽出し、レベル分類から代表和訳、オリジナルの例文英作文・択一クイズのすべてをワンタップで追加！教科書の予習や試験学習に威力を発揮します。
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 調べるタブ。辞書・活用表・文法ガイドの入口をまとめる。
          上部のナビに散らばっていて、何がどこにあるのか分かりにくかった */}
      {activeTab === "reference" && (
        <div className="space-y-3" data-testid="reference_tab">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-5">
            <div className="flex items-start gap-2">
              <BookMarked className="w-5 h-5 text-sky-600 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-lg font-black text-gray-900 dark:text-slate-100">調べる</h2>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed mt-1">
                  解いていて分からなかったことを確かめる場所です。
                  意味と使い方は辞書、形の変化は活用表、並べ方は文法ガイドで調べられます。
                </p>
              </div>
            </div>
          </div>

          {REFERENCE_ENTRIES.map(entry => (
            <button
              key={entry.id}
              onClick={
                entry.id === "dictionary" ? onOpenDictionary
                  : entry.id === "verb_forms" ? onOpenVerbForms
                    : onOpenGrammar
              }
              id={`btn_reference_${entry.id}`}
              className="w-full text-left bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-2xl p-4 hover:border-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-3.5"
            >
              <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${entry.tone}`}>
                <entry.icon className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-black text-gray-900 dark:text-slate-100">{entry.title}</span>
                <span className="block text-xs font-semibold text-gray-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  {entry.description}
                </span>
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {activeTab === "ai" && (
        <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6" id="ai_advisor_section">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-purple-100 rounded-xl text-purple-700">
              <Sparkles className="w-4 h-4 fill-purple-200" />
            </span>
            <span className="text-xs font-black tracking-wider uppercase font-mono text-purple-700">AI Study Advisor</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">AIパーソナル学習アドバイザリー</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">
            あなたの回答履歴（レベル別の習得率、まだ手を付けていないレベル、間違えた単語の数）を分析して、
            次に取り組むレベルと具体的な進め方を示します。押すたびに最新の記録で分析し直します。
          </p>

          <div className="mt-6 border-t border-gray-100 pt-6">
            {advice ? (
              <div className="space-y-4">
                <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5 text-gray-800 text-sm leading-relaxed max-w-none">
                  <SimpleMarkdown text={advice} />
                </div>
                {adviceSource && (
                  <p className="text-[11px] font-bold text-gray-400" id="advice_source">
                    {adviceSource === "ai"
                      ? "Gemini AI が生成しました。"
                      : "AIキーが未設定のため、アプリが学習記録から組み立てました。"}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={handleFetchAdvice}
                    disabled={isFetchingAdvice}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    {isFetchingAdvice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    <span>最新の回答進捗で再分析</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <Sparkles className="w-12 h-12 text-indigo-300 mx-auto mb-3 animate-pulse" />
                <p className="text-gray-600 font-extrabold mb-1">あなたの回答傾向をAIが分析します</p>
                <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
                  スタッツ、弱点、学習履歴をもとに最適化された効率的コーチングアドバイスを受け取りましょう。
                </p>
                <button
                  onClick={handleFetchAdvice}
                  disabled={isFetchingAdvice}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-6 py-3 rounded-xl transition shadow hover:shadow-md inline-flex items-center gap-2 cursor-pointer text-sm"
                  id="btn_get_advice"
                >
                  {isFetchingAdvice ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>進捗データを分析中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>AIアドバイスを受け取る</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {adviceError && (
              <p className="text-sm text-rose-500 font-medium mt-3 bg-rose-50 border border-rose-100 rounded-lg p-3">
                {adviceError}
              </p>
            )}
          </div>

          {/* 弱点分野の自動分析セクション */}
          <div className="mt-8 border-t border-gray-100 pt-6" id="weakness_analysis_section">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 bg-rose-100 rounded-xl text-rose-700">
                <Brain className="w-4 h-4" />
              </span>
              <span className="text-xs font-black tracking-wider uppercase font-mono text-rose-700">Weakness Analyzer</span>
            </div>
            <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">弱点分野の自動分析</h2>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              「間違えた単語の復習」に溜まった単語から、あなたが苦手とする領域とその克服アドバイスを出します。
              Gemini APIキーがあるときは AI が分析し、無いときはアプリが品詞を数えて組み立てます（結果に出どころを書きます）。
            </p>

            <div className="mt-6">
              {weaknessAnalysis ? (
                <div className="space-y-5">
                  <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-5">
                    <p className="text-sm text-gray-800 leading-relaxed font-semibold">
                      {weaknessAnalysis.summary}
                    </p>
                  </div>
                  {/* 出どころを書く。AIキーが無いときは品詞を数えただけの集計なので、
                      AIの分析として読まれると内容を過大に受け取らせてしまう */}
                  <p className="text-[11px] font-bold text-gray-400" id="weakness_source">
                    {weaknessAnalysis.isFallback
                      ? "AIキーが未設定のため、アプリが間違えた単語の品詞を数えて組み立てました。"
                      : "Gemini AI が分析しました。"}
                  </p>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                      <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">品詞別の傾向</h3>
                      <div className="space-y-2.5">
                        {weaknessAnalysis.partOfSpeechStats.map((stat, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                              <span>{stat.label}</span>
                              <span className="font-mono">{stat.count}語 ({stat.percentage}%)</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-rose-500 rounded-full"
                                style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
                      <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">分野・テーマ別の傾向</h3>
                      <div className="space-y-2.5">
                        {weaknessAnalysis.topicStats.map((stat, i) => (
                          <div key={i}>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                              <span>{stat.label}</span>
                              <span className="font-mono">{stat.count}語 ({stat.percentage}%)</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl p-4">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-wide mb-3">克服のための学習アドバイス</h3>
                    <ul className="space-y-1.5">
                      {weaknessAnalysis.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                          <ThumbsUp className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleFetchWeaknessAnalysis}
                      disabled={isFetchingWeakness}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      {isFetchingWeakness ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>最新の間違えた単語で再分析</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Brain className="w-12 h-12 text-rose-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-extrabold mb-1">間違えた単語の傾向を分析します</p>
                  <p className="text-xs text-gray-400 mb-5 max-w-xs mx-auto">
                    現在 <span className="font-mono font-bold">{wrongWords.length}語</span> の間違えた単語が記録されています。品詞や分野の傾向から、あなたの弱点分野を見つけます。
                  </p>
                  <button
                    onClick={handleFetchWeaknessAnalysis}
                    disabled={isFetchingWeakness}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-bold px-6 py-3 rounded-xl transition shadow hover:shadow-md inline-flex items-center gap-2 cursor-pointer text-sm"
                    id="btn_get_weakness_analysis"
                  >
                    {isFetchingWeakness ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>間違えた単語を分析中...</span>
                      </>
                    ) : (
                      <>
                        <Brain className="w-4 h-4" />
                        <span>弱点分野を分析する</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {weaknessError && (
                <p className="text-sm text-rose-500 font-medium mt-3 bg-rose-50 border border-rose-100 rounded-lg p-3">
                  {weaknessError}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "ranking" && (
        <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6" id="ranking_section">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="p-1.5 bg-amber-100 rounded-xl text-amber-700">
                  <Trophy className="w-4 h-4 fill-amber-200" />
                </span>
                <span className="text-xs font-black tracking-wider uppercase font-mono text-amber-700">My Records</span>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">自己ベスト記録</h2>
              <p className="text-sm text-gray-500 mt-1 max-w-md">
                クイズの回答やAI単語の追加でスコアが増えます。過去の自分を超え続けることが一番の上達への近道です。
              </p>
            </div>
            <button
              onClick={onOpenGachaShop}
              className="bg-gradient-to-r from-violet-600 to-indigo-700 hover:opacity-90 text-white font-bold text-xs px-4 py-3 rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              id="btn_open_gacha_from_ranking"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>貯めたポイントでガチャを引く</span>
            </button>
          </div>

          {/* 自己ベスト・累計スタッツパネル */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3" id="self_records_panel">
            <div className="bg-amber-50/70 border border-amber-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-amber-700 font-black tracking-wider uppercase block">総スコア</span>
              <p className="text-2xl font-black text-amber-800 font-mono mt-1">{stats.score}<span className="text-xs text-amber-700 ml-0.5">P</span></p>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-emerald-700 font-black tracking-wider uppercase block">連続ログイン</span>
              <p className="text-2xl font-black text-emerald-800 font-mono mt-1">{stats.currentStreak}<span className="text-xs text-emerald-700 ml-0.5">日</span></p>
            </div>
            <div className="bg-indigo-50/70 border border-indigo-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-indigo-600 font-black tracking-wider uppercase block">累計回答数</span>
              <p className="text-2xl font-black text-indigo-800 font-mono mt-1">{stats.completedQuestions}<span className="text-xs text-indigo-700 ml-0.5">問</span></p>
            </div>
            <div className="bg-rose-50/70 border border-rose-150 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-rose-700 font-black tracking-wider uppercase block">累計正答率</span>
              <p className="text-2xl font-black text-rose-800 font-mono mt-1">
                {stats.completedQuestions > 0 ? Math.round((stats.correctAnswers / stats.completedQuestions) * 100) : 0}<span className="text-xs text-rose-700 ml-0.5">%</span>
              </p>
            </div>
          </div>

          {/* 仮想ライバル（CPU）との比較 */}
          <div className="mt-8">
            <h3 className="text-sm font-extrabold text-gray-700">仮想ライバル（CPU）とのスコア比較</h3>
            <p className="text-xs text-gray-400 mt-1">
              ※ 以下は実在のユーザーではなく、練習用に用意された架空のCPUライバルです。目標スコアの目安としてご活用ください。
            </p>
          </div>

          <div className="mt-4 border border-gray-150 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-inner">
            {ranking.map((user, idx) => {
              const place = idx + 1;
              const isMe = user.isMe;
              
              // 順位に応じたメダル
              let badge = null;
              if (place === 1) badge = <span className="text-lg">🥇</span>;
              else if (place === 2) badge = <span className="text-lg">🥈</span>;
              else if (place === 3) badge = <span className="text-lg">🥉</span>;
              else badge = <span className="text-sm font-semibold font-mono text-gray-400">{place}</span>;

              return (
                <div 
                  key={user.id} 
                  className={`flex items-center justify-between p-4 transition-all ${
                    isMe ? "bg-amber-50/70 py-5 border-y border-amber-200/50" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 flex justify-center items-center">
                      {badge}
                    </div>
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 bg-white flex items-center justify-center text-xl shadow-sm">
                      {isMe && equipped.avatar ? equipped.avatar : user.avatar}
                    </div>
                    <div>
                      <h4 className={`text-sm tracking-tight ${isMe ? "font-black text-amber-900" : "font-bold text-gray-800"}`}>
                        {user.name} {isMe ? <span className="bg-amber-100 text-amber-700 text-[10px] py-0.5 px-2 rounded-full font-bold ml-1 font-sans">YOU</span> : <span className="bg-gray-100 text-gray-600 text-[10px] py-0.5 px-2 rounded-full font-bold ml-1 font-sans">CPU</span>}
                      </h4>
                      <p className="text-xs text-gray-400 font-medium">
                        {isMe && equipped.title ? (
                          <span className="text-indigo-600 font-bold">🏷️ {equipped.title}</span>
                        ) : isMe ? "あなたの現在位置" : "仮想ライバル"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black font-mono text-gray-800 tracking-tight">{user.score}</span>
                    <span className="text-[10px] text-gray-400 font-bold ml-0.5">P</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === "bonus" && (
        <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-6" id="bonus_section">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-emerald-100 rounded-xl text-emerald-700">
              <Calendar className="w-4 h-4" />
            </span>
            <span className="text-xs font-black tracking-wider uppercase font-mono text-emerald-700">Daily Login Stamp Rally</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">デイリーログインスタンプ</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            1日に1回、光っているスタンプを押すとログインボーナスを受け取れます。毎日継続して、大量ボーナスを獲得しましょう。
          </p>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-7 gap-4">
            {bonusDays.map((bonus, idx) => {
              // 過去に受け取った日、もしくは本日の進捗
              const isClaimedToday = !checkCanClaimToday();
              const claimedCount = isClaimedToday 
                ? ((stats.currentStreak - 1) % 7) + 1 
                : stats.currentStreak % 7;
              
              // どのスタンプが現在マークされているか
              let status: "claimed" | "active" | "locked" = "locked";
              if (idx < claimedCount) {
                status = "claimed";
              } else if (idx === claimedCount && !isClaimedToday) {
                status = "active";
              }

              // 受け取りは今日ぶんの日付を押して行う。別に「受け取る」ボタンを
              // 置いていたが、押す先が2つあると同じ操作の入口が分かれるため外した。
              // 受け取り済みの日と、まだ先の日は押しても何も起きないので、
              // ボタンにせず今までどおりの枠のままにする
              const isClaimable = status === "active";
              const cardClass = `border rounded-2xl p-4 flex flex-col items-center text-center transition-all ${
                status === "claimed"
                  ? "bg-emerald-50 border-emerald-200"
                  : status === "active"
                    ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md scale-102 hover:bg-indigo-100 cursor-pointer"
                    : "bg-gray-50 border-gray-100 opacity-60"
              }`;
              const inner = (
                <>
                  <span className="text-xs text-gray-600 font-bold">DAY {bonus.day}</span>
                  <div className="my-3 text-3xl">
                    {status === "claimed" ? "🎁" : idx === 6 ? "👑" : "💎"}
                  </div>
                  <span className={`text-[11px] font-black font-mono tracking-tight ${status === "claimed" ? "text-emerald-700" : "text-gray-700"}`}>
                    {status === "claimed" ? "受取済" : `+${bonus.points} P`}
                  </span>
                </>
              );

              return isClaimable ? (
                <button
                  key={bonus.day}
                  type="button"
                  onClick={handleClaimLoginBonus}
                  className={cardClass}
                  id={`btn_claim_bonus_day_${bonus.day}`}
                  aria-label={`DAY ${bonus.day} のログインボーナス ${bonus.points} ポイントを受け取る`}
                >
                  {inner}
                </button>
              ) : (
                <div key={bonus.day} className={cardClass}>
                  {inner}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            {checkCanClaimToday() ? (
              /* 押す先はスタンプだけなので、どれを押すのかをここで言葉にする。
                 光っているだけでは「押せる」ことが伝わらない */
              <div
                className="bg-indigo-50 rounded-2xl p-4 text-center border font-semibold border-indigo-200 text-indigo-700 inline-flex items-center gap-2 text-sm"
                id="claim_bonus_hint"
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span>光っているスタンプを押すと、本日のボーナスを受け取れます。</span>
              </div>
            ) : (
              <div className="bg-gray-100 rounded-2xl p-4 text-center border font-semibold border-gray-200 text-gray-500 inline-flex items-center gap-2 text-sm">
                <ThumbsUp className="w-5 h-5 text-emerald-500" />
                <span>本日のログインボーナスはすべて獲得済みです。明日また来てね！</span>
              </div>
            )}
          </div>

          {/* 学習カレンダー（日別解答数のヒートマップ）。
              毎日開くログインボーナスと並べて、続けた日が見えるようにする。
              「習熟度 & クイズ」に常時置いていたときは縦に443pxあり、
              その下の出題の入口を押し下げていた */}
          <div className="mt-8 pt-6 border-t border-gray-100" data-testid="calendar_in_bonus">
            <StudyCalendar dailyLog={dailyLog} dailyGoal={dailyGoal} />
          </div>
        </div>
      )}
      {/* CSVテンプレートモーダル */}
      {showCsvTemplateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-start justify-center z-50 p-4 overflow-y-auto" id="csv_template_modal">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative my-auto transform scale-100 transition-all max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            {/* ヘッダー */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-emerald-50 rounded-xl text-emerald-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  </span>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">インポート用 CSV テンプレート例</h3>
                    <p className="text-[10px] text-gray-400 font-mono">CSV Import Templates & Specs</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCsvTemplateModal(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-xl text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* タブ切り替え（標準フル vs 最小構成） */}
              <div className="flex bg-gray-100 p-1 rounded-xl mb-5 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setCsvTemplateType("full")}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    csvTemplateType === "full"
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  <span>標準テンプレート（フル機能推奨）</span>
                  <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[9px] font-black font-mono">5列</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCsvTemplateType("min")}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    csvTemplateType === "min"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-850"
                  }`}
                >
                  <span>簡易テンプレート（英単語と訳のみ）</span>
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[9px] font-black font-mono">2列</span>
                </button>
              </div>

              {/* プレビューテーブル表示 & 列詳細 */}
              <div className="mb-5">
                <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                  <span>📄 アップロード時のExcel/テーブルプレビューイメージ</span>
                </h4>
                <div className="border border-gray-150 rounded-xl overflow-hidden shadow-3xs overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse font-sans min-w-[500px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-250 text-gray-600 font-extrabold text-[10px] uppercase font-mono tracking-wider">
                        <th className="p-2.5">1列目 (word)</th>
                        <th className="p-2.5">2列目 (translation)</th>
                        {csvTemplateType === "full" && (
                          <>
                            <th className="p-2.5">3列目 (level)</th>
                            <th className="p-2.5">4列目 (sentence)</th>
                            <th className="p-2.5">5列目 (sentenceTranslation)</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-705 font-mono">
                      {csvTemplateType === "full" ? (
                        <>
                          <tr>
                            <td className="p-2.5 font-bold text-indigo-600">evaluate</td>
                            <td className="p-2.5 text-gray-900">評価する</td>
                            <td className="p-2.5 text-gray-400">advanced</td>
                            <td className="p-2.5 text-[10px]">We must carefully <span className="text-rose-500 font-bold">[_____]</span> our options...</td>
                            <td className="p-2.5 text-[10px]">決定する前に慎重に評価...</td>
                          </tr>
                          <tr className="bg-slate-50/40">
                            <td className="p-2.5 font-bold text-indigo-600">curiosity</td>
                            <td className="p-2.5 text-gray-900">好奇心</td>
                            <td className="p-2.5 text-gray-400">junior</td>
                            <td className="p-2.5 text-[10px]">His eyes were full of <span className="text-rose-500 font-bold">[_____]</span>.</td>
                            <td className="p-2.5 text-[10px]">彼の目は好奇心に満ちていた。</td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr>
                            <td className="p-2.5 font-bold text-emerald-600">accomplish</td>
                            <td className="p-2.5 text-gray-900">成し遂げる</td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td className="p-2.5 font-bold text-emerald-600">collaborate</td>
                            <td className="p-2.5 text-gray-900">共同で取り組む</td>
                          </tr>
                          <tr>
                            <td className="p-2.5 font-bold text-emerald-600">hypothesis</td>
                            <td className="p-2.5 text-gray-900">仮説</td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
                {csvTemplateType === "min" && (
                  <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed pl-1 font-medium font-sans">
                    ※ 簡易型はレベル指定がないため、アップロード画面で<b>あらかじめ選択された「所属レベル」</b>に自動。例文やクイズ用4択肢等もアプリ側でインテリジェントに自動生成します。
                  </p>
                )}
              </div>

              {/* CSV生テキストとコピー */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-750 flex items-center gap-1">
                    <span>💡 CSVプレーンテキスト (コピー＆ペースト用)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const txt = csvTemplateType === "full" 
                        ? "word,translation,level,sentence,sentenceTranslation\nevaluate,評価する,advanced,We must carefully evaluate our options before deciding.,決定する前に、私たちは選択肢を慎重に評価しなければなりません。\npinnacle,頂点、極致,advanced,Winning the award was the pinnacle of her career.,その賞を受けることは、彼女のキャリアの頂点でした。\ncomply,従う、遵守する,senior3,All staff members must comply with safety regulations.,全職員が安全規則に従わなければなりません。\ncuriosity,好奇心,junior,His eyes were full of childish curiosity.,彼の目は子供のような好奇心に満ちていました。"
                        : "word,translation\naccomplish,成し遂げる\ncollaborate,共同で取り組む\nhypothesis,仮説\nnegotiation,交渉";
                      handleCopyTemplate(txt);
                    }}
                    className="text-[11px] bg-slate-50 hover:bg-slate-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer font-bold shadow-3xs"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">コピーしました！</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                        <span>テキストをコピー</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] leading-relaxed relative overflow-x-auto select-all shadow-inner border border-slate-950">
                  <pre className="whitespace-pre text-left">
                    {csvTemplateType === "full" 
                      ? `word,translation,level,sentence,sentenceTranslation
evaluate,評価する,advanced,We must carefully evaluate our options before deciding.,決定する前に、私たちは選択肢を慎重に評価しなければなりません。
pinnacle,頂点、極致,advanced,Winning the award was the pinnacle of her career.,その賞を受けることは、彼女のキャリアの頂点でした。
comply,従う、遵守する,senior3,All staff members must comply with safety regulations.,全職員が安全規則に従わなければなりません。
curiosity,好奇心,junior,His eyes were full of childish curiosity.,彼の目は子供のような好奇心に満ちていました。`
                      : `word,translation
accomplish,成し遂げる
collaborate,共同で取り組む
hypothesis,仮説
negotiation,交渉`}
                  </pre>
                </div>
              </div>

              {/* Excel保存のアドバイス・エラー対策 */}
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-2xl p-4 text-[11px] text-amber-900 leading-relaxed">
                <h5 className="font-bold flex items-center gap-1.5 mb-1.5 text-amber-950 text-xs">
                  <HelpCircle className="w-4 h-4 text-amber-750 flex-shrink-0" />
                  <span>⚠️ ExcelやGoogleスプレッドシートで保存するときの注意点</span>
                </h5>
                <ul className="list-decimal pl-4.5 space-y-1">
                  <li>
                    CSVを書き出す際は、必ずファイルの種類の選択肢で<b> 「CSV UTF-8 (カンマ区切り) (*.csv)」</b> を選択してください。通常のCSV（Excel既定のShift-JIS）を選んでしまうと、日本語が文字化けや取り込みエラーの原因となります。
                  </li>
                  <li>
                    ヘッダー行（1行目の <code>word,translation...</code>）は必須ではありませんが、これがあると列の名前から配列を自動認識するため便利で安全です。
                  </li>
                </ul>
              </div>
            </div>

            {/* フッターダウンロードボタン */}
            <div className="mt-6 pt-4 border-t border-gray-150 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleDownloadTemplate(csvTemplateType)}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition shadow-md hover:shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-white" />
                <span>このテンプレートの CSV ファイルを直接ダウンロード ➔</span>
              </button>
              <button
                type="button"
                onClick={() => setShowCsvTemplateModal(false)}
                className="py-3 px-6 bg-gray-100 hover:bg-gray-150 text-gray-600 rounded-xl font-bold text-xs transition cursor-pointer text-center"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
