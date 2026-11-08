# 海の魚を写真の魚に作り直す：お手元で写真を作る手順

海の3D背景の魚を、Fish Kit（CC0。https://cda-social.github.io/fish/gallery.html ）と同じ方法で
「写真から作った3Dの魚」に作り直す。写真は Codex（OpenAI）の画像生成で作るので、**写真だけをお手元の PC で作る**。
形を起こす作業（Blender）・海への組み込み・図鑑の更新は、クラウドの Claude Code のセッションで行う。

魚の群れ（カタクチイワシ）は、キットのモデルをそのまま使って置き換え済み（`src/ocean/assets/README.md`）。

## 作る魚（5種）

| ID | 魚 | 海の段 | いまの形 |
| --- | --- | --- | --- |
| `butterflyfish` | チョウチョウウオ（Chaetodon auripes） | サンゴ礁 | その場で作る簡単な形 |
| `damselfish` | デバスズメダイ（Chromis viridis） | サンゴ礁 | その場で作る簡単な形 |
| `wrasse` | ナポレオンフィッシュ（Cheilinus undulatus） | 礁の斜面・沖 | Blender の自作 |
| `lanternfish` | ハダカイワシ（ハダカイワシ科） | 薄明の海・深海 | 群れの色を変えているだけ |
| `anglerfish` | チョウチンアンコウ（Himantolophus groenlandicus） | 深海 | Blender の自作 |

マンタ・ウミガメ・ジンベエザメ・クラゲ・サンゴなどは、この方法（真横の写真から魚の形を起こす）では作れないので、いまのまま。

## 用意するもの

- Fish Kit（ギャラリーの「キット一式」`fish-kit.zip`）を解凍したフォルダ
- Codex CLI（画像生成が使える ChatGPT の契約でログインしたもの）
- Claude Code（キットの `making/README.md` を読ませて動かしてもらう）
- Python 3（キットの `recover_refs.py` が使う）

キットのスクリプト（`making/scripts/fishgen/gen_refs.sh`）は **Windows 用**に書かれている（Codex の場所を
`%LOCALAPPDATA%` から探す）。Mac などでは、Claude Code に Codex の場所（`CODEX`）を合わせてもらう。

## 頼み方（お手元の Claude Code に）

> fish-kit/making/README.md と、eitango-quest の docs/ocean-fish-photos.md を読んで、
> docs に書いてある5種の写真を、手順1（`gen_refs.sh`）だけで作って。
> 1種できるたびに、ひれを広げた写真とひれを消した写真を見せて止まって。
> よいと言ったものは、docs の「できた写真の置き場所」のとおりに push して。

手順2以降（Blender で形を起こす・えらや口の形を Codex に聞く）は**しなくてよい**。
海では遠くを泳ぐだけで、口やえらぶたは動かさないため。

## `gen_refs.sh` に足す説明

`P[...]` の行を足し、`bash scripts/fishgen/gen_refs.sh butterflyfish damselfish wrasse lanternfish anglerfish` で作る。
体が黒い2種（ハダカイワシ・チョウチンアンコウ）は、キットの説明どおり背景を明るい灰色にする（背景と体が見分けられず、形に穴があくため）。

```bash
P[butterflyfish]="A single adult oriental butterflyfish, chouchouuo (Chaetodon auripes), about 18 cm, in perfect lateral side view facing LEFT. Deep, strongly laterally compressed disc-shaped body, short pointed snout with a small mouth. Natural colours: golden yellow to yellowish-brown body with many fine dark brown horizontal lines along the scale rows, a black vertical bar through the eye, yellow fins with a dark band near the rear edge of the soft dorsal and anal fins, truncate tail. $COMMON"
P[damselfish]="A single adult blue-green chromis, debasuzumedai (Chromis viridis), about 8 cm, in perfect lateral side view facing LEFT. Small oval, laterally compressed body, small mouth, large eye, long continuous dorsal fin, deeply forked tail with pointed lobes. Natural colours: iridescent pale apple-green to light blue-green body, slightly darker blue-green back, translucent bluish-green fins. $COMMON"
P[wrasse]="A single adult male humphead wrasse, megane-mochinouo / napoleon fish (Cheilinus undulatus), about 150 cm, in perfect lateral side view facing LEFT. Large heavy body with a prominent bulbous hump on the forehead, thick fleshy lips, long continuous dorsal fin, rounded tail. Natural colours: green to blue-green body with fine dark wavy lines on each scale, two short dark lines running back from the eye, fins edged with yellowish green. $COMMON"
P[lanternfish]="A single adult lanternfish, hadakaiwashi (family Myctophidae, Diaphus sp.), about 10 cm, in perfect lateral side view facing LEFT. Slender, laterally compressed body, blunt rounded head with a very large eye and a large mouth, small adipose fin, forked tail. Natural colours: dark brownish-black back, dark silvery-grey sides, rows of small round pearly bluish-white photophores (light organs) along the lower sides and belly. ${COMMON//dark charcoal-gray studio background (#2f2f30)/medium neutral gray studio background (#77777a, clearly lighter than the dark fish)}"
P[anglerfish]="A single adult female deep-sea anglerfish, chouchin-ankou (Himantolophus groenlandicus), about 40 cm, in perfect lateral side view facing LEFT. Globular, soft, rounded body, very large upward-facing mouth (closed, lips together) with small pointed teeth just visible, tiny eyes, a long fishing-rod-like spine (illicium) rising from the top of the head and ending in a bulb-shaped pale lure (esca) with short filaments, small pectoral fins, short dorsal and anal fins set far back, small rounded tail. Natural colours: velvety black to very dark brown skin, the lure pale cream. ${COMMON//dark charcoal-gray studio background (#2f2f30)/medium neutral gray studio background (#77777a, clearly lighter than the black fish)}"
```

## 写真を見るところ（キットの説明より）

- 本物らしい色と形か（学名どおりの魚か。色は言葉ではっきり書いてあるか）
- ひれが全部広がっていて、体から離れて見えるか
- 真横・口が左・口とえらぶたは閉じている・背景は無地（1672 × 941）
- ひれを消した写真（`_nofins`）は、構図・大きさ・背景の色がひれを広げた写真と同じか

## できた写真の置き場所

eitango-quest の **`fish-photos` ブランチ**（main とは別。写真が大きいので main には入れない）の
`fish-photos/` に、キットが作った名前のまま置いて push する。

```
fish-photos/butterflyfish.png
fish-photos/butterflyfish_nofins.png
fish-photos/damselfish.png
...
```

PNG は加工しない（縮小・JPEG にすると、背景と体の切り分けがずれる）。
push したら、クラウドのセッションに「写真を置いた」と伝える。そこから先（Blender で形を起こす・確かめる・
海と図鑑に組み込む）はこちらで行い、形ができたところで見せて確かめてもらう。
