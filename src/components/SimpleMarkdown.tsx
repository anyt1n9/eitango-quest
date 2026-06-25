import React from "react";

// 見出し(#)・太字(**)を含む1行をインライン整形する
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) {
      return (
        <strong key={keyPrefix + i} className="font-black text-gray-900 dark:text-slate-100">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={keyPrefix + i}>{p}</React.Fragment>;
  });
}

/**
 * AIアドバイス等で返る軽量Markdown（見出し ###、太字 **、箇条書き - / *）を
 * 整形して表示する簡易レンダラー。外部依存なし。
 */
export default function SimpleMarkdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length) {
      const items = list;
      const key = "ul" + blocks.length;
      blocks.push(
        <ul key={key} className="list-disc pl-5 space-y-1 my-2">
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, key + "-" + i + "-")}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flushList();
    if (line.trim() === "") return;

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls =
        level <= 1
          ? "text-lg font-black mt-3 mb-1.5"
          : level === 2
          ? "text-base font-black mt-3 mb-1.5"
          : "text-sm font-black mt-2 mb-1";
      blocks.push(
        <p key={"h" + idx} className={cls}>
          {renderInline(h[2], "h" + idx + "-")}
        </p>
      );
      return;
    }

    blocks.push(
      <p key={"p" + idx} className="mb-2 font-medium">
        {renderInline(line, "p" + idx + "-")}
      </p>
    );
  });

  flushList();

  return <div className={className}>{blocks}</div>;
}
