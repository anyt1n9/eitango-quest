"""
上から見た写真と下から見た写真から、ウミガメの3Dの形を作る（海の3D背景のアオウミガメ）。

  .venv/bin/python scripts/fishgen/make_turtle.py [--preview <フォルダ>]   # --preview：模様と部位の分け方の画像も書き出す

写真は scripts/fishgen/photos/seaturtle_top.webp と seaturtle_bottom.webp（ChatGPT の画像生成で作ってもらったもの。
上から見た写真は頭が左、下から見た写真は頭が右）。できた形は src/ocean/assets/ocean-seaturtle.glb に書く。
numpy・scipy・Pillow を使う（bpy は要らない）。形と模様の共通の部分は flatbody.py。

- 部位：上から見た輪郭を、甲羅・頭・前あし2本・後ろあし2本に分ける（太さ 224 画素より細いものを削ると甲羅だけが残る）。
- 厚み：甲羅は楕円の丸い屋根（背は高く、腹は低い）。頭・首・あしは丸い断面（その辺りの太さを半径にした円）にし、
  あしは付け根を腕・脚のように太く、先へ行くほど平たくする。頭は横から見た写真に合わせて甲羅の縁より少し上に置く。
  以前は輪郭からの距離に比例させていて、横から見ると頭もあしも薄いくさび形の板だった。
- 輪郭：輪郭の外の格子の点は輪郭の上へ寄せ、背と腹の面をそこで閉じる（模様の切り抜きだけで輪郭を出すと、
  丸くした頭やあしでは、背と腹の面のあいだが横から見て隙間になる）。寄せて裏返った三角形は捨てる。
- 腹の模様：下から見た写真も同じように部位に分け、部位ごとに上から見た写真の位置へ合わせる（甲羅は楕円どうし、
  頭とあしは向きと長さ・幅をそろえる）。エイのように行ごとにそろえると、あしの角度が上と下の写真で違うので合わない。
- あしの動き：あしの頂点に印 _FLIPPER =（前あしの重み、後ろあしの重み、回す軸の |x|）を付ける。場面のシェーダーは
  この印で、軸のまわりにあしを羽ばたかせる（src/ocean/turtle.ts）。重みは付け根（甲羅・頭と接する所の |x|）で 0、
  そこから外へなめらかに 1 になる。甲羅と頭は 0 なので、どの時刻でも動かない。
  以前の Blender のウミガメは「甲羅の縁（|x| 0.42）より外があし」と位置だけで決めていたが、写真のカメは前あしの付け根が
  甲羅の縁より内側（首の横）にあり、甲羅のいちばん広い所は |x| 0.40 で前あしの付け根より後ろにある。位置だけでは決められない。
- 座標：頭が +Z、背が +Y、横が X（以前の Blender のウミガメと同じ）。甲羅の半分の幅を 0.40 にそろえる。
  向きと大きさをここでそろえるので、海の場面では回さずにそのまま使う。
- 作り直すと、同じ写真からは同じファイルができる。
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from flatbody import Atlas, Mesh, fill_outside, keep_cells, load, sample, write_glb  # noqa: E402

SHELL_HALF = 0.40            # 甲羅の半分の幅（場面の単位。以前の Blender のウミガメと同じ）
HEAD_Z = 0.77                # 頭の先の Z
SHELL, HEAD, FRONT_L, FRONT_R, REAR_L, REAR_R = 1, 2, 3, 4, 5, 6


def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def parts(m):
    """部位のラベル画像（0 外・1 甲羅・2 頭・3 左前・4 右前・5 左後ろ・6 右後ろ）と、甲羅の楕円（中心と半径）"""
    H, W = m.shape
    small = m[::4, ::4]
    shell = ndi.binary_opening(small, structure=disk(28))       # 太さ 224 画素より細いもの（頭・あし）を落とす
    lab, n = ndi.label(shell)
    s = ndi.sum(shell, lab, range(1, n + 1))
    shell = (lab == (np.argmax(s) + 1)).astype(np.float32)
    shell = ndi.zoom(shell, 4, order=1)[:H, :W] > 0.5
    shell = np.pad(shell, ((0, H - shell.shape[0]), (0, W - shell.shape[1])))[:H, :W] & m
    ys, xs = np.nonzero(shell)
    cy, cx = ys.mean(), xs.mean()
    a, b = 2 * xs.std(), 2 * ys.std()                           # 一様な楕円なら標準偏差の2倍が半径
    label = np.zeros((H, W), np.int32)
    label[shell] = SHELL
    rest = m & ~shell
    lab, n = ndi.label(rest)
    xx = np.arange(W)[None, :]
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() < 2000:
            continue
        ys_, xs_ = np.nonzero(comp)
        my, mx = ys_.mean(), xs_.mean()
        if my < cy - 0.6 * b and abs(mx - cx) < 0.3 * a:
            label[comp] = HEAD
        elif my < cy:
            label[comp] = FRONT_L if mx < cx else FRONT_R
        else:
            # 後ろあし2本は尾の所でつながることがあるので、甲羅の中心の左右で分ける
            label[comp & (xx < cx)] = REAR_L
            label[comp & (xx >= cx)] = REAR_R
    # 残り（甲羅と部位のすき間の細いかけら）は、いちばん近い部位に
    _, (iy, ix) = ndi.distance_transform_edt(label == 0, return_indices=True)
    label = np.where(m, label[iy, ix], 0)
    found = sorted(set(np.unique(label)) - {0})
    if found != [1, 2, 3, 4, 5, 6]:
        sys.exit(f"甲羅・頭・あし4本に分けられません（見つかった部位 {found}）。写真の輪郭を確かめてください")
    return label, (cx, cy, a, b)


def frame(label, k):
    """部位の中心と、長い向き・短い向き（と、それぞれの広がり）"""
    ys, xs = np.nonzero(label == k)
    P = np.stack([xs, ys], 1).astype(float)
    c = P.mean(0)
    w, v = np.linalg.eigh(np.cov((P - c).T))
    return c, v[:, 1], np.sqrt(w[1]), np.sqrt(w[0])


def align_under(top_label, top_shell, under, under_label, under_shell):
    """下から見た写真（上から見た写真と同じ左右の向きにしたもの）を、部位ごとに上から見た写真の位置へ合わせる"""
    H, W = top_label.shape
    yy, xx = np.mgrid[0:H, 0:W]
    sx = np.zeros((H, W)); sy = np.zeros((H, W))
    cx, cy, a, b = top_shell
    ucx, ucy, ua, ub = under_shell
    sel = top_label == SHELL
    sx[sel] = ucx + (xx[sel] - cx) * ua / a
    sy[sel] = ucy + (yy[sel] - cy) * ub / b
    for k in (HEAD, FRONT_L, FRONT_R, REAR_L, REAR_R):
        c, e1, s1, s2 = frame(top_label, k)
        d, f1, t1, t2 = frame(under_label, k)
        # 長い向きは甲羅の中心から外へ、短い向きはそれを90度回した向きにそろえる
        if e1 @ (c - (cx, cy)) < 0:
            e1 = -e1
        if f1 @ (d - (ucx, ucy)) < 0:
            f1 = -f1
        e2 = np.array([-e1[1], e1[0]]); f2 = np.array([-f1[1], f1[0]])
        sel = top_label == k
        P = np.stack([xx[sel], yy[sel]], 1) - c
        u = P @ e1 / s1; v = P @ e2 / s2
        Q = d + np.outer(u * t1, f1) + np.outer(v * t2, f2)
        sx[sel] = Q[:, 0]; sy[sel] = Q[:, 1]
    return sample(under, sx, sy)


def main():
    args = sys.argv[1:]
    here = os.path.dirname(os.path.abspath(__file__))
    out = os.path.join(here, "..", "..", "src", "ocean", "assets", "ocean-seaturtle.glb")
    preview = args[args.index("--preview") + 1] if "--preview" in args else None

    # 頭を上に向ける。下から見た写真は左右も入れ替えて、上から見た写真と同じ左右の向きにする
    # 右の前あしの先が写真の端の近くにあるので、まわりに余白を足す
    top, tm = load(os.path.join(here, "photos", "seaturtle_top.webp"), rotate=-90, margin=64)
    under, um = load(os.path.join(here, "photos", "seaturtle_bottom.webp"), rotate=90, mirror=True, margin=64)
    H, W = tm.shape
    tl, (cx, cy, sa, sb) = parts(tm)
    ul, ushell = parts(um)
    print("shell", round(cx), round(cy), round(sa), round(sb), "parts", {k: int((tl == k).sum()) for k in range(1, 7)})
    # 色は輪郭の3画素内側から取る（写真の縁の画素には背景の色が混ざる）
    warped = align_under(tl, (cx, cy, sa, sb), fill_outside(under, ndi.binary_erosion(um, iterations=3)), ul, ushell)

    ys, xs = np.nonzero(tm)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    k = SHELL_HALF / sa                       # 写真の1画素が何単位か
    step = (x1 - x0) / 36                     # 格子の間隔（画素）
    atlas = Atlas(top, warped, tm, (x0, x1, y0, y1), int(np.ceil(2 * step)) + 4, 512)

    # ---- あしの付け根（甲羅・頭と接する所）。あしを回す軸と、あしの太さ（付け根ほど太い）に使う
    body = ndi.binary_dilation((tl == SHELL) | (tl == HEAD), iterations=8)
    pivots, along = {}, np.zeros((H, W), np.float32)
    for kk in (FRONT_L, FRONT_R, REAR_L, REAR_R):
        part = tl == kk
        j = part & body
        if not j.any():
            # 接する所が無いと軸が NaN になり、場面であしの頂点が消えるか飛び散る。作る時点で止める
            sys.exit(f"部位 {kk}（3〜6 があし）が甲羅・頭に接していません。写真の輪郭と部位の分け方（--preview の parts.png）を確かめてください")
        pivots[kk] = float(np.median(np.abs(np.nonzero(j)[1] - cx)))
        # 付け根からの距離を、あしの先で 1 になるようにそろえる
        dist = ndi.distance_transform_edt(~j)
        along[part] = dist[part] / dist[part].max()
    ramp = 0.25 * sa

    # ---- 厚み（画素）。部位の境目でなめらかにつながるよう、部位の印はぼかしてから使う
    dt = ndi.distance_transform_edt(tm)
    _, (iy, ix) = ndi.distance_transform_edt(tl == 0, return_indices=True)
    lab_ext = tl[iy, ix]                      # 輪郭の外は、いちばん近い部位
    soft = {kk: ndi.gaussian_filter((lab_ext == kk).astype(np.float32), 12) for kk in range(1, 7)}
    # 頭とあしの丸みを効かせる範囲。部位の境目で 1 のまま、甲羅の側へ少し入ってから 0 になる（境目で半分にすると、
    # 首の付け根や腕の付け根がくびれた）。甲羅の側は甲羅の丸み（max）が引き継ぐ
    reach = {kk: np.clip(2 * ndi.gaussian_filter((lab_ext == kk).astype(np.float32), 16), 0, 1) for kk in range(2, 7)}
    # 頭とあしの「その辺りの太さ」（輪郭からいちばん遠い所までの距離。円柱なら半径）。部位ごとに、近くでの最大をとり、
    # 甲羅の側へは、いちばん近い頭・あしの値をのばす
    radius = np.zeros((H, W), np.float32)
    for kk in range(2, 7):
        part = tl == kk
        r_k = ndi.maximum_filter(np.where(part, dt, 0), size=int(0.9 * dt[part].max()))
        radius[part] = r_k[part]
    _, (ry, rx) = ndi.distance_transform_edt(tl < 2, return_indices=True)
    radius = np.maximum(ndi.gaussian_filter(radius[ry, rx], 10), 1.0)
    # あしの厚みと幅の比：付け根は腕・脚のように太く、先へ行くほど平たい櫂（かい）になる
    # （前あし 0.55 → 0.15、後ろあしは短く太いので 0.6 → 0.25）
    thick_ratio = np.zeros((H, W), np.float32)
    for kk, base, tip in ((FRONT_L, 0.55, 0.15), (FRONT_R, 0.55, 0.15), (REAR_L, 0.6, 0.25), (REAR_R, 0.6, 0.25)):
        part = tl == kk
        thick_ratio[part] = tip + (base - tip) * (1 - along[part]) ** 1.5
    _, (fy, fx) = ndi.distance_transform_edt(tl < 3, return_indices=True)
    thick_ratio = ndi.gaussian_filter(thick_ratio[fy, fx], 6)

    def round_profile(d, r):
        """輪郭から d の所の、半径 r の丸い断面の高さ（輪郭で 0、中心で r。輪郭のそばで立ち上がる）"""
        d = np.minimum(d, r)
        return np.sqrt(np.clip(d * (2 * r - d), 0, None))

    def surfaces(x, y):
        """背の面と腹の面の高さ（画素。上が正）"""
        r2 = ((x - cx) / sa) ** 2 + ((y - cy) / sb) ** 2
        dome = np.clip(1 - r2, 0, 1)
        d = sample(dt, x, y)
        r = sample(radius, x, y)
        s_shell = sample(soft[SHELL], x, y); s_head = sample(soft[HEAD], x, y)
        w_head = sample(reach[HEAD], x, y)
        w_fl = np.maximum.reduce([sample(reach[kk], x, y) for kk in range(3, 7)])
        edge = np.clip(d / 4.0, 0, 1)         # 輪郭の上では 0
        # 甲羅の丸みは楕円で付けるが、楕円と写真の輪郭はぴったりは重ならない。輪郭の近くで急に 0 に落とすと、
        # 横から見たとき縁がギザギザの壁になった。輪郭から半分の幅の2割までで、なめらかに薄くする
        rim = np.clip(d / (0.2 * sa), 0, 1) ** 0.7
        # 頭と首：丸い断面（縦は横の幅より少し低い）。横から見た写真では、頭は甲羅の縁より少し高い所にある
        c = round_profile(d, r) * edge
        head_up, head_dn, lift = 0.75 * c, 0.6 * c, 0.22 * r * s_head
        # あし：丸い断面を、厚みと幅の比（thick_ratio）まで平たくする。上側を少し厚く
        t = 2 * sample(thick_ratio, x, y) * c
        fl_up, fl_dn = 0.55 * t, 0.45 * t
        up = np.maximum.reduce([0.55 * sa * dome ** 0.5 * rim * s_shell * edge, head_up * w_head, fl_up * w_fl])
        dn = np.maximum.reduce([0.2 * sa * dome ** 0.4 * rim * s_shell * edge, head_dn * w_head, fl_dn * w_fl])
        # 背と腹の面は輪郭で同じ高さ（lift）で出会う。lift は頭のまわりだけで、甲羅とあしに向かって 0 になる
        return lift + up, lift - dn, lift
    print("pivots (|x|)", {kk: round(v * k, 3) for kk, v in pivots.items()})

    def flippers(x, y):
        lab = sample(lab_ext, x, y)
        ax = np.abs(x - cx)
        out = np.zeros(x.shape + (3,))
        for kk in (FRONT_L, FRONT_R, REAR_L, REAR_R):
            sel = lab == kk
            t = np.clip((ax[sel] - pivots[kk]) / ramp, 0, 1)
            out[sel, 0 if kk in (FRONT_L, FRONT_R) else 1] = t * t * (3 - 2 * t)
            out[sel, 2] = pivots[kk] * k
        return out

    def to3(x, y, h):
        return np.stack([-(x - cx) * k, h * k, HEAD_Z - (y - y0) * k], -1)

    gx = np.arange(x0 - step, x1 + 2 * step, step)
    gy = np.arange(y0 - step, y1 + 2 * step, step)
    GX, GY = np.meshgrid(gx, gy)
    keep = keep_cells(sample(ndi.binary_dilation(tm, iterations=int(step * 1.5)), GX, GY))
    # 輪郭の外の格子の点は、いちばん近い輪郭の上へ寄せ、背と腹の面をそこで閉じる。輪郭を模様の切り抜きだけで出すと、
    # 頭やあしを丸くしたとき、輪郭の手前の格子の点がもう高いので、背と腹の面のあいだが横から見て隙間になった
    _, (oy, ox) = ndi.distance_transform_edt(~tm, return_indices=True)
    xi = np.clip(np.round(GX).astype(int), 0, W - 1); yi = np.clip(np.round(GY).astype(int), 0, H - 1)
    outside = ~tm[yi, xi]
    GX = np.where(outside, ox[yi, xi], GX).astype(float); GY = np.where(outside, oy[yi, xi], GY).astype(float)
    back, belly, lift = surfaces(GX, GY)
    back[outside] = lift[outside]; belly[outside] = lift[outside]
    fl = flippers(GX, GY)
    mesh = Mesh(extra_size=3)
    plane = np.stack([GX, GY], -1)
    mesh.add_grid(to3(GX, GY, back), atlas.uv(GX, GY, False), keep, extra=fl, plane=plane)
    mesh.add_grid(to3(GX, GY, belly), atlas.uv(GX, GY, True), keep, flip=True, extra=fl, plane=plane)
    V, N, UV, F, FL = mesh.finish()
    print("verts", len(V), "tris", len(F), "x", V[:, 0].min(), V[:, 0].max(), "y", V[:, 1].min(), V[:, 1].max(), "z", V[:, 2].min(), V[:, 2].max())

    img = atlas.webp()
    write_glb(out, V, N, UV, F, img, "sea_turtle", "eitango-quest make_turtle.py", {"_FLIPPER": FL})
    print("wrote", os.path.normpath(out), os.path.getsize(out), "bytes (image", len(img), "bytes)")
    if preview:
        atlas.image.save(os.path.join(preview, "atlas.png"))
        cols = np.array([(0, 0, 0), (200, 200, 200), (255, 80, 80), (80, 200, 80), (80, 120, 255), (230, 200, 60), (200, 80, 230)], np.uint8)
        Image.fromarray(np.concatenate([cols[tl], cols[ul]], 1)).resize((W, H // 2)).save(os.path.join(preview, "parts.png"))


if __name__ == "__main__":
    main()
