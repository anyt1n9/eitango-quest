import React, { useState, useRef } from "react";
import {
  Sparkles,
  Plus,
  Loader2,
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
import { parseCSV, buildDistractors, normalizeImportedWord } from "../importWords";
import { playChime } from "../sound";
import { shuffle } from "../shuffle";
import { inferPartOfSpeech } from "../pos";
import { toFillInSentence } from "../fillIn";
import { ExpandIcon } from "./AppIcons";
import { LEVEL_LABELS, LEVEL_ORDER } from "../levelLabels";

interface WordImportProps {
  vocabulary: Word[];
  setVocabulary: React.Dispatch<React.SetStateAction<Word[]>>;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  setRanking: React.Dispatch<React.SetStateAction<RankingUser[]>>;
}

/**
 * 単語を増やす（AIで1件ずつ・CSV・PDF）。
 *
 * ダッシュボードの下に置いていたが、毎日の学習では使わないので「教材」の画面へ移した。
 * 取り込みの手順は縦に1,200pxあるので、既定では畳んでおく。
 */
export default function WordImport({ vocabulary, setVocabulary, setStats, setRanking }: WordImportProps) {
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

  /** 取り込みの手順を開いているか。既定は畳む */
  const [showImportPanel, setShowImportPanel] = useState(false);

  /**
   * 取り込みのボーナス点を合計スコアとライバル比較の自分の点に足す。
   *
   * 以前は setStats の更新関数の中で setRanking を呼び、自分の点を合計スコアと
   * 同じ値で上書きしていた。更新関数は副作用を持ってはいけない（StrictMode や
   * 並行描画では2回呼ばれる）うえ、ライバル比較の点と合計スコアは別々に積み上がるので、
   * 上書きするとそれまでの差が消える。クイズの得点（updateRankingScore）と同じく、
   * どちらにも同じ点を足す形にそろえる。
   */
  const addBonus = (points: number) => {
    setStats(prev => ({ ...prev, score: prev.score + points }));
    setRanking(prev =>
      prev.map(u => (u.isMe ? { ...u, score: u.score + points } : u)).sort((a, b) => b.score - a.score)
    );
  };

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
        addBonus(scoreBonus);

        playChime("bonus");
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
          addBonus(scoreBonus);

          playChime("bonus");
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

  // AI単語追加
  /*
   * 追加の連打を同期的に止める。
   *
   * isAdding（＝ボタンの disabled）が効くのは再描画のあとなので、
   * ダブルクリックや Enter の連打では handleAddAIWord が2本走る。
   * どちらも押した時点の vocabulary を抱えているため、重複の確認
   * （vocabulary.some(...)）は両方とも素通りし、同じ単語が別々のIDで
   * 2件登録される。クイズにも2件出て、+50のボーナスも二重に入り、
   * AIの呼び出しも1回ぶん無駄になる。
   * ガチャの pullingRef・ログインボーナスの claimingRef と同じ作りで塞ぐ。
   */
  const addingRef = useRef(false);

  const handleAddAIWord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (addingRef.current || !newWord.trim()) return;
    addingRef.current = true;
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
      playChime("bonus");
      
      // スコア小ボーナス
      addBonus(50);

      // AIを呼べなかったときは 503/502 で断るようになったので、
      // ここに来るのは本当にAIが分析した結果だけ
      const msg = `AIが英単語「${data.word}」の分析を完了しました！\nレベル: ${
        LEVEL_LABELS[newWordObject.level] ?? newWordObject.level
      }\n自動分析された例文と選択肢がクイズに追加されました！ (獲得スコア: +50)`;
      alert(msg);
    } catch (err: any) {
      console.error(err);
      setAddingError(err.message || "ネットワークに接続できない、またはAPIの制限により取得に失敗しました。");
    } finally {
      setIsAdding(false);
      addingRef.current = false;
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
    <>
          {/* 単語を増やす（AI・CSV・PDF） */}
          <div className="bg-white border border-gray-100 dark:border-slate-800 rounded-2xl p-5" id="ai_word_creation_bento">
            <div>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 shrink-0 bg-indigo-50 rounded-xl text-indigo-700 flex items-center justify-center">
                  <ExpandIcon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-gray-900">単語を増やす</h2>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    出会った単語をAIで1件ずつ、またはCSV・PDFからまとめて単語帳に加えます。
                  </p>
                </div>
              </div>

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
                    <h4 className="text-xs font-bold text-slate-700 mb-1.5">使いどころ</h4>
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
                        <span>PDFからAI抽出</span>
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

                        {/* CSVの3列目にレベルが無い行は、ここで選んだレベルに入れる */}
                        <div className="flex items-center gap-3 mb-4 text-xs flex-wrap">
                          <label htmlFor="csv_default_level" className="font-bold text-gray-700 text-xs">レベルの指定が無い行の扱い</label>
                          <select
                            id="csv_default_level"
                            value={defaultCsvLevel}
                            onChange={e => setDefaultCsvLevel(e.target.value as Level)}
                            className="min-h-11 px-3 rounded-xl border border-gray-200 bg-white text-gray-900 text-xs font-bold cursor-pointer"
                          >
                            {LEVEL_ORDER.map(lvl => (
                              <option key={lvl} value={lvl}>{LEVEL_LABELS[lvl]}</option>
                            ))}
                          </select>
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
    </>
  );
}
