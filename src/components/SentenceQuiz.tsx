import React, { useRef, useState, useEffect } from "react";
import { ArrowLeft, Check, X, Volume2, Eye, Loader2 } from "lucide-react";
import { Level, Word, UserStats } from "../types";
import { LEVEL_LABELS } from "../levelLabels";
import { getAudioContext } from "../sound";
import { shuffle } from "../shuffle";
import { SrsState } from "../srs";
import { selectQuizWords } from "../selectQuestions";
import { canFillSentence } from "../quizFormats";
// 例文を穴埋めにする処理は共有する（綴りクイズ・取り込みでも同じ扱いが要る）
import { showHoles, toFillInSentence } from "../fillIn";
import AnswerFeedback from "./AnswerFeedback";
import QuizResult from "./QuizResult";

// クイズ回答時の効果音（シンセ）
const playSentenceSound = (isCorrect: boolean) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isCorrect) {
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
    console.warn("Audio Context error blocked.");
  }
};

interface SentenceQuizProps {
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
  // 復習セッション用: 指定された単語のみを出題する（レベルフィルタを上書きする）
  customWords?: Word[];
  // 復習セッションかどうか（表示文言の切り替え用）
  reviewMode?: boolean;
  // 出題の重み付け（復習期日超過・未習を優先）に使う
  srsData?: Record<string, SrsState>;
  // 解答1件ごとに呼ばれるコールバック（間隔反復・デイリー目標の更新用）
  recordAnswer?: (wordId: string, isCorrect: boolean) => void;
}

export default function SentenceQuiz({
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
  srsData = {},
  recordAnswer
}: SentenceQuizProps) {
  const [questions, setQuestions] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  const [showTranslation, setShowTranslation] = useState(false);

  // クイズ成績
  const [score, setScore] = useState(0);
  const [details, setDetails] = useState<{ word: Word; userChoice: string; isCorrect: boolean }[]>([]);
  const [isFinished, setIsFinished] = useState(false);

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
    // customWords が渡された場合（復習）はそれを出題プールにする。
    // 復習の対象は呼び出し側が wordsForFormat で形式に合う語だけに絞っている。
    //
    // レベル別の出題では、例文が無い語・英語の選択肢が足りない語を落とす。
    // 落とさないと、穴だけがあって選ぶものが無い設問が出る
    const levelWords = (customWords && customWords.length > 0)
      ? customWords
      : vocabulary.filter(w => w.level === level && canFillSentence(w));
    // 復習期日を過ぎた語・まだ解いていない語を優先して選ぶ
    // （復習セッションは既に対象が絞られているのでそのまま使う）
    const picked = (customWords && customWords.length > 0)
      ? shuffle(levelWords).slice(0, Math.min(questionCount, levelWords.length))
      : selectQuizWords({ pool: levelWords, count: questionCount, solvedHistory, srsData });
    return picked.map(q => {
      return {
        ...q,
        sentence: toFillInSentence(q.sentence, q.word),
        sentenceOptions: q.sentenceOptions ? shuffle(q.sentenceOptions) : []
      };
    });
  };

  // 出題対象は「中身」で見る。配列の同一性で見ると、呼び出し側が毎回
  // 新しい配列を作るだけで出題し直しになり、解答の途中で問題が入れ替わる
  const customWordsKey = (customWords || []).map(w => w.id).join(",");

  useEffect(() => {
    setQuestions(prepareQuestions());
  }, [level, vocabulary, questionCount, customWordsKey]);

  // リザルト画面から同じ設定でもう一度挑戦する（新しい出題セットを再抽選）
  const handleRetry = () => {
    clearTimer();
    setQuestions(prepareQuestions());
    setCurrentIndex(0);
    setSelectedOption(null);
    answeredRef.current = false;
    setShowTranslation(false);
    setScore(0);
    setDetails([]);
    setIsFinished(false);
  };

  const currentQuestion = questions[currentIndex];

  // 新しい問題に遷移した際、自動で英文を1回だけ発音する
  useEffect(() => {
    if (currentQuestion && !isFinished) {
      try {
        if ("speechSynthesis" in window) {
          const cleanText = showHoles(currentQuestion.sentence, "something");
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(cleanText);
          u.lang = "en-US";
          u.rate = 0.85;
          window.speechSynthesis.speak(u);
        }
      } catch (err) {
        console.warn("Speak sentence on start error:", err);
      }
    }
  }, [currentIndex, currentQuestion, isFinished]);


  const handleSelectOption = (option: string) => {
    if (answeredRef.current || selectedOption !== null) return;
    answeredRef.current = true;

    setSelectedOption(option);
    // 例文穴埋めの正解は、本来の英単語（currentQuestion.word）
    const isCorrect = option.toLowerCase() === currentQuestion.word.toLowerCase();

    playSentenceSound(isCorrect);

    // 間隔反復(SRS)・デイリー目標の更新
    recordAnswer?.(currentQuestion.id, isCorrect);

    // 進捗履歴と苦手単語の永続化
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

    // 正解ならすぐ次へ進む。間違えたときは、正解を入れた例文と和訳を読み終えるまで待つ
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
    setShowTranslation(false);
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

    // 例文は少し難しいので、1問あたり40P支給、パーフェクトボーナス200P
    const addedPoints = finalScore * 40 + (finalScore === questions.length ? 200 : 0);
    updateRankingScore(addedPoints);

    // 回答数・正答数は1問ごとに App（recordPractice）が数える。ここで足すと二重になる
    setStats(prev => ({
      ...prev,
      score: prev.score + addedPoints
    }));
  };

  const handleSpeakText = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if ("speechSynthesis" in window) {
        // [_____] を何かしらの単語、またはそのままポーズとして発音させるために読み上げ
        const cleanText = showHoles(text, "something");
        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = "en-US";
        u.rate = 0.85;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      console.warn("TTS error", e);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border shadow-sm">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-sm text-gray-500 font-medium font-sans mt-3">例文穴埋めクイズの準備をしています...</span>
      </div>
    );
  }

  if (isFinished) {
    const perfect = score === questions.length;
    return (
      <div className="max-w-xl mx-auto" id="sentence_quiz_section_root">
        <QuizResult
          id="sentence_result_card"
          title="例文穴埋め完了！"
          subtitle={reviewMode ? "復習・例文穴埋め" : `${LEVEL_LABELS[level]}・例文穴埋め`}
          score={score}
          total={questions.length}
          // 例文は少し難しいので、1問あたり40P、全問正解で200P
          points={score * 40 + (perfect ? 200 : 0)}
          perfectBonus={200}
          reviewTitle="英文の復習"
          items={details.map((item, idx) => ({
            key: `${idx}_${item.word.id}`,
            isCorrect: item.isCorrect,
            content: (
              <>
                <p className="text-[13px] font-semibold text-gray-800 leading-relaxed">
                  {showHoles(item.word.sentence, `【 ${item.word.word} 】`)}
                </p>
                <p className="text-xs text-gray-600 font-semibold leading-relaxed">
                  訳: {item.word.sentenceTranslation}
                </p>
                {!item.isCorrect && (
                  <p className="text-xs text-rose-700 font-black">
                    あなたの答え: {item.userChoice}（正解: {item.word.word}）
                  </p>
                )}
              </>
            )
          }))}
          onRetry={handleRetry}
          onBack={onBackToDashboard}
          retryId="btn_retry_sentence_quiz"
          backId="btn_back_dashboard_from_sentence_quiz"
        />
      </div>
    );
  }

  const answered = selectedOption !== null;
  const answeredCorrectly = answered && selectedOption!.toLowerCase() === currentQuestion.word.toLowerCase();

  return (
    <div className="max-w-xl mx-auto" id="sentence_quiz_section_root">
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm" id="sentence_quiz_running_card">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-gray-800 transition min-h-11 cursor-pointer"
            id="btn_quit_sentence_quiz"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>中断して戻る</span>
          </button>
          <div className="bg-gray-100 px-3.5 py-1.5 rounded-full text-xs font-black tabular-nums text-emerald-700">
            Q: {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* 出題プログレス */}
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-6">
          <div 
            className="bg-emerald-600 h-full rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* 穴埋め例文の出題 */}
        <div className="space-y-5 mb-6 bg-gray-50 p-5 rounded-2xl border border-gray-100 text-center">
          <span className="text-xs font-black text-emerald-800">
            穴埋めに当てはまる英単語を選択
          </span>

          <div className="space-y-4">
            {/* 英文。穴埋め箇所を強調。答えたあとは正解の語を入れて見せる */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xl md:text-2xl font-black text-gray-800 leading-relaxed max-w-md break-words">
                {currentQuestion.sentence.split("[_____]").map((part, i, arr) => (
                  <React.Fragment key={i}>
                    {part}
                    {i < arr.length - 1 && (
                      <span
                        data-testid="sentence_hole"
                        className={`inline-block px-3 py-0.5 mx-1.5 rounded-lg text-base font-black ${
                          answered
                            ? "bg-emerald-50 border-2 border-emerald-400 text-emerald-900"
                            : "bg-yellow-100 border-2 border-dashed border-yellow-400 text-yellow-900"
                        }`}
                      >
                        {answered ? currentQuestion.word : "_____"}
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </p>
              <button
                onClick={(e) => handleSpeakText(answered ? showHoles(currentQuestion.sentence, currentQuestion.word) : currentQuestion.sentence, e)}
                className="p-2 bg-white shadow-sm border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-full transition-all cursor-pointer active:scale-90"
                title="英文の発音を聴く"
                aria-label="英文の発音を聴く"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* 日本語訳はヒントとして隠しておき、答えたあとは必ず見せる */}
            <div className="pt-2 border-t border-gray-200 max-w-sm mx-auto">
              {showTranslation || answered ? (
                <p className="text-xs md:text-sm font-bold text-gray-600 leading-relaxed">
                  和訳: {currentQuestion.sentenceTranslation}
                </p>
              ) : (
                <button
                  onClick={() => setShowTranslation(true)}
                  className="inline-flex items-center gap-1 min-h-11 px-2 text-xs text-gray-600 hover:text-gray-800 font-bold transition cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>日本語訳のヒントをみる</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 4択選択肢 (今回は英単語のため、英単語が並ぶ) */}
        <div className="grid grid-cols-2 gap-3" id="sentence_quiz_options_grid">
          {currentQuestion.sentenceOptions.map((option, idx) => {
            const isSelected = selectedOption === option;
            const isCorrectAnswer = option.toLowerCase() === currentQuestion.word.toLowerCase();

            // 答えたあとも選択肢は見せたままにする。自分の選んだ語と正解を見比べられるように
            let btnClass = "bg-white border-gray-200 text-gray-800 hover:bg-gray-50 hover:border-gray-300";
            if (answered) {
              if (isCorrectAnswer) btnClass = "bg-emerald-50 border-emerald-400 text-emerald-900";
              else if (isSelected) btnClass = "bg-rose-50 border-rose-300 text-rose-900";
              else btnClass = "bg-gray-50 border-gray-100 text-gray-600";
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectOption(option)}
                disabled={answered}
                className={`border rounded-2xl p-4 min-h-14 text-center text-sm font-black transition-all cursor-pointer disabled:cursor-default flex items-center justify-center gap-1.5 ${btnClass}`}
                id={`sentence_option_btn_${idx}`}
              >
                <span>{option}</span>
                {answered && isCorrectAnswer && <Check className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />}
                {answered && isSelected && !isCorrectAnswer && <X className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />}
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
              message={`不正解です。正解は「${currentQuestion.word}」（${currentQuestion.translation}）`}
              onNext={() => handleNext(score)}
              nextLabel={currentIndex + 1 < questions.length ? "次の問題へ" : "結果を見る"}
            >
              <p>
                <span className="font-black text-gray-900">{currentQuestion.word}</span>
                <span className="text-gray-700">　{currentQuestion.translation}</span>
              </p>
              <p className="text-gray-700">
                あなたの答え: <span className="font-black text-rose-800">{selectedOption}</span>
              </p>
            </AnswerFeedback>
          )
        )}
      </div>
    </div>
  );
}
