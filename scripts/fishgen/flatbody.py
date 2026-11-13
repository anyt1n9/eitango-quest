"""
上から見た写真と下から見た写真から、平たい生き物の3Dの形を作るときの共通の処理（make_ray.py・make_turtle.py）。

考え方
- 形：上から見た写真の輪郭を覆う「同じ間隔の格子」を、背の面と腹の面の2枚張る。厚みは呼び出し側が決める
  （輪郭の上では 0 にして、背と腹の面が縁で合うようにする）。輪郭そのものは模様の切り抜き（アルファ）で出すので、
  格子は輪郭より少し外まで張り、どの角も輪郭から離れたます目は捨てる。
  行ごとに左右の端まで格子を張ると、端が急に変わる行（エイの翼の先）で細長い三角形ができ、陰の付け方が乱れて線が出た。
- 模様：左半分が背（上から見た写真）、右半分が腹（下から見た写真を、上から見た写真の輪郭に合わせたもの）。
  どちらも上から見た写真の座標のまま、外接の四角を切り出す。
  写真の縁の画素には背景の色が混ざっているので、色は輪郭の3画素内側から取り、外は内側の色で埋める
  （遠くで縮めたとき背景の青がにじまない）。色と切り抜きは別々に縮める（RGBA のまま縮めると、
  輪郭の外の色が黒に引かれて縁が黒くにじむ）。
- 座標：写真の x（右）が場面の -X、写真の y（下）が場面の -Z（頭を写真の上に向けておけば、頭が +Z、背が +Y）。
"""
import io
import json
import struct

import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def load(path, rotate=0, mirror=False, margin=0):
    """写真を読み、背景（縁の色）と違う、いちばん大きなかたまりを生き物の形として返す（rotate は反時計回りの度）。
    margin：写真のまわりに足す余白（画素）。生き物が写真の端に近いと、模様の切り出し（格子より少し広い四角）が
    写真の外にはみ出し、端の頂点の UV が隣の半分（背なら腹の模様）を指してしまうため"""
    im = Image.open(path).convert("RGB")
    if rotate:
        im = im.rotate(rotate, expand=True)
    if mirror:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    a = np.asarray(im).astype(np.float32) / 255
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bg = np.median(border, 0)
    d = np.linalg.norm(a - bg, axis=-1)
    m = d > 0.15
    lab, n = ndi.label(m)
    s = ndi.sum(m, lab, range(1, n + 1))
    m = ndi.binary_fill_holes(lab == (np.argmax(s) + 1))
    if margin:
        a = np.pad(a, ((margin, margin), (margin, margin), (0, 0)), mode="edge")
        m = np.pad(m, margin)
    return a, m


def fill_outside(img, m):
    """輪郭の外の画素を、いちばん近い輪郭の内側の色で埋める"""
    _, (iy, ix) = ndi.distance_transform_edt(~m, return_indices=True)
    return img[iy, ix]


def sample(img, x, y):
    """格子の点（画素の座標。小数でよい）で、画像の値を引く"""
    H, W = img.shape[:2]
    return img[np.clip(np.round(y).astype(int), 0, H - 1), np.clip(np.round(x).astype(int), 0, W - 1)]


class Atlas:
    """模様：左半分が背、右半分が腹。どちらも上から見た写真の座標のまま、外接の四角（pad 画素広げる）を切り出す"""

    def __init__(self, top, under, mask, bbox, pad, side):
        H, W = mask.shape
        x0, x1, y0, y1 = bbox
        self.cx0, cx1, self.cy0, cy1 = max(x0 - pad, 0), min(x1 + pad, W - 1), max(y0 - pad, 0), min(y1 + pad, H - 1)
        self.cw, self.ch = cx1 - self.cx0 + 1, cy1 - self.cy0 + 1
        th = int(round(self.ch * side / self.cw))
        sl = (slice(self.cy0, cy1 + 1), slice(self.cx0, cx1 + 1))
        alpha = ndi.gaussian_filter(mask.astype(np.float32), 0.7)
        a_img = Image.fromarray((np.clip(alpha[sl], 0, 1) * 255 + 0.5).astype(np.uint8), "L").resize((side, th), Image.BILINEAR)
        er = ndi.binary_erosion(mask, iterations=3)

        def crop(img):
            img = fill_outside(img, er)
            rgb = Image.fromarray((np.clip(img[sl], 0, 1) * 255 + 0.5).astype(np.uint8), "RGB").resize((side, th), Image.LANCZOS)
            rgb.putalpha(a_img)
            return rgb
        self.image = Image.new("RGBA", (side * 2, th))
        self.image.paste(crop(top), (0, 0))
        self.image.paste(crop(under), (side, 0))

    def uv(self, x, y, under):
        u = (x - self.cx0) / self.cw * 0.5 + (0.5 if under else 0.0)
        v = (y - self.cy0) / self.ch
        return np.stack(np.broadcast_arrays(u, v), -1)

    def webp(self):
        buf = io.BytesIO()
        self.image.save(buf, "WEBP", quality=82, method=6)
        return buf.getvalue()


class Mesh:
    """頂点（位置・UV・ほかの値）と三角形を集める"""

    def __init__(self, extra_size=0):
        self.verts, self.uvs, self.extra, self.faces = [], [], [], []
        self.extra_size = extra_size

    def add_grid(self, P, UV, keep=None, flip=False, extra=None):
        """P: (rows, cols, 3) の格子を三角形2枚ずつでつなぐ。keep[i, j] が偽のます目は捨てる。flip で面の向きを逆に"""
        r, c = P.shape[:2]
        base = len(self.verts)
        self.verts.extend(P.reshape(-1, 3)); self.uvs.extend(UV.reshape(-1, 2))
        if self.extra_size:
            self.extra.extend(extra.reshape(-1, self.extra_size))
        for i in range(r - 1):
            for j in range(c - 1):
                if keep is not None and not keep[i, j]:
                    continue
                a = base + i * c + j; b = a + 1; d = a + c; e = d + 1
                if flip:
                    self.faces.append((a, b, d)); self.faces.append((b, e, d))
                else:
                    self.faces.append((a, d, b)); self.faces.append((b, d, e))

    def finish(self):
        """使わない頂点を除き、面の法線を足し合わせた頂点の法線を付ける（背と腹は別の頂点なので、縁で混ざらない）"""
        V = np.array(self.verts, np.float32)
        UV = np.array(self.uvs, np.float32)
        X = np.array(self.extra, np.float32) if self.extra_size else None
        F = np.array(self.faces, np.uint32)
        used = np.unique(F)
        remap = np.full(len(V), -1, np.int64); remap[used] = np.arange(len(used))
        V, UV, F = V[used], UV[used], remap[F].astype(np.uint32)
        if X is not None:
            X = X[used]
        N = np.zeros_like(V)
        fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
        for c in range(3):
            np.add.at(N, F[:, c], fn)
        N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
        return V, N, UV, F, X


def keep_cells(inside):
    """格子の点が輪郭の近くかどうか（inside）から、どれかの角が輪郭の近くにあるます目を残す"""
    return inside[:-1, :-1] | inside[:-1, 1:] | inside[1:, :-1] | inside[1:, 1:]


def write_glb(path, V, N, UV, F, img, name, generator, extra=None):
    """float の位置・法線・UV（と extra：{"_名前": 値}）と webp の模様1枚の glb を書く（数値を詰めない）"""
    chunks = []

    def add(b):
        off = sum(len(c) for c in chunks)
        chunks.append(b + b"\0" * ((4 - len(b) % 4) % 4))
        return off, len(b)
    idx = F.astype(np.uint16 if len(V) < 65536 else np.uint32).tobytes()
    extra = extra or {}
    datas = [(V.tobytes(), 34962), (N.tobytes(), 34962), (UV.tobytes(), 34962)]
    datas += [(np.ascontiguousarray(v, np.float32).tobytes(), 34962) for v in extra.values()]
    datas += [(idx, 34963), (img, None)]
    views = []
    for data, target in datas:
        off, ln = add(data)
        v = {"buffer": 0, "byteOffset": off, "byteLength": ln}
        if target:
            v["target"] = target
        views.append(v)
    bin_data = b"".join(chunks)
    attrs = {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}
    accessors = [
        {"bufferView": 0, "componentType": 5126, "count": len(V), "type": "VEC3", "min": V.min(0).tolist(), "max": V.max(0).tolist()},
        {"bufferView": 1, "componentType": 5126, "count": len(N), "type": "VEC3"},
        {"bufferView": 2, "componentType": 5126, "count": len(UV), "type": "VEC2"},
    ]
    for key, v in extra.items():
        attrs[key] = len(accessors)
        accessors.append({"bufferView": len(accessors), "componentType": 5126, "count": len(v), "type": {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4"}[v.shape[1]]})
    accessors.append({"bufferView": len(accessors), "componentType": 5123 if len(V) < 65536 else 5125, "count": F.size, "type": "SCALAR"})
    gltf = {
        "asset": {"version": "2.0", "generator": generator},
        "extensionsUsed": ["EXT_texture_webp"], "extensionsRequired": ["EXT_texture_webp"],
        "scene": 0, "scenes": [{"nodes": [0]}],
        "nodes": [{"name": name, "mesh": 0}],
        "meshes": [{"name": name, "primitives": [{"attributes": attrs, "indices": len(accessors) - 1, "material": 0}]}],
        "materials": [{"name": name, "doubleSided": True, "alphaMode": "MASK", "alphaCutoff": 0.5,
                       "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicFactor": 0, "roughnessFactor": 0.7}}],
        "textures": [{"sampler": 0, "extensions": {"EXT_texture_webp": {"source": 0}}}],
        "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 33071, "wrapT": 33071}],
        "images": [{"bufferView": len(views) - 1, "mimeType": "image/webp"}],
        "accessors": accessors,
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
