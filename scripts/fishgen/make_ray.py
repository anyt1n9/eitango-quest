"""
上から見た写真と下から見た写真から、平たい生き物（エイ）の3Dの形を作る（海の3D背景のマダラトビエイ）。

  .venv/bin/python scripts/fishgen/make_ray.py [--preview <フォルダ>]   # --preview：模様（アトラス）の画像も書き出す

写真は scripts/fishgen/photos/eagleray_top.webp と eagleray_bottom.webp（ChatGPT の画像生成で作ってもらったもの。
docs/ocean-fish-photos.md）。できた形は src/ocean/assets/ocean-eagleray.glb に書く。numpy・scipy・Pillow を使う（bpy は要らない）。
Fish Kit のスクリプト（fishgen.py）は真横の写真1枚から魚を起こすので、平たいエイは作れない。そのためこちらで作る。

- 形と模様の作り方の共通の部分は flatbody.py（同じ間隔の格子・背と腹の模様・glb の書き出し）。
- 厚み：輪郭からの距離と、体の中心の盛り上がり（頭から腹びれまで）から付ける。輪郭の上では厚み 0 で上下の面が合う。
  細い尾は、行ごとの幅を太さにした細い管にする。
- 腹の模様：下から見た写真を、上から見た写真の輪郭に合わせて引き伸ばす（行ごとに左右の端をそろえ、
  下から見ているので左右を入れ替える）。
- 座標：頭が +Z、背が +Y、翼の幅の方向が X（以前の Blender のマンタと同じ）。翼の端から端が 4.2（RAY_SPAN）。
  向きと大きさをここでそろえるので、海の場面では回さずにそのまま使う（src/ocean/photoFish.ts の RAY_SPAN）。
- 作り直すと、同じ写真からは同じファイルができる。
"""
import os
import sys

import numpy as np
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from flatbody import Atlas, Mesh, fill_outside, keep_cells, load, sample, write_glb  # noqa: E402


def rows_extent(m):
    H = m.shape[0]
    L = np.full(H, -1); R = np.full(H, -1)
    for y in range(H):
        xs = np.flatnonzero(m[y])
        if xs.size:
            L[y], R[y] = xs[0], xs[-1]
    return L, R


def main():
    args = sys.argv[1:]
    here = os.path.dirname(os.path.abspath(__file__))
    top_p = os.path.join(here, "photos", "eagleray_top.webp")
    bot_p = os.path.join(here, "photos", "eagleray_bottom.webp")
    out = os.path.join(here, "..", "..", "src", "ocean", "assets", "ocean-eagleray.glb")
    # 翼の端から端（場面の単位）。src/ocean/photoFish.ts の RAY_SPAN と同じ値にする（場面の羽ばたきはその半分を翼の端として
    # 計算する）。変えるときは両方そろえる
    span = 4.2
    preview = args[args.index("--preview") + 1] if "--preview" in args else None

    top, tm = load(top_p)
    bot, bm = load(bot_p)
    H, W = tm.shape
    ys, xs = np.nonzero(tm)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    k = span / (x1 - x0)                 # 写真の1画素が何単位か
    cx = (x0 + x1) / 2
    tL, tR = rows_extent(tm)
    width = np.where(tL >= 0, tR - tL + 1, 0)
    # 尾の付け根：翼より後ろで、行の幅が細くなる所
    widest = int(np.argmax(width))
    tail0 = next((y for y in range(widest, y1) if width[y] < 0.04 * (x1 - x0)), None)
    if tail0 is None:
        sys.exit("尾の付け根が見つかりません（翼より後ろで細くなる行がない）。写真の輪郭の切り出しを確かめてください")
    # 腹びれは尾の付け根の少し後ろまである。体（格子）は腹びれの後ろの端まで、尾はそこから
    fins_end = tail0
    for y in range(tail0, y1):
        if width[y] < 0.025 * (x1 - x0):
            fins_end = y
            break
    print("bbox", x0, x1, y0, y1, "tail starts", tail0, "body grid ends", fins_end)

    # ---- 下から見た写真を、上から見た写真の輪郭に合わせる（行ごとに左右の端をそろえ、左右を入れ替える）
    bys, bxs = np.nonzero(bm)
    bx0, bx1, by0, by1 = bxs.min(), bxs.max(), bys.min(), bys.max()
    sy = (by1 - by0) / (y1 - y0)
    bL, bR = rows_extent(bm)
    # 行ごとの左右の端は、翼の先の高さで急に変わる（翼の先を含む行と含まない行）。そのまま合わせると、上と下の写真で
    # 変わる行が1〜2行ずれて、模様が横に1行ずれた線になる。端は上下になめらかにしてから合わせる
    def smooth_extent(Lx, Rx):
        ok = Lx >= 0
        ys_ok = np.flatnonzero(ok)
        Li = np.interp(np.arange(H), ys_ok, Lx[ok]); Ri = np.interp(np.arange(H), ys_ok, Rx[ok])
        return ndi.gaussian_filter1d(Li, 8), ndi.gaussian_filter1d(Ri, 8)
    sL, sR = smooth_extent(tL, tR)
    sbL, sbR = smooth_extent(bL, bR)
    # 輪郭の画素には背景の青が混ざっている（写真の縁のぼかし）。色は 3 画素内側から取る
    bot_filled = fill_outside(bot, ndi.binary_erosion(bm, iterations=3))
    warped = np.zeros_like(top)
    for y in range(H):
        if tL[y] < 0:
            continue
        yb = int(round(by0 + (y - y0) * sy))
        yb = min(max(yb, 0), H - 1)
        l2, r2 = sbL[yb], sbR[yb]
        xs_t = np.arange(tL[y], tR[y] + 1)
        t = (xs_t - sL[y]) / max(sR[y] - sL[y], 1)
        xb = r2 - t * (r2 - l2)           # 下から見ているので左右を入れ替える
        xb = np.clip(np.round(xb).astype(int), 0, W - 1)
        warped[y, xs_t] = bot_filled[yb, xb]

    # ---- 模様（アトラス）。体の格子は輪郭より2ます外まで張るので、切り出す四角もそこまで広げる
    # （狭いと、外側の頂点の UV が隣の半分（背なら腹の模様）に入る）
    step = (x1 - x0) / 60                 # 体の格子の間隔（画素）
    atlas = Atlas(top, warped, tm, (x0, x1, y0, y1), int(np.ceil(2 * step)) + 4, 1024)

    # ---- 厚み（画素）：輪郭からの距離と、体の中心の盛り上がり
    # 厚みは「行ごとに左右の端までを埋めた形」から測る。輪郭そのものから測ると、翼の先の高さの行で格子の点が
    # 輪郭の外（翼の先と体のあいだのくぼみ）に落ちて厚みが 0 になり、背と腹の面が重なって背の模様が線のように透けた
    filled = np.zeros_like(tm)
    for y in range(H):
        if tL[y] >= 0:
            filled[y, tL[y]:tR[y] + 1] = True
    dt = ndi.distance_transform_edt(filled)
    body_len = fins_end - y0
    def thickness(x, y):
        """背の側と腹の側の厚み（画素）"""
        xi = np.clip(np.round(x).astype(int), 0, W - 1); yi = np.clip(np.round(y).astype(int), 0, H - 1)
        d = dt[yi, xi]
        wing = 0.04 * (x1 - x0) * np.power(np.clip(d / dt.max(), 0, 1), 0.75)
        s = np.clip((y - y0) / body_len, 0, 1)
        # 頭（先の 15%）で立ち上がり、体の半ばで最も厚く、腹びれへ向かって細くなる
        along = np.clip(s / 0.15, 0, 1) ** 0.6 * (1 - 0.55 * np.clip((s - 0.45) / 0.55, 0, 1))
        body = 0.055 * (x1 - x0) * along * np.exp(-((x - cx) / (0.07 * (x1 - x0))) ** 2)
        t = np.sqrt(wing ** 2 + body ** 2)
        t *= np.clip(d / 4.0, 0, 1)        # 輪郭の上では 0
        return 0.62 * t, 0.38 * t

    head_z = 0.9                         # 頭の先の Z（以前の Blender のマンタの頭と同じ所）
    def to3(x, y, h):
        return np.stack([-(x - cx) * k, h * k, head_z - (y - y0) * k], -1)

    mesh = Mesh()
    # 体と翼：同じ間隔の格子（行ごとの幅に合わせると、翼の先の行で幅が急に変わって細長い三角形ができ、
    # 陰の付け方が乱れて線が出た）。輪郭は模様の切り抜きで出すので、格子は輪郭より少し外まで張り、
    # どの角も輪郭から離れたます目は捨てる
    gx = np.arange(x0 - step, x1 + 2 * step, step)
    gy = np.arange(y0 - step, fins_end + step, step)
    GX, GY = np.meshgrid(gx, gy)
    up, dn = thickness(GX, GY)
    near = ndi.binary_dilation(filled, iterations=int(step * 1.5))
    keep = keep_cells(sample(near, GX, GY))
    mesh.add_grid(to3(GX, GY, up), atlas.uv(GX, GY, False), keep)
    mesh.add_grid(to3(GX, GY, -dn), atlas.uv(GX, GY, True), keep, flip=True)

    # 尾：腹びれの後ろから尾の先まで、行の幅を太さにした細い管
    NT, RING = 24, 6
    ty = np.linspace(fins_end - 4, y1, NT)
    ring = np.linspace(0, 2 * np.pi, RING + 1)
    P = np.zeros((NT, RING + 1, 3)); UV = np.zeros((NT, RING + 1, 2))
    for i, y in enumerate(ty):
        yi = min(int(round(y)), y1)
        if tL[yi] >= 0:
            # 尾の中心は、その行で中心に近い区間
            seg = np.flatnonzero(tm[yi])
            core = seg[np.abs(seg - cx) < 0.03 * (x1 - x0)]
            c = core.mean() if core.size else cx
            rad = max((core.max() - core.min() + 1) / 2 if core.size else 1.0, 1.0)
        else:
            c, rad = cx, 1.0
        rad = max(rad * (1 - 0.7 * i / (NT - 1)), 0.8)
        for j, a in enumerate(ring):
            x = c + np.cos(a) * rad
            h = np.sin(a) * rad * 0.8
            P[i, j] = to3(np.array([x]), np.array([y]), np.array([h]))[0]
            UV[i, j] = atlas.uv(c + np.cos(a) * rad * 0.6, y, np.sin(a) < 0)
    mesh.add_grid(P, UV, flip=True)     # 輪の向きのままだと面が内向きになる

    V, N, UVs, F, _ = mesh.finish()
    print("verts", len(V), "tris", len(F), "z", V[:, 2].min(), V[:, 2].max(), "y", V[:, 1].min(), V[:, 1].max(), "x", V[:, 0].min(), V[:, 0].max())

    img_bytes = atlas.webp()
    write_glb(out, V, N, UVs, F, img_bytes, "eagle_ray", "eitango-quest make_ray.py")
    print("wrote", os.path.normpath(out), os.path.getsize(out), "bytes (image", len(img_bytes), "bytes)")
    if preview:
        atlas.image.save(preview + "/atlas.png")


if __name__ == "__main__":
    main()
