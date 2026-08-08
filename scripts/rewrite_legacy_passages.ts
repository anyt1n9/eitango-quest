/**
 * 既存の長文 p1〜p5 を書き直すスクリプト。
 *
 * これらは収録語を詰め込むことを優先した短い文章（63〜112語）で、
 * とくに p5 は104語に20語の対象語を含んでおり、物語や論説というより
 * 単語リストを文の形にしたものになっていた。
 * ID とレベル、扱う語彙のテーマは保ったまま、追加済みの10本と同じ水準
 * （物語として成立し、語の密度が自然な長さ）に書き換える。
 */
import fs from "fs";
import path from "path";

type P = {
  id: string;
  title: string;
  englishParagraphs: string[];
  japaneseParagraphs: string[];
  vocabularyHighlight: { word: string; translation: string }[];
  description: string;
  pointReward: number;
  questions: { question: string; options: string[]; correctIndex: number }[];
};

const REWRITTEN: P[] = [
  {
    id: "p1",
    title: "The Secret of the Old Library",
    englishParagraphs: [
      "The library in our town is old and beautiful. It has a brown roof, a heavy wooden door, and a garden with white flowers. My grandfather told me that his own grandfather used to read there, so the building is more than a hundred years old.",
      "Last April, our teacher gave us an important homework. Each student had to find one book that changed someone's life. Most of my classmates asked their parents. I did not want to do that, so I walked to the library after school on a warm Tuesday.",
      "The librarian was a small woman with grey hair. When I told her about the homework, she smiled and said, 'Come with me.' We went to the back of the second floor. There was a shelf that I had never noticed before. The books there were very old, and some of them had no titles.",
      "'These books were given to us by people in this town,' she said. 'When someone finishes a book that is important to them, they can write a short letter and leave it inside.' She opened one book and showed me a small piece of paper. The date on it was 1968.",
      "I read letters for two hours. A woman wrote that she decided to become a nurse. A man wrote that he stopped being angry with his brother. A high school student wrote that she was afraid of the future, but that the story gave her courage. Nobody wrote their family name.",
      "I chose a thin book about a boy who walks across a desert. Before I returned it, I wrote my own letter and left it between the last two pages. I did not write anything special. I only wrote, 'I did not know that a library could keep the feelings of a whole town.' Then I closed the book and put it back on the shelf for the next reader."
    ],
    japaneseParagraphs: [
      "私たちの町の図書館は古くて美しい建物です。茶色の屋根と重い木の扉があり、庭には白い花が咲いています。祖父の話では、祖父の祖父もそこで本を読んでいたそうなので、この建物は100年以上前のものです。",
      "去年の4月、先生が大切な宿題を出しました。生徒は一人ひとり、誰かの人生を変えた本を1冊見つけてくること、というものです。同級生のほとんどは親に尋ねました。私はそうしたくなかったので、暖かい火曜日の放課後、図書館まで歩いて行きました。",
      "司書は白髪の小柄な女性でした。宿題のことを話すと、彼女は微笑んで「いらっしゃい」と言いました。私たちは2階のいちばん奥へ行きました。そこには、それまで気づいたことのない書棚がありました。並んでいる本はとても古く、題名のないものもありました。",
      "「これらの本は、この町の人たちが寄贈してくれたものです」と彼女は言いました。「自分にとって大切な本を読み終えた人は、短い手紙を書いて中に挟んでいってよいことになっているのです。」彼女は1冊を開き、小さな紙を見せてくれました。そこに書かれた日付は1968年でした。",
      "私は2時間、手紙を読み続けました。ある女性は看護師になろうと決めたと書いていました。ある男性は、兄への怒りをやめたと書いていました。ある高校生は、将来が怖かったけれど、その物語が勇気をくれたと書いていました。誰も名字は書いていませんでした。",
      "私は、砂漠を歩いて渡る少年の薄い本を選びました。返す前に、自分の手紙を書いて最後の2ページの間に挟みました。特別なことは書きませんでした。ただ「図書館が町じゅうの気持ちを保管できるなんて知らなかった」とだけ書きました。それから本を閉じ、次に読む人のために書棚へ戻しました。"
    ],
    vocabularyHighlight: [
      { word: "beautiful", translation: "美しい、きれいな" },
      { word: "library", translation: "図書館" },
      { word: "important", translation: "重要な、大切な" },
      { word: "notice", translation: "気づく" },
      { word: "afraid", translation: "恐れて、怖がって" },
      { word: "courage", translation: "勇気" },
      { word: "desert", translation: "砂漠" },
      { word: "returned", translation: "返した、戻った" }
    ],
    description: "町の図書館に残された匿名の手紙をめぐる中学レベルの物語です。過去形と日常語彙を中心に、起承転結のある構成で書かれています。",
    pointReward: 90,
    questions: [
      {
        question: "先生が出した宿題はどんなものでしたか？",
        options: [
          "誰かの人生を変えた本を1冊見つけること",
          "図書館の歴史を調べること",
          "好きな作家について発表すること",
          "本の感想文を書くこと"
        ],
        correctIndex: 0
      },
      {
        question: "2階の奥の書棚にあった本の特徴はどれですか？",
        options: [
          "町の人が寄贈した古い本で、中に手紙が挟まれている",
          "図書館が最近購入した新しい本",
          "貸し出しが禁止されている貴重書",
          "外国語で書かれた辞書ばかり"
        ],
        correctIndex: 0
      },
      {
        question: "手紙を書いた人たちに共通していたことは何ですか？",
        options: [
          "名字を書いていなかった",
          "全員が同じ本について書いていた",
          "全員が同じ年に書いていた",
          "全員が学校の生徒だった"
        ],
        correctIndex: 0
      },
      {
        question: "語り手は自分の手紙に何と書きましたか？",
        options: [
          "図書館が町じゅうの気持ちを保管できるとは知らなかった",
          "この本をもっと多くの人に読んでほしい",
          "司書に感謝している",
          "宿題を早く終えられてよかった"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p2",
    title: "Exploring the Wonders of Nature",
    englishParagraphs: [
      "Every summer term, a group of students from our university travels to the mountains in the north to explore an old forest. The trip lasts ten days, and the purpose is not tourism. Each team records which plants and insects exist in a particular area, and the results are sent to a research institute in the city.",
      "I joined the trip for the first time three years ago, and I expected it to be relaxing. It was not. We walked for six hours a day with heavy bags, and it rained on four of the ten days. The senior students told me that this was a normal year.",
      "What surprised me most was how much the forest depended on things that nobody notices. Our leader, Professor Mori, showed us a single fallen tree covered in green moss. 'This tree died about twenty years ago,' she said. 'More species live on it now than lived in it when it was alive.'",
      "She explained that many small animals depend on dead wood for shelter, and that certain mushrooms cannot grow anywhere else. If a forest is cleaned too carefully, and every fallen tree is removed, those species disappear. The forest looks tidy, but it becomes poorer.",
      "In my second year, I began to notice the same pattern everywhere. A river depends on the shape of its stones. A field depends on the insects that most farmers consider a nuisance. Nothing in a natural system stands alone, and the parts that look useless are often the parts that hold everything together.",
      "I am now studying to become a researcher, and my project is about dead wood. When I explain it at parties, people usually laugh, and I understand why. But I have learned that important things are not always beautiful or exciting. Sometimes they are quietly lying on the ground, waiting for somebody to look at them properly."
    ],
    japaneseParagraphs: [
      "毎年、夏の学期になると、私たちの大学の学生の一団が北の山地へ行き、古い森を調査します。行程は10日間で、目的は観光ではありません。各班が、決められた区域にどんな植物や昆虫が生息しているかを記録し、その結果は市内の研究所へ送られます。",
      "私が初めて参加したのは3年前で、のんびりした旅になるだろうと思っていました。そうではありませんでした。私たちは重い荷物を背負って1日6時間歩き、10日のうち4日は雨でした。上級生たちは、これでも例年並みだと言いました。",
      "いちばん驚いたのは、森が、誰も気に留めないものにどれほど依存しているかということでした。引率の森教授は、緑の苔に覆われた1本の倒木を見せてくれました。「この木は20年ほど前に枯れました」と彼女は言いました。「生きていた頃よりも、いまのほうが多くの種がこの木で暮らしているのです。」",
      "多くの小さな動物は隠れ場所として枯れ木に依存しており、ある種のきのこは他の場所では育たない、と彼女は説明しました。森をあまりに丁寧に手入れして倒木をすべて取り除くと、そうした種は姿を消します。森は整って見えますが、その中身は貧しくなるのです。",
      "2年目になると、私は同じ型をあちこちで見つけるようになりました。川はその石の形に依存しています。畑は、多くの農家が厄介者と考える昆虫に依存しています。自然の仕組みの中で単独で成り立っているものは一つもなく、役に立たないように見える部分こそが、全体をつなぎとめていることが少なくありません。",
      "私はいま研究者を目指して勉強しており、研究の題目は枯れ木です。集まりの場でそう説明すると、たいてい笑われますし、その気持ちも分かります。けれども私は、大切なものが必ずしも美しかったり、心躍るものだったりするわけではないと学びました。ときにそれは静かに地面に横たわり、誰かがきちんと見てくれるのを待っているのです。"
    ],
    vocabularyHighlight: [
      { word: "explore", translation: "探検する、調査する" },
      { word: "term", translation: "学期、期間、用語" },
      { word: "exist", translation: "存在する" },
      { word: "depend", translation: "頼る、依存する" },
      { word: "species", translation: "種（しゅ）" },
      { word: "shelter", translation: "避難所、隠れ場所" },
      { word: "nuisance", translation: "厄介なもの、迷惑" },
      { word: "researcher", translation: "研究者" }
    ],
    description: "森林調査に参加した学生の語りを通して、生態系の相互依存を描く高校1年レベルの読解です。説明と省察を組み合わせた構成になっています。",
    pointReward: 120,
    questions: [
      {
        question: "この調査旅行の目的は何ですか？",
        options: [
          "区域内の植物や昆虫を記録し、研究所へ報告すること",
          "観光地としての可能性を調べること",
          "登山の技術を身につけること",
          "森林の面積を測量すること"
        ],
        correctIndex: 0
      },
      {
        question: "森教授が倒木について述べたことはどれですか？",
        options: [
          "生きていた頃より、いまのほうが多くの種が暮らしている",
          "早く取り除かなければ森全体が病気になる",
          "20年後には完全に土に還る",
          "観察に適さないので調査対象から外すべきだ"
        ],
        correctIndex: 0
      },
      {
        question: "森を「あまりに丁寧に手入れする」とどうなると説明されていますか？",
        options: [
          "見た目は整うが、種が姿を消して中身が貧しくなる",
          "新しい木がより早く育つ",
          "訪れる観光客が増える",
          "調査の記録がとりやすくなる"
        ],
        correctIndex: 0
      },
      {
        question: "語り手が2年目に気づいた「同じ型」とはどういうことですか？",
        options: [
          "自然の中では何も単独で成り立たず、役に立たなく見える部分が全体を支えている",
          "調査は毎年同じ手順で行われている",
          "山の天気は必ず数日で変わる",
          "学生は毎年同じ場所で記録している"
        ],
        correctIndex: 0
      },
      {
        question: "語り手の現在の研究題目は何ですか？",
        options: [
          "枯れ木",
          "山の気象",
          "きのこの栽培",
          "農業と昆虫の関係"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p3",
    title: "Understanding Our Cultural Evolution",
    englishParagraphs: [
      "In a small museum in northern Kyushu there is a case containing forty-two clay pots. They were made in the same village over a period of roughly six hundred years, and they are arranged in order of age. Visitors usually walk past the case in less than a minute, which is a pity, because it contains one of the clearest records of cultural evolution that anyone has assembled.",
      "The oldest pots are thick and heavy. Their patterns are simple lines pressed into the clay with a rope. The newest ones are thin, almost delicate, and decorated with curves that must have taken hours to complete. Between these two extremes there is no sudden jump. Each pot is slightly different from the one before it, and the change is so gradual that it is impossible to say where one style ends and the next begins.",
      "The curator, Mr. Nagai, argues that this is the point. 'People imagine that culture changes when someone has a brilliant idea,' he told me. 'Almost always it changes because a hundred people made small adjustments, and none of them thought they were doing anything historic.' A potter who slightly thinned the wall of a pot was not trying to begin a new period. She was probably trying to save clay.",
      "What made the collection possible was the involvement of an unusual number of people. Farmers who found broken pieces in their fields brought them to the museum instead of throwing them away. A retired teacher spent eleven years matching fragments. Without that effort, the sequence would have gaps, and a sequence with gaps proves very little.",
      "There is still room for doubt. Nobody knows for certain that all forty-two pots came from the same tradition, and the dates derive from a method that has a margin of error of several decades. Mr. Nagai is careful to say so on the label, which is unusual in a museum. 'A permanent display should not pretend to be more certain than the evidence,' he said. 'If we are wrong, I would rather visitors find out from us.'",
      "Standing in front of the case, it is difficult not to think about our own contemporary objects. The phone in your pocket looks nothing like the primitive devices of forty years ago, and yet no single year produced that difference. Somebody adjusted a corner, somebody removed a button, and the result, seen from a distance, looks like a revolution."
    ],
    japaneseParagraphs: [
      "九州北部の小さな博物館に、42個の土器を収めた展示ケースがあります。それらはおよそ600年にわたって同じ集落で作られたもので、古い順に並べられています。来館者はたいてい1分もかけずにこのケースの前を通り過ぎてしまいますが、それは惜しいことです。ここには、これまでに誰かがまとめた中でも最も明瞭な、文化の進化の記録が収められているからです。",
      "最も古い土器は厚く、重いものです。文様は、縄を粘土に押しつけた単純な線です。最も新しいものは薄く、ほとんど繊細と言ってよく、仕上げるのに何時間もかかったに違いない曲線で飾られています。この両極の間に、突然の飛躍はありません。どの土器も一つ前のものとわずかに違うだけで、その変化はあまりに緩やかなので、どこで一つの様式が終わり次が始まるのかを言うことはできません。",
      "学芸員の永井さんは、まさにそこが要点だと論じます。「人は、誰かが天才的な着想を得たときに文化が変わると思い込んでいます」と彼は私に語りました。「しかしほとんどの場合、変わるのは100人が小さな調整を重ねたからで、その誰一人として、自分が歴史的なことをしているとは考えていません。」土器の壁をわずかに薄くした職人は、新しい時代を始めようとしていたのではありません。おそらく粘土を節約しようとしていたのです。",
      "この収集を可能にしたのは、異例なほど多くの人の関与でした。畑で破片を見つけた農家が、捨てずに博物館へ持ち込みました。退職した教師が11年をかけて破片を突き合わせました。その労力がなければ、この連なりには欠落が生じていたでしょう。そして欠落のある連なりは、ほとんど何も証明しません。",
      "疑いの余地はまだあります。42個すべてが同じ伝統に由来すると確実に分かっているわけではありませんし、年代は数十年の誤差を持つ方法から導かれています。永井さんはそのことを解説板に明記していますが、博物館では珍しいことです。「常設の展示が、証拠以上に確からしいふりをしてはいけません」と彼は言いました。「もし私たちが間違っているなら、来館者には私たちの口から知ってほしいのです。」",
      "ケースの前に立つと、私たち自身の現代の品々について考えずにはいられません。あなたのポケットにある電話は、40年前の原始的な機器とは似ても似つきません。しかし、その差を生んだ年が1年だけあったわけではないのです。誰かが角を調整し、誰かがボタンを一つ取り去り、その結果が、遠くから見ると革命のように見えるのです。"
    ],
    vocabularyHighlight: [
      { word: "evolution", translation: "進化、発展" },
      { word: "gradual", translation: "徐々の、緩やかな" },
      { word: "curator", translation: "学芸員、館長" },
      { word: "adjustments", translation: "調整" },
      { word: "involvement", translation: "関与、参加" },
      { word: "fragments", translation: "破片、断片" },
      { word: "doubt", translation: "疑い、疑う" },
      { word: "derive", translation: "由来する、導き出す" },
      { word: "permanent", translation: "永続的な、常設の" },
      { word: "contemporary", translation: "現代の、同時代の" },
      { word: "primitive", translation: "原始的な、初期の" }
    ],
    description: "土器の連続的な変化を通して、文化がどのように変わるのかを考える高校2年レベルの読解です。説明と引用、譲歩を含む論述型の構成です。",
    pointReward: 160,
    questions: [
      {
        question: "42個の土器の並びから分かることは何ですか？",
        options: [
          "様式は突然変わるのではなく、少しずつ連続して変化した",
          "600年の間に3度の大きな飛躍があった",
          "古いものほど装飾が細かい",
          "すべて同じ職人が作った"
        ],
        correctIndex: 0
      },
      {
        question: "永井さんは文化が変わる仕組みをどう説明していますか？",
        options: [
          "天才の着想ではなく、多くの人の小さな調整の積み重ねによる",
          "外部からの移住者がもたらす",
          "権力者の命令によって決まる",
          "気候の変化が主な原因である"
        ],
        correctIndex: 0
      },
      {
        question: "土器の壁を薄くした職人の意図として本文が推測しているのはどれですか？",
        options: [
          "粘土を節約しようとしていた",
          "新しい時代を始めようとしていた",
          "権力者に献上しようとしていた",
          "運びやすくしようとしていた"
        ],
        correctIndex: 0
      },
      {
        question: "この収集を可能にしたものとして挙げられているのはどれですか？",
        options: [
          "破片を持ち込んだ農家と、11年かけて突き合わせた退職教師の関与",
          "国からの多額の補助金",
          "大学の考古学研究室による発掘",
          "海外の博物館との交換"
        ],
        correctIndex: 0
      },
      {
        question: "永井さんが解説板に不確かさを明記している理由はどれですか？",
        options: [
          "常設の展示が証拠以上に確からしいふりをすべきではないから",
          "来館者からの質問を減らすため",
          "研究者からの批判を避けるため",
          "年代測定をやり直す予定があるため"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p4",
    title: "The Silent Disaster and Rebuilding Hope",
    englishParagraphs: [
      "The storm arrived on a Thursday in September and left before dawn on Friday. It was not the strongest storm the coast had seen, and for that reason the damage it caused was not reported nationally for almost two weeks. The disaster was silent in the sense that mattered: nobody outside the region knew it had happened.",
      "What the wind and water destroyed was not dramatic. Three bridges were closed for inspection. A section of the regional railway was buried under mud. The two shipping companies that connected the islands to the mainland suspended their overnight services, and the small airline that carried medical staff cancelled every flight for eleven days. No building collapsed on television, so there was nothing to show.",
      "The consequences, however, were significant. Fishing families could not send their catch to market, and a catch that cannot be sent is not delayed income; it is spoiled protein. The town's only pharmacy ran out of two common medicines. A woman in the next valley went into labour and reached the hospital forty minutes later than she should have, which on that occasion caused no harm and might easily have caused a great deal.",
      "The trigger for change was a meeting held in an unheated community hall three weeks later. About sixty residents attended, most of them over sixty years old. The founder of a small logistics company that had gone out of business in the 1990s stood up and pointed out that the region had once maintained its own emergency provision of fuel, medicine, and boat parts, and that this store had been closed as a cost saving in 2003.",
      "Rebuilding it required a sacrifice that nobody enjoyed. Each participating household paid a small annual amount, and four people gave up weekends for two years to organize the inventory. There were failures. The first storage building leaked, and a batch of medicine had to be thrown away. Volunteers argued about who should hold the keys. Twice the whole project nearly stopped.",
      "It did not stop, and the reason is not inspiring in the way that news reports prefer. Nobody experienced a sudden delight in community spirit. People simply kept attending meetings that they found tedious, because the alternative was to rely on a transition back to normal conditions that might not arrive in time. Courage, in this instance, looked exactly like turning up on a cold Saturday morning.",
      "The store now holds enough supplies for eleven days. It has been used once, during a smaller storm in 2024, and it worked. The residents do not describe this as a triumph. They describe it as the minimum that they should have had all along."
    ],
    japaneseParagraphs: [
      "その嵐は9月の木曜日にやってきて、金曜の夜明け前に去りました。沿岸部が経験した中で最も強い嵐というわけではなく、それゆえ、もたらした被害が全国で報じられるまでには2週間近くかかりました。この災害は、重要な意味において静かなものでした。この地域の外にいる誰も、それが起きたことを知らなかったのです。",
      "風と水が壊したものは、劇的ではありませんでした。3本の橋が点検のため通行止めになりました。在来線の一区間が土砂に埋まりました。島と本土を結ぶ2社の海運会社は夜行便を休止し、医療従事者を運んでいた小さな航空会社は11日間すべての便を欠航にしました。テレビに映るような建物の倒壊はなく、見せる映像がなかったのです。",
      "しかし、その帰結は重大でした。漁業を営む家々は漁獲を市場へ送れませんでした。送れない漁獲は、収入が遅れることではありません。傷んだ蛋白質になるということです。町に一つしかない薬局は、よく使われる薬を2種類切らしました。隣の谷の女性が産気づき、本来より40分遅れて病院に着きました。そのときは何事もありませんでしたが、大事に至っていてもおかしくありませんでした。",
      "変化のきっかけは、3週間後に暖房のない公民館で開かれた集まりでした。住民およそ60人が参加し、その大半は60歳を超えていました。1990年代に廃業した小さな物流会社の創業者が立ち上がり、かつてこの地域は燃料・医薬品・船の部品を自前で備蓄していたこと、そしてその備蓄が2003年に経費削減で閉じられたことを指摘しました。",
      "それを再建するには、誰も楽しめない犠牲が必要でした。参加する各世帯が少額の年会費を払い、4人が2年間、週末を返上して在庫の管理を担いました。失敗もありました。最初の倉庫は雨漏りし、医薬品を一括で廃棄する羽目になりました。ボランティアは、誰が鍵を持つかで言い争いました。計画は二度、頓挫しかけました。",
      "それでも止まらなかったのですが、その理由は、報道が好むような感動的なものではありません。誰も、地域の絆に突然の喜びを覚えたわけではないのです。人々はただ、退屈だと感じる会合に通い続けました。そうしなければ、間に合うとは限らない「元の状態への移行」に頼るしかなかったからです。この場合の勇気は、寒い土曜の朝に姿を見せることと寸分違いませんでした。",
      "備蓄庫はいま、11日分の物資を保管しています。使われたのは一度、2024年のより小さな嵐のときで、きちんと機能しました。住民はこれを快挙とは呼びません。最初から持っているべきだった最低限のもの、と説明しています。"
    ],
    vocabularyHighlight: [
      { word: "disaster", translation: "災害、惨事" },
      { word: "suspended", translation: "停止した、保留した" },
      { word: "overnight", translation: "夜間の、一晩で" },
      { word: "significant", translation: "重要な、著しい" },
      { word: "trigger", translation: "きっかけ、引き金" },
      { word: "founder", translation: "創業者、設立者" },
      { word: "provision", translation: "備蓄、供給、条項" },
      { word: "sacrifice", translation: "犠牲、犠牲にする" },
      { word: "failures", translation: "失敗" },
      { word: "tedious", translation: "退屈な、うんざりする" },
      { word: "transition", translation: "移行、変化" },
      { word: "courage", translation: "勇気" },
      { word: "delight", translation: "喜び、楽しませる" }
    ],
    description: "報道されなかった災害からの地域再建を描く高校3年レベルの読解です。感傷を排した事実の積み重ねと、抽象度の高い語彙を扱います。",
    pointReward: 200,
    questions: [
      {
        question: "この災害が「静かな」ものだったと述べられているのはなぜですか？",
        options: [
          "地域の外にいる誰も、それが起きたことを知らなかったから",
          "風の音がほとんどしなかったから",
          "夜のうちに過ぎ去ったから",
          "住民が声を上げなかったから"
        ],
        correctIndex: 0
      },
      {
        question: "報道されにくかった理由として本文が挙げているのはどれですか？",
        options: [
          "テレビに映るような建物の倒壊がなかったから",
          "住民が取材を断ったから",
          "通信網が完全に途絶えたから",
          "被害額が算定できなかったから"
        ],
        correctIndex: 0
      },
      {
        question: "「送れない漁獲」について本文はどう述べていますか？",
        options: [
          "収入が遅れるのではなく、傷んだ蛋白質になるということ",
          "冷凍すれば翌週に出荷できるということ",
          "価格が上がるので損失は小さいということ",
          "地元で消費すれば問題ないということ"
        ],
        correctIndex: 0
      },
      {
        question: "備蓄が2003年に閉じられた理由は何でしたか？",
        options: [
          "経費削減",
          "物流会社の倒産",
          "国の制度変更",
          "倉庫の老朽化"
        ],
        correctIndex: 0
      },
      {
        question: "計画が続いた理由として本文が述べているのはどれですか？",
        options: [
          "元の状態への移行が間に合う保証がなく、退屈な会合に通い続けるしかなかったから",
          "地域の絆に突然の喜びを覚えたから",
          "自治体から手厚い補助が出たから",
          "報道されて注目が集まったから"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p5",
    title: "The Conspicuous Paradox of Modern Innovation",
    englishParagraphs: [
      "Few claims are as ubiquitous in contemporary business writing as the assertion that organizations must innovate or die. The phrase is repeated at conferences, printed on office walls, and included in annual reports with a confidence that discourages scrutiny. It is also, in the form usually stated, close to meaningless, because it supplies no criterion for distinguishing innovation from mere change.",
      "The ambiguity is not accidental. A company that has replaced a functioning system with a more expensive one can describe the exercise as innovation, and a company that has left a functioning system alone can be accused of stagnant thinking. Since both descriptions are available at all times, the vocabulary provides no information about which decision was correct. It provides only a way of praising or attacking a decision that has already been made.",
      "What makes this more than a semantic complaint is that the incentives are asymmetrical. A manager who introduces a costly and redundant platform is rarely blamed if it fails, because the attempt itself is treated as evidence of ambition. A manager who declines to introduce it, and who is right, receives no credit, since nothing observable happens. Over several years this asymmetry produces organizations full of half-finished projects and short of people willing to say that an existing process is adequate.",
      "The most lucrative technology companies are frequently cited as counterexamples, but their histories rarely support the moral drawn from them. Their decisive advantages usually came from a small number of durable choices, followed by long periods in which the main achievement was refusing to be distracted. That behaviour is not conspicuous, and it does not generate case studies, which is one reason it is imitated less often than it deserves.",
      "None of this amounts to an argument for standing still. Genuinely obsolete methods do impose real costs, and organizations that cannot abandon them become vulnerable in ways that are painful and slow. The prerequisite for useful change, however, is a comprehensive account of what the current arrangement actually achieves, including the parts that nobody has documented because they have never failed. Without that account, replacing a system is not a strategy; it is a bet placed with someone else's money.",
      "A more defensible standard would ask three questions before any large change is approved. What specific problem does the present arrangement fail to solve? What evidence, gathered how, would show that the replacement solves it? And what would have to be observed for us to conclude, two years from now, that this was a mistake? Organizations that answer these questions in writing tend to attempt fewer transformations and complete a higher proportion of them.",
      "This is a less exciting message than the one printed on the office wall, and it is unlikely to displace it. Slogans survive because they are resilient to evidence, not because they are supported by it. But the distinction between changing something and improving it is not difficult to draw, and an organization that draws it carefully will, over a sufficiently long period, be difficult to distinguish from one that is simply lucky."
    ],
    japaneseParagraphs: [
      "現代の経営書において、「組織は革新しなければ死ぬ」という主張ほど、いたるところで見かける言い分は多くありません。この言葉は会議で繰り返され、オフィスの壁に掲げられ、吟味を寄せつけないほどの自信とともに年次報告書に載ります。しかし通常語られる形でのこの主張は、ほとんど無意味に近いものです。革新と単なる変化を区別する基準を、何も与えていないからです。",
      "この曖昧さは偶然ではありません。機能していた仕組みをより高価なものに置き換えた企業は、その営みを革新と説明できます。そして機能していた仕組みをそのままにした企業は、停滞した思考だと非難されえます。どちらの説明も常に手に入る以上、この語彙は、どちらの判断が正しかったのかについて何の情報も与えません。与えるのは、すでに下された判断を称賛したり攻撃したりする手段だけです。",
      "これが単なる言葉づかいへの苦情にとどまらないのは、誘因が非対称だからです。高価で不必要な基盤を導入した管理職は、それが失敗してもめったに責められません。試みたこと自体が野心の証拠として扱われるからです。導入を見送り、しかもその判断が正しかった管理職は、何も評価されません。観測できる出来事が何も起きないからです。数年のうちに、この非対称は、中途半端な計画であふれ、既存の手順で十分だと言う人間が足りない組織を生み出します。",
      "最も収益性の高い技術企業がしばしば反例として引かれますが、その来歴が、そこから引き出される教訓を裏づけていることはまれです。彼らの決定的な優位は、たいてい少数の長持ちする選択から生まれ、そのあとには、主たる功績が「気を散らされることを拒んだ」ことである長い期間が続きます。そうした振る舞いは目立たず、事例研究にもなりません。それが、値するほどには真似されない理由の一つです。",
      "以上は、立ち止まっていろという主張ではありません。本当に時代遅れになった手法は現実の費用を課しますし、それを手放せない組織は、つらく、そして遅い形で脆くなります。しかし有用な変化の前提条件は、現在の仕組みが実際に何を達成しているのかについての包括的な説明です。そこには、一度も破綻したことがないために誰も文書化してこなかった部分も含まれます。その説明を欠いたまま仕組みを置き換えるのは、戦略ではありません。他人の金で行う賭けです。",
      "より擁護しやすい基準は、大きな変更を承認する前に三つの問いを立てることでしょう。現在の仕組みが解決できていない具体的な問題は何か。置き換えがそれを解決したと示す証拠は何であり、どのように集めるのか。そして、2年後にこれは誤りだったと結論するためには、何が観測されなければならないのか。これらを文書で答える組織は、試みる変革の数は減り、完遂する割合は高くなる傾向があります。",
      "これはオフィスの壁に掲げられた言葉より心躍らない主張であり、それに取って代わることはまずないでしょう。標語が生き延びるのは、証拠に裏づけられているからではなく、証拠に対して打たれ強いからです。しかし、何かを変えることと、それを良くすることの区別は、引くのが難しいものではありません。そしてその区別を丁寧に引く組織は、十分に長い期間で見れば、単に運が良いだけの組織と見分けがつかなくなるはずです。"
    ],
    vocabularyHighlight: [
      { word: "ubiquitous", translation: "どこにでもある、遍在する" },
      { word: "contemporary", translation: "現代の、同時代の" },
      { word: "scrutiny", translation: "綿密な調査、吟味" },
      { word: "criterion", translation: "基準、判断基準" },
      { word: "ambiguity", translation: "曖昧さ、両義性" },
      { word: "stagnant", translation: "停滞した、よどんだ" },
      { word: "redundant", translation: "余分な、冗長な" },
      { word: "lucrative", translation: "儲かる、利益の上がる" },
      { word: "durable", translation: "耐久性のある、長続きする" },
      { word: "conspicuous", translation: "顕著な、目立つ" },
      { word: "obsolete", translation: "時代遅れの、廃れた" },
      { word: "vulnerable", translation: "脆弱な、傷つきやすい" },
      { word: "prerequisite", translation: "前提条件、必要条件" },
      { word: "comprehensive", translation: "包括的な、総合的な" },
      { word: "defensible", translation: "擁護できる" },
      { word: "resilient", translation: "回復力のある、打たれ強い" }
    ],
    description: "「革新しなければ死ぬ」という標語を検討し、変化と改善の区別を論じる社会人・上級レベルの評論です。抽象名詞と譲歩構文を多用します。",
    pointReward: 260,
    questions: [
      {
        question: "筆者が「組織は革新しなければ死ぬ」という主張を批判する理由はどれですか？",
        options: [
          "革新と単なる変化を区別する基準を与えていないから",
          "統計的な裏づけが古いから",
          "経営者にしか当てはまらないから",
          "翻訳の過程で意味が変わったから"
        ],
        correctIndex: 0
      },
      {
        question: "本文が指摘する「誘因の非対称」とはどういうことですか？",
        options: [
          "導入して失敗しても責められにくいが、見送って正しくても評価されない",
          "管理職と現場で評価基準が違う",
          "大企業と中小企業で資金力に差がある",
          "国内と海外で規制が異なる"
        ],
        correctIndex: 0
      },
      {
        question: "収益性の高い技術企業の来歴について、筆者はどう述べていますか？",
        options: [
          "少数の長持ちする選択と、気を散らされることを拒んだ長い期間から成る",
          "毎年のように大きな変革を繰り返してきた",
          "運だけで成功したので参考にならない",
          "事例研究が豊富なので模倣しやすい"
        ],
        correctIndex: 0
      },
      {
        question: "筆者が挙げる「有用な変化の前提条件」はどれですか？",
        options: [
          "現在の仕組みが実際に何を達成しているかの包括的な説明",
          "経営陣の全会一致の合意",
          "十分な予算の確保",
          "競合他社の動向調査"
        ],
        correctIndex: 0
      },
      {
        question: "大きな変更の前に立てるべき三つの問いに含まれないものはどれですか？",
        options: [
          "競合他社が同じ変更を行っているか",
          "現在の仕組みが解決できていない具体的な問題は何か",
          "置き換えが解決したと示す証拠は何か",
          "2年後に誤りだったと結論するには何が観測されるべきか"
        ],
        correctIndex: 0
      }
    ]
  }

];

function main() {
  const file = path.join(process.cwd(), "src/data/passages.ts");
  const lines = fs.readFileSync(file, "utf8").split("\n");

  // 要素の開始行（"  {"）の位置を集める
  const starts: number[] = [];
  lines.forEach((l, i) => { if (l === "  {") starts.push(i); });
  const endOfArray = lines.findIndex(l => l === "];");

  const rangeOf = (id: string): [number, number] => {
    const idLine = lines.findIndex(l => l.trim() === `id: "${id}",`);
    if (idLine < 0) throw new Error("見つかりません: " + id);
    const s = [...starts].reverse().find(i => i < idLine)!;
    const next = starts.find(i => i > idLine);
    return [s, next !== undefined ? next : endOfArray];
  };

  const render = (p: P, level: string) => {
    const j = (v: unknown) => JSON.stringify(v, null, 6).split("\n").join("\n    ");
    return [
      "  {",
      `    id: ${JSON.stringify(p.id)},`,
      `    level: ${JSON.stringify(level)},`,
      `    title: ${JSON.stringify(p.title)},`,
      `    englishParagraphs: ${j(p.englishParagraphs)},`,
      `    japaneseParagraphs: ${j(p.japaneseParagraphs)},`,
      `    vocabularyHighlight: ${j(p.vocabularyHighlight)},`,
      `    description: ${JSON.stringify(p.description)},`,
      `    pointReward: ${p.pointReward},`,
      `    questions: ${j(p.questions)}`,
      "  },"
    ];
  };

  // 後ろから置換して行番号のずれを避ける
  const jobs = REWRITTEN.map(p => ({ p, range: rangeOf(p.id) }))
    .sort((a, b) => b.range[0] - a.range[0]);
  let out = lines;
  for (const { p, range } of jobs) {
    const level = out.slice(range[0], range[1]).find(l => l.includes("level:"))!.match(/level: "(\w+)"/)![1];
    out = [...out.slice(0, range[0]), ...render(p, level), ...out.slice(range[1])];
  }
  fs.writeFileSync(file, out.join("\n"));
  console.log(`${REWRITTEN.length}本を書き直しました: ${REWRITTEN.map(p => p.id).join(", ")}`);
}

main();
