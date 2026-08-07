import React from "react";

/**
 * アプリ全体を包むエラーバウンダリ。
 *
 * これまでエラーバウンダリが無かったため、描画中に例外が1つでも投げられると
 * React がツリー全体をアンマウントし、画面が完全な白紙になっていた。
 * （例: AIの応答が想定外の形で返り、data.puzzle.filter が undefined を参照する）
 * 白紙になるとヘッダーも戻るボタンも消え、ユーザーは再読み込みするしかない。
 *
 * ここで捕捉して、状況の説明と復帰手段（再読み込み）を表示する。
 * 学習データは localStorage に保存されているため、再読み込みしても失われない。
 */
interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  // @types/react が依存に入っておらず React.Component が型を持たないため、
  // props の型をここで明示する（declare なので実行時のコードは生成されない）。
  declare props: Props;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("画面の描画中にエラーが発生しました:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm max-w-md w-full text-center space-y-4">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl">
            !
          </div>
          <h1 className="text-lg font-black text-gray-900">
            画面の表示中に問題が発生しました
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            お手数ですが、下のボタンから再読み込みしてください。
            <br />
            学習データ（スコア・単語・学習履歴）は端末に保存されているため、失われません。
          </p>
          <p className="text-[11px] text-gray-400 font-mono bg-gray-50 border border-gray-150 rounded-xl p-3 break-words text-left">
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-8 py-3 rounded-2xl shadow transition cursor-pointer text-sm"
          >
            再読み込みする
          </button>
        </div>
      </div>
    );
  }
}
