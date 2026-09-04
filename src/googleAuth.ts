/**
 * Googleへのログイン（ドライブ同期のためのアクセストークン取得）。
 *
 * 使うのは Google Identity Services のトークンクライアントだけで、
 * こちらのサーバーは介在しない（アクセストークンはブラウザの中だけに置き、
 * 保存もしない。切れたら取り直す）。
 *
 * **クライアントIDが設定されていないときは、同期の入口ごと出さない。**
 * 押しても必ず失敗するボタンを見せる方が分かりにくい。
 */
import { DRIVE_SCOPE } from "./driveBackup";

const GSI_SRC = "https://accounts.google.com/gsi/client";

/** Vite の環境変数。ビルド時に埋め込まれる（公開してよい値） */
export function googleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || "";
}

export function isGoogleSyncConfigured(): boolean {
  return googleClientId().length > 0;
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }): TokenClient;
        };
      };
    };
  }
}

let scriptLoading: Promise<void> | null = null;

/** Googleのスクリプトを1度だけ読み込む（起動時のJSに載せないため遅らせる） */
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptLoading) {
    scriptLoading = new Promise<void>((resolve, reject) => {
      const el = document.createElement("script");
      el.src = GSI_SRC;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        // 控えを残すと、通信が戻っても同じ失敗を返し続けることになる
        scriptLoading = null;
        reject(new Error("Googleのログイン用スクリプトを読み込めませんでした。"));
      };
      document.head.appendChild(el);
    });
  }
  return scriptLoading;
}

/**
 * ドライブ用のアクセストークンを取る。
 *
 * `silent` は「すでに許可済みなら画面を出さずに取る」。
 * 起動直後など、利用者が押していない場面ではこちらを使う
 * （押していないのにポップアップが出るのは、ブラウザにも塞がれる）。
 */
export function requestDriveToken(options: { silent?: boolean } = {}): Promise<string> {
  const clientId = googleClientId();
  if (!clientId) {
    return Promise.reject(new Error("Googleドライブ同期は設定されていません。"));
  }
  return loadGsi().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const oauth2 = window.google?.accounts?.oauth2;
        if (!oauth2) {
          reject(new Error("Googleのログインを準備できませんでした。"));
          return;
        }
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: DRIVE_SCOPE,
          callback: (response) => {
            if (response.access_token) resolve(response.access_token);
            else reject(new Error(response.error_description || "Googleのログインに失敗しました。"));
          },
          error_callback: () => {
            // 利用者が閉じた場合もここに来る。理由は分からないので一律に伝える
            reject(new Error("Googleのログインを完了できませんでした。"));
          }
        });
        client.requestAccessToken(options.silent ? { prompt: "" } : undefined);
      })
  );
}
