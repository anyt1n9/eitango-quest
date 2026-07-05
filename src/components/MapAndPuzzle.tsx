import React, { useState } from "react";
import { motion } from "motion/react";
import { 
  Sparkles, 
  ArrowLeft, 
  Volume2, 
  VolumeX, 
  Search, 
  Loader2, 
  ArrowRight, 
  HelpCircle, 
  Trophy, 
  Check, 
  RefreshCw,
  Compass,
  CornerDownRight,
  BookOpen
} from "lucide-react";
import { UserStats, RankingUser } from "../types";
import { getAudioContext } from "../sound";

// TTS用の簡易発音ヘルパー
const speakWord = (text: string) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
};

// シンセサイザー音
const playSound = (type: "success" | "fail" | "click") => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (type === "success") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else if (type === "fail") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.setValueAtTime(100, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === "click") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    }
  } catch (e) {
    // Audio unsupported
  }
};

interface ConnectionNode {
  word: string;
  type: string;
  meaning: string;
  connectionReason: string;
}

interface PuzzleItem {
  word: string;
  partOfSpeech: string;
  meaning: string;
  masked: boolean;
}

interface ConnectionMapResponse {
  focusWord: string;
  connections: ConnectionNode[];
  puzzle: PuzzleItem[];
  distractors: string[];
  isFallback?: boolean;
}

interface MapAndPuzzleProps {
  onBackToDashboard: () => void;
  updateRankingScore: (points: number) => void;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  stats: UserStats;
}

// プリセットおすすめワード
const PRESETS = ["construct", "act", "create", "press", "sign", "serve"];

export default function MapAndPuzzle({
  onBackToDashboard,
  updateRankingScore,
  setStats,
  stats
}: MapAndPuzzleProps) {
  const [searchWord, setSearchWord] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState("");
  const [data, setData] = useState<ConnectionMapResponse | null>(null);

  // パズル用インタラクティブ状態
  const [userSelections, setUserSelections] = useState<Record<number, string>>({}); // index -> word
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [isDoneAlready, setIsDoneAlready] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // AI 読み込みハンドラー
  const handleFetchMap = async (wordToQuery: string) => {
    if (!wordToQuery.trim()) return;
    setIsLoading(true);
    setErrorStatus("");
    setData(null);
    setUserSelections({});
    setIsAnswerChecked(false);
    setIsDoneAlready(false);
    setShowExplanation(false);

    try {
      const response = await fetch("/api/gemini/connection-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: wordToQuery.trim() })
      });
      
      const payload = await response.json();
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "情報の取得に失敗しました。");
      }

      setData(payload);
    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "通信または生成エラーが発生しました。時間を置いて再度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  // 選択肢カードの一覧 (答え候補)
  // ※以前は「正解語→ひっかけ語」の順で並んでいたため、先頭から順に選ぶだけで
  //   正解できてしまっていた。データ取得時に1回だけシャッフルして固定する。
  const puzzleChoices = React.useMemo(() => {
    if (!data) return [];
    const maskedWords = data.puzzle
      .filter(item => item.masked)
      .map(item => item.word);
    const choices = Array.from(new Set([...maskedWords, ...data.distractors]));
    // Fisher-Yates シャッフル
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    return choices;
  }, [data]);

  const handleSelectWordForBlank = (blankIdx: number, word: string) => {
    if (isAnswerChecked) return;
    playSound("click");
    setUserSelections(prev => ({
      ...prev,
      [blankIdx]: word
    }));
  };

  const handleClearBlank = (blankIdx: number) => {
    if (isAnswerChecked) return;
    playSound("click");
    setUserSelections(prev => {
      const copy = { ...prev };
      delete copy[blankIdx];
      return copy;
    });
  };

  const checkAnswer = () => {
    if (!data) return;
    
    // 全空欄が埋まっているかチェック
    const maskedIndices = data.puzzle
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.masked)
      .map(({ idx }) => idx);
    
    const allFilled = maskedIndices.every(idx => userSelections[idx]);
    if (!allFilled) {
      alert("すべての空欄に単語を当てはめてください！");
      return;
    }

    // 正誤チェック
    let totalCorrect = true;
    maskedIndices.forEach(idx => {
      const userWord = userSelections[idx]?.trim().toLowerCase();
      const actualWord = data.puzzle[idx].word.trim().toLowerCase();
      if (userWord !== actualWord) {
        totalCorrect = false;
      }
    });

    setIsAnswerChecked(true);

    if (totalCorrect) {
      playSound("success");
      const isFirstClear = !isDoneAlready;
      setIsDoneAlready(true);

      if (isFirstClear) {
        // 初回正解ボーナス（同じパズルの再回答では加算しない）
        const bonusPoints = 100;
        setStats(prev => ({
          ...prev,
          score: prev.score + bonusPoints
        }));
        updateRankingScore(bonusPoints);

        alert(`素晴らしい！大正解です！ 🎉\n派生語変化の法則を完璧に解き明かしました！\n【+${bonusPoints} P】があなたのスコアに加算されました！`);
      } else {
        alert("大正解です！ 🎉（このパズルのボーナスはすでに獲得済みです）");
      }
    } else {
      playSound("fail");
      alert("残念！いくつか間違っている箇所があります。もう一度選択し直してみてください。");
    }
  };

  const resetPuzzle = () => {
    setUserSelections({});
    setIsAnswerChecked(false);
    playSound("click");
  };

  return (
    <div className="space-y-6" id="map_puzzle_screen_wrapper">
      {/* 画面ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-xs" id="map_puzzle_sub_header">
        <button
          onClick={onBackToDashboard}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 font-bold select-none cursor-pointer"
          id="btn_back_to_dashboard_from_map"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>ダッシュボードに戻る</span>
        </button>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Sparkles className="w-5 h-5 fill-indigo-100" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">AI単語つながり＆派生語パズル</h1>
            <p className="text-[10px] text-gray-400 mt-0.5 font-bold font-mono tracking-wider uppercase">generated by gemini 3.5 flash</p>
          </div>
        </div>
      </div>

      {/* 検索・プリセットボックス */}
      <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm" id="search_preset_control_panel">
        <div>
          <h2 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
            <Compass className="w-4.5 h-4.5 text-indigo-500" />
            <span>キーワード英単語を探索する</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            語源探査したい英単語を入力するか、おすすめ語根を選択してAIが単語網羅マップと変化パズルを展開します。
          </p>

          <form onSubmit={(e) => { e.preventDefault(); handleFetchMap(searchWord); }} className="mt-4 flex gap-2 w-full max-w-lg" id="search_word_form">
            <input
              type="text"
              placeholder="英単語を入力 (例: pressure, structure など)"
              value={searchWord}
              onChange={(e) => setSearchWord(e.target.value.replace(/[^a-zA-Z\s-]/g, ""))}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-semibold font-mono placeholder-gray-400 text-sm"
              id="input_map_search_word"
            />
            <button
              type="submit"
              disabled={isLoading || !searchWord.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 text-white font-bold px-5 rounded-xl transition flex items-center gap-1.5 shadow select-none cursor-pointer text-xs"
              id="btn_map_search_submit"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>AI探査</span>
            </button>
          </form>

          {/* プリセットトリガー */}
          <div className="mt-4 border-t border-gray-50 pt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-400 font-bold">おすすめの極(ルーツ単語):</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(word => (
                <button
                  key={word}
                  type="button"
                  onClick={() => { setSearchWord(word); handleFetchMap(word); }}
                  className="px-2.5 py-1 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-600 hover:text-indigo-800 border border-indigo-100 rounded-lg text-xs font-bold transition font-mono"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {errorStatus && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center" id="map_fetch_error_container">
          <p className="text-sm font-bold text-rose-700">{errorStatus}</p>
          <button
            onClick={() => handleFetchMap(searchWord || "construct")}
            className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>再試行する</span>
          </button>
        </div>
      )}

      {/* ロード中スケルトン */}
      {isLoading && (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm space-y-4" id="map_fetch_loading_placeholder">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-100 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-800">AIが語系知のネットワークを展開中...</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
              Gemini は関連するラテン語源や接頭辞、および名詞・動詞・形容詞の形態変化を分析し、学習マップとパズルを生成しています。
            </p>
          </div>
        </div>
      )}

      {/* メイン出力 (データ到着時) */}
      {data && (
        <div className="space-y-8" id="map_puzzle_results_container">
          {data.isFallback && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-4 flex gap-3 text-amber-800 dark:text-amber-300 text-xs">
              <span className="text-sm">💡</span>
              <div>
                <p className="font-bold">一時的な自動調整中 (429の制限回避)</p>
                <p className="mt-1 opacity-90 leading-relaxed">
                  現在APIへのアクセスが集中して一時的に読み込み制限がかかっているため、快適な学習を継続できるようローカルエンジンで自動構成したデモ用のつながりマップ・派生語パズルを表示しています。時間を置いて再度検索すると、最新のAIによって指定単語を完璧に分析したパーソナルコンテンツが生成されます。
                </p>
              </div>
            </div>
          )}
          
          {/* 1. つながりマップセクション */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6" id="connections_map_card">
            <div className="flex md:items-center justify-between flex-col md:flex-row gap-2 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full" />
                  <span>① 「{data.focusWord}」から広がる知のつながりマップ</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  共通の接頭辞・接尾辞や、同じ語根から派生した言葉のネットワークです。流れをなぞって語彙力を芋づる式に増やしましょう。
                </p>
              </div>
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black tracking-wide px-3 py-1 rounded-xl uppercase font-mono self-start md:self-auto">
                connection loop of 5
              </span>
            </div>

            {/* ノードのタイムライン描画 */}
            <motion.div 
              initial="hidden"
              animate="visible"
              variants={{
                hidden: { opacity: 0 },
                visible: {
                  opacity: 1,
                  transition: {
                    staggerChildren: 0.12
                  }
                }
              }}
              className="space-y-6 relative before:absolute before:left-6 before:top-4 before:bottom-4 before:w-0.5 before:bg-indigo-100" 
              id="nodes_timeline_list"
            >
              {data.connections.map((node, index) => (
                <motion.div 
                  key={index}
                  variants={{
                    hidden: { opacity: 0, x: -16, y: 5 },
                    visible: { opacity: 1, x: 0, y: 0, transition: { type: "spring", stiffness: 120 } }
                  }}
                  className="flex gap-4 relative" 
                  id={`node_step_${index}`}
                >
                  {/* 丸アイコンインジケータ */}
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-indigo-600 text-indigo-600 flex items-center justify-center font-black text-xs shadow-xs z-10 shrink-0 select-none font-mono">
                    {index + 1}
                  </div>

                  {/* コンテンツカード */}
                  <div className="flex-1 bg-slate-50 border border-gray-150 rounded-2xl p-4 hover:border-indigo-300 hover:bg-indigo-50/20 transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-base font-bold text-gray-900 select-all">
                          {node.word}
                        </span>
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md">
                          {node.type}
                        </span>
                      </div>
                      
                      {/* 音声再生 */}
                      <button
                        onClick={() => speakWord(node.word)}
                        className="p-1 px-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 hover:text-indigo-600 transition flex items-center gap-1 select-none cursor-pointer text-[10px] font-bold"
                        title="音声を発音する"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>発音</span>
                      </button>
                    </div>

                    <p className="text-xs font-black text-indigo-950">
                      意味: {node.meaning}
                    </p>

                    <div className="mt-2.5 pl-3 border-l-2 border-indigo-400/50 text-xs text-gray-500 font-medium leading-relaxed">
                      {node.connectionReason}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* 2. 派生語パズルセクション */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-6" id="derivative_puzzle_card">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-base font-extrabold text-rose-950 flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full" />
                <span>② 派生語変化パズル (Word Derivation Quiz)</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                品詞によってスペルが美しく変化する「派生語のステップ」です。空欄になっている箇所に、一番しっくりくる英単語をカードから選んであてはめてください！
              </p>
            </div>

            {/* パズル本体 */}
            <div className="bg-slate-50 rounded-2xl border border-gray-150 p-5 space-y-4" id="puzzle_game_board">
              <motion.div 
                initial="hidden"
                animate="visible"
                variants={{
                  hidden: { opacity: 0 },
                  visible: {
                    opacity: 1,
                    transition: {
                      staggerChildren: 0.1
                    }
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-5 gap-3" 
                id="puzzle_steps_flex"
              >
                {data.puzzle.map((item, index) => {
                  const isMasked = item.masked;
                  const currentPlaced = userSelections[index];

                  // 正確なスペル判定
                  const isCorrect = isAnswerChecked && currentPlaced?.trim().toLowerCase() === item.word.trim().toLowerCase();
                  const isWrong = isAnswerChecked && currentPlaced?.trim().toLowerCase() !== item.word.trim().toLowerCase();

                  return (
                    <motion.div 
                      key={index}
                      variants={{
                        hidden: { opacity: 0, y: 15 },
                        visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 120, damping: 14 } }
                      }}
                      className={`relative flex flex-col justify-between p-4 rounded-xl border transition-all ${
                        isMasked 
                          ? currentPlaced 
                            ? isCorrect
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-emerald-100/30 shadow-md"
                              : isWrong
                                ? "bg-rose-50 border-rose-300 text-rose-900 shadow-rose-100/30 shadow-md"
                                : "bg-indigo-50/70 border-indigo-300 text-indigo-900 shadow-sm"
                            : "bg-white border-dashed border-gray-300 hover:border-indigo-400 cursor-pointer animate-pulse"
                          : "bg-gray-100 text-gray-800 border-gray-200"
                      }`}
                      id={`puzzle_slot_container_${index}`}
                    >
                      {/* ステップ順 */}
                      <div className="flex justify-between items-center mb-2 select-none font-mono text-[10px] text-gray-400 font-bold">
                        <span>STEP {index + 1}</span>
                        <span className="bg-gray-200/50 text-gray-500 px-1.5 py-0.5 rounded-md font-sans">
                          {item.partOfSpeech}
                        </span>
                      </div>

                      {/* 単語テキスト または スロット */}
                      <div className="my-2 text-center">
                        {!isMasked ? (
                          <div className="font-mono font-black text-sm text-gray-800 select-all">
                            {item.word}
                          </div>
                        ) : currentPlaced ? (
                          <div className="group relative">
                            <span className="font-mono font-black text-sm select-none break-all">
                              {currentPlaced}
                            </span>
                            {!isAnswerChecked && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleClearBlank(index); }}
                                className="absolute -top-6 -right-2 text-[8px] bg-rose-500 hover:bg-rose-600 text-white px-1 rounded-sm shadow-xs transition cursor-pointer select-none"
                              >
                                戻す
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-indigo-600 font-bold flex items-center justify-center gap-1.5 py-1">
                            <HelpCircle className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
                            <span>ここを選択</span>
                          </span>
                        )}
                      </div>

                      {/* 日本語訳 */}
                      <div className="mt-1 text-center text-[10px] text-gray-500 font-medium leading-tight">
                        {item.meaning}
                      </div>

                      {/* 音声発音：マスクされていない or 正答で表示 */}
                      {(!isMasked || (isCorrect)) && (
                        <button
                          onClick={() => speakWord(isMasked ? currentPlaced : item.word)}
                          className="mt-3 mx-auto p-1 rounded-full bg-white/75 hover:bg-white text-gray-400 hover:text-indigo-600 transition flex items-center justify-center border border-gray-150 shrink-0 cursor-pointer"
                          title="音声を再生"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      )}

                      {/* OK/NG アイコン */}
                      {isMasked && isAnswerChecked && (
                        <div className="absolute -bottom-2 right-2 rounded-full p-0.5 bg-white shadow-xs">
                          {isCorrect ? (
                            <span className="text-xs text-emerald-600 font-black">✔</span>
                          ) : (
                            <span className="text-xs text-rose-600 font-black">✖</span>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </motion.div>

              {/* クイズ選択肢選択トレー */}
              {!isAnswerChecked && (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.4 }}
                  className="mt-6 border-t border-gray-200 pt-5 space-y-3" 
                  id="choices_drawer_container"
                >
                  <p className="text-xs font-extrabold text-gray-700 text-center">
                    👇 下記の英単語カードをクリックして、上部の 「ここを選択」 のスロットにピッタリはめてください！
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {puzzleChoices.map((wordOption) => {
                      // 既に使用されているか？
                      const isUsed = Object.values(userSelections).includes(wordOption);

                      return (
                        <button
                          key={wordOption}
                          disabled={isUsed}
                          onClick={() => {
                            // 最初に見つかった空スロットに割り振る
                            const firstEmptyMaskedIdx = data.puzzle
                              .map((item, idx) => ({ item, idx }))
                              .filter(({ item, idx }) => item.masked && !userSelections[idx])[0]?.idx;

                            if (firstEmptyMaskedIdx !== undefined) {
                              handleSelectWordForBlank(firstEmptyMaskedIdx, wordOption);
                            } else {
                              alert("すべての空きスロットが埋まっています。配置をキャンセルするには、上の単語の「戻す」を押してください。");
                            }
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition font-mono border ${
                            isUsed 
                              ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed"
                              : "bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs hover:shadow-xs cursor-pointer"
                          }`}
                        >
                          {wordOption}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ゲームアクションコントローラ */}
              <div className="flex justify-center gap-3 mt-6">
                {!isAnswerChecked ? (
                  <button
                    onClick={checkAnswer}
                    className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs shadow hover:shadow-md transition flex items-center gap-1 cursor-pointer select-none"
                    id="btn_submit_puzzle_answers"
                  >
                    <Check className="w-4 h-4" />
                    <span>答え合わせをする (回答提出)</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={resetPuzzle}
                      className="px-5 py-2.5 bg-gray-500 hover:bg-gray-600 text-white font-bold rounded-xl text-xs shadow transition flex items-center gap-1 cursor-pointer select-none"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>やり直す</span>
                    </button>
                    {!isDoneAlready && (
                      <span className="text-xs font-extrabold text-rose-600 animate-pulse">
                        いくつか誤りがあります！
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* AI語源の詳しい解説を表示（アコーディオン） */}
            <div className="border border-indigo-100 rounded-2xl overflow-hidden" id="puzzle_explanation_section">
              <button
                onClick={() => setShowExplanation(!showExplanation)}
                className="w-full bg-indigo-50/45 hover:bg-indigo-50/70 p-4 flex items-center justify-between text-xs font-bold text-indigo-950 transition cursor-pointer"
                id="btn_toggle_puzzle_explanation"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <span>この派生語ネットワークの語彙的豆知識を学ぶ</span>
                </div>
                <span>{showExplanation ? "閉じる ▲" : "開く ▼"}</span>
              </button>
              
              {showExplanation && (
                <div className="p-4 bg-white border-t border-indigo-50 text-xs text-gray-600 leading-relaxed font-semibold font-sans space-y-3">
                  <p>
                    <strong>【派生関係について】</strong><br/>
                    英単語は、1つのコアとなる「語根（ルート）」に、品詞を規定する「接尾辞（Suffix）」や方向・状態を表す「接頭辞（Prefix）」が融合して姿を変えていきます。<br/>
                    例えば：
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-1 text-indigo-950">
                    <li>動詞 <code className="font-mono bg-indigo-50 px-1 rounded">act</code>（行動する）</li>
                    <li>名詞 <code className="font-mono bg-indigo-50 px-1 rounded">action</code>（行動）：接尾辞 <code className="font-mono text-indigo-600">-ion</code> が付き名詞化。</li>
                    <li>形容詞 <code className="font-mono bg-indigo-50 px-1 rounded">active</code>（活動的な）：接尾辞 <code className="font-mono text-indigo-600">-ive</code> が付き形容詞化。</li>
                    <li>名詞 <code className="font-mono bg-indigo-50 px-1 rounded">activity</code>（活動）：接尾辞 <code className="font-mono text-indigo-600">-ity</code> が特性を表す名詞に。</li>
                    <li>動詞 <code className="font-mono bg-indigo-50 px-1 rounded">activate</code>（活性化する）：接尾辞 <code className="font-mono text-indigo-600">-ate</code> が「変容・動作」を定義。</li>
                  </ul>
                  <p>
                    この法則を一度身につけると、未知の英単語に遭遇したときも「品詞の予想」や「大まかなニュアンスの察知」が容易になり、英語の読解スピードが劇的に上昇します！
                  </p>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* 初期ステートでの案内 */}
      {!data && !isLoading && !errorStatus && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="bg-white rounded-3xl p-10 text-center border border-gray-150 shadow-xs space-y-4" 
          id="map_intro_splash"
        >
          <Sparkles className="w-14 h-14 text-indigo-400 mx-auto fill-indigo-50 animate-pulse" />
          <div>
            <h3 className="text-base font-extrabold text-gray-800">
              AIが「芋づる式」に学びを自動生成
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
              上の入力欄に好きな英単語を打ち込むか、おすすめの極ワードを選択してください。Gemini が瞬時につながりと派生を算出してあなたに届けます。
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => handleFetchMap("construct")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
            >
              「construct」のマップを表示 ➔
            </button>
            <button
              onClick={() => handleFetchMap("act")}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              「act」のパズルに挑戦 ➔
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
