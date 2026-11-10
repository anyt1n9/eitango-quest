import { useEffect, useRef, useState } from "react";
import { createOceanScene, type OceanScene } from "../ocean/oceanScene";
import { oceanGradientCss } from "../ocean/depth";
// 名前に中身のハッシュが付く（作り直したモデルと古いコードが組み合わさらない）
import oceanModelUrl from "../ocean/assets/ocean.glb?url";
// 写真から作った魚（Fish Kit の作り方。CC0。src/ocean/assets/README.md）。その深さで泳ぐものだけを取りに行く
import anchovyUrl from "../ocean/assets/ocean-anchovy.glb?url";
import lanternfishUrl from "../ocean/assets/ocean-lanternfish.glb?url";
import butterflyfishUrl from "../ocean/assets/ocean-butterflyfish.glb?url";
import damselfishUrl from "../ocean/assets/ocean-damselfish.glb?url";
import wrasseUrl from "../ocean/assets/ocean-wrasse.glb?url";
import anglerfishUrl from "../ocean/assets/ocean-anglerfish.glb?url";

const FISH_URLS = {
  anchovy: anchovyUrl, lanternfish: lanternfishUrl, butterflyfish: butterflyfishUrl,
  damselfish: damselfishUrl, wrasse: wrasseUrl, anglerfish: anglerfishUrl,
};

/**
 * 海の3D背景（既定で使う。メニューの「背景の画像・透明感」で止められる。決め方は src/oceanSetting.ts）。
 *
 * three.js と3Dモデル（海が約1.5MB、魚はその深さで泳ぐものだけ1種130〜170KB）を読むので、App から lazy() で読み込む。
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
  /**
   * 水深（m。覚えた語数で決まる。src/ocean/depth.ts）。変わったら数秒かけて潜る（浮かぶ）。
   * 作り直さない（3Dモデルの組み立てとシェーダーの準備がやり直しになる）
   */
  depth: number;
  /**
   * 3D の海を描けているか（作れた＝true、続けられなくなった・外した＝false）。
   * App の「海を眺める」はこれが true のときだけ出す。部品を読み込み中のときや、
   * 3Dモデルを取れず・WebGL を失って海の色の地になったときに押すと、文字だけが消えて
   * 眺めるもののない地が出てしまう
   */
  onDrawingChange?: (drawing: boolean) => void;
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

export default function OceanBackground({ active, motion, depth, onDrawingChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<OceanScene | null>(null);
  const [failed, setFailed] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const moving = motion && !reduceMotion;
  const latest = useRef({ active, moving, depth });
  latest.current = { active, moving, depth };
  const reportDrawing = useRef(onDrawingChange);
  reportDrawing.current = onDrawingChange;

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
        fishUrls: FISH_URLS,
        motion: latest.current.moving,
        depth: latest.current.depth,
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
    reportDrawing.current?.(true);
    return () => {
      // 続けられなくなった（failed）ときも、外したときも、ここを通る
      reportDrawing.current?.(false);
      scene.dispose();
      canvas.remove();
      sceneRef.current = null;
    };
  }, [failed]);

  useEffect(() => { sceneRef.current?.setActive(active); }, [active]);
  useEffect(() => { sceneRef.current?.setMotion(moving); }, [moving]);
  useEffect(() => { sceneRef.current?.setDepth(depth, true); }, [depth]);

  return (
    <div
      ref={hostRef}
      className="bg-scene bg-ocean3d"
      data-testid={active ? "background_scene" : undefined}
      data-kind={failed ? "ocean-fallback" : "ocean"}
      data-active={active ? "true" : "false"}
      data-depth={depth}
      data-veil="light"
      // 3D を描けないとき（海の色の地）と、canvas の描きはじめの前に見える地。いまの深さの色にする
      style={{ background: oceanGradientCss(depth) }}
      aria-hidden="true"
    >
      <div className="bg-photo-veil" />
    </div>
  );
}
