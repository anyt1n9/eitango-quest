# 海の3D背景の3Dモデル

| ファイル | 中身 | 作り方・出どころ |
| --- | --- | --- |
| `ocean.glb` | ウミガメ・ジンベエザメ・サンゴ・ウミウチワ・岩・海草 | `scripts/blender/make_ocean_assets.py` が Blender で作る（このリポジトリの自作） |
| `ocean-anchovy.glb` | 魚の群れ（カタクチイワシ） | Fish Kit（https://cda-social.github.io/fish/gallery.html）の `fish/katakuchi_lo.glb` を**そのまま**使っている（名前だけ変えた） |
| `ocean-butterflyfish.glb` | チョウチョウウオ | 下の「写真の魚」 |
| `ocean-damselfish.glb` | デバスズメダイ | 下の「写真の魚」 |
| `ocean-wrasse.glb` | ナポレオンフィッシュ | 下の「写真の魚」 |
| `ocean-lanternfish.glb` | ハダカイワシ | 下の「写真の魚」 |
| `ocean-anglerfish.glb` | チョウチンアンコウ | 下の「写真の魚」 |
| `ocean-eagleray.glb` | エイ（マダラトビエイ） | 下の「写真のエイ」 |

Fish Kit は CC0 1.0（パブリックドメイン）。改変・再配布・商用利用が自由で、クレジット表記も要らない
（`LICENSE-fish-kit.txt`）。写真から作った魚で、写真は Codex（OpenAI）の画像生成、形は Blender で作られている。

## 写真の魚

カタクチイワシ以外の5種は、キットと同じ方法でこのリポジトリで作った。

- 写真：真横から見た魚の写真を、ChatGPT（OpenAI）の画像生成で作ってもらったもの（`scripts/fishgen/photos/<id>.webp`。
  手順は `docs/ocean-fish-photos.md`）
- 形：キットの形を起こすスクリプト（`scripts/fishgen/fishgen.py`・`build.py`。CC0 のものを写し、作業場所と魚の一覧だけ変えた）を、
  `scripts/fishgen/make_photo_fish.py` から動かして作った。使うのは遠く用の軽い形（キットの `_lo`。約700面）

作り直しても形と模様は同じで、三角形の並び順だけが毎回少し変わる（ファイルのバイトは一致しない）。

## 写真のエイ

マダラトビエイは、上から見た写真と下から見た写真（`scripts/fishgen/photos/eagleray_top.webp`・`eagleray_bottom.webp`。
ChatGPT の画像生成で作ってもらったもの）から、`scripts/fishgen/make_ray.py` で作った（このリポジトリの自作のスクリプト。
キットのスクリプトは真横の写真1枚から魚を起こすので、平たいエイは作れない）。上から見た写真の輪郭に厚みを付け、
背に上からの写真、腹に下からの写真を貼る。同じ写真からは同じファイルができる。以前の Blender のマンタと入れ替えた。

ファイル名を `ocean-` で始めているのは、ビルドで付く名前（`ocean-anchovy-<ハッシュ>.glb`）を
サービスワーカーの「海の3D背景」の置き場所（`vite.config.ts` の `runtimeCaching`）に入れるため。
魚を足したら、その置き場所の数（`maxEntries`）も足りるかを見ること（`tests/photoFish.test.ts`）。
