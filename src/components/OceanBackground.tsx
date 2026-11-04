import { useEffect, useRef, useState } from "react";
import { createOceanScene, type OceanScene } from "../ocean/oceanScene";
// 名前に中身のハッシュが付く（作り直したモデルと古いコードが組み合わさらない）
import oceanModelUrl from "../ocean/assets/ocean.glb?url";

/**
 * 海の3D背景（既定で使う。メニューの「背景の画像・透明感」で止められる。決め方は src/oceanSetting.ts）。
 *
 * three.js と3Dモデル（約1.3MB）を読むので、App から lazy() で読み込む。
 * 「使わない」を選んだ人の端末には何も届かない。使う人も、最初の画面が出てから読み込む（App の oceanMounted）。
 *
 * 出題中は見せない（BackgroundScene と同じ決まり）。ただし作り直すと
 * 3Dモデルの組み立てとシェーダーの準備がやり直しになるので、出題中も
 * 外さずに描くのを止めて隠すだけにする（active=false）。
 * 端末の「視差効果を減らす」設定とメニューの「背景の動き」では止めた1枚を出す。
 * WebGL が使えない・3Dモデルを取れない・WebGL を失って戻らないときは、静かな海の色の地に切り替える。
 */
interface Props {
  /** 出題中は false（描くのをやめて隠す） */
  active: boolean;
  /** メニューの「背景の動き」 */
  motion: boolean;
}

function usePrefersReducedMotion(): boolean {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduce, setReduce] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setReduce(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduce;
}

export default function OceanBackground({ active, motion }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OceanScene | null>(null);
  const [failed, setFailed] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const moving = motion && !reduceMotion;
  const latest = useRef({ active, moving });
  latest.current = { active, moving };

  useEffect(() => {
    const host = hostRef.current;
    if (!host || failed) return;
    // 描く場所（canvas）は毎回ここで作り、片付けるときに捨てる。
    // 片付けでは WebGL を手放す（forceContextLoss）ので、同じ canvas を使い回すと
    // 手放したものが返ってきて描けない（開発時の StrictMode は「作る→片付ける→作る」と走る）
    const canvas = document.createElement("canvas");
    canvas.className = "bg-ocean3d-canvas";
    host.prepend(canvas);
    let scene: OceanScene;
    try {
      scene = createOceanScene(canvas, {
        modelUrl: oceanModelUrl,
        motion: latest.current.moving,
        onFail: (reason) => {
          console.warn(`海の3D背景を続けられないため、海の色の地に切り替えます（${reason}）`);
          setFailed(true);
        },
      });
    } catch (e) {
      console.warn("海の3D背景を表示できないため、海の色の地に切り替えます", e);
      canvas.remove();
      setFailed(true);
      return;
    }
    scene.setActive(latest.current.active);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      canvas.remove();
      sceneRef.current = null;
    };
  }, [failed]);

  useEffect(() => { sceneRef.current?.setActive(active); }, [active]);
  useEffect(() => { sceneRef.current?.setMotion(moving); }, [moving]);

  return (
    <div
      ref={hostRef}
      className="bg-scene bg-ocean3d"
      data-testid={active ? "background_scene" : undefined}
      data-kind={failed ? "ocean-fallback" : "ocean"}
      data-active={active ? "true" : "false"}
      data-veil="light"
      aria-hidden="true"
    >
      <div className="bg-photo-veil" />
    </div>
  );
}
