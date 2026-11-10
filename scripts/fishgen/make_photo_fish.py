"""
海の3D背景の「写真の魚」（src/ocean/assets/ocean-<id>.glb）を作る。

写真（photos/<id>.webp）は、ChatGPT の画像生成で作ってもらった真横の魚（docs/ocean-fish-photos.md）。
形を起こすのは Fish Kit（https://cda-social.github.io/fish/gallery.html 、CC0 1.0）の fishgen.py と build.py
（ひれを消した写真が無ければ、build.py が体の輪郭をなめらかな線で引いて自動で作る）。

  .venv/bin/python scripts/fishgen/make_photo_fish.py [<id> ...]      # 省くと5種すべて

Blender を Python から使う版（bpy==4.5.3。scripts/blender/make_ocean_assets.py と同じ .venv）で動く。
作業は .cache/fishgen/ で行い、できた遠く用の形（キットの _lo。約700面）を src/ocean/assets/ocean-<id>.glb に写す。
写真の切り分けは .cache/fishgen/logs/<id>_analysis.png で確かめる（水色が体、桃色がひれ、緑が目）。
"""
import json
import os
import shutil
import sys

# 海では遠くを泳ぐので、遠く用の形だけを使う（fishgen は読み込むときにこの値を見る）
os.environ["FISH_LOD"] = "1"
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
import numpy as np  # noqa: E402

import build  # noqa: E402  (fishgen.load_rgb を「ひれを消した写真が無ければ自動で作る」ものに差し替える)
import fishgen as fg  # noqa: E402

IDS = ["butterflyfish", "damselfish", "wrasse", "lanternfish", "anglerfish"]
ASSETS = os.path.join(REPO, "src", "ocean", "assets")


def save_png(rgb, path):
    h, w = rgb.shape[:2]
    img = bpy.data.images.new("out", w, h)
    img.pixels.foreach_set(np.concatenate([rgb[::-1], np.ones((h, w, 1), np.float32)], -1).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def place_photo(sid):
    """photos/<id>.webp を、fishgen が読む refs/fish/<id>.png に置く"""
    os.makedirs(fg.REF, exist_ok=True)
    # 前に作った「ひれを消した写真」が残っていると、写真を差し替えても古いものから形を起こしてしまう
    for old in (sid + "_nofins_auto.png", sid + "_nofins.png"):
        if os.path.exists(fg.REF + old):
            os.remove(fg.REF + old)
    save_png(fg.load_rgb(os.path.join(HERE, "photos", sid + ".webp")), fg.REF + sid + ".png")


def wrasse_hump():
    """ナポレオンフィッシュの額のこぶは体の一部。自動の「ひれを消した写真」は、輪郭から飛び出たこぶを背びれと
    見なして体から外す（そのままでは、こぶが薄い板になる）。背びれの始まりより前で、体の上側にある魚の画素を体に戻す"""
    src = fg.load_rgb(fg.REF + "wrasse.png")
    auto = fg.REF + "wrasse_nofins_auto.png"
    build.auto_nofins(fg.REF + "wrasse.png", auto)
    nof = fg.load_rgb(auto)
    h, w = src.shape[:2]
    border = np.concatenate([src[:12].reshape(-1, 3), src[-12:].reshape(-1, 3), src[:, :12].reshape(-1, 3), src[:, -12:].reshape(-1, 3)])
    bg = np.median(border, 0)
    body = np.abs(nof - bg).max(-1) > 1e-3
    fish = np.linalg.norm(src - bg, axis=-1) > 0.12
    dorsal = int(w * 0.305)   # 背びれの始まり（写真の幅 1536 のうち 468 画素目）
    mid = np.array([np.flatnonzero(body[:, x]).mean() if body[:, x].any() else h for x in range(w)])
    yy, xx = np.mgrid[0:h, 0:w]
    hump = fish & (xx < dorsal) & (yy < mid[None, :])
    print("wrasse hump", int((hump & ~body).sum()), "px")
    save_png(np.where((body | hump)[..., None], src, bg[None, None, :]).astype(np.float32), fg.REF + "wrasse_nofins.png")


def anglerfish_lure():
    """提灯（写真の左上の白い玉）の中心を、キットの座標（頭が +X・上が +Y、メートル）で返す。
    src/ocean/photoFish.ts の ANGLERFISH_LURE_KIT と同じになっていること"""
    F = fg.Fish("anglerfish")
    s = F.src
    h, w = s.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    pale = (s[..., 0] > 0.55) & (s[..., 1] > 0.5) & (s[..., 0] > s[..., 2] + 0.05) & (xx < w * 0.3) & (yy < h * 0.45)
    pale = fg.components(pale)[0]
    ys, xs = np.nonzero(pale)
    x, y = F.to_m(xs.mean(), ys.mean())
    r = 0.5 * max(xs.max() - xs.min(), ys.max() - ys.min()) * F.S
    return {"x": round(float(x), 4), "y": round(float(y), 4), "radius": round(float(r), 4), "length": F.cfg["length"]}


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith("-")] or IDS
    for sid in ids:
        if sid not in fg.SPECIES:
            raise SystemExit(f"{sid} は fishgen.py の SPECIES にありません")
        place_photo(sid)
        if sid == "wrasse":
            wrasse_hump()
        fg.make(sid)
        out = os.path.join(ASSETS, f"ocean-{sid}.glb")
        shutil.copyfile(fg.OUT + sid + fg.LOD_SUFFIX + ".glb", out)
        print("wrote", out, os.path.getsize(out), "bytes")
        if sid == "anglerfish":
            print("ANGLERFISH_LURE_KIT", json.dumps(anglerfish_lure()))


if __name__ == "__main__":
    main()
