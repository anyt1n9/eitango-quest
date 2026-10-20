import React, { useState } from "react";
import { ListChecks, Languages, TextCursorInput, Equal, GitFork, Target, ChevronRight, Lock, Repeat, BookMarked } from "lucide-react";
import { Level, Word, UserStats, RankingUser } from "../types";
import { SrsState } from "../srs";
import { countMastered, SolvedHistory } from "../mastery";
import { readStudyLevel, readQuestionCount } from "../studySettings";
import { LEVEL_LABELS } from "../levelLabels";
import { ListeningIcon, SpellingIcon, ReadingIcon, DiaryIcon, PuzzleIcon } from "./AppIcons";
import WordImport from "./WordImport";

type QuizType = "word" | "sentence" | "listening" | "spelling" | "reverse" | "synonym" | "sense";

/** 単語クイズの入口。「今日」の画面と同じ形式を、説明つきで一覧にする */
const FORMATS: { type: QuizType; name: string; desc: string; Icon: (p: { className?: string }) => React.ReactElement }[] = [
  { type: "word", name: "一問一答", desc: "英単語の意味を4択で", Icon: ListChecks },
  { type: "reverse", name: "日本語→英単語", desc: "意味から英単語を選ぶ", Icon: Languages },
  { type: "sentence", name: "例文穴埋め", desc: "例文の空所に入る語", Icon: TextCursorInput },
  { type: "listening", name: "リスニング", desc: "音声だけで聞き取る", Icon: ListeningIcon },
  { type: "spelling", name: "綴りを書く", desc: "意味を見て綴りを入力", Icon: SpellingIcon },
  { type: "synonym", name: "類義語", desc: "同じ意味の語を選ぶ", Icon: Equal },
  { type: "sense", name: "語義の見分け", desc: "文の中での意味を選ぶ", Icon: GitFork }
];

/** AI英語日記を使えるようになる習得語数 */
const DIARY_UNLOCK = 200;

interface LearnHubProps {
  vocabulary: Word[];
  setVocabulary: React.Dispatch<React.SetStateAction<Word[]>>;
  setStats: React.Dispatch<React.SetStateAction<UserStats>>;
  setRanking: React.Dispatch<React.SetStateAction<RankingUser[]>>;
  solvedHistory: SolvedHistory;
  srsData: Record<string, SrsState>;
  wrongWords: string[];
  onStartQuiz: (level: Level, type: QuizType, count?: number) => void;
  /** 苦手な単語の一覧と復習 */
  onStartReview: () => void;
  onOpenReading: () => void;
  onOpenGrammar: () => void;
  onOpenVerbForms: () => void;
  onOpenMapPuzzle: () => void;
  onOpenDiary: () => void;
  /** レベルを選び直す（「今日」の画面へ） */
  onChangeLevel: () => void;
}

/** 一覧の1行（長文・文法など） */
function Row({ id, title, note, Icon, onClick }: {
  id: string;
  title: string;
  note: string;
  Icon: (p: { className?: string }) => React.ReactElement;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      className="w-full min-h-14 flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition cursor-pointer"
    >
      <span className="w-9 h-9 shrink-0 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-black text-gray-900">{title}</span>
        <span className="block text-xs text-gray-500 mt-0.5">{note}</span>
      </span>
      <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
    </button>
  );
}

/**
 * 教材の画面（画面下のタブの「教材」）。
 *
 * ダッシュボードの「学習メニュー」の折りたたみ、「調べる」タブ、レベルのカードの
 * 6つの形式ボタン、ハンバーガーの「つながりマップ」に分かれていた入口をここに集める。
 */
export default function LearnHub({
  vocabulary,
  setVocabulary,
  setStats,
  setRanking,
  solvedHistory,
  srsData,
  wrongWords,
  onStartQuiz,
  onStartReview,
  onOpenReading,
  onOpenGrammar,
  onOpenVerbForms,
  onOpenMapPuzzle,
  onOpenDiary,
  onChangeLevel
}: LearnHubProps) {
  // 「今日」の画面で選んだレベルと問題数をそのまま使う
  const [level] = useState<Level>(() => readStudyLevel());
  const [count] = useState<number>(() => readQuestionCount());

  const mastered = countMastered(vocabulary.map(w => w.id), solvedHistory, srsData);
  const diaryOpen = mastered >= DIARY_UNLOCK;

  return (
    <div className="space-y-6" id="learn_page">
      <h1 className="text-xl font-black text-gray-900 px-1">教材</h1>

      <section aria-labelledby="learn_quiz_heading" className="space-y-2.5">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 id="learn_quiz_heading" className="text-base font-black text-gray-900">単語クイズ</h2>
            <p className="text-xs text-gray-500 mt-0.5" id="learn_quiz_setting">
              {LEVEL_LABELS[level]}・{count}問
            </p>
          </div>
          <button
            type="button"
            onClick={onChangeLevel}
            id="btn_learn_change_level"
            className="min-h-11 px-2 text-xs font-black text-indigo-700 cursor-pointer"
          >
            レベルを変える
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map(f => (
            <button
              key={f.type}
              type="button"
              id={`btn_learn_${f.type}`}
              onClick={() => onStartQuiz(level, f.type, count)}
              className="min-h-24 flex flex-col items-start gap-1.5 p-3 text-left bg-white border border-gray-100 dark:border-slate-800 rounded-2xl hover:border-indigo-300 transition cursor-pointer"
            >
              <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <f.Icon className="w-4.5 h-4.5" />
              </span>
              <span className="text-sm font-black text-gray-900">{f.name}</span>
              <span className="text-[11px] text-gray-500 leading-snug">{f.desc}</span>
            </button>
          ))}
          <button
            type="button"
            id="btn_learn_wrong_words"
            onClick={onStartReview}
            className="min-h-24 flex flex-col items-start gap-1.5 p-3 text-left bg-white border border-gray-100 dark:border-slate-800 rounded-2xl hover:border-indigo-300 transition cursor-pointer"
          >
            <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center">
              <Target className="w-4.5 h-4.5" />
            </span>
            <span className="text-sm font-black text-gray-900">苦手な単語</span>
            <span className="text-[11px] text-gray-500 leading-snug">
              {wrongWords.length > 0 ? `間違えた ${wrongWords.length}語を復習` : "間違えた語はまだありません"}
            </span>
          </button>
        </div>
      </section>

      <section aria-labelledby="learn_read_heading" className="space-y-2.5">
        <h2 id="learn_read_heading" className="text-base font-black text-gray-900 px-1">読む・文法</h2>
        <div className="bg-white border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-slate-800">
          <Row id="learn_open_reading" title="長文ストーリー" note="各レベルの単語だけで書いた長文を読む" Icon={ReadingIcon} onClick={onOpenReading} />
          <Row id="learn_open_grammar" title="文法ガイド" note="中学〜大学の34項目。説明と練習問題" Icon={BookMarked} onClick={onOpenGrammar} />
          <Row id="learn_open_verb_forms" title="動詞の活用" note="過去形・過去分詞・ing形の一覧" Icon={Repeat} onClick={onOpenVerbForms} />
          <Row id="learn_open_map" title="つながりマップ" note="単語どうしの関係をパズルで" Icon={PuzzleIcon} onClick={onOpenMapPuzzle} />
        </div>
      </section>

      <section aria-labelledby="learn_write_heading" className="space-y-2.5">
        <h2 id="learn_write_heading" className="text-base font-black text-gray-900 px-1">書く</h2>
        {/* まだ使えないうちは控えめに出す。以前は「学習メニュー」の中でいちばん目立つ
            オレンジのボタンが、使えない機能のものだった */}
        <button
          type="button"
          id="learn_open_diary"
          onClick={onOpenDiary}
          className={`w-full min-h-14 flex items-center gap-3 px-4 py-3 text-left rounded-2xl transition cursor-pointer ${
            diaryOpen
              ? "bg-white border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800"
              : "bg-gray-50 border border-dashed border-gray-300"
          }`}
        >
          <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${
            diaryOpen ? "bg-indigo-50 text-indigo-700" : "bg-gray-100 text-gray-600"
          }`}>
            {diaryOpen ? <DiaryIcon className="w-5 h-5" /> : <Lock className="w-4.5 h-4.5" />}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-black text-gray-900">AI 英語日記</span>
            {diaryOpen ? (
              <span className="block text-xs text-gray-500 mt-0.5">覚えた単語でAIが書いた日記を読む・書く</span>
            ) : (
              <>
                <span className="block text-xs text-gray-600 mt-0.5" id="learn_diary_lock">
                  {DIARY_UNLOCK}語覚えると使えます（あと {DIARY_UNLOCK - mastered}語）
                </span>
                <span className="block mt-1.5 h-1.5 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
                  <span className="block h-full bg-gray-500" style={{ width: `${Math.round((mastered / DIARY_UNLOCK) * 100)}%` }} />
                </span>
              </>
            )}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" aria-hidden="true" />
        </button>
      </section>

      <section aria-label="単語を増やす">
        <WordImport vocabulary={vocabulary} setVocabulary={setVocabulary} setStats={setStats} setRanking={setRanking} />
      </section>
    </div>
  );
}
