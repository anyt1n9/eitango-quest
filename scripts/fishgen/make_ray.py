"""
上から見た写真と下から見た写真から、平たい生き物（エイ）の3Dの形を作る（海の3D背景のマダラトビエイ）。

  .venv/bin/python scripts/fishgen/make_ray.py [--preview <フォルダ>]

写真は scripts/fishgen/photos/eagleray_top.webp と eagleray_bottom.webp（ChatGPT の画像生成で作ってもらったもの。
docs/ocean-fish-photos.md）。できた形は src/ocean/assets/ocean-eagleray.glb に書く。numpy・scipy・Pillow を使う（bpy は要らない）。
Fish Kit のスクリプト（fishgen.py）は真横の写真1枚から魚を起こすので、平たいエイは作れない。そのためこちらで作る。

- 形：上から見た写真の輪郭を、頭から尾の付け根まで行ごとに切り、行ごとに左右の端までを格子でつなぐ（上の面と下の面）。
  厚みは輪郭からの距離と、体の中心の盛り上がり（頭から腹びれまで）から付ける。輪郭の上では厚み 0 で上下の面が合う。
  細い尾は、行ごとの幅を太さにした細い管にする。
- 模様：上の面には上から見た写真、下の面には下から見た写真を、上から見た写真の輪郭に合わせて
  引き伸ばしたもの（行ごとに左右の端をそろえ、下から見ているので左右を入れ替える）を貼る。
  輪郭の外は捨てる（アルファの切り抜き）。輪郭の外の色は内側の色で埋める（遠くで縮めたとき背景の青がにじまない）。
- 座標：頭が +Z、背が +Y、翼の幅の方向が X（以前の Blender のマンタと同じ）。翼の端から端が 4.2（--span）。
  向きと大きさをここでそろえるので、海の場面では回さずにそのまま使う（src/ocean/photoFish.ts の RAY_SPAN）。
- 作り直すと、同じ写真からは同じファイルができる。
"""
import os
import json
import struct
import sys
import io

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def load(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32) / 255
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = np.linalg.norm(a - bg, axis=-1)
    m = d > 0.15
    lab, n = ndi.label(m)
    s = ndi.sum(m, lab, range(1, n + 1))
    m = ndi.binary_fill_holes(lab == (np.argmax(s) + 1))
    return a, m


def fill_outside(img, m):
    """輪郭の外の画素を、いちばん近い輪郭の内側の色で埋める"""
    _, (iy, ix) = ndi.distance_transform_edt(~m, return_indices=True)
    return img[iy, ix]


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
    span = float(args[args.index("--span") + 1]) if "--span" in args else 4.2
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
    tail0 = next(y for y in range(widest, y1) if width[y] < 0.04 * (x1 - x0))
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
    top_filled = fill_outside(top, ndi.binary_erosion(tm, iterations=3))
    warped = fill_outside(warped, ndi.binary_erosion(tm, iterations=3))

    # ---- 模様（アトラス）：左が背、右が腹。どちらも上から見た写真の座標のまま、外接の四角を切り出す。
    # 体の格子は輪郭より2ます外まで張るので、切り出す四角もそこまで広げる（狭いと、外側の頂点の UV が
    # 隣の半分（背なら腹の模様）に入る）
    step = (x1 - x0) / 60                 # 体の格子の間隔（画素）
    pad = int(np.ceil(2 * step)) + 4
    cx0, cx1, cy0, cy1 = max(x0 - pad, 0), min(x1 + pad, W - 1), max(y0 - pad, 0), min(y1 + pad, H - 1)
    cw, ch = cx1 - cx0 + 1, cy1 - cy0 + 1
    side = 1024
    th = int(round(ch * side / cw))
    alpha = ndi.gaussian_filter(tm.astype(np.float32), 0.7)
    a_img = Image.fromarray((np.clip(alpha[cy0:cy1 + 1, cx0:cx1 + 1], 0, 1) * 255 + 0.5).astype(np.uint8), "L").resize((side, th), Image.BILINEAR)
    def crop(img):
        # 色と切り抜きは別々に縮める（RGBA のまま縮めると、輪郭の外の色が黒に引かれて縁が黒くにじむ）
        rgb = Image.fromarray((np.clip(img[cy0:cy1 + 1, cx0:cx1 + 1], 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").resize((side, th), Image.LANCZOS)
        rgb.putalpha(a_img)
        return rgb
    atlas = Image.new("RGBA", (side * 2, th))
    atlas.paste(crop(top_filled), (0, 0))
    atlas.paste(crop(warped), (side, 0))

    def uv(x, y, under):
        u = (x - cx0) / cw * 0.5 + (0.5 if under else 0.0)
        v = (y - cy0) / ch
        return u, v

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

    verts, uvs, faces = [], [], []
    def add_grid(P, UV, flip=False):
        """P: (rows, cols, 3) の格子を、三角形2枚ずつでつなぐ（flip で面の向きを逆に）"""
        r, c = P.shape[:2]
        base = len(verts)
        verts.extend(P.reshape(-1, 3)); uvs.extend(UV.reshape(-1, 2))
        for i in range(r - 1):
            for j in range(c - 1):
                a = base + i * c + j; b = a + 1; d = a + c; e = d + 1
                if flip:
                    faces.append((a, b, d)); faces.append((b, e, d))
                else:
                    faces.append((a, d, b)); faces.append((b, d, e))
        return base

    # 体と翼：同じ間隔の格子（行ごとの幅に合わせると、翼の先の行で幅が急に変わって細長い三角形ができ、
    # 陰の付け方が乱れて線が出た）。輪郭は模様の切り抜きで出すので、格子は輪郭より少し外まで張り、
    # どの角も輪郭から離れたます目は捨てる
    gx = np.arange(x0 - step, x1 + 2 * step, step)
    gy = np.arange(y0 - step, fins_end + step, step)
    GX, GY = np.meshgrid(gx, gy)
    up, dn = thickness(GX, GY)
    near = ndi.binary_dilation(filled, iterations=int(step * 1.5))
    inside = near[np.clip(np.round(GY).astype(int), 0, H - 1), np.clip(np.round(GX).astype(int), 0, W - 1)]
    def grid(h, under):
        P = to3(GX, GY, h)
        UV = np.stack(np.broadcast_arrays(*uv(GX, GY, under)), -1)
        base = len(verts)
        verts.extend(P.reshape(-1, 3)); uvs.extend(UV.reshape(-1, 2))
        r, c = GX.shape
        for i in range(r - 1):
            for j in range(c - 1):
                if not (inside[i, j] or inside[i, j + 1] or inside[i + 1, j] or inside[i + 1, j + 1]):
                    continue
                a = base + i * c + j; b = a + 1; d = a + c; e = d + 1
                faces.append((a, d, b) if not under else (a, b, d))
                faces.append((b, d, e) if not under else (b, e, d))
    grid(up, False)
    grid(-dn, True)

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
            near = seg[np.abs(seg - cx) < 0.03 * (x1 - x0)]
            c = near.mean() if near.size else cx
            rad = max((near.max() - near.min() + 1) / 2 if near.size else 1.0, 1.0)
        else:
            c, rad = cx, 1.0
        rad = max(rad * (1 - 0.7 * i / (NT - 1)), 0.8)
        for j, a in enumerate(ring):
            x = c + np.cos(a) * rad
            h = np.sin(a) * rad * 0.8
            P[i, j] = to3(np.array([x]), np.array([y]), np.array([h]))[0]
            UV[i, j] = uv(c + np.cos(a) * rad * 0.6, y, np.sin(a) < 0)
    add_grid(P, UV, flip=True)          # 輪の向きのままだと面が内向きになる

    V = np.array(verts, np.float32)
    UVs = np.array(uvs, np.float32)
    F = np.array(faces, np.uint32)
    # 捨てたます目にしか使わない頂点を除く
    used = np.unique(F)
    remap = np.full(len(V), -1, np.int64); remap[used] = np.arange(len(used))
    V, UVs, F = V[used], UVs[used], remap[F].astype(np.uint32)
    # 法線：面の法線を頂点に足し合わせる（背と腹は別の頂点なので、縁で混ざらない）
    N = np.zeros_like(V)
    fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
    for c in range(3):
        np.add.at(N, F[:, c], fn)
    N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    print("verts", len(V), "tris", len(F), "z", V[:, 2].min(), V[:, 2].max(), "y", V[:, 1].min(), V[:, 1].max(), "x", V[:, 0].min(), V[:, 0].max())

    buf = io.BytesIO()
    atlas.save(buf, "WEBP", quality=82, method=6)
    img_bytes = buf.getvalue()
    write_glb(out, V, N, UVs, F, img_bytes)
    print("wrote", os.path.normpath(out), os.path.getsize(out), "bytes (image", len(img_bytes), "bytes)")
    if preview:
        atlas.save(preview + "/atlas.png")


def write_glb(path, V, N, UV, F, img):
    chunks = []
    def add(b):
        off = sum(len(c) for c in chunks)
        chunks.append(b + b"\0" * ((4 - len(b) % 4) % 4))
        return off, len(b)
    idx = F.astype(np.uint16 if len(V) < 65536 else np.uint32).tobytes()
    views = []
    for data, target in [(V.tobytes(), 34962), (N.tobytes(), 34962), (UV.tobytes(), 34962), (idx, 34963), (img, None)]:
        off, ln = add(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": ln}
        if target:
            v["target"] = target
        views.append(v)
    bin_data = b"".join(chunks)
    gltf = {
        "asset": {"version": "2.0", "generator": "eitango-quest make_ray.py"},
        "extensionsUsed": ["EXT_texture_webp"], "extensionsRequired": ["EXT_texture_webp"],
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "eagle_ray", "mesh": 0}],
        "meshes": [{"name": "eagle_ray", "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3, "material": 0}]}],
        "materials": [{"name": "eagle_ray", "doubleSided": True, "alphaMode": "MASK", "alphaCutoff": 0.5,
                       "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 0.7}}],
        "textures": [{"sampler": 0, "extensions": {"EXT_texture_webp": {"source": 0}}}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": 4, "mimeType": "image/webp"}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(V), "type": "VEC3", "min": V.min(0).tolist(), "max": V.max(0).tolist()},
            {"bufferView": 1, "componentType": 5126, "count": len(N), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(UV), "type": "VEC2"},
            {"bufferView": 3, "componentType": 5123 if len(V) < 65536 else 5125, "count": F.size, "type": "SCALAR"},
        ],
        "bufferViews": views,
        "buffers": [{"byteLength": len(bin_data)}],
    }
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bin_data)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(bin_data), 0x004E4942)); f.write(bin_data)


if __name__ == "__main__":
    main()
