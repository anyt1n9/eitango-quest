# 海の魚を写真から作る：写真の頼み方

海の3D背景の魚は、Fish Kit（CC0。https://cda-social.github.io/fish/gallery.html ）と同じ方法で
「写真から作った3Dの魚」にしている。写真は **ChatGPT のチャットで画像を作ってもらい、Claude Code のチャットに貼る**。
形を起こす作業（Blender）・海への組み込み・図鑑の更新は、Claude Code のセッションで行う
（`scripts/fishgen/make_photo_fish.py`。CLAUDE.md の「海の3D背景」）。

キットの手順は Codex CLI（画像生成が使える ChatGPT の契約が要る）で写真を作るが、契約が無くても
ChatGPT のチャットで同じ写真を作れる。写真1枚（ひれを広げた真横の写真）だけで足りる
（ひれを消した写真は、キットのスクリプトが体の輪郭から自動で作る）。

## いまの魚

| ID | 魚 | 海の段 | 写真 |
| --- | --- | --- | --- |
| `anchovy` | カタクチイワシ | 浅瀬〜沖 | キットのモデルをそのまま使う |
| `butterflyfish` | チョウチョウウオ（Chaetodon auripes） | サンゴ礁 | `scripts/fishgen/photos/butterflyfish.webp` |
| `damselfish` | デバスズメダイ（Chromis viridis） | サンゴ礁 | `scripts/fishgen/photos/damselfish.webp` |
| `wrasse` | ナポレオンフィッシュ（Cheilinus undulatus） | 礁の斜面・沖 | `scripts/fishgen/photos/wrasse.webp` |
| `lanternfish` | ハダカイワシ（ハダカイワシ科） | 薄明の海・深海 | `scripts/fishgen/photos/lanternfish.webp` |
| `anglerfish` | チョウチンアンコウ（Himantolophus groenlandicus） | 深海 | `scripts/fishgen/photos/anglerfish.webp` |
| `eagleray` | マダラトビエイ（Aetobatus narinari） | 浅瀬〜沖 | `scripts/fishgen/photos/eagleray_top.webp`・`eagleray_bottom.webp`（上と下から見た2枚） |
| `seaturtle` | アオウミガメ（Chelonia mydas） | 浅瀬・サンゴ礁 | `scripts/fishgen/photos/seaturtle_top.webp`・`seaturtle_bottom.webp`（上と下から見た2枚） |

エイやウミガメのような平たい生き物は、真横の写真からは作れない。**上から見た写真と下から見た写真**の2枚から作る
（`scripts/fishgen/make_ray.py`・`make_turtle.py`。下の「平たい生き物の頼み方」）。ジンベエザメ・クラゲ・サンゴなどは、
いまは Blender の自作（`scripts/blender/make_ocean_assets.py`）のまま。

## ChatGPT への頼み方

1種ずつ、下の文の `<魚の説明>` を入れ替えて頼む。説明は**学名・大きさ・体の色を言葉ではっきり書く**
（キットの経験では、「アカカマス」とだけ書くと真っ赤な魚を描いた）。

> 魚類図鑑の標本写真のような、写実的な写真を1枚作ってください。
> <魚の説明>
> 真横から見た1匹だけ。口は左を向き、口とえらぶたは閉じる。ひれはすべて広げ、体から離れて見えるように。
> 背景は無地（模様も影も無い）。魚の全体が画面に収まり、上下左右に少し余白を残す。文字や枠は入れない。

体が黒い魚（ハダカイワシ・チョウチンアンコウ）は、背景を**明るい灰色**にしてもらう（背景と体の区別がつかないと、形に穴があく）。
これまでの写真は背景が青になったが、どれも切り分けられた（透けたひれに背景の青が少し混ざる）。

いまの魚の説明（例）：

- チョウチョウウオ：A single adult oriental butterflyfish (Chaetodon auripes), about 18 cm. Deep, strongly laterally compressed disc-shaped body, short pointed snout. Golden yellow body with many fine dark brown horizontal lines, a black vertical bar through the eye, yellow fins.
- デバスズメダイ：A single adult blue-green chromis (Chromis viridis), about 8 cm. Small oval body, large eye, deeply forked tail. Iridescent pale apple-green to light blue-green body, translucent bluish-green fins.
- ナポレオンフィッシュ：A single adult male humphead wrasse (Cheilinus undulatus), about 150 cm. Large heavy body with a prominent bulbous hump on the forehead, thick fleshy lips, rounded tail. Green to blue-green body with fine dark wavy lines on each scale, two short dark lines behind the eye.
- ハダカイワシ：A single adult lanternfish (family Myctophidae), about 10 cm. Slender body, very large eye, forked tail. Dark brownish back, silvery sides, rows of small round bluish-white photophores along the lower sides and belly.
- チョウチンアンコウ：A single adult female deep-sea anglerfish (Himantolophus groenlandicus), about 40 cm. Globular soft body, very large mouth with small pointed teeth, tiny eyes, a long fishing-rod-like spine rising from the head and ending in a pale bulb-shaped lure. Velvety black to very dark brown skin.

## 平たい生き物（エイ・ウミガメ）の頼み方

上から見た図（背）と下から見た図（腹）を、**別々の画像で**作ってもらう（1枚にまとめると1つの図が小さくなる）。
横から見た図は使わない（厚みは体の形から付ける）。

> 上の写真と同じ<生き物>を、真下から見た図にしてください。上から見た図と同じ姿勢・同じ大きさ・同じ位置で、
> 頭を画面の上に向け、翼（胸びれ）を左右いっぱいに広げてください。背景は同じ無地。

- 上と下の輪郭がよく重なるほど、腹の模様の継ぎ目が目立たない（マダラトビエイは95%重なった）。
- 翼はまっすぐ左右に広げ、尾は真下へ伸ばしてもらう（曲がっていると、尾の形が上と下で合わない）。
- ウミガメは、あし4本を甲羅から離して広げてもらう（甲羅に重なったあしは甲羅の一部として切り分けられ、動かせない）。
  頭の向きは上下の写真で違ってよい（`make_turtle.py` が回してそろえる）。あしの角度が上と下で少し違っても、部位ごとに合わせる。

## 写真を見るところ（キットの説明より）

- 本物らしい色と形か（学名どおりの魚か）
- ひれが全部広がっていて、体から離れて見えるか（体に重なったひれは、体の模様として描かれて動かない）
- 真横・口が左・口とえらぶたは閉じている・背景は無地
- 体から離れたもの（チョウチンアンコウの竿と提灯）は、細くても途切れずにつながっているか

## 写真ができたら

Claude Code のチャットに、魚の名前を添えて貼る。**Claude が作業している途中に貼った画像はファイルとして受け取れない**
（画面には見えるが、形を起こす材料にできない）。返事が終わってから、新しいメッセージで貼ること。

受け取った写真は `scripts/fishgen/photos/<id>.webp` に置き、`make_photo_fish.py` で形を起こす。
形ができたら、海に入れる前に3方向から描いた画像と、写真の切り分け（水色が体、桃色がひれ、緑が目）を見せて確かめてもらう。
