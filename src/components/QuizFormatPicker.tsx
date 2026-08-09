import { Word } from "../types";
import { QUIZ_FORMATS, QuizFormat, countByFormat } from "../quizFormats";
import { List, PenLine, Headphones, Keyboard, Languages } from "lucide-react";

/**
 * 復習をどの形式で解くかを選ぶ。
 *
 * 復習はどちらの入口（今日の復習・苦手単語の復習）も四択に固定されていたため、
 * 文穴埋めや綴りで覚えた語も四択でしか出し直せなかった。
 * 選択肢から選べても自分では書けない、という状態が残ってしまうので、
 * 覚えたときと同じ形式で復習できるようにする。
 *
 * 形式によっては出題できない語がある（綴りはイディオムを出せない、
 * 文穴埋めは例文が要る）ため、出題できる語数を添えて、0語の形式は選べなくする。
 */
interface Props {
  words: Word[];
  onSelect: (format: QuizFormat) => void;
  className?: string;
}

const ICONS: Record<QuizFormat, typeof List> = {
  word: List,
  sentence: PenLine,
  listening: Headphones,
  spelling: Keyboard,
  reverse: Languages
};

export default function QuizFormatPicker({ words, onSelect, className = "" }: Props) {
  const counts = countByFormat(words);

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 ${className}`} data-testid="quiz_format_picker">
      {QUIZ_FORMATS.map(f => {
        const Icon = ICONS[f.key];
        const count = counts[f.key];
        const disabled = count === 0;
        return (
          <button
            key={f.key}
            onClick={() => onSelect(f.key)}
            disabled={disabled}
            id={`review_format_${f.key}`}
            title={disabled ? "この形式で出題できる単語がありません" : f.description}
            className={`border rounded-2xl p-3.5 text-left transition flex items-center gap-3 ${disabled
              ? "bg-gray-50 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800 text-gray-300 dark:text-slate-600 cursor-not-allowed"
              : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/40 dark:hover:bg-slate-800 cursor-pointer"}`}
          >
            <Icon className={`w-5 h-5 shrink-0 ${disabled ? "" : "text-indigo-600 dark:text-indigo-400"}`} />
            <span className="flex-1 min-w-0">
              <span className={`block text-sm font-black ${disabled ? "" : "text-gray-900 dark:text-slate-100"}`}>
                {f.label}
              </span>
              <span className={`block text-[11px] font-semibold ${disabled ? "" : "text-gray-500 dark:text-slate-400"}`}>
                {f.description}
              </span>
            </span>
            <span className={`shrink-0 text-[11px] font-mono font-black ${disabled
              ? ""
              : "text-indigo-700 dark:text-indigo-300"}`}>
              {count}語
            </span>
          </button>
        );
      })}
    </div>
  );
}
