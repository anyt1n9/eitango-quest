import React, { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADSENSE_SLOT_FOOTER, ADS_ENABLED } from "../adConfig";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

// AdSense のスクリプトを一度だけ読み込む
let scriptInjected = false;
function ensureAdSenseScript() {
  if (scriptInjected || typeof document === "undefined") return;
  if (document.querySelector('script[data-adsense-loader="1"]')) {
    scriptInjected = true;
    return;
  }
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  s.crossOrigin = "anonymous";
  s.setAttribute("data-adsense-loader", "1");
  document.head.appendChild(s);
  scriptInjected = true;
}

interface AdBannerProps {
  slot?: string;
  className?: string;
}

/**
 * 控えめなレスポンシブ・ディスプレイ広告。
 * AdSense が未設定（adConfig がプレースホルダー）の間は何も描画しない。
 */
export default function AdBanner({ slot = ADSENSE_SLOT_FOOTER, className = "" }: AdBannerProps) {
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ADS_ENABLED) return;
    ensureAdSenseScript();
    // SPA では同じ ins に二重 push しないようガード
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // 読み込み前・広告ブロック時などは黙って無視
    }
  }, []);

  // 未設定なら広告枠ごと非表示（審査前・開発中でも安全）
  if (!ADS_ENABLED) return null;

  return (
    <div
      className={`w-full max-w-4xl mx-auto px-4 my-2 ${className}`}
      aria-label="広告"
    >
      {/* 「広告」であることを明示（AdSense ポリシー: 誤クリック誘発を避ける） */}
      <p className="text-[10px] text-gray-300 dark:text-slate-600 text-center mb-1 tracking-wider uppercase">
        Sponsored
      </p>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
