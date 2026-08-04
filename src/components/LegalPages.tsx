import React from "react";
import { ArrowLeft, ShieldCheck, FileText, ExternalLink } from "lucide-react";

// ▼リリース時に差し替え: お問い合わせ用 Google フォームの共有URL（https://forms.gle/... など）
const CONTACT_FORM_URL = "https://forms.gle/XXXXXXXXXXXX";
const LAST_UPDATED = "2026年8月4日";

// お問い合わせフォームへのボタン（両ページ共通）
function ContactBlock() {
  return (
    <div className="not-prose">
      <p className="mb-2">お問い合わせは、以下のフォームよりご連絡ください。</p>
      <a
        href={CONTACT_FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition !no-underline !text-white"
      >
        お問い合わせフォームを開く
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

function Shell({
  title,
  icon,
  onBack,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        ダッシュボードに戻る
      </button>
      <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <span className="text-indigo-600 dark:text-indigo-400">{icon}</span>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 dark:text-slate-100">{title}</h1>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-6">最終更新日: {LAST_UPDATED}</p>
        <div className="space-y-5 text-sm leading-relaxed text-gray-700 dark:text-slate-300 [&_h2]:font-black [&_h2]:text-gray-900 dark:[&_h2]:text-slate-100 [&_h2]:text-base [&_h2]:mt-6 [&_h2]:mb-1.5 [&_a]:text-indigo-600 dark:[&_a]:text-indigo-400 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicy({ onBack }: { onBack: () => void }) {
  return (
    <Shell title="プライバシーポリシー" icon={<ShieldCheck className="w-6 h-6" />} onBack={onBack}>
      <p>
        英単語 Quest（以下「本アプリ」）は、利用者のプライバシーを尊重します。本ポリシーは、本アプリが取り扱う情報とその目的を説明します。
      </p>

      <h2>1. 収集しない情報</h2>
      <p>
        本アプリはアカウント登録を必要とせず、氏名・住所・電話番号などの個人を特定する情報を収集・保存しません。
      </p>

      <h2>2. 端末内に保存される情報</h2>
      <p>
        学習の進捗・スコア・苦手単語・設定などは、利用者のブラウザの <strong>localStorage</strong> にのみ保存され、当方のサーバーには送信されません。ブラウザのデータを消去すると、これらは失われます。
      </p>

      <h2>3. AI機能（Google Gemini API）</h2>
      <p>
        AIによる単語分析・例文生成・日記添削などの機能を利用した場合、入力された英単語やテキストは処理のため Google の Gemini API に送信されます。送信内容の取り扱いは
        {" "}<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google のプライバシーポリシー</a>に従います。個人情報や機密情報は入力しないでください。
      </p>

      <h2>4. 広告について（Google AdSense）</h2>
      <p>
        本アプリは第三者配信の広告サービス「Google AdSense」を利用しています。Google などの第三者広告配信事業者は、Cookie を使用して、利用者の本アプリや他サイトへのアクセス情報に基づいた広告を配信することがあります。
      </p>
      <ul>
        <li>
          Google による Cookie の使用は
          {" "}<a href="https://policies.google.com/technologies/ads" target="_blank" rel="noopener noreferrer">広告における Cookie の使用について</a>をご覧ください。
        </li>
        <li>
          パーソナライズ広告は
          {" "}<a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">広告設定</a>から無効にできます。
        </li>
        <li>
          第三者配信事業者の広告を無効にするには
          {" "}<a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer">aboutads.info</a>をご利用ください。
        </li>
      </ul>

      <h2>5. アクセス解析</h2>
      <p>現時点で、本アプリは独自のアクセス解析ツールによる個人単位の追跡は行っていません。</p>

      <h2>6. 子どもの利用</h2>
      <p>
        本アプリは学習用途で幅広い年齢の利用を想定しています。保護者の方は、お子様の利用にあたり本ポリシーをご確認ください。
      </p>

      <h2>7. ポリシーの変更</h2>
      <p>本ポリシーは予告なく変更されることがあります。重要な変更がある場合は本ページ上で告知します。</p>

      <h2>8. お問い合わせ</h2>
      <ContactBlock />
    </Shell>
  );
}

export function TermsOfService({ onBack }: { onBack: () => void }) {
  return (
    <Shell title="利用規約" icon={<FileText className="w-6 h-6" />} onBack={onBack}>
      <p>本利用規約（以下「本規約」）は、英単語 Quest（以下「本アプリ」）の利用条件を定めるものです。本アプリを利用した時点で、本規約に同意したものとみなします。</p>

      <h2>1. サービス内容</h2>
      <p>本アプリは英単語学習を目的としたウェブアプリケーションであり、無料で提供されます。</p>

      <h2>2. AI生成コンテンツについて</h2>
      <p>
        本アプリのAI機能（例文・解説・添削など）は自動生成であり、内容の正確性・完全性を保証しません。学習の最終的な判断はご自身の責任で行ってください。
      </p>

      <h2>3. 禁止事項</h2>
      <ul>
        <li>法令または公序良俗に違反する行為</li>
        <li>本アプリの運営を妨害する行為、過度な負荷をかける行為</li>
        <li>本アプリの複製・改変・再配布を無断で行う行為</li>
        <li>広告を不正にクリックする、または他者にクリックを促す行為</li>
      </ul>

      <h2>4. 免責事項</h2>
      <p>
        本アプリは「現状有姿」で提供され、明示・黙示を問わずいかなる保証も行いません。本アプリの利用またはデータ消失により生じた損害について、当方は一切の責任を負いません。
      </p>

      <h2>5. 知的財産権</h2>
      <p>本アプリおよび収録コンテンツに関する権利は、当方または正当な権利者に帰属します。</p>

      <h2>6. 規約の変更</h2>
      <p>本規約は予告なく変更されることがあります。変更後に本アプリを利用した場合、変更後の規約に同意したものとみなします。</p>

      <h2>7. お問い合わせ</h2>
      <ContactBlock />
    </Shell>
  );
}
