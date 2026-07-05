import React, { useState, useEffect } from "react";
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
  BookOpen,
  Loader2,
  ThumbsUp,
  Compass,
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
  HelpCircle
} from "lucide-react";
import { Level, Word, UserStats, RankingUser } from "../types";
import SimpleMarkdown from "./SimpleMarkdown";
import { todayStr } from "../srs";
import { initialVocabulary } from "../data/vocabulary";
import { getWordPos } from "../pos";
import StudyCalendar from "./StudyCalendar";

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
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  wrongWords: string[];
  onStartQuiz: (level: Level, type: "word" | "sentence" | "listening", count?: number) => void;
  onStartReview: () => void;
  onOpenDictionary: () => void;
  onStartReading: () => void;
  ranking: RankingUser[];
  setRanking: React.Dispatch<React.SetStateAction<RankingUser[]>>;
  dailyLog: Record<string, { count: number; correct: number }>;
  dailyGoal: number;
}

export default function Dashboard({
  stats,
  setStats,
  vocabulary,
  setVocabulary,
  solvedHistory,
  wrongWords,
  onStartQuiz,
  onStartReview,
  onOpenDictionary,
  onStartReading,
  ranking,
  setRanking,
  dailyLog,
  dailyGoal
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
  };

  const handleCopyTemplate = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // CSVシンプルなパーサー
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let entry = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          entry += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(entry.trim());
        entry = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        row.push(entry.trim());
        lines.push(row);
        row = [];
        entry = '';
      } else {
        entry += char;
      }
    }
    if (entry || row.length > 0) {
      row.push(entry.trim());
      lines.push(row);
    }
    return lines.filter(r => r.length > 0 && r.some(c => c !== ''));
  };

  // 誤選択肢用のダミーワード抽出
  const getCsvDistractors = (pool: string[], correct: string, count = 3): string[] => {
    const res: string[] = [];
    const filteredPool = pool.filter(x => x && x.toLowerCase() !== correct.toLowerCase());
    const uniquePool = Array.from(new Set(filteredPool));
    
    const size = uniquePool.length;
    if (size === 0) {
      return [correct, correct, correct];
    }

    const seen = new Set<string>();
    while (res.length < count && seen.size < size) {
      const idx = Math.floor(Math.random() * size);
      const val = uniquePool[idx];
      if (!seen.has(val)) {
        seen.add(val);
        res.push(val);
      }
    }
    while (res.length < count) {
      res.push(uniquePool[Math.floor(Math.random() * size)] || correct);
    }
    return res;
  };

  const shuffleArray = <T,>(arr: T[]): T[] => {
    return [...arr].sort(() => Math.random() - 0.5);
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

          let sentence = row[3] ? row[3].trim() : "";
          let sentenceTranslation = row[4] ? row[4].trim() : "";

          if (!sentence) {
            sentence = `I want to study [_____] today.`;
            sentenceTranslation = `私は今日、[_____]を勉強したいです。`;
          } else {
            if (!sentence.includes("[_____]")) {
              const regex = new RegExp(rawWord, "gi");
              if (regex.test(sentence)) {
                sentence = sentence.replace(regex, "[_____]");
              } else {
                sentence = sentence + " [_____]";
              }
            }
          }

          const jpPool = tempVocabulary.filter(w => w.level === level).map(w => w.translation);
          const jpDistractors = getCsvDistractors(jpPool, rawTranslation, 3);
          const options = shuffleArray([rawTranslation, ...jpDistractors]);

          const enPool = tempVocabulary.filter(w => w.level === level).map(w => w.word);
          const enDistractors = getCsvDistractors(enPool, rawWord, 3);
          const sentenceOptions = shuffleArray([rawWord, ...enDistractors]);

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

          if (!response.ok) {
            throw new Error("サーバーとの通信に失敗しました。快適な接続環境下で再度お試しください。");
          }

          const data = await response.json();
          if (data.error) {
            throw new Error(data.error);
          }

          const words: Word[] = data.words || [];
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
  const [isFetchingAdvice, setIsFetchingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  const [weaknessAnalysis, setWeaknessAnalysis] = useState<WeaknessAnalysis | null>(null);
  const [isFetchingWeakness, setIsFetchingWeakness] = useState(false);
  const [weaknessError, setWeaknessError] = useState("");

  const [activeTab, setActiveTab] = useState<"progress" | "ranking" | "bonus" | "ai">("progress");

  // 出題単語数選択用のステート
  const [selectedWordLimitLevel, setSelectedWordLimitLevel] = useState<Level | null>(null);
  const [tempLimitOption, setTempLimitOption] = useState<number>(10);

  // 各レベルの単語カウントと習熟度計算
  const getLevelCounts = (level: Level) => {
    const levelWords = vocabulary.filter(w => w.level === level);
    const total = levelWords.length;
    const completed = levelWords.filter(w => solvedHistory[w.id] && solvedHistory[w.id].attemptCount > 0).length;
    const correct = levelWords.filter(w => solvedHistory[w.id] && solvedHistory[w.id].correctCount > 0).length;
    const masterRate = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    return { total, completed, correct, masterRate };
  };

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

  const handleClaimLoginBonus = () => {
    if (!checkCanClaimToday()) return;

    playAudio("bonus");
    const today = todayStr();
    
    // スコア追加
    const rawIndex = stats.currentStreak % 7;
    const points = bonusDays[rawIndex].points;
    const nextStreak = (stats.lastLoginDate === getYesterdayString()) ? stats.currentStreak + 1 : 1;
    
    const newScore = stats.score + points;
    
    setStats(prev => ({
      ...prev,
      score: newScore,
      currentStreak: nextStreak,
      lastLoginDate: today
    }));

    // ランキングの更新
    setRanking(prev => {
      const updated = prev.map(u => u.isMe ? { ...u, score: newScore } : u);
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
      
      // 既存の単語と同じ英単語があれば重複追加を防ぐ
      const isDuplicate = vocabulary.some(w => w.word.toLowerCase() === data.word.toLowerCase());
      if (isDuplicate) {
        setAddingError(`「${data.word}」は既に登録されています！`);
        setIsAdding(false);
        return;
      }

      setVocabulary(prev => [...prev, data]);
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

      const msg = data.isFallback
        ? `💡 一時的な自動調整モード:\nAI接続の混雑を避けるため、今回はローカルエンジンを使用して英単語「${data.word}」を登録しました。\n（自動生成されたクイズと例文が正常に追加されました！）`
        : `AIが英単語「${data.word}」の分析を完了しました！\n難易度: ${
            data.level === "junior" ? "中学生" : data.level === "senior" ? "高校生" : "大学生・社会人"
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
      setAdvice(data.advice);
      playAudio("bonus");
    } catch (err: any) {
      console.error(err);
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
      setWeaknessAnalysis(data);
      playAudio("bonus");
    } catch (err: any) {
      console.error(err);
      setWeaknessError(err.message || "弱点分析の作成に失敗しました。");
    } finally {
      setIsFetchingWeakness(false);
    }
  };

  // 単語追加時に自動的な入力チェック
  const handleWordInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewWord(e.target.value.replace(/[^a-zA-Z\s-]/g, "")); // 英語アルファベット、スペース、ハイフンのみ許容
  };

  return (
    <div className="space-y-6" id="dashboard_page">
      {/* ヒーローヘッダー */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center md:justify-between relative overflow-hidden" id="hero_banner">
        {/* 背景の装飾サークル */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600/60 text-indigo-200 text-xs px-3 py-1 rounded-full font-semibold border border-indigo-400/40 tracking-wider uppercase font-mono">
              Dashboard
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">英単語 Quest</h1>
          <p className="text-indigo-100 text-sm max-w-md">
            中高大・社会人の3レベルを完全攻略。AIと連動した自分だけのクイズスタジオ。
          </p>
        </div>

        {/* コレクトスタッツ */}
        <div className="mt-4 md:mt-0 flex gap-4 md:gap-8 items-center bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 z-10 justify-around">
          <div className="text-center px-4 border-r border-white/10">
            <p className="text-xs text-indigo-200 font-medium">合計スコア</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Trophy className="w-5 h-5 text-amber-300 fill-amber-400" />
              <span className="text-2xl font-black font-mono tracking-tight">{stats.score}</span>
            </div>
          </div>
          <div className="text-center px-4">
            <p className="text-xs text-indigo-200 font-medium">ログイン連続</p>
            <div className="flex items-center gap-1 justify-center mt-1">
              <Calendar className="w-5 h-5 text-pink-300 fill-pink-400/20 animate-pulse" />
              <span className="text-2xl font-black font-mono tracking-tight">{stats.currentStreak}日</span>
            </div>
          </div>
        </div>
      </div>

      {/* タブ切り替え（Bento Gridスタイッシュ） */}
      <div className="grid grid-cols-4 bg-gray-100 p-1 rounded-xl gap-1">
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
            <span>ランキング</span>
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
          {/* 学習カレンダー（日別解答数のヒートマップ） */}
          <StudyCalendar dailyLog={dailyLog} dailyGoal={dailyGoal} />

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
                className="bg-rose-600 text-white font-bold hover:bg-rose-700 transition px-6 py-3 rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap group text-sm md:text-base"
                id="btn_start_review"
              >
                <span>復習をスタートする</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* 長文ストーリー読破ショートカットバナー */}
          <div className="bg-gradient-to-r from-violet-600 to-indigo-700 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-violet-500/20" id="reading_banner">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl shadow-inner border border-white/10 shrink-0">
                <Compass className="w-6 h-6 text-amber-300 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  長文ストーリー読破 Quest が新登場！
                  <span className="bg-amber-400 text-slate-900 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">new</span>
                </h3>
                <p className="text-violet-100 text-xs mt-1 max-w-xl font-medium leading-relaxed">
                  各レベルの重要ターゲット英単語「のみ」を用いて丁寧に書き下ろされた長文を読んで、実践的なリーディング力を鍛えましょう！単語ホバーによる自動翻訳翻訳付き、完全読覇でボーナスポイント獲得！
                </p>
              </div>
            </div>
            {onStartReading && (
              <button
                onClick={onStartReading}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black px-4.5 py-2.5 rounded-xl shadow-md transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1 text-[11px] md:text-xs"
                id="dashboard_open_reading_btn"
              >
                <span>長文を読む ➔</span>
              </button>
            )}
          </div>

          {/* AI英語日記解放ショートカットバナー */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4 border border-amber-400/20" id="diary_banner_dashboard">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-md text-white rounded-xl shadow-inner border border-white/10 shrink-0">
                <Sparkles className="w-6 h-6 text-yellow-300 fill-yellow-250/20 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <span>AI 英語日記 (AI English Journal)</span>
                  {Object.values(solvedHistory).filter(h => h.correctCount > 0).length >= 200 ? (
                    <span className="bg-emerald-400 text-slate-900 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-bounce">解放済み (Unlocked)</span>
                  ) : (
                    <span className="bg-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">習得200語で解放</span>
                  )}
                </h3>
                <p className="text-amber-50 text-xs mt-1 max-w-xl font-medium leading-relaxed leading-normal">
                  あなたが単語テストや穴埋め問題で完璧に覚えた英単語をふんだんに使用して、AIがオシャレな200〜400文字の「英語日記」を全自動で書き下ろします。実践的なアウトプット学習に最適です！
                  <span className="block mt-1 font-mono text-[10px] text-amber-200 font-extrabold">現在の習得数: {Object.values(solvedHistory).filter(h => h.correctCount > 0).length} / 200 単語</span>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const navBtn = document.getElementById("nav_diary_toggle_btn");
                if (navBtn) {
                  navBtn.click();
                }
              }}
              className="bg-white text-slate-900 hover:bg-gray-100 text-xs font-black px-4.5 py-2.5 rounded-xl shadow-md transition-all shrink-0 cursor-pointer flex items-center justify-center gap-1.5"
              id="dashboard_open_diary_btn"
            >
              <span>{Object.values(solvedHistory).filter(h => h.correctCount > 0).length >= 200 ? "日記を書く/読む ➔" : "進捗を確認する ➔"}</span>
            </button>
          </div>

          {/* 単語辞書一覧ショートカットバナー */}
          <div className="bg-indigo-50/45 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm" id="dictionary_banner">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-2xs shrink-0 border border-indigo-500/20">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                  全レベル単語の辞書・組み合わせリスト一覧
                </h4>
                <p className="text-xs text-indigo-700/80 mt-0.5 font-medium leading-relaxed">
                  初級から上級まで、すべての英単語＆日本語の組み合わせリスト。キーワード検索や発音再生、例文の確認が可能です！
                </p>
              </div>
            </div>
            <button
              onClick={onOpenDictionary}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4.5 py-2.5 rounded-xl shadow-xs hover:shadow-md cursor-pointer transition whitespace-nowrap"
              id="dashboard_open_dict_btn"
            >
              辞書一覧を開く
            </button>
          </div>

          {/* クイズレベル選択 - スタイリッシュデザイン */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6" id="level_selection_section">
            
            {/* JUNIOR CARD */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative flex flex-col justify-between" id="junior_level_card">
              <div>
                <div className="flex justify-between items-start">
                  <span className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-bold">
                    初級 (中学生レベル)
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">習熟度</span>
                    <p className="text-lg font-black text-blue-700 font-mono">{juniorStats.masterRate}%</p>
                  </div>
                </div>

                {/* 進捗バー */}
                <div className="mt-4 bg-gray-100 w-full h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${juniorStats.masterRate}%` }}
                  />
                </div>
                
                <div className="mt-3 flex justify-between text-xs text-gray-500 font-mono">
                  <span>覚えた: {juniorStats.correct} 語</span>
                  <span>全 {juniorStats.total} 語</span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600 border-t border-gray-50 pt-4">
                  <p className="text-xs font-semibold text-gray-400">収録語句の例:</p>
                  <p className="font-mono text-xs text-gray-500">beautiful, library, important, station...</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedWordLimitLevel("junior");
                    setTempLimitOption(10);
                  }}
                  className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-blue-700 shadow-sm hover:shadow transition"
                  id="btn_junior_word"
                >
                  一問一答を解く
                </button>
                <button
                  onClick={() => onStartQuiz("junior", "sentence")}
                  className="w-full bg-blue-50 text-blue-700 font-bold py-2.5 rounded-xl text-xs hover:bg-blue-100 transition border border-blue-200/50"
                  id="btn_junior_sentence"
                >
                  例文穴埋めを解く
                </button>
                <button
                  onClick={() => onStartQuiz("junior", "listening")}
                  className="w-full bg-blue-50 text-blue-700 font-bold py-2.5 rounded-xl text-xs hover:bg-blue-100 transition border border-blue-200/50"
                  id="btn_junior_listening"
                >
                  🎧 リスニングを解く
                </button>
              </div>
            </div>

            {/* SENIOR CARD */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative flex flex-col justify-between" id="senior_level_card">
              <div>
                <div className="flex justify-between items-start">
                  <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-bold">
                    中級 (高校1年生レベル)
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">習熟度</span>
                    <p className="text-lg font-black text-emerald-700 font-mono">{seniorStats.masterRate}%</p>
                  </div>
                </div>

                {/* 進捗バー */}
                <div className="mt-4 bg-gray-100 w-full h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${seniorStats.masterRate}%` }}
                  />
                </div>
                
                <div className="mt-3 flex justify-between text-xs text-gray-500 font-mono">
                  <span>覚えた: {seniorStats.correct} 語</span>
                  <span>全 {seniorStats.total} 語</span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600 border-t border-gray-50 pt-4">
                  <p className="text-xs font-semibold text-gray-400">収録語句の例:</p>
                  <p className="font-mono text-xs text-gray-500">environment, achieve, technology, protect...</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedWordLimitLevel("senior");
                    setTempLimitOption(10);
                  }}
                  className="w-full bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-emerald-700 shadow-sm hover:shadow transition"
                  id="btn_senior_word"
                >
                  一問一答を解く
                </button>
                <button
                  onClick={() => onStartQuiz("senior", "sentence")}
                  className="w-full bg-emerald-50 text-emerald-700 font-bold py-2.5 rounded-xl text-xs hover:bg-emerald-100 transition border border-emerald-200/50"
                  id="btn_senior_sentence"
                >
                  例文穴埋めを解く
                </button>
                <button
                  onClick={() => onStartQuiz("senior", "listening")}
                  className="w-full bg-emerald-50 text-emerald-700 font-bold py-2.5 rounded-xl text-xs hover:bg-emerald-100 transition border border-emerald-200/50"
                  id="btn_senior_listening"
                >
                  🎧 リスニングを解く
                </button>
              </div>
            </div>

            {/* SENIOR2 CARD (高校2年生レベル) */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative flex flex-col justify-between" id="senior2_level_card">
              <div>
                <div className="flex justify-between items-start">
                  <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-bold">
                    中級 (高校2年生レベル)
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">習熟度</span>
                    <p className="text-lg font-black text-purple-700 font-mono">{senior2Stats.masterRate}%</p>
                  </div>
                </div>

                {/* 進捗バー */}
                <div className="mt-4 bg-gray-100 w-full h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-purple-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${senior2Stats.masterRate}%` }}
                  />
                </div>
                
                <div className="mt-3 flex justify-between text-xs text-gray-500 font-mono">
                  <span>覚えた: {senior2Stats.correct} 語</span>
                  <span>全 {senior2Stats.total} 語</span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600 border-t border-gray-50 pt-4">
                  <p className="text-xs font-semibold text-gray-400">収録語句の例:</p>
                  <p className="font-mono text-xs text-gray-500">skill, tragedy, knowledge, establish...</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedWordLimitLevel("senior2");
                    setTempLimitOption(10);
                  }}
                  className="w-full bg-purple-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-purple-700 shadow-sm hover:shadow transition"
                  id="btn_senior2_word"
                >
                  一問一答を解く
                </button>
                <button
                  onClick={() => onStartQuiz("senior2", "sentence")}
                  className="w-full bg-purple-50 text-purple-700 font-bold py-2.5 rounded-xl text-xs hover:bg-purple-100 transition border border-purple-200/50"
                  id="btn_senior2_sentence"
                >
                  例文穴埋めを解く
                </button>
                <button
                  onClick={() => onStartQuiz("senior2", "listening")}
                  className="w-full bg-purple-50 text-purple-700 font-bold py-2.5 rounded-xl text-xs hover:bg-purple-100 transition border border-purple-200/50"
                  id="btn_senior2_listening"
                >
                  🎧 リスニングを解く
                </button>
              </div>
            </div>

            {/* SENIOR3 CARD (高校3年生レベル) */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative flex flex-col justify-between" id="senior3_level_card">
              <div>
                <div className="flex justify-between items-start">
                  <span className="bg-pink-100 text-pink-700 text-xs px-3 py-1 rounded-full font-bold">
                    中級 (高校3年生レベル)
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">習熟度</span>
                    <p className="text-lg font-black text-pink-700 font-mono">{senior3Stats.masterRate}%</p>
                  </div>
                </div>

                {/* 進捗バー */}
                <div className="mt-4 bg-gray-100 w-full h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-pink-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${senior3Stats.masterRate}%` }}
                  />
                </div>
                
                <div className="mt-3 flex justify-between text-xs text-gray-500 font-mono">
                  <span>覚えた: {senior3Stats.correct} 語</span>
                  <span>全 {senior3Stats.total} 語</span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600 border-t border-gray-50 pt-4">
                  <p className="text-xs font-semibold text-gray-400">収録語句の例:</p>
                  <p className="font-mono text-xs text-gray-500">significant, sacrifice, trigger, delight...</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedWordLimitLevel("senior3");
                    setTempLimitOption(10);
                  }}
                  className="w-full bg-pink-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-pink-700 shadow-sm hover:shadow transition"
                  id="btn_senior3_word"
                >
                  一問一答を解く
                </button>
                <button
                  onClick={() => onStartQuiz("senior3", "sentence")}
                  className="w-full bg-pink-50 text-pink-700 font-bold py-2.5 rounded-xl text-xs hover:bg-pink-100 transition border border-pink-200/50"
                  id="btn_senior3_sentence"
                >
                  例文穴埋めを解く
                </button>
                <button
                  onClick={() => onStartQuiz("senior3", "listening")}
                  className="w-full bg-pink-50 text-pink-700 font-bold py-2.5 rounded-xl text-xs hover:bg-pink-100 transition border border-pink-200/50"
                  id="btn_senior3_listening"
                >
                  🎧 リスニングを解く
                </button>
              </div>
            </div>

            {/* ADVANCED CARD */}
            <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm relative flex flex-col justify-between" id="advanced_level_card">
              <div>
                <div className="flex justify-between items-start">
                  <span className="bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-bold">
                    上級 (大学生・社会人)
                  </span>
                  <div className="text-right">
                    <span className="text-xs text-gray-400">習熟度</span>
                    <p className="text-lg font-black text-amber-700 font-mono">{advancedStats.masterRate}%</p>
                  </div>
                </div>

                {/* 進捗バー */}
                <div className="mt-4 bg-gray-100 w-full h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-600 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${advancedStats.masterRate}%` }}
                  />
                </div>
                
                <div className="mt-3 flex justify-between text-xs text-gray-500 font-mono">
                  <span>覚えた: {advancedStats.correct} 語</span>
                  <span>全 {advancedStats.total} 語</span>
                </div>

                <div className="mt-4 space-y-2 text-sm text-gray-600 border-t border-gray-50 pt-4">
                  <p className="text-xs font-semibold text-gray-400">収録語句の例:</p>
                  <p className="font-mono text-xs text-gray-500">comprehensive, architecture, constraint, execution...</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedWordLimitLevel("advanced");
                    setTempLimitOption(10);
                  }}
                  className="w-full bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-amber-700 shadow-sm hover:shadow transition"
                  id="btn_advanced_word"
                >
                  一問一答を解く
                </button>
                <button
                  onClick={() => onStartQuiz("advanced", "sentence")}
                  className="w-full bg-amber-50 text-amber-700 font-bold py-2.5 rounded-xl text-xs hover:bg-amber-100 transition border border-amber-200/50"
                  id="btn_advanced_sentence"
                >
                  例文穴埋めを解く
                </button>
                <button
                  onClick={() => onStartQuiz("advanced", "listening")}
                  className="w-full bg-amber-50 text-amber-700 font-bold py-2.5 rounded-xl text-xs hover:bg-amber-100 transition border border-amber-200/50"
                  id="btn_advanced_listening"
                >
                  🎧 リスニングを解く
                </button>
              </div>
            </div>

          </div>

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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6 pt-6 border-t border-gray-100">
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
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold font-mono text-sm placeholder-gray-400"
                        id="input_new_word"
                      />
                      <button
                        type="submit"
                        disabled={isAdding || !newWord.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold px-5 rounded-xl transition flex items-center gap-1.5 shadow hover:shadow-md cursor-pointer text-xs whitespace-nowrap"
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
                    <p className="text-[11px] text-slate-500 leading-relaxed">
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
                            ? "bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 shadow-3xs"
                            : "text-gray-500 hover:text-gray-800 dark:hover:text-slate-200"
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
                            ? "bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-400 shadow-3xs"
                            : "text-gray-500 hover:text-gray-800 dark:hover:text-slate-200"
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
                                className={`px-2 py-1 rounded-md text-[10px] font-black transition cursor-pointer ${
                                  defaultCsvLevel === lvl 
                                    ? "bg-white text-emerald-700 shadow-sm" 
                                    : "text-gray-500 hover:text-gray-800"
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
                          <p className="text-[11px] text-slate-500 leading-relaxed mb-2 font-sans">
                            以下の形式で、カンマ区切りのテキストファイルをご用意ください。
                          </p>
                          <div className="bg-white/80 border border-emerald-100 p-2 rounded-lg font-mono text-[10px] text-slate-600 overflow-x-auto leading-relaxed shadow-inner">
                            <div><span className="text-emerald-700 font-bold">1列目:</span> 英単語 (例: evaluate)  <span className="text-[9px] text-rose-500 font-bold">[必須]</span></div>
                            <div><span className="text-emerald-700 font-bold">2列目:</span> 日本語訳 (例: 評価する)  <span className="text-[9px] text-rose-500 font-bold">[必須]</span></div>
                            <div><span className="text-emerald-700 font-bold">3列目:</span> レベル (junior/senior/senior2...) <span className="text-[9px] text-slate-400 font-bold">[任意]</span></div>
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
                              <p className="text-[9px] text-slate-400 mt-1">
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
                          <p className="text-[11px] text-slate-500 leading-relaxed font-sans">
                            <b>Gemini</b>がお手元のPDFから学術・日常シーンで役立つ英単語を抽出し、レベル分類から代表和訳、オリジナルの例文英作文・択一クイズのすべてをワンタップで追加！教科書の予習や試験学習に威力を発揮します。
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
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
            あなたの回答履歴（現在のレベル別習熟度、間違えた単語の数など）をGemini AIが綿密に多角分析し、効率的な英単語学習プランや個別メッセージを提案します。
          </p>

          <div className="mt-6 border-t border-gray-100 pt-6">
            {advice ? (
              <div className="space-y-4">
                <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-5 text-gray-800 text-sm leading-relaxed max-w-none">
                  <SimpleMarkdown text={advice} />
                </div>
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
              「間違えた単語の復習」に溜まった単語をGemini AIが品詞・分野の傾向から分析し、あなたが苦手とする領域とその克服アドバイスを提案します。
            </p>

            <div className="mt-6">
              {weaknessAnalysis ? (
                <div className="space-y-5">
                  <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-5">
                    <p className="text-sm text-gray-800 leading-relaxed font-semibold">
                      {weaknessAnalysis.summary}
                    </p>
                  </div>

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
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3 rounded-xl transition shadow hover:shadow-md inline-flex items-center gap-2 cursor-pointer text-sm"
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
          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 bg-amber-100 rounded-xl text-amber-700">
              <Trophy className="w-4 h-4 fill-amber-200" />
            </span>
            <span className="text-xs font-black tracking-wider uppercase font-mono text-amber-700">Competitive Ranked Board</span>
          </div>
          <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">ライバルランキング</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            クイズの回答やAI単語の追加でスコアが増えます。仮想ライバルたちと競い合い、頂点を目指しましょう！
          </p>

          <div className="mt-6 border border-gray-150 rounded-2xl divide-y divide-gray-100 overflow-hidden shadow-inner">
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
                      {user.avatar}
                    </div>
                    <div>
                      <h4 className={`text-sm tracking-tight ${isMe ? "font-black text-amber-900" : "font-bold text-gray-800"}`}>
                        {user.name} {isMe && <span className="bg-amber-100 text-amber-700 text-[10px] py-0.5 px-2 rounded-full font-bold ml-1 font-sans">YOU</span>}
                      </h4>
                      <p className="text-xs text-gray-400 font-medium">現在ランク</p>
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
            1日に1回ログインボーナスを受け取ることができます。毎日継続して、大量ボーナスを獲得しましょう。
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

              return (
                <div 
                  key={bonus.day} 
                  className={`border rounded-2xl p-4 flex flex-col items-center text-center transition-all ${
                    status === "claimed"
                      ? "bg-emerald-50 border-emerald-200" 
                      : status === "active"
                        ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-md scale-102"
                        : "bg-gray-50 border-gray-100 opacity-60"
                  }`}
                >
                  <span className="text-xs text-gray-400 font-bold">DAY {bonus.day}</span>
                  <div className="my-3 text-3xl">
                    {status === "claimed" ? "🎁" : idx === 6 ? "👑" : "💎"}
                  </div>
                  <span className={`text-[11px] font-black font-mono tracking-tight ${status === "claimed" ? "text-emerald-700" : "text-gray-700"}`}>
                    {status === "claimed" ? "受取済" : `+${bonus.points} P`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            {checkCanClaimToday() ? (
              <button
                onClick={handleClaimLoginBonus}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-10 py-4 rounded-2xl shadow-lg hover:shadow-xl transition flex items-center gap-2 transform active:scale-95 cursor-pointer text-base"
                id="btn_claim_bonus"
              >
                <Sparkles className="w-5 h-5 animate-pulse" />
                <span>ログインボーナスを受け取る！</span>
              </button>
            ) : (
              <div className="bg-gray-100 rounded-2xl p-4 text-center border font-semibold border-gray-200 text-gray-500 inline-flex items-center gap-2 text-sm">
                <ThumbsUp className="w-5 h-5 text-emerald-500" />
                <span>本日のログインボーナスはすべて獲得済みです。明日また来てね！</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 出題単語数選択モーダル */}
      {selectedWordLimitLevel !== null && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 transition-all" id="word_count_modal">
          <div className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative transform scale-100 transition-transform duration-300">
            <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              <span>一問一答の出題単語数を選択</span>
            </h3>
            <p className="text-xs text-gray-400 dark:text-slate-500 font-mono mt-1">Select the number of vocabulary words for this quiz</p>

            <div className="mt-5 space-y-3">
              {[
                { count: 10, label: "10単語", desc: "お気軽クイック学習 (目標: 1分)" },
                { count: 50, label: "50単語", desc: "しっかり集中トレーニング (目標: 5分)" },
                { count: 100, label: "100単語", desc: "本気の限界挑戦テスト (目標: 10分)" }
              ].map((item) => {
                const isSelected = tempLimitOption === item.count;
                return (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setTempLimitOption(item.count)}
                    className={`w-full text-left p-4.5 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 dark:border-indigo-400 text-indigo-950 dark:text-indigo-200 shadow-3xs"
                        : "bg-gray-50/55 dark:bg-slate-850 hover:bg-gray-100 dark:hover:bg-slate-800 border-gray-200 dark:border-slate-800 text-gray-700 dark:text-slate-450"
                    }`}
                  >
                    <div className="flex flex-col">
                      <p className="font-extrabold text-sm flex items-center gap-2">
                        <span className={`w-3 h-3 rounded-full border-2 border-indigo-500 flex items-center justify-center ${isSelected ? "bg-indigo-600 dark:bg-indigo-400" : "bg-transparent"}`} />
                        <span>{item.label}</span>
                      </p>
                      <p className="text-[11px] text-gray-450 dark:text-slate-500 font-semibold mt-1.5 ml-5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedWordLimitLevel(null)}
                className="flex-1 py-3.5 border border-gray-200 dark:border-slate-800 hover:bg-gray-150 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 font-bold rounded-xl text-xs transition cursor-pointer text-center"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedWordLimitLevel) {
                    onStartQuiz(selectedWordLimitLevel, "word", tempLimitOption);
                    setSelectedWordLimitLevel(null);
                  }
                }}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition shadow-md hover:shadow-lg cursor-pointer text-center"
                id="btn_confirm_word_count"
              >
                スタート ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSVテンプレートモーダル */}
      {showCsvTemplateModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto" id="csv_template_modal">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative my-8 transform scale-100 transition-all max-h-[90vh] overflow-y-auto flex flex-col justify-between">
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
                      : "text-gray-500 hover:text-gray-800"
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
