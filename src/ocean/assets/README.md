# 海の3D背景の3Dモデル

| ファイル | 中身 | 作り方・出どころ |
| --- | --- | --- |
| `ocean.glb` | マンタ・ウミガメ・ナポレオンフィッシュ・ジンベエザメ・チョウチンアンコウ・サンゴ・ウミウチワ・岩・海草 | `scripts/blender/make_ocean_assets.py` が Blender で作る（このリポジトリの自作） |
| `ocean-anchovy.glb` | 魚の群れ（カタクチイワシ） | Fish Kit（https://cda-social.github.io/fish/gallery.html）の `fish/katakuchi_lo.glb` を**そのまま**使っている（名前だけ変えた） |

Fish Kit は CC0 1.0（パブリックドメイン）。改変・再配布・商用利用が自由で、クレジット表記も要らない
（`LICENSE-fish-kit.txt`）。写真から作った魚で、写真は Codex（OpenAI）の画像生成、形は Blender で作られている。

ファイル名を `ocean-` で始めているのは、ビルドで付く名前（`ocean-anchovy-<ハッシュ>.glb`）を
サービスワーカーの「海の3D背景」の置き場所（`vite.config.ts` の `runtimeCaching`）に入れるため。
