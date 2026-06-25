import { useEffect, useState } from "react";
import { getPhonetic } from "../phonetics";

/**
 * 単語の発音記号(IPA)を表示する小さなコンポーネント。
 * 取得できない場合は何も描画しない。
 */
export default function Phonetic({ word, className = "" }: { word: string; className?: string }) {
  const [ipa, setIpa] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIpa(null);
    getPhonetic(word).then((r) => {
      if (active) setIpa(r);
    });
    return () => {
      active = false;
    };
  }, [word]);

  if (!ipa) return null;

  return (
    <span className={`font-mono text-gray-400 dark:text-slate-500 ${className}`} aria-label="発音記号">
      {ipa}
    </span>
  );
}
