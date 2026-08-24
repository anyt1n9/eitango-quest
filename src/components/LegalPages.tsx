import React from "react";
import { ArrowLeft, ShieldCheck, FileText, ExternalLink, BookOpen } from "lucide-react";

// お問い合わせ用 Google フォームの共有URL
const CONTACT_FORM_URL = "https://forms.gle/ntH2Pgirb1vhgLbh8";
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
  /** 規約とポリシーだけに出す。アプリの説明には更新日の意味が無い */
  showUpdated = true,
}: {
  title: string;
  icon: React.ReactNode;
  onBack: () => void;
  children: React.ReactNode;
  showUpdated?: boolean;
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
        {showUpdated && (
          <p className="text-xs text-gray-400 dark:text-slate-500 mb-6">最終更新日: {LAST_UPDATED}</p>
        )}
        {!showUpdated && <div className="mb-6" />}
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
        Eigorira（以下「本アプリ」）は、利用者のプライバシーを尊重します。本ポリシーは、本アプリが取り扱う情報とその目的を説明します。
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
      <p>本利用規約（以下「本規約」）は、Eigorira（以下「本アプリ」）の利用条件を定めるものです。本アプリを利用した時点で、本規約に同意したものとみなします。</p>

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


/**
 * アプリケーション説明。
 *
 * 以前はフッターの中で開く小さなパネルに、6行の文章を詰め込んでいた。
 * 何がどれだけ入っていて、どう使うのかが読み取れなかったので、
 * 規約・ポリシーと同じ1枚の画面にして、項目ごとに分けて書く。
 * 数値は実際の収録データを数えたもの。
 */
export function AboutApp({ onBack }: { onBack: () => void }) {
  return (
    <Shell
      title="Eigorira（エイゴリラ）とは"
      icon={<BookOpen className="w-6 h-6" />}
      onBack={onBack}
      showUpdated={false}
    >
      <p>
        中学生から社会人までが使える、英単語の学習アプリです。
        単語を覚えるだけで終わらせず、<strong>文法・長文・語法</strong>までこの中で完結します。
        登録もお金も要らず、学習の記録は端末の中だけに保存されます。
      </p>

      <h2>収録しているもの</h2>
      <ul>
        <li><strong>英単語 7,730語</strong> — 中学1,062 / 高1 1,189 / 高2 1,425 / 高3 1,620 / 大学・社会人 2,434</li>
        <li><strong>例文</strong> — 全ての語に、その語を使った英文と和訳が付いています</li>
        <li><strong>語義 7,377語ぶん</strong> — 多義語の意味を並べ、品詞ごとの実際の使われ方の割合も示します</li>
        <li><strong>語法 5,091語ぶん</strong> — 動詞がとる文の形、よく一緒に使う語、同じ語源の仲間</li>
        <li><strong>文法 34項目</strong> — 中学から大学レベルまで。説明・例文・よくある間違い・練習問題つき</li>
        <li><strong>長文 25本</strong> — そのレベルの単語だけで書かれた読み物。設問と音読つき</li>
      </ul>

      <h2>1. 覚える（5つの出題形式）</h2>
      <p>
        レベルと1回の問題数（10問・50問・100問）を選んで始めます。同じ単語でも、形式が変わると
        問われる力が変わります。
      </p>
      <ul>
        <li><strong>一問一答</strong> — 英単語を見て意味を4択で選ぶ。まず意味を覚える段階に</li>
        <li><strong>例文穴埋め</strong> — 文の空所に入る語を選ぶ。使われ方まで含めて覚えられます</li>
        <li><strong>リスニング</strong> — 綴りを見ずに音だけで答える。読めるが聞き取れない語が分かります</li>
        <li><strong>日本語→英単語</strong> — 訳を見て英語を選ぶ。「意味は分かるが出てこない」を減らします</li>
        <li><strong>綴りを書く</strong> — 実際に入力する。どの文字から間違えたかを色分けで返します</li>
      </ul>

      <h2>2. 忘れる前に戻す（今日の復習）</h2>
      <p>
        一度覚えた単語も時間が経てば忘れます。正解した語は次に出るまでの間隔が延び、
        間違えた語はすぐ戻ってくる仕組み（間隔反復）で出題日を決めています。
        その日に出す語は「今日の復習」にまとまり、こちらも5つの形式から選べます。
      </p>
      <p>
        クイズで間違えた語は自動で「苦手単語」に貯まります。正解すると卒業していくので、
        苦手なものだけを集中して潰せます。
      </p>

      <h2>3. 習熟度の上がり方</h2>
      <p>
        単語ごとに数値を1つ持っていて、<strong>正解すると1つ上がり、間違えると1つ下がります</strong>。
        これが2以上になった語を「習得済み」と数え、レベルの習熟度は
        「習得済みの語数 ÷ そのレベルの収録語数」で出しています。
      </p>
      <ul>
        <li><strong>形式は問いません</strong> — どの形式で答えても同じ数値が動くので、5つすべてを答える必要はありません</li>
        <li><strong>1回の正解では上がりません</strong> — 4択は当てずっぽうでも当たるため、同じ語に2回正解して初めて習得済みになります</li>
        <li><strong>間違えると下がります</strong> — 忘れてしまえば習熟度も下がる、という見え方に揃えています</li>
        <li>長文の設問と文法の練習問題は、この数値を動かしません（間違えた語が苦手単語に貯まります）</li>
      </ul>

      <h2>4. 調べる</h2>
      <ul>
        <li><strong>辞書</strong> — 全7,730語を検索。意味・例文・発音・語義・語法を見られます</li>
        <li><strong>動詞の活用表</strong> — 不規則動詞を含む変化形の一覧</li>
        <li><strong>文法ガイド</strong> — 34項目の解説。その形をとる動詞を収録語から引いて示します</li>
      </ul>

      <h2>5. AIを使う機能</h2>
      <p>
        単語の追加・つながりマップ・英語日記・長文生成・頻度分析・類義語・PDFからの取り込みは、
        Gemini APIキーを設定したときだけ使えます。設定が無いときは、それらしい中身を作って返すことはせず、
        使えない旨をお伝えします。苦手分析と学習アドバイスはAI無しでも動き、
        どちらで作った文章かを結果に明記します。
      </p>

      <h2>6. データの保存</h2>
      <p>
        学習の記録はすべて、お使いの端末（ブラウザ）の中だけに保存されます。サーバーには送られません。
        端末を変えるときや消えてしまうのが心配なときは、「データ」の画面から書き出して、
        別の端末で読み込めます。
      </p>
      <p>
        インターネットに繋がらない場所でも、一度開いたことがあれば学習を続けられます
        （AIを使う機能を除く）。
      </p>

      <h2>お問い合わせ</h2>
      <ContactBlock />
    </Shell>
  );
}
