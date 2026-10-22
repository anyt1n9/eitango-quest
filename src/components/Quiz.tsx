import React, { useRef, useState, useEffect } from "react";
import { ArrowLeft, Check, X, Volume2, Loader2 } from "lucide-react";
import { Level, Word, UserStats, QuizHistory } from "../types";
import { LEVEL_LABELS } from "../levelLabels";
import Phonetic from "./Phonetic";
import { getAudioContext } from "../sound";
import { shuffle } from "../shuffle";
import { SrsState } from "../srs";
import { canAnswerInEnglish, canChooseMeaning } from "../quizFormats";
import { selectQuizWords } from "../selectQuestions";
import { canUseSpeech, onVoicesChanged } from "../speech";
import { DominantSenseHint } from "./WordSenses";
import AnswerFeedback from "./AnswerFeedback";
import QuizResult from "./QuizResult";

// クイズ回答時の効果音（ダッシュボード側と同じシンセ）
const playQuizSound = (isCorrect: boolean) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isCorrect) {
      // 正解音
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else {
      // 不正解音
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn("Audio contexts blocked or not supported.");
  }
};

interface QuizProps {
  level: Level;
  vocabulary: Word[];
  wrongWords: string[];
  setWrongWords: React.Dispatch<React.SetStateAction<string[]>>;
  solvedHistory: Record<string, { correctCount: number; attemptCount: number }>;
  setSolvedHistory: React.Dispatch<React.SetStateAction<Record<string, { correctCount: number; attemptCount: number }>>>;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  onBackToDashboard: () => void;
  updateRankingScore: (points: number) => void;
  questionCount?: number;
  // SRS復習セッション用: 指定された単語のみを出題する（レベルフィルタを上書き）
  customWords?: Word[];
  // 復習セッションかどうか（表示文言の切り替え用）
  reviewMode?: boolean;
  // リスニングモード: 単語の綴りを隠し、音声だけを聞いて意味を答える
  listeningMode?: boolean;
  // 日→英モード: 日本語訳を見て英単語を選ぶ（産出寄りの練習）
  reverseMode?: boolean;
  // 出題の重み付け（復習期日超過・未習を優先）に使う
  srsData?: Record<string, SrsState>;
  // 解答1件ごとに呼ばれるコールバック（間隔反復・デイリー目標の更新用）
  recordAnswer?: (wordId: string, isCorrect: boolean) => void;
}

export default function Quiz({
  level,
  vocabulary,
  wrongWords,
  setWrongWords,
  solvedHistory,
  setSolvedHistory,
  setStats,
  onBackToDashboard,
  updateRankingScore,
  questionCount = 10,
  customWords,
  reviewMode = false,
  listeningMode = false,
  reverseMode = false,
  srsData = {},
  recordAnswer
}: QuizProps) {
  // レベルに合致する単語プールをシャッフルして10問抽出 (10問未満ならすべて)
  const [questions, setQuestions] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // クイズ成績
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ word: Word; userChoice: string; isCorrect: boolean }[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  // 読み上げが使えるか。使えない端末ではリスニングでも綴りを見せる
  // （綴りを隠したままだと手がかりが無く、当てずっぽうにしかならない）
  const [speechOk, setSpeechOk] = useState(canUseSpeech);
  useEffect(() => onVoicesChanged(() => setSpeechOk(canUseSpeech())), []);

  /*
   * 解答の二度押しを同期的に止める。
   *
   * 「一度答えたら選び直せない」は state で守っているが、state が効くのは
   * 再描画のあとなので、同じ瞬間に2回押されると（スマホのダブルタップなど）両方が通る。
   * 解答の記録は学習データそのもので、1回の解答が2回分として記録されると
   * 間隔反復の箱が2段上がり、まだ覚えていない語が「習得済み」になる。
   * 別の選択肢を続けて押した場合は、両方が解答として記録される。
   * state の解答状態を消すのと同じ場所で、この印も消す（次の問題では押せるように）。
   * 「次の問題へ」の二度押しで1問飛ばさないよう、進むときもこの印で見る。
   */
  const answeredRef = useRef(false);

  // 正解のあと自動で次へ進むタイマー
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // コンポーネント破棄時のクリーンアップ
  useEffect(() => clearTimer, []);

  // 出題プールからランダムに問題をピックアップし、各問題の4択選択肢をシャッフル
  const prepareQuestions = () => {
    // customWords が渡された場合（SRS復習）はそれを出題プールにする。
    // 復習の対象は呼び出し側が wordsForFormat で形式に合う語だけに絞っている。
    //
    // レベル別の出題では、その形式で問えない語を落とす。
    // 取り込んだ単語（CSV・AI・PDF）は同じ品詞の候補が足りないと
    // 誤答が0〜1件しか作れず、そのまま出すと
    // 「選択肢が1つだけ＝常に正解」の設問になる（誤答生成が取れた分だけ返すため）
    const canAsk = reverseMode ? canAnswerInEnglish : canChooseMeaning;
    const levelWords = (customWords && customWords.length > 0)
      ? customWords
      : vocabulary.filter(w => w.level === level && canAsk(w));
    // 復習期日を過ぎた語・まだ解いていない語を優先して選ぶ
    // （SRS復習セッションは既に対象が絞られているのでそのまま使う）
    const picked = (customWords && customWords.length > 0)
      ? shuffle(levelWords).slice(0, Math.min(questionCount, levelWords.length))
      : selectQuizWords({ pool: levelWords, count: questionCount, solvedHistory, srsData });
    return picked.map(q => {
      // 日→英モードでは英単語が選択肢になる。
      // 例文穴埋め用に用意した sentenceOptions は、同じ品詞・似た綴りの語で
      // できているのでそのまま使える。
      const source = reverseMode ? q.sentenceOptions : q.options;
      return {
        ...q,
        options: source ? shuffle(source) : []
      };
    });
  };

  // 出題対象は「中身」で見る。配列の同一性で見ると、呼び出し側が毎回
  // 新しい配列を作るだけで出題し直しになり、解答の途中で問題が入れ替わる
  const customWordsKey = (customWords || []).map(w => w.id).join(",");

  useEffect(() => {
    setQuestions(prepareQuestions());
  }, [level, vocabulary, questionCount, customWordsKey, reverseMode]);

  // リザルト画面から同じ設定でもう一度挑戦する（新しい出題セットを再抽選）
  const handleRetry = () => {
    clearTimer();
    setQuestions(prepareQuestions());
    setCurrentIndex(0);
    setSelectedOption(null);
    answeredRef.current = false;
    setScore(0);
    setDetails([]);
    setIsFinished(false);
  };

  const currentQuestion = questions[currentIndex];

  // 新しい問題に遷移した際、自動で英単語を1回だけ発音する
  useEffect(() => {
    // 日→英モードでは英単語が答えなので、出題時に読み上げない
    if (currentQuestion && !isFinished && !reverseMode) {
      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(currentQuestion.word);
          u.lang = "en-US";
          u.rate = 0.9;
          window.speechSynthesis.speak(u);
        }
      } catch (err) {
        console.warn("Speak on start error:", err);
      }
    }
  }, [currentIndex, currentQuestion, isFinished, reverseMode]);

  // 数字キー(1〜4)で選択肢を選べるようにする。
  // パソコンで解くとき、毎問マウスへ手を移すことになっていた
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isFinished || selectedOption !== null) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // 文字を入力しているときは邪魔しない
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1) return;
      const option = currentQuestion?.options?.[n - 1];
      if (option === undefined) return;
      e.preventDefault();
      handleSelectOption(option);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });


  const handleSelectOption = (option: string) => {
    if (answeredRef.current || selectedOption !== null) return;
    answeredRef.current = true;
    
    setSelectedOption(option);
    const isCorrect = option === (reverseMode ? currentQuestion.word : currentQuestion.translation);
    
    playQuizSound(isCorrect);

    // 間隔反復(SRS)・デイリー目標の更新
    recordAnswer?.(currentQuestion.id, isCorrect);

    // 進捗履歴と苦手単語の永続化バッファの追加
    setSolvedHistory(prev => {
      const existing = prev[currentQuestion.id] || { correctCount: 0, attemptCount: 0 };
      return {
        ...prev,
        [currentQuestion.id]: {
          correctCount: existing.correctCount + (isCorrect ? 1 : 0),
          attemptCount: existing.attemptCount + 1
        }
      };
    });

    if (!isCorrect) {
      setWrongWords(prev => {
        if (!prev.includes(currentQuestion.id)) {
          return [...prev, currentQuestion.id];
        }
        return prev;
      });
    }

    // 得点と成績詳細
    const nextScore = isCorrect ? score + 1 : score;
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    setDetails(prev => [
      ...prev,
      {
        word: currentQuestion,
        userChoice: option,
        isCorrect
      }
    ]);

    // 正解ならすぐ次へ進む。間違えたときは、正解と見比べて読み終えるまで待つ
    // （「次の問題へ」を押して進む。以前は6秒で勝手に進んでいた）
    if (isCorrect) {
      timerRef.current = setTimeout(() => handleNext(nextScore), 1200);
    }
  };

  /** 次の問題へ。finalScore は最後の問題を答えたあとの正解数 */
  const handleNext = (finalScore: number) => {
    if (!answeredRef.current) return;
    answeredRef.current = false;
    clearTimer();
    setSelectedOption(null);
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(prev => prev + 1);
      // 解説を見るために下へ送っていたら、次の問題の頭へ戻す
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      handleFinishQuiz(finalScore);
    }
  };

  const handleFinishQuiz = (finalScore: number) => {
    setIsFinished(true);

    // スコア加算とスタッツ更新
    const addedPoints = finalScore * 30 + (finalScore === questions.length ? 150 : 0); // パーフェクトボーナス150
    updateRankingScore(addedPoints);

    setStats(prev => ({
      ...prev,
      completedQuestions: prev.completedQuestions + questions.length,
      correctAnswers: prev.correctAnswers + finalScore,
      score: prev.score + addedPoints
    }));
  };

  // ブラウザのTTS発音（英語のスピーキング音声読み上げ）
  const handleSpeakWord = (wordText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(wordText);
        u.lang = "en-US";
        u.rate = 0.9;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn("Speech synthesis error", e);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border shadow-sm">
        <LoaderComponent />
      </div>
    );
  }

  if (isFinished) {
    const perfect = score === questions.length;
    return (
      <div className="max-w-xl mx-auto" id="quiz_section_root">
        <QuizResult
          id="quiz_result_card"
          title="クイズ完了！"
          subtitle={reviewMode
            ? "今日の復習"
            : `${LEVEL_LABELS[level]}・${listeningMode ? "リスニング" : reverseMode ? "日本語→英単語" : "一問一答"}`}
          score={score}
          total={questions.length}
          points={score * 30 + (perfect ? 150 : 0)}
          perfectBonus={150}
          items={details.map((item, idx) => ({
            key: `${idx}_${item.word.id}`,
            isCorrect: item.isCorrect,
            content: (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-900 select-all">{item.word.word}</span>
                  <button
                    type="button"
                    onClick={(e) => handleSpeakWord(item.word.word, e)}
                    className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 transition cursor-pointer"
                    aria-label={`${item.word.word} の発音を聴く`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-xs text-gray-600 font-medium">意味: {item.word.translation}</p>
                {!item.isCorrect && (
                  <p className="text-xs text-rose-700 font-bold">あなたの答え: {item.userChoice}</p>
                )}
              </>
            )
          }))}
          onRetry={handleRetry}
          onBack={onBackToDashboard}
          retryId="btn_retry_quiz"
          backId="btn_back_dashboard_from_quiz"
        />
      </div>
    );
  }

  const answered = selectedOption !== null;
  const correctOption = reverseMode ? currentQuestion.word : currentQuestion.translation;
  const answeredCorrectly = answered && selectedOption === correctOption;

  return (
    <div className="max-w-xl mx-auto" id="quiz_section_root">
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm" id="quiz_running_card">
        {/* ヘッダー・進捗 */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-800 transition min-h-11 cursor-pointer"
            id="btn_quit_quiz"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>中断して戻る</span>
          </button>
          <div className="bg-gray-100 px-3.5 py-1.5 rounded-full text-xs font-black tabular-nums text-indigo-700">
            Q: {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* 出題プログレスバー */}
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-6">
          <div 
            className="bg-indigo-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* 英単語の出題表示 */}
        <div className="text-center space-y-4 my-6">
          <span className="text-xs font-black text-indigo-700">
            {listeningMode ? "🎧 音声を聞いて意味を選択"
              : reverseMode ? "日本語に合う英単語を選択"
              : "英単語の意味を選択"}
          </span>

          {reverseMode && !answered ? (
            /* 日→英モードでは、綴りも発音も答えそのものなので出さない */
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 leading-snug px-2">
              {currentQuestion.translation}
            </h2>
          ) : listeningMode && !answered ? (
            /* リスニングモード中は綴りを隠し、大きな再生ボタンだけを見せる。
               ただし読み上げが使えない端末で綴りまで隠すと、手がかりが
               何も無い四択になって答えようがなくなるので、そのときは綴りを出す */
            speechOk ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={(e) => handleSpeakWord(currentQuestion.word, e)}
                  className="w-24 h-24 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-all cursor-pointer active:scale-90 flex items-center justify-center shadow-lg"
                  title="もう一度発音を聴く"
                  aria-label="もう一度発音を聴く"
                  id="listening_replay_btn"
                >
                  <Volume2 className="w-10 h-10" />
                </button>
                <p className="text-xs text-gray-600 font-semibold">
                  タップでもう一度再生できます
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2" id="listening_no_speech">
                <h2 className="text-3xl md:text-4xl font-black text-gray-900">
                  {currentQuestion.word}
                </h2>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                  この端末では英語の音声を再生できないため、綴りを表示しています
                </p>
              </div>
            )
          ) : (
            <>
              {reverseMode && (
                <p className="text-sm font-bold text-gray-600">
                  {currentQuestion.translation}
                </p>
              )}
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-4xl font-black text-gray-900 tracking-tight select-all">
                  {currentQuestion.word}
                </h2>
                <button
                  onClick={(e) => handleSpeakWord(currentQuestion.word, e)}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-all cursor-pointer active:scale-90"
                  title="発音を聴く"
                  aria-label="発音を聴く"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* 発音記号(IPA) */}
              <Phonetic word={currentQuestion.word} className="text-sm" />
            </>
          )}

          <p className="text-xs text-gray-600 font-bold">
            {reviewMode
              ? "🔁 今日の復習 (間隔反復)"
              : `レベル: ${LEVEL_LABELS[level]}`}
          </p>
        </div>

        {/* 4択選択肢ボタンリスト */}
        <div className="grid grid-cols-1 gap-3" id="quiz_options_container">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedOption === option;
            const isCorrectAnswer = option === correctOption;

            // 答えたあとも選択肢は見せたままにする。自分の選んだ語と正解を見比べられるように
            let btnClass = "bg-gray-50 border-gray-200 text-gray-800 hover:bg-gray-100 hover:border-gray-300";
            if (answered) {
              if (isCorrectAnswer) btnClass = "bg-emerald-50 border-emerald-400 text-emerald-900 font-black";
              else if (isSelected) btnClass = "bg-rose-50 border-rose-300 text-rose-900 font-black";
              else btnClass = "bg-gray-50 border-gray-100 text-gray-600";
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(option)}
                disabled={answered}
                className={`border rounded-2xl p-4 min-h-14 text-left text-sm font-semibold transition-all flex items-center gap-3 cursor-pointer disabled:cursor-default ${btnClass}`}
                id={`option_btn_${idx}`}
              >
                {/* 数字キーでも選べることを示す。番号が見えていないと使われない。
                    読み上げと文字の突き合わせには要らないので aria からは隠す */}
                <span
                  aria-hidden="true"
                  className="hidden sm:flex shrink-0 w-6 h-6 rounded-md border border-current/20 items-center justify-center text-[11px] tabular-nums font-black opacity-60"
                >
                  {idx + 1}
                </span>
                <span data-testid="option_label" className="flex-1">
                  {option}
                </span>
                {answered && isCorrectAnswer && (
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                )}
                {answered && isSelected && !isCorrectAnswer && (
                  <X className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>

        {answered && (
          answeredCorrectly ? (
            <AnswerFeedback correct message="正解です" />
          ) : (
            <AnswerFeedback
              correct={false}
              message={reverseMode
                ? `不正解です。正解は「${currentQuestion.word}」（${currentQuestion.translation}）`
                : `不正解です。正解は「${currentQuestion.translation}」（${currentQuestion.word}）`}
              onNext={() => handleNext(score)}
              nextLabel={currentIndex + 1 < questions.length ? "次の問題へ" : "結果を見る"}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-black text-gray-900 select-all">{currentQuestion.word}</span>
                <button
                  type="button"
                  onClick={(e) => handleSpeakWord(currentQuestion.word, e)}
                  className="p-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-full transition cursor-pointer"
                  aria-label="正解の発音を聴く"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
                <Phonetic word={currentQuestion.word} className="text-xs" />
              </div>
              <p className="font-bold text-gray-900">{currentQuestion.translation}</p>
              {/* 覚えている語義より、よく使われる語義が別にある場合だけ補足する */}
              <DominantSenseHint wordId={currentQuestion.id} ownPos={currentQuestion.pos} />
            </AnswerFeedback>
          )
        )}
      </div>
    </div>
  );
}

function LoaderComponent() {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <span className="text-sm text-gray-500 font-medium font-sans">英単語クイズの準備をしています...</span>
    </div>
  );
}
