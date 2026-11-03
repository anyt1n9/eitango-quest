import { useEffect, useRef, useState } from "react";
import { createOceanScene, type OceanScene } from "../ocean/oceanScene";

/**
 * 海の3D背景（試験中。メニューの「背景の画像・透明感」で選んだ人にだけ出す）。
 *
 * three.js と3Dモデル（約1.3MB）を読むので、App から lazy() で読み込む。
 * 選んでいない人の端末には何も届かない（起動時の JS の量も変わらない）。
 *
 * 出題中は見せない（BackgroundScene と同じ決まり）。ただし作り直すと
 * 3Dモデルの組み立てとシェーダーの準備がやり直しになるので、出題中も
 * 外さずに描くのを止めて隠すだけにする（active=false）。
 * 端末の「視差効果を減らす」設定とメニューの「背景の動き」では止めた1枚を出す。
 * WebGL が使えない端末では、静かな海の色の地に切り替える。
 */
interface Props {
  /** 出題中は false（描くのをやめて隠す） */
  active: boolean;
  /** メニューの「背景の動き」 */
  motion: boolean;
}

export const OCEAN_MODEL_URL = "/ocean/ocean.glb";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OceanScene | null>(null);
  const [failed, setFailed] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const moving = motion && !reduceMotion;
  const movingRef = useRef(moving);
  movingRef.current = moving;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: OceanScene;
    try {
      scene = createOceanScene(canvas, { modelUrl: OCEAN_MODEL_URL, motion: movingRef.current });
    } catch (e) {
      console.warn("海の3D背景を表示できないため、海の色の地に切り替えます", e);
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => { sceneRef.current?.setActive(active); }, [active]);
  useEffect(() => { sceneRef.current?.setMotion(moving); }, [moving]);

  return (
    <div
      className="bg-scene bg-ocean3d"
      data-testid={active ? "background_scene" : undefined}
      data-kind={failed ? "ocean-fallback" : "ocean"}
      data-active={active ? "true" : "false"}
      data-veil="light"
      aria-hidden="true"
    >
      {!failed && <canvas ref={canvasRef} className="bg-ocean3d-canvas" />}
      <div className="bg-photo-veil" />
    </div>
  );
}
