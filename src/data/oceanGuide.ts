import type { GuideId } from "../ocean/guide";

/**
 * 海の図鑑の中身（書き下ろし）。一覧の索引（名前・出会う深さ）は src/ocean/guide.ts。
 * 図鑑の画面を開いたときにだけ読む（起動時の JS に入れない）。
 *
 * 辞書やコーパスから作ったものではないので、出典で正しさを担保できない。説明は図鑑や
 * 水族館の解説で広く言われていることだけにし、言い切れないことは「〜といわれる」と書く。
 * 形の面（例文に生き物の名前が入っている・一緒に覚える語が収録にある・不適切な語が無い）は
 * tests/oceanGuide.data.test.ts と tests/offensive.data.test.ts が見る。
 */
export interface GuideText {
  /** どんな生き物か（1〜2文） */
  about: string;
  /** 名前の英語についてのメモ（語の成り立ち・言い分け・慣用句） */
  memo: string;
  /** 例文 [英語, 和訳]。英語には生き物の名前を入れる */
  example: readonly [string, string];
  /** 一緒に覚えたい収録語（単語データの ID）。例文・説明に出てくる語から選ぶ */
  words: readonly string[];
}

export const OCEAN_GUIDE_TEXT: Record<GuideId, GuideText> = {
  seagrass: {
    about: "浅い海の砂地に生える、花を咲かせる草のなかま。アオウミガメやジュゴンが食べに来る。",
    memo: "sea（海）と grass（草）を合わせた語。海藻（seaweed）は藻のなかまで、海草（seagrass）は陸の草と同じく花を咲かせる。日本語でも「海藻」と「海草」で書き分ける。",
    example: ["Sea turtles come to the shallows to eat seagrass.", "ウミガメは海草を食べに浅瀬へやって来る。"],
    words: ["j81", "b1_seaweed", "j614"],
  },
  "sea-turtle": {
    about: "肺で息をするので、ときどき水面に上がって息つぎをする。アオウミガメは大人になると、おもに海草を食べる。",
    memo: "turtle は水にすむカメ。陸にすむカメは tortoise と呼び分けることが多い。甲羅は shell。",
    example: ["The sea turtle swam up to the surface to breathe.", "ウミガメは息をするために水面まで泳いで上がった。"],
    words: ["b1_turtle", "a2_shell", "s313", "s3-579"],
  },
  "eagle-ray": {
    about: "黒っぽい背に白い水玉もようのあるエイ。翼のような胸びれを羽ばたかせて、海の中を飛ぶように泳ぐ。とがった口先で砂の中の貝やカニを探し、かたい貝殻をかみ砕いて食べる。",
    memo: "eagle は「ワシ」。胸びれを広げて泳ぐ姿を、空を飛ぶワシに見立てた名前。spotted は「まだらの・斑点のある」（spot は「点・しみ」）。ray は「エイ」で、光線の ray とは由来の違う別の語。貝殻（shell）をかみ砕く（crush）ための、板のような歯をもつ。",
    example: ["A spotted eagle ray glided over the sand like a bird.", "マダラトビエイが、鳥のように砂地の上をすべっていった。"],
    words: ["b2_eagle", "b1_glide", "a2_shell", "b1_crush"],
  },
  anchovy: {
    about: "大きな群れを作って泳ぐ小さな魚。群れでいると、敵の大きな魚にねらわれにくい。しらすや煮干しの多くは、この魚から作られる。下あごが短く、口が片方しかないように見えることから「片口」の名が付いたといわれる。",
    memo: "イワシのなかまでも、マイワシは sardine、カタクチイワシは anchovy と呼び分ける。魚の群れは a school of fish と言う（学校の school とは由来の違う語）。鳥や羊の群れなら flock。",
    example: ["A huge school of anchovies swirled around the rock.", "カタクチイワシの大きな群れが、岩のまわりを渦を巻くように泳いだ。"],
    words: ["s2_384", "b1_flock", "b1_enemy"],
  },
  coral: {
    about: "イソギンチャクのなかまの小さな動物が、たくさん集まって暮らしている。体の中にすむ藻が光合成をするので、光の届く浅い海で育つ。",
    memo: "サンゴ礁は coral reef。reef は海面近くに盛り上がった岩やサンゴの「礁」。枝分かれするサンゴには、シカの角に見立てた staghorn coral という名前のものもある。",
    example: ["Coral grows best in clear, warm water with plenty of sunlight.", "サンゴは、澄んだ暖かい水とたっぷりの日の光のもとでよく育つ。"],
    words: ["b2_coral", "a126", "j426"],
  },
  "brain-coral": {
    about: "表面のうねった溝が脳のしわのように見える、丸いかたまりのサンゴ。ゆっくり大きくなり、何百年も生きるものもある。",
    memo: "brain は「脳」。名前のとおり、見た目を脳に見立てている。hundreds of years は「何百年も」で、for centuries（何世紀も）とも言う。",
    example: ["This brain coral has been growing for hundreds of years.", "このノウサンゴは何百年も育ち続けている。"],
    words: ["s123", "a2_hundred", "s579"],
  },
  butterflyfish: {
    about: "平たい体の、あざやかな黄色の魚。目を通る黒いしまで目の位置を分かりにくくし、敵を混乱させるといわれる。2匹でいることが多い。",
    memo: "butterfly（チョウ）＋ fish。fish と同じく、複数でもふつう形を変えない（two butterflyfish）。",
    example: ["Two butterflyfish swam side by side around the coral.", "2匹のチョウチョウウオが、サンゴのまわりを並んで泳いでいた。"],
    words: ["a1_butterfly", "b1_stripe", "s237"],
  },
  damselfish: {
    about: "サンゴ礁に群れる小さな魚。青緑色のデバスズメダイは、危険を感じると、いっせいに枝サンゴのすき間へ逃げこむ。",
    memo: "damselfish は damsel（おとめ・少女）＋ fish。damsel は古い語で、いまは物語の中でくらいしか使わない。",
    example: ["When the diver came closer, the damselfish hid in the coral.", "ダイバーが近づくと、スズメダイはサンゴの中に隠れた。"],
    words: ["s3-279", "a2_danger", "a126"],
  },
  "sea-fan": {
    about: "うちわのように平たく枝を広げる、サンゴのなかま。流れを横切る向きに広がり、流れてくる小さなえさを受け止める。",
    memo: "fan は「うちわ・扇」。和名のウミウチワ（海のうちわ）と同じ見立て。応援する人の fan は、fanatic（熱狂的な人）を縮めた別の語。",
    example: ["The sea fan spreads its branches like a net to catch food.", "ウミウチワは網のように枝を広げて、えさをとらえる。"],
    words: ["a1_fan", "s253", "a2_net"],
  },
  "humphead-wrasse": {
    about: "サンゴ礁でいちばん大きな魚のひとつで、2mほどになるものもいる。数が減っていて、守るために国際的な取り引きが制限されている。",
    memo: "hump は「こぶ」。大人の額（forehead）がこぶのようにふくらむことから。こぶを帽子に見立てて Napoleon wrasse とも呼ぶ。和名はメガネモチノウオ。",
    example: ["A humphead wrasse slowly passed in front of us.", "ナポレオンフィッシュが、私たちの前をゆっくり通り過ぎた。"],
    words: ["b1_forehead", "a2_pass", "s2_642"],
  },
  "whale-shark": {
    about: "世界でいちばん大きな魚。大きな口で海水ごとプランクトンや小魚を吸いこんで食べる。人を襲うことはなく、人には無害。",
    memo: "whale（クジラ）＋ shark（サメ）。クジラのように大きいサメという意味で、クジラではなくサメのなかま。",
    example: ["Despite its huge size, the whale shark is a gentle fish.", "とても大きいのに、ジンベエザメはおとなしい魚だ。"],
    words: ["b1_whale", "s2_384", "s2_526", "b2_harmless"],
  },
  jellyfish: {
    about: "体は透明で、ほとんどが水でできている。かさを縮めて水を押し出しながら進む。深い海には、自分で光を出すクラゲも多い。",
    memo: "jelly（ゼリー）＋ fish。fish と付くが魚ではない。複数でも jellyfish のままでよい。",
    example: ["Be careful not to touch a jellyfish. It might sting you.", "クラゲに触らないように気をつけて。刺されるかもしれないよ。"],
    words: ["a1_touch", "a1915", "b2_transparent"],
  },
  lanternfish: {
    about: "体に並んだ発光器で光る、小さな魚。昼は深い海の暗やみにいて、夜になると浅い所へ上がってくる。深い海でいちばん数の多い魚のなかまのひとつ。",
    memo: "lanternfish は lantern（手さげランプ・ちょうちん）＋ fish。体に並ぶ光る点を、明かりに見立てた名前。夜に上がって昼に下りる動きは vertical migration（鉛直移動）と呼ばれる。",
    example: ["At night, glowing lanternfish swim up toward the surface to feed.", "夜になると、光るハダカイワシが、えさを食べに水面の方へ上がってくる。"],
    words: ["b2_glow", "b1_darkness", "s2_385"],
  },
  "marine-snow": {
    about: "上の海から沈んでくる、生き物の死がいやふんなどの細かな粒。日の光の届かない深い海に暮らす生き物の、大切な食べ物になる。",
    memo: "marine は「海の」、snow は「雪」。海の中に降り続ける雪に見立てた名前。remains は「（生き物の）死がい・残り」。",
    example: ["Marine snow falls slowly into the deep sea.", "マリンスノーが、深い海へゆっくり降りていく。"],
    words: ["a551", "j68", "b2_remains"],
  },
  anglerfish: {
    about: "頭の上の突起の先を光らせ、寄ってきた獲物を大きな口で飲みこむ。光っているのは、突起の先にすむ細菌。",
    memo: "anglerfish は angler（釣り人）＋ fish（angle は「釣りをする」）。頭の突起を釣りざおのように使うことから。lure は「（釣りの）疑似餌」。",
    example: ["The anglerfish uses a glowing lure to attract its prey.", "チョウチンアンコウは、光るえさを使って獲物をおびき寄せる。"],
    words: ["s3-527", "a799", "s3-496"],
  },
};
