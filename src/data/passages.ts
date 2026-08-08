export interface PassageQuestion {
  question: string; // 内容理解を問う設問（日本語）
  options: string[]; // 4択の選択肢（日本語）
  correctIndex: number; // 正解選択肢のインデックス (0-3)
}

export interface Passage {
  id: string;
  level: "junior" | "senior" | "senior2" | "senior3" | "advanced";
  title: string;
  englishParagraphs: string[];
  japaneseParagraphs: string[];
  vocabularyHighlight: { word: string; translation: string }[];
  description: string;
  pointReward: number;
  questions?: PassageQuestion[]; // 理解度チェック設問
}

export const passages: Passage[] = [
  {
    id: "p1",
    level: "junior",
    title: "The Beautiful Secret of the Old Library",
    englishParagraphs: [
      "There is a beautiful and quiet library in my town. Many children like to study there after school. Yesterday, I went to the library to read important books about flowers and water.",
      "I found an important book. The book was very old, but beautiful. It said, 'Reading is important for your dreams and future. Water is important for flowers, and books are important for the mind.' That was a simple and important secret."
    ],
    japaneseParagraphs: [
      "私の町には、美しく静かな図書館があります。多くの子供たちが放課後、そこで勉強するのが好きです。昨日、私は花と水に関する大切な本を読むために図書館へ行きました。",
      "私は一冊の重要な本を見つけました。その本はとても古かったのですが、美しかったです。そこにはこう書かれていました。『読書はあなたの夢と将来にとって重要です。水が花にとって重要であるように、本は心にとって重要なのです。』それはシンプルで、大切な秘密でした。"
    ],
    vocabularyHighlight: [
      { word: "beautiful", translation: "美しい、きれいな" },
      { word: "library", translation: "図書館" },
      { word: "important", translation: "重要な、大切な" }
    ],
    description: "中学レベルの重要語彙（beautiful, library, important）を含む心温まる短いお話です。",
    pointReward: 50,
    questions: [
      {
        question: "語り手はなぜ図書館へ行きましたか？",
        options: [
          "花と水に関する大切な本を読むため",
          "友達と一緒に宿題をするため",
          "静かな場所で昼寝をするため",
          "新しい本を借りて家に帰るため"
        ],
        correctIndex: 0
      },
      {
        question: "古い本に書かれていた内容として正しいものはどれですか？",
        options: [
          "読書は夢と将来にとって重要である",
          "図書館は放課後すぐに閉まってしまう",
          "水よりも本の方がずっと大切である",
          "子供はもっと外で遊ぶべきである"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p2",
    level: "senior",
    title: "Exploring the Wonders of Nature",
    englishParagraphs: [
      "Some people love to explore the tall mountains during the summer term. We know that many interesting and unique wild animals exist there. They are active and live near clean rivers.",
      "The local leaders want to preserve the beautiful nature. Exploring the forest guides us to understand our environment deeply. Since human lives depend on nature, caring for it is our top duty."
    ],
    japaneseParagraphs: [
      "夏期の期間中、高い山々を探索することを好む人々がいます。そこには多くの興味深くユニークな野生動物が存在していることを私たちは知っています。彼らは活動的で、きれいな川の近くに住んでいます。",
      "地域のリーダーたちは美しい自然を保護したいと考えています。森を探索することは、私たちの環境を深く理解するための手引きとなります。人間の生活は自然に依存しているため、自然を思いやることは私たちの最優先の義務です。"
    ],
    vocabularyHighlight: [
      { word: "explore", translation: "探索する、調査する" },
      { word: "term", translation: "期間、専門用語" },
      { word: "exist", translation: "存在する、実在する" },
      { word: "depend", translation: "依存する" }
    ],
    description: "高校1年生レベルの重要語（explore, term, exist, depend）を使用した、自然探検に関するエッセイです。",
    pointReward: 60,
    questions: [
      {
        question: "地域のリーダーたちが望んでいることは何ですか？",
        options: [
          "美しい自然を保護すること",
          "山に新しい道路を建設すること",
          "観光客をもっと増やすこと",
          "野生動物を捕まえて保護施設に移すこと"
        ],
        correctIndex: 0
      },
      {
        question: "本文によると、私たちが自然を大切にすべき理由は何ですか？",
        options: [
          "人間の生活が自然に依存しているから",
          "法律で厳しく定められているから",
          "野生動物の数が急激に減っているから",
          "森の探検が流行しているから"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p3",
    level: "senior2",
    title: "Understanding Our Cultural Evolution",
    englishParagraphs: [
      "History shows that cultural evolution is a permanent process of change. The transition from primitive styles to contemporary society required the long term involvement of many people. We must solve various problems and doubt traditional answers to discover new facts.",
      "We often need to adjust ourselves to this rapid progress. Working together to build a solid agreement is a key factor for our stable future. Through such efforts, we derive new wisdom and values."
    ],
    japaneseParagraphs: [
      "文化の進化とは、変化の永続的なプロセスであることを歴史が示しています。原始的な様式から現代社会への遷移には、多くの人々の長期的な関与が必要でした。私たちは新しい事実を発見するために、様々な問題を解決し、伝統的な答えに疑いを持つ必要があります。",
      "私たちはしばしば、この急速な進歩に自分自身を調節（適応）させる必要があります。しっかりとした合意を築くために協力することは、私たちの安定した未来のための重要な要因です。そのような努力を通じて、私たちは新しい知恵と価値観を引き出す（得る）のです。"
    ],
    vocabularyHighlight: [
      { word: "evolution", translation: "進化、発展" },
      { word: "involvement", translation: "関与、関わり合い" },
      { word: "doubt", translation: "疑い、疑問" },
      { word: "derive", translation: "を引き出す" },
      { word: "permanent", translation: "永久の" },
      { word: "adjust", translation: "を調節する、適合させる" },
      { word: "contemporary", translation: "現在の，現代の" },
      { word: "primitive", translation: "原始的な" }
    ],
    description: "高校2年生レベルの語（evolution, involvement, doubt, derive, permanent, adjust）をふんだんに使った、人類の文化と社会の進歩に関するやや高度な読み物です。",
    pointReward: 70,
    questions: [
      {
        question: "本文では「文化の進化」はどのようなものだと述べられていますか？",
        options: [
          "変化の永続的なプロセスである",
          "一度で完了する歴史的な出来事である",
          "原始的な様式へ回帰する動きである",
          "少数の天才によってのみ起こる発明である"
        ],
        correctIndex: 0
      },
      {
        question: "安定した未来のための重要な要因として挙げられているものはどれですか？",
        options: [
          "協力してしっかりとした合意を築くこと",
          "伝統的な答えを疑わずに守り続けること",
          "急速な進歩をあえて止めること",
          "各自がばらばらに行動すること"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p4",
    level: "senior3",
    title: "The Silent Disaster and Rebuilding Hope",
    englishParagraphs: [
      "The violent storm was a sudden disaster that became a trigger for a significant transition in our neighborhood. The regional airline and several shipping organizations stopped overnight operations due to severe damage. There was great fear, but the prompt provision of clean water and warm food brought comfort to the suffering families.",
      "The brave founder of the local estate decided to make a massive sacrifice of his personal assets to support the radical rebuild attempt. People showed great courage to clear blockages and restore electrical systems.",
      "Today, the community is highly resilient and united. It is an absolute delight to see how they overcame a temporary failure and created a sustainable partnership."
    ],
    japaneseParagraphs: [
      "激しい嵐は、私たちの地域に重大な遷移（変革）をもたらす引き金（きっかけ）となった、突然の災害でした。地域の航空会社やいくつかの海運機関は、深刻な被害のために一晩中かかる運行業務を停止しました。大きな恐怖がありましたが、きれいな水と温かい食事の素早い供給は、苦しんでいる家族に快適さ（慰め）をもたらしました。",
      "地元の不動産（財産）の勇敢な創設者は、急進的な（抜本的な）再建の試みを支援するために、自身の個人資産という多大な犠牲を払うことを決定しました。人々は障害物を取り除き、電気系統を復旧するために大きな勇気を示しました。",
      "今日、地域社会は非常に回復力があり、団結しています。彼らが一時的な失敗を克服し、持続可能なパートナーシップを築き上げた様子を見るのは、この上ない喜びです。"
    ],
    vocabularyHighlight: [
      { word: "significant", translation: "重要な" },
      { word: "sacrifice", translation: "犠牲" },
      { word: "trigger", translation: "引き金" },
      { word: "delight", translation: "喜び，歓喜" },
      { word: "disaster", translation: "災害，災難" },
      { word: "overnight", translation: "一晩中，夜通しで" },
      { word: "transition", translation: "遷移，変遷" },
      { word: "provision", translation: "供給，支給" },
      { word: "courage", translation: "勇気" },
      { word: "failure", translation: "失敗" },
      { word: "assets", translation: "資産" },
      { word: "founder", translation: "創設者" }
    ],
    description: "新規追加された高校3年生レベルの語句（significant, sacrifice, trigger, disaster, overnight, transition, provision, asset, founder, courage）を厳選することなくストーリーに昇華し、地域社会の再建を描いた躍動的な長文です。",
    pointReward: 80,
    questions: [
      {
        question: "嵐のあと、苦しむ家族に慰め（快適さ）をもたらしたものは何ですか？",
        options: [
          "きれいな水と温かい食事の素早い供給",
          "航空会社による運行の即時再開",
          "新しい住宅の無償提供",
          "政府からの多額の見舞金"
        ],
        correctIndex: 0
      },
      {
        question: "地元の不動産の創設者がしたこととして正しいものはどれですか？",
        options: [
          "再建の試みを支援するため個人資産を犠牲にした",
          "危険を避けて早々に町を離れた",
          "災害対応の新しい会社を設立した",
          "電気系統をたった一人で修理した"
        ],
        correctIndex: 0
      },
      {
        question: "現在の地域社会の様子として本文の内容に合うものはどれですか？",
        options: [
          "回復力があり、団結している",
          "今も停電が続き困窮している",
          "人口が大きく減ってしまった",
          "再建をあきらめて移転を決めた"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p5",
    level: "advanced",
    title: "The Conspicuous Paradox of Modern Innovation",
    englishParagraphs: [
      "In our contemporary discourse, the ubiquitous usage of technology has created an unprecedented level of ambiguity in human relationships. While some lucrative digital platforms seem highly resilient, closer scrutiny reveals that they are highly vulnerable to stagnant user engagement. This represents a conspicuous paradox in our society.",
      "To transcend these superficial benchmarks and avoid detrimental outcomes, leaders should design a comprehensive paradigm focused on long-term sustainability. True innovation is a prerequisite that requires collaborative synergy, rather than arbitrary, redundant, or obsolete features.",
      "By establishing a clear methodology, we can facilitate a powerful turnaround and unlock mutual benefits for both businesses and the global community."
    ],
    japaneseParagraphs: [
      "私たちの現代の論説において、テクノロジーの至るところにある（遍在する）使用は、対人関係において前例のないレベルの曖昧さを生み出しています。いくつかの儲かるデジタルプラットフォームは非常に回復力（弾力性）があるように見えますが、より綿密な吟味を行うと、ユーザー関与の停滞（停滞した関与）に対して非常に脆弱であることが明らかになります。これは、私たちの社会における顕著な矛盾を表しています。",
      "これらのうわべだけの（浅薄な）基準を超越（超越）し、有害な結果を避けるために、リーダーたちは長期的な持続可能性に焦点を当てた包括的な模範（パラダイム）を設計すべきです。真の革新は、恣意的で、不必要（余分）で、時代遅れとなった機能ではなく、協調的な相乗効果（シナジー）を必要とする必須の前提条件です。",
      "明確な方法論を確立することによって、私たちは強力な方向転換（好転）を円滑にし、企業とグローバルな地域社会の両方に相互の利益をもたらすことができます。"
    ],
    vocabularyHighlight: [
      { word: "conspicuous", translation: "顕著な、目立つ" },
      { word: "ubiquitous", translation: "どこにでもある、遍在する" },
      { word: "ambiguity", translation: "曖昧さ、両義性" },
      { word: "scrutiny", translation: "綿密な調査、吟味" },
      { word: "lucrative", translation: "儲かる、利益の上がる" },
      { word: "resilient", translation: "回復力のある、弾力的な" },
      { word: "vulnerable", translation: "脆弱な、傷つきやすい" },
      { word: "comprehensive", translation: "総合的な、包括的な" },
      { word: "unprecedented", translation: "前例のない" },
      { word: "stagnant", translation: "停滞した、淀んだ" },
      { word: "detrimental", translation: "有害な、損失となる" },
      { word: "sustainability", translation: "持続可能性" },
      { word: "synergy", translation: "相乗効果" },
      { word: "paradigm", translation: "模範、パラダイム" },
      { word: "turnaround", translation: "好転、方向転換" },
      { word: "transcend", translation: "超越する、卓越する" },
      { word: "arbitrary", translation: "恣意的な、任意の" },
      { word: "redundant", translation: "余分な、不必要な" },
      { word: "obsolete", translation: "時代遅れの、廃れた" },
      { word: "prerequisite", translation: "必須条件、前提条件" }
    ],
    description: "最難関レベル（conspicuous, ubiquitous, ambiguity, lucrative, resilient, vulnerable, paradigm, synergy, prerequisite）を多数使用し、現代のデジタル社会のあり方に深く切り込んだオピニオン長文エッセイです。",
    pointReward: 100,
    questions: [
      {
        question: "本文が指摘する「顕著な矛盾（パラドックス）」とは何ですか？",
        options: [
          "儲かるデジタルプラットフォームが、停滞したユーザー関与に対して脆弱であること",
          "テクノロジーが人間関係を完全に破壊してしまったこと",
          "現代社会では革新がまったく起きていないこと",
          "企業がテクノロジーから利益を得られないこと"
        ],
        correctIndex: 0
      },
      {
        question: "真の革新に必要だと述べられているものはどれですか？",
        options: [
          "協調的な相乗効果（シナジー）",
          "恣意的で余分な機能の追加",
          "時代遅れの手法の復活",
          "うわべだけの基準の遵守"
        ],
        correctIndex: 0
      },
      {
        question: "リーダーたちが設計すべきだとされているものは何ですか？",
        options: [
          "長期的な持続可能性に焦点を当てた包括的なパラダイム",
          "短期的な利益を最大化する販売戦略",
          "より大規模な広告キャンペーン",
          "従来型の厳格な階層組織"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p6",
    level: "junior",
    title: "The Notebook by the River",
    englishParagraphs: [
      "Every Tuesday after school, Hana walked home along the river. She liked the sound of the water and the smell of the grass. On that Tuesday in June, the weather was warm, and she was thinking about her math homework. She did not notice the small blue notebook on the bench until she almost stepped on it.",
      "Hana picked it up. The cover was wet, and the pages were full of drawings. There were birds, bridges, and a large picture of the river at sunset. On the last page, someone had written, 'I want to become an artist, but my father says it is not a real job.' There was no name and no telephone number.",
      "Hana wanted to find the owner. The next morning, she showed the notebook to her teacher, Mr. Sato. He looked at the drawings carefully. 'These are very good,' he said quietly. 'I think a student in this school made them.' He put a short message on the board in the hallway: 'Found by the river. Ask Hana in class 2-B.'",
      "For three days, nobody came. Hana began to feel sad about the notebook. Then, on Friday afternoon, a tall boy from another class stopped her near the library. His face was red, and he did not look at her eyes. 'That notebook is mine,' he said. 'I left it there because I was angry.'",
      "Hana gave it back to him. 'Your pictures are beautiful,' she said. 'My teacher said so, too.' The boy was quiet for a moment. Then he smiled a little and said, 'Thank you. Maybe I will draw the river again this weekend.' Hana watched him walk away with the notebook under his arm, and she felt happy about her long walk home."
    ],
    japaneseParagraphs: [
      "毎週火曜日の放課後、ハナは川沿いを歩いて家へ帰っていました。彼女は水の音と草のにおいが好きでした。その6月の火曜日、天気は暖かく、彼女は算数の宿題のことを考えていました。ベンチの上の小さな青いノートに、ほとんど踏みそうになるまで気づきませんでした。",
      "ハナはそれを拾い上げました。表紙は濡れていて、ページは絵でいっぱいでした。鳥や橋、そして夕暮れの川の大きな絵がありました。最後のページには、こう書かれていました。「僕は画家になりたい。でも父は、それは本当の仕事ではないと言う。」名前も電話番号もありませんでした。",
      "ハナは持ち主を見つけたいと思いました。翌朝、彼女は担任の佐藤先生にノートを見せました。先生は絵を注意深く見ました。「これはとても上手だね」と先生は静かに言いました。「この学校の生徒が描いたのだと思う。」先生は廊下の掲示板に短い伝言を貼りました。「川で拾いました。2年B組のハナまで。」",
      "3日間、誰も来ませんでした。ハナはそのノートのことで悲しくなり始めました。すると金曜日の午後、別のクラスの背の高い男子が図書館の近くで彼女を呼び止めました。彼の顔は赤く、彼女の目を見ようとしませんでした。「そのノートは僕のです」と彼は言いました。「腹が立ったから、あそこに置いてきたんです。」",
      "ハナはそれを彼に返しました。「あなたの絵、きれいですね」と彼女は言いました。「先生もそう言っていました。」男子はしばらく黙っていました。それから少し笑って言いました。「ありがとう。今週末、また川を描いてみようかな。」ハナは、彼がノートを脇に抱えて歩いていくのを見送り、長い帰り道を歩いてよかったと感じました。"
    ],
    vocabularyHighlight: [
      { word: "weather", translation: "天気、天候" },
      { word: "notice", translation: "気づく" },
      { word: "cover", translation: "表紙、覆い" },
      { word: "carefully", translation: "注意深く、慎重に" },
      { word: "hallway", translation: "廊下" },
      { word: "quietly", translation: "静かに" },
      { word: "beautiful", translation: "美しい、きれいな" },
      { word: "angry", translation: "怒った" }
    ],
    description: "川で拾ったノートをきっかけに、絵を描く少年と主人公が出会う中学レベルの短編小説です。過去形と日常語彙を中心に構成されています。",
    pointReward: 90,
    questions: [
      {
        question: "ハナはノートをどこで見つけましたか？",
        options: [
          "川沿いのベンチの上",
          "図書館の机の上",
          "教室のロッカーの中",
          "学校の廊下の床"
        ],
        correctIndex: 0
      },
      {
        question: "ノートの最後のページに書かれていたのはどんな内容でしたか？",
        options: [
          "画家になりたいが、父に反対されているという悩み",
          "友達とけんかしてしまったという後悔",
          "転校することが決まったという知らせ",
          "テストの点数が悪かったという記録"
        ],
        correctIndex: 0
      },
      {
        question: "男子がノートを川に置いていった理由は何でしたか？",
        options: [
          "腹を立てていたから",
          "重くて持ち歩きたくなかったから",
          "誰かに見つけてほしかったから",
          "新しいノートを買ったから"
        ],
        correctIndex: 0
      },
      {
        question: "物語の最後で、男子はどうしましたか？",
        options: [
          "少し笑って、また川を描こうと言った",
          "ノートを受け取らずに立ち去った",
          "ハナに絵を一枚あげた",
          "先生に会いに行った"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p7",
    level: "junior",
    title: "The Concert in the Rain",
    englishParagraphs: [
      "The school festival was on the first Saturday of October. The brass band practiced every morning for two months. Kenta played the trumpet, and he was nervous because this was his first concert. His sister promised to come and listen, and his grandmother said she would take the bus from the next town.",
      "On Saturday morning, the sky was dark. At nine o'clock, it started to rain. The students looked at the stage in the school garden. The chairs were wet, and water was running down the steps. Their teacher said, 'I am sorry. We cannot use this stage today. It is too dangerous.'",
      "Kenta felt terrible. Many students went back to their classrooms without a word. Then Aya, the leader of the band, had an idea. 'The gym is empty,' she said. 'We can move everything there. If we work together, we can finish before lunch.'",
      "Everyone carried chairs, music stands, and heavy instruments through the rain. Some teachers helped them. Kenta's shoes were full of water, but he did not stop. By half past eleven, the gym was ready. It did not look like a beautiful concert hall, but it was warm and dry.",
      "The concert began at one o'clock. The gym was full of families, and Kenta saw his grandmother in the third row. When the band played the last song, everyone stood up and clapped for a long time. Later, his grandmother said, 'The rain made today special. I will remember this concert for many years.' Kenta thought she was right."
    ],
    japaneseParagraphs: [
      "学校祭は10月の第1土曜日でした。吹奏楽部は2か月間、毎朝練習しました。ケンタはトランペットを吹いていて、これが初めての演奏会だったので緊張していました。姉は聴きに来ると約束し、祖母は隣町からバスで来ると言っていました。",
      "土曜日の朝、空は暗くなっていました。9時に、雨が降り始めました。生徒たちは校庭のステージを見ました。椅子は濡れ、階段には水が流れていました。先生が言いました。「残念だけど、今日はこのステージは使えません。危険すぎます。」",
      "ケンタはひどい気持ちになりました。多くの生徒が何も言わずに教室へ戻っていきました。そのとき、部長のアヤが思いつきました。「体育館が空いています」と彼女は言いました。「全部そこへ移せます。みんなで力を合わせれば、昼までに終わります。」",
      "全員が椅子、譜面台、重い楽器を雨の中で運びました。何人かの先生も手伝ってくれました。ケンタの靴は水でいっぱいでしたが、彼は手を止めませんでした。11時半には、体育館の準備が整いました。美しいコンサートホールには見えませんでしたが、暖かくて乾いていました。",
      "演奏会は1時に始まりました。体育館は家族でいっぱいで、ケンタは3列目に祖母を見つけました。楽団が最後の曲を演奏すると、全員が立ち上がり、長い間拍手をしました。あとで祖母は言いました。「雨が今日を特別なものにしたね。この演奏会は何年も忘れないよ。」ケンタも、その通りだと思いました。"
    ],
    vocabularyHighlight: [
      { word: "festival", translation: "祭り、祝祭" },
      { word: "practiced", translation: "練習した" },
      { word: "nervous", translation: "緊張して、不安な" },
      { word: "promised", translation: "約束した" },
      { word: "dangerous", translation: "危険な" },
      { word: "empty", translation: "空の、誰もいない" },
      { word: "instruments", translation: "楽器、器具" },
      { word: "special", translation: "特別な" }
    ],
    description: "雨で中止になりかけた学校の演奏会を、生徒たちが力を合わせて成功させる中学レベルの物語です。",
    pointReward: 90,
    questions: [
      {
        question: "演奏会の朝、何が問題になりましたか？",
        options: [
          "雨で校庭のステージが使えなくなった",
          "楽器が壊れてしまった",
          "先生が来られなくなった",
          "生徒の多くが風邪をひいた"
        ],
        correctIndex: 0
      },
      {
        question: "アヤはどんな提案をしましたか？",
        options: [
          "空いている体育館へ全部移すこと",
          "演奏会を翌週に延期すること",
          "傘をさして予定通り行うこと",
          "曲数を減らして短く終えること"
        ],
        correctIndex: 0
      },
      {
        question: "体育館の準備が終わったのは何時ごろでしたか？",
        options: [
          "11時半ごろ",
          "9時ごろ",
          "1時ごろ",
          "3時ごろ"
        ],
        correctIndex: 0
      },
      {
        question: "祖母は演奏会についてどう言いましたか？",
        options: [
          "雨が今日を特別なものにした",
          "来年はもっと広い会場がよい",
          "もっと練習が必要だ",
          "バスが遅れて残念だった"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p8",
    level: "senior",
    title: "The Bakery on the Corner",
    englishParagraphs: [
      "For forty years, Mr. Oda had opened his bakery at five in the morning. The shop stood on the corner of a narrow street, and the smell of bread reached the station two blocks away. However, in recent years, fewer people came. A large supermarket had opened near the station, and it sold bread at half the price.",
      "Yuki started working at the bakery during her second year of high school. At first, she only washed trays and swept the floor. Mr. Oda rarely spoke, and she thought he was unfriendly. But one morning he stopped her and said, 'Watch the dough. It tells you when it is ready. You cannot decide that by looking at a clock.'",
      "After that, he began to teach her. She learned that temperature, water, and time were all connected, and that patience mattered more than strength. She also learned that Mr. Oda remembered the names of almost every customer, and that he kept a small notebook of who liked which bread.",
      "In February, Mr. Oda fell on the ice and broke his wrist. The doctor told him not to work for six weeks. Without him, the shop would have to close, and Yuki knew that a closed shop rarely opens again. That evening, she called four of her classmates.",
      "The next morning, five students arrived at five o'clock. They were slow, and the first batch of bread was too dark. Customers noticed, but nobody complained. Instead, they told their neighbors, and by the end of the week the line reached the street corner. When Mr. Oda returned in March, he found his shop busier than it had been in years.",
      "He said very little, as usual. But he took out his notebook, wrote something on a new page, and turned it toward Yuki. It said, 'Yuki: likes the bread she made herself.' She laughed, and then she cried a little, and then she went back to work."
    ],
    japaneseParagraphs: [
      "40年間、小田さんは朝5時に自分のパン屋を開けてきました。店は細い通りの角に立っていて、パンの香りは2区画先の駅まで届きました。しかし近年、来る客は減っていました。駅の近くに大きなスーパーができ、そこでは半額でパンを売っていたのです。",
      "ユキは高校2年のときにそのパン屋で働き始めました。最初は天板を洗い、床を掃くだけでした。小田さんはめったに話さず、彼女は無愛想な人だと思っていました。しかしある朝、彼は彼女を呼び止めて言いました。「生地をよく見なさい。生地が、いつ準備できたかを教えてくれる。時計を見て決められることではないんだ。」",
      "それから、彼は彼女に教え始めました。彼女は、温度と水と時間がすべてつながっていること、そして力よりも忍耐のほうが大切だということを学びました。また、小田さんがほとんどすべての客の名前を覚えていること、誰がどのパンを好きかを小さな手帳に書き留めていることも知りました。",
      "2月、小田さんは氷の上で転んで手首を折りました。医師は6週間働かないようにと言いました。彼がいなければ店は閉めるしかなく、そして一度閉めた店はめったに再開しないことをユキは知っていました。その晩、彼女は同級生4人に電話をかけました。",
      "翌朝、5人の生徒が5時に集まりました。彼らの作業は遅く、最初のパンは焼きすぎて黒くなりました。客は気づきましたが、誰も文句を言いませんでした。それどころか近所の人に話し、週の終わりには行列が通りの角まで伸びていました。3月に小田さんが戻ってきたとき、店はここ何年もなかったほど忙しくなっていました。",
      "彼はいつものように、ほとんど何も言いませんでした。しかし手帳を取り出し、新しいページに何かを書いて、ユキのほうへ向けました。そこにはこう書かれていました。「ユキ ― 自分で焼いたパンが好き。」彼女は笑い、それから少し泣いて、また仕事に戻りました。"
    ],
    vocabularyHighlight: [
      { word: "narrow", translation: "狭い" },
      { word: "recent", translation: "最近の" },
      { word: "rarely", translation: "めったに～ない" },
      { word: "unfriendly", translation: "不親切な、よそよそしい" },
      { word: "temperature", translation: "温度、気温" },
      { word: "patience", translation: "忍耐、辛抱" },
      { word: "customer", translation: "客、顧客" },
      { word: "complained", translation: "不満を言った" },
      { word: "neighbors", translation: "近所の人々" }
    ],
    description: "職人のパン屋と高校生の弟子を描いた高校1年レベルの物語です。比較・関係詞・仮定を含む自然な文体で書かれています。",
    pointReward: 120,
    questions: [
      {
        question: "小田さんの店の客が減った理由は何でしたか？",
        options: [
          "駅の近くに安く売る大きなスーパーができたから",
          "パンの品質が落ちたから",
          "開店時間が遅くなったから",
          "店が別の場所へ移転したから"
        ],
        correctIndex: 0
      },
      {
        question: "小田さんがユキに最初に教えたのはどんなことでしたか？",
        options: [
          "生地を見て判断すること。時計では決められない",
          "できるだけ速く作業すること",
          "客の名前を全部覚えること",
          "力を入れて生地をこねること"
        ],
        correctIndex: 0
      },
      {
        question: "小田さんが働けなくなったとき、ユキは何をしましたか？",
        options: [
          "同級生4人に電話して手伝いを頼んだ",
          "店を一時的に閉めることにした",
          "スーパーにパンを卸すことにした",
          "近所の別のパン職人を雇った"
        ],
        correctIndex: 0
      },
      {
        question: "最初のパンが黒く焼けてしまったとき、客はどう反応しましたか？",
        options: [
          "文句を言わず、近所の人に店のことを話した",
          "返金を求めた",
          "二度と店に来なくなった",
          "スーパーへ行くよう勧めた"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p9",
    level: "senior",
    title: "Letters from the Mountain",
    englishParagraphs: [
      "When her grandmother died in the spring, Mei was asked to clean the old house in the mountains. She had visited it only twice as a child, and she remembered almost nothing except the cold water from the well and the sound of insects at night.",
      "The house was full of things that nobody needed: broken tools, empty jars, and forty years of newspapers. On the second day, behind a wooden box in the closet, Mei found a bundle of letters tied with a red string. The paper was thin and brown at the edges, and the handwriting was small and careful.",
      "The letters had been written between 1962 and 1968. They were from her grandmother to a friend named Setsuko, but they had never been sent. In them, her grandmother described a life that Mei had never imagined. She had wanted to study literature in Tokyo. She had passed the entrance examination. Her family had not allowed her to go, because her older brother was ill and someone had to stay.",
      "One letter said, 'I am not angry with them. I only wish that someone had asked me what I wanted. Perhaps that is the same thing as being angry, but it feels different when I write it down.'",
      "Mei sat on the floor for a long time. She had always thought of her grandmother as a quiet woman who cooked well and said little. It had never occurred to her that this woman had made a choice, or that the choice had been made for her.",
      "Before she left the mountain, Mei put the letters in her bag. In September, she began a course in modern Japanese literature. She did not tell herself that she was studying for her grandmother; that would have been too simple. But on the first day, she wrote Setsuko's name in the front of her notebook, and she kept it there for four years."
    ],
    japaneseParagraphs: [
      "祖母が春に亡くなったとき、メイは山にある古い家を片づけるよう頼まれました。子どもの頃に2度しか訪れたことがなく、井戸の冷たい水と夜の虫の音以外、ほとんど何も覚えていませんでした。",
      "家は誰にも必要のない物であふれていました。壊れた道具、空の瓶、40年分の新聞。2日目、押入れの木箱の裏で、メイは赤い紐で結ばれた手紙の束を見つけました。紙は薄く、端は茶色くなっていて、筆跡は小さく丁寧でした。",
      "手紙は1962年から1968年の間に書かれたものでした。祖母からセツコという友人へ宛てたものでしたが、一度も送られていませんでした。そこには、メイが想像したこともない人生が描かれていました。祖母は東京で文学を学びたいと思っていたのです。入学試験にも合格していました。しかし家族が行かせてくれませんでした。兄が病気で、誰かが残らなければならなかったからです。",
      "ある手紙にはこう書かれていました。「私は家族を恨んではいません。ただ、誰かが私に『どうしたいのか』と聞いてくれていたら、と思うだけです。それは恨んでいるのと同じことかもしれませんが、こうして書いてみると、違うもののように感じます。」",
      "メイは長い間、床に座っていました。彼女はずっと、祖母を料理が上手で口数の少ない女性だと思っていました。この人が一つの選択をしたこと、あるいはその選択が本人以外によってなされたことなど、考えたこともありませんでした。",
      "山を離れる前に、メイは手紙をかばんに入れました。9月、彼女は日本近代文学の講座を受け始めました。祖母のために勉強しているのだ、とは自分に言い聞かせませんでした。それではあまりに単純だからです。けれど初日に、彼女はノートの表紙の裏にセツコの名前を書き、それを4年間そのままにしていました。"
    ],
    vocabularyHighlight: [
      { word: "insects", translation: "昆虫、虫" },
      { word: "bundle", translation: "束、包み" },
      { word: "handwriting", translation: "筆跡、手書き" },
      { word: "described", translation: "描写した、説明した" },
      { word: "literature", translation: "文学" },
      { word: "examination", translation: "試験、検査" },
      { word: "allowed", translation: "許した" },
      { word: "occurred", translation: "起こった、思い浮かんだ" }
    ],
    description: "祖母の家で見つかった未投函の手紙から、語り手が家族の過去を知る高校1年レベルの物語です。過去完了や仮定法を含みます。",
    pointReward: 120,
    questions: [
      {
        question: "メイが押入れで見つけたものは何でしたか？",
        options: [
          "赤い紐で結ばれた手紙の束",
          "祖母の日記帳",
          "古い写真のアルバム",
          "文学賞の賞状"
        ],
        correctIndex: 0
      },
      {
        question: "祖母が東京へ行けなかった理由は何でしたか？",
        options: [
          "兄が病気で、誰かが家に残る必要があったから",
          "入学試験に合格しなかったから",
          "学費を払えなかったから",
          "文学に興味がなくなったから"
        ],
        correctIndex: 0
      },
      {
        question: "手紙の中で祖母は自分の気持ちをどう表現していましたか？",
        options: [
          "恨んではいないが、望みを聞いてほしかった",
          "家族を強く恨んでいる",
          "今の生活に完全に満足している",
          "もう何も覚えていない"
        ],
        correctIndex: 0
      },
      {
        question: "メイはノートの表紙の裏に何を書きましたか？",
        options: [
          "セツコの名前",
          "祖母の命日",
          "大学の校訓",
          "手紙が書かれた年"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p10",
    level: "senior2",
    title: "The Night Bus to Aomori",
    englishParagraphs: [
      "Ryo had planned the trip for months, and he missed the last train by four minutes. He stood on the empty platform and watched the red lights disappear into the dark. The next train would leave at six in the morning, and the interview he had travelled for would begin at nine.",
      "A station employee suggested the night bus. It was cheaper than the train, she explained, but it took eight hours and arrived slightly later. Ryo bought a ticket without thinking, which was unusual for him. He was the kind of person who compared prices for an hour before buying a pencil.",
      "The bus was almost full. His seat was next to an elderly man who was reading a paperback with a torn cover. For the first two hours, neither of them spoke. Then the man closed his book and asked, in a quiet voice, whether Ryo was going home or leaving it.",
      "Ryo said he was going to an interview. He admitted that he was not sure he wanted the job. The company was famous, the salary was good, and everyone he knew considered it an obvious opportunity. Nevertheless, whenever he imagined starting the work, he felt nothing at all.",
      "The old man listened without interrupting. When Ryo finished, he said that he had spent thirty-one years as an engineer at a company whose name Ryo recognized immediately. 'I was competent,' he said. 'I was never curious. Those are different things, and only one of them keeps you awake at night in a good way.'",
      "He did not tell Ryo what to do. Instead, he asked a single question: 'What did you read about last month, when nobody required you to read anything?' Ryo thought about it for a long time while the bus moved north through the darkness.",
      "By the time the sky turned grey over the mountains, Ryo had not made a decision. He attended the interview, and he answered the questions honestly, including the difficult ones. Three weeks later he turned down the offer and applied to a much smaller organization that repaired and catalogued old maps. His parents were disappointed. He was not."
    ],
    japaneseParagraphs: [
      "リョウは何か月も前からその旅行を計画していたのに、最終列車に4分間に合いませんでした。彼は誰もいないホームに立ち、赤い尾灯が闇に消えていくのを見ていました。次の列車は朝6時発で、そのために旅をしてきた面接は9時に始まる予定でした。",
      "駅員が夜行バスを勧めてくれました。列車より安いが8時間かかり、到着は少し遅くなる、と彼女は説明しました。リョウは考えもせずに切符を買いました。彼にしては珍しいことでした。彼は鉛筆一本を買うのに1時間も値段を比べるような人間だったのです。",
      "バスはほぼ満席でした。彼の隣の席には、表紙の破れた文庫本を読んでいる年配の男性が座っていました。最初の2時間、二人とも口をききませんでした。やがて男性は本を閉じ、静かな声で、家へ帰るところなのか、家を出るところなのかと尋ねました。",
      "リョウは面接に行くところだと答えました。そして、その仕事が欲しいのかどうか自分でも分からない、と打ち明けました。会社は有名で、給料も良く、知り合いは皆それを当然の好機だと考えていました。それにもかかわらず、その仕事を始めるところを想像しても、彼は何も感じませんでした。",
      "老人は口を挟まずに聞いていました。リョウが話し終えると、彼は、リョウがすぐに分かるような名前の会社で31年間技術者として働いた、と言いました。「私は有能ではあった」と彼は言いました。「だが、好奇心は一度も持たなかった。この二つは別物で、夜眠れなくさせるにしても、良い意味でそうさせるのは片方だけだ。」",
      "彼はリョウにどうすべきかを教えませんでした。代わりに、一つだけ質問しました。「先月、誰にも読めと言われていないのに読んだものは何かね。」リョウは、バスが暗闇の中を北へ進む間、長い時間そのことを考えていました。",
      "山の上の空が灰色に変わるころになっても、リョウは決心がついていませんでした。彼は面接を受け、難しい質問も含めて正直に答えました。3週間後、彼はその内定を断り、古い地図を修復し目録を作る、はるかに小さな組織に応募しました。両親はがっかりしました。彼はしませんでした。"
    ],
    vocabularyHighlight: [
      { word: "platform", translation: "プラットホーム、演壇" },
      { word: "employee", translation: "従業員" },
      { word: "compared", translation: "比較した" },
      { word: "elderly", translation: "年配の、高齢の" },
      { word: "admitted", translation: "認めた" },
      { word: "salary", translation: "給料" },
      { word: "opportunity", translation: "機会、好機" },
      { word: "competent", translation: "有能な" },
      { word: "curious", translation: "好奇心のある" },
      { word: "catalogued", translation: "目録を作った" }
    ],
    description: "終電を逃した夜行バスでの出会いが、進路の選択に影響を与える高校2年レベルの物語です。譲歩・関係詞・時制の使い分けを含みます。",
    pointReward: 160,
    questions: [
      {
        question: "リョウが夜行バスに乗ることになった理由は何でしたか？",
        options: [
          "最終列車に4分間に合わなかったから",
          "列車の運賃が高すぎたから",
          "面接が延期になったから",
          "駅員に切符を間違えて売られたから"
        ],
        correctIndex: 0
      },
      {
        question: "リョウがその仕事について感じていたことは何でしたか？",
        options: [
          "条件は良いのに、始めるところを想像しても何も感じない",
          "給料が低すぎて生活できない",
          "会社の評判が悪くて不安だ",
          "自分の能力では務まらない"
        ],
        correctIndex: 0
      },
      {
        question: "老人が自分について語ったことはどれですか？",
        options: [
          "有能ではあったが、好奇心を持ったことがなかった",
          "若い頃に会社を辞めて後悔している",
          "技術者としての才能がなかった",
          "31年間ずっと転職を考えていた"
        ],
        correctIndex: 0
      },
      {
        question: "老人がリョウにした唯一の質問はどれですか？",
        options: [
          "誰にも言われずに自分から読んだものは何か",
          "その会社の給料はいくらか",
          "両親は何と言っているか",
          "なぜ列車に乗り遅れたのか"
        ],
        correctIndex: 0
      },
      {
        question: "リョウは最終的にどうしましたか？",
        options: [
          "内定を断り、古い地図を扱う小さな組織に応募した",
          "有名な会社の内定を受け入れた",
          "面接を受けずに帰った",
          "両親の勧めに従って進路を決めた"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p11",
    level: "senior2",
    title: "The Robot That Learned to Wait",
    englishParagraphs: [
      "The robotics club had six members and one goal: to build a machine that could carry a cup of water across the classroom without spilling it. The competition in December awarded points for speed, and for two years the club had lost to schools with larger budgets.",
      "Their first design was fast. It crossed the room in eleven seconds and arrived with an empty cup and a wet floor. Their second design was slower and more stable, but it still lost half the water whenever it stopped. Nao, who was in charge of the software, insisted that the problem was mechanical. Ken, who had built the frame, insisted that it was not.",
      "They argued for most of October. Their adviser refused to take sides. She only reminded them that the water did not care about their opinions, and that the fastest way to settle a disagreement was to measure something.",
      "So they measured. They filmed the robot at two hundred frames per second and watched the recording together. What they saw surprised both of them. The water did not spill while the robot was moving. It spilled a fraction of a second after the robot stopped, because the liquid continued to move even when the machine did not.",
      "The solution was not a stronger motor or a stiffer frame. It was a pause. Nao rewrote the program so that the robot slowed down gradually and then waited for half a second before releasing the cup. The new version took fourteen seconds instead of eleven, which cost them points for speed.",
      "In December, they finished third out of twenty-two teams. It was the best result in the club's history. In her report, their adviser wrote a sentence that Ken later copied into his own notebook: 'The students did not build a faster robot. They built one that understood the difference between stopping and being still.'"
    ],
    japaneseParagraphs: [
      "ロボット部の部員は6人で、目標は一つでした。水の入ったコップをこぼさずに教室の端から端まで運べる機械を作ることです。12月の大会では速さに点が与えられ、この2年間、部は予算の多い学校に負け続けていました。",
      "最初の設計は速いものでした。11秒で教室を横切り、空のコップと濡れた床とともに到着しました。2つ目の設計はより遅く安定していましたが、それでも止まるたびに水の半分をこぼしました。ソフトウェアを担当していたナオは、問題は機構の側にあると主張しました。フレームを組んだケンは、そうではないと主張しました。",
      "二人は10月のほとんどを言い争って過ごしました。顧問はどちらの味方もしませんでした。彼女はただ、水は君たちの意見など気にしない、そして意見の対立を決着させる最も速い方法は何かを測ることだ、と言うだけでした。",
      "そこで二人は測定しました。毎秒200コマでロボットを撮影し、その記録を一緒に見ました。目にしたものは二人とも意外なものでした。水はロボットが動いている間はこぼれていなかったのです。こぼれていたのはロボットが止まったコンマ数秒後で、機械が止まっても液体は動き続けていたからでした。",
      "解決策は、より強力なモーターでも、より硬いフレームでもありませんでした。「間」でした。ナオはプログラムを書き直し、ロボットが徐々に減速し、コップを離す前に0.5秒待つようにしました。新しい版は11秒ではなく14秒かかり、その分、速さの点を失いました。",
      "12月、二人のチームは22チーム中3位に入りました。部の歴史で最高の成績でした。顧問は報告書に、後にケンが自分のノートへ書き写す一文を記しました。「生徒たちはより速いロボットを作ったのではない。『止まること』と『静止していること』の違いを理解したロボットを作ったのだ。」"
    ],
    vocabularyHighlight: [
      { word: "competition", translation: "競争、大会" },
      { word: "budgets", translation: "予算" },
      { word: "stable", translation: "安定した" },
      { word: "insisted", translation: "主張した" },
      { word: "mechanical", translation: "機械の、機械的な" },
      { word: "disagreement", translation: "意見の相違" },
      { word: "fraction", translation: "ごくわずか、分数" },
      { word: "liquid", translation: "液体" },
      { word: "gradually", translation: "徐々に" }
    ],
    description: "ロボット部の生徒が対立を測定によって解決する高校2年レベルの物語です。理系の題材と論理的な文章構成を扱います。",
    pointReward: 160,
    questions: [
      {
        question: "最初の設計の問題は何でしたか？",
        options: [
          "速いが、水を全部こぼしてしまった",
          "遅すぎて時間内に到着できなかった",
          "コップを持ち上げられなかった",
          "予算が足りずに完成しなかった"
        ],
        correctIndex: 0
      },
      {
        question: "顧問は対立した二人に何を勧めましたか？",
        options: [
          "何かを測定して決着をつけること",
          "多数決で決めること",
          "設計を最初からやり直すこと",
          "大会への出場を見送ること"
        ],
        correctIndex: 0
      },
      {
        question: "高速撮影で分かった事実はどれですか？",
        options: [
          "水はロボットが止まった直後にこぼれていた",
          "水は走行中ずっとこぼれ続けていた",
          "コップの形が原因だった",
          "床の傾きが原因だった"
        ],
        correctIndex: 0
      },
      {
        question: "採用された解決策はどれですか？",
        options: [
          "徐々に減速し、コップを離す前に0.5秒待つ",
          "より強力なモーターに交換する",
          "フレームをより硬い素材にする",
          "コップに蓋を付ける"
        ],
        correctIndex: 0
      },
      {
        question: "顧問が報告書に書いた内容はどれですか？",
        options: [
          "「止まること」と「静止していること」の違いを理解したロボットを作った",
          "生徒たちは他校より速いロボットを作り上げた",
          "予算があれば優勝できたはずだ",
          "来年は速さを最優先にすべきだ"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p12",
    level: "senior3",
    title: "The Archive of Ordinary Voices",
    englishParagraphs: [
      "The project began as a way for the city library to fill three empty shelves. A grant had been awarded for local history, and the librarians, having no unusual documents to display, decided instead to record the memories of residents over the age of seventy-five. Volunteers were recruited from a nearby high school, and Sana signed up because the alternative was cleaning the school pool.",
      "She was assigned to Mrs. Kurihara, who had worked in a textile factory from 1959 until it closed in 1994. Sana arrived with a list of prepared questions, most of which she never asked. Within ten minutes it became clear that Mrs. Kurihara had her own idea of what mattered, and that it had almost nothing to do with dates.",
      "What she wanted to describe was noise. She explained that the factory had been so loud that the workers developed a language of gestures, and that this language had grammar. A particular movement of the wrist meant that a machine was about to fail. Another, performed with two fingers, meant that the supervisor was in a bad mood and that questions should wait until afternoon.",
      "Sana had expected an account of hardship, and there was hardship in it. But the recording that she produced was mostly about invention. These women, none of whom had studied linguistics, had constructed a functioning system of communication in order to work safely, and when the factory closed, the system disappeared with it. Nobody had written it down, because nobody had considered it worth writing down.",
      "The library eventually collected forty-one interviews. Very few contained events that would appear in a conventional history of the region. There were no disasters, no famous visitors, and no decisive battles. Nevertheless, taken together, the recordings preserved something that official records consistently omit: the ordinary intelligence that people apply to the circumstances they happen to be given.",
      "Sana wrote her graduation essay on the factory gestures. In her conclusion she argued that the value of an archive should not be measured by the importance of the people in it. 'A record of the powerful,' she wrote, 'tells us what was decided. A record of everyone else tells us what was actually done.' Her teacher disagreed with the argument but gave her the highest mark in the class."
    ],
    japaneseParagraphs: [
      "その企画は、市立図書館が空いた3つの書棚を埋めるための手段として始まりました。地域史に助成金が下りたものの、展示できる珍しい資料がなかった司書たちは、代わりに75歳以上の住民の記憶を記録することにしたのです。近くの高校からボランティアが募集され、サナが応募したのは、その代わりが学校のプール掃除だったからでした。",
      "彼女は栗原さんの担当になりました。1959年から1994年の閉鎖まで、紡績工場で働いていた人です。サナは用意した質問の一覧を持って行きましたが、その大半は結局尋ねませんでした。10分もしないうちに、栗原さんには何が重要かという自分なりの考えがあり、それが年号とはほとんど無関係だということが分かったからです。",
      "彼女が語りたかったのは「音」でした。工場はあまりにうるさかったので、働く者たちは身振りの言語を発達させた、そしてその言語には文法があった、と彼女は説明しました。手首のある特定の動きは、機械がまもなく故障することを意味しました。二本の指で行う別の動きは、監督の機嫌が悪いので質問は午後まで待つべきだ、という意味でした。",
      "サナは苦労話を予想していましたし、実際に苦労もそこにはありました。しかし彼女が作った記録の中心は、むしろ「発明」でした。言語学を学んだ者は一人もいないこの女性たちが、安全に働くために機能する伝達の体系を作り上げ、そして工場が閉鎖されると、その体系も一緒に消えたのです。誰も書き残しませんでした。書き残す価値があるとは、誰も考えなかったからです。",
      "図書館は最終的に41件の聞き取りを集めました。従来の地域史に載るような出来事を含むものは、ごくわずかでした。災害も、著名な訪問者も、決定的な戦いもありません。それにもかかわらず、まとめて見たとき、その録音は公式の記録が一貫して省いてきたものを残していました。人々が、たまたま与えられた状況に対して働かせる、ごく普通の知恵です。",
      "サナは卒業論文を工場の身振りについて書きました。結論で彼女は、記録庫の価値は、そこに登場する人物の重要さで測られるべきではない、と論じました。「権力者の記録は、何が決定されたかを教えてくれる」と彼女は書きました。「それ以外の全員の記録は、実際に何が行われたかを教えてくれる。」担当教員はその主張に同意しませんでしたが、クラスで最高の評価を与えました。"
    ],
    vocabularyHighlight: [
      { word: "grant", translation: "助成金、補助金" },
      { word: "residents", translation: "住民" },
      { word: "recruited", translation: "募集した、採用した" },
      { word: "assigned", translation: "割り当てられた" },
      { word: "textile", translation: "織物、繊維" },
      { word: "gestures", translation: "身振り、手ぶり" },
      { word: "supervisor", translation: "監督者、上司" },
      { word: "hardship", translation: "苦難、困窮" },
      { word: "linguistics", translation: "言語学" },
      { word: "conventional", translation: "従来の、慣習的な" },
      { word: "preserved", translation: "保存した" },
      { word: "circumstances", translation: "状況、事情" }
    ],
    description: "図書館の聞き取り調査を通じて、記録に残らない知恵の価値を考える高校3年レベルの読解です。抽象的な議論と長い複文を含みます。",
    pointReward: 200,
    questions: [
      {
        question: "この企画が始まったきっかけは何でしたか？",
        options: [
          "地域史の助成金が下りたが、展示できる資料がなかったこと",
          "高校生のボランティアが不足していたこと",
          "工場の閉鎖が決まったこと",
          "住民から記録を求める要望があったこと"
        ],
        correctIndex: 0
      },
      {
        question: "栗原さんが最も語りたかったことは何でしたか？",
        options: [
          "工場の騒音の中で生まれた身振りの言語",
          "工場が閉鎖された正確な日付",
          "当時の給料の額",
          "経営者との対立"
        ],
        correctIndex: 0
      },
      {
        question: "二本の指で行う身振りは何を意味しましたか？",
        options: [
          "監督の機嫌が悪いので、質問は午後まで待つべきだ",
          "機械がまもなく故障する",
          "休憩の時間になった",
          "材料が足りなくなった"
        ],
        correctIndex: 0
      },
      {
        question: "身振りの体系が記録されなかった理由は何だと述べられていますか？",
        options: [
          "書き残す価値があると誰も考えなかったから",
          "文字を書ける人がいなかったから",
          "会社が記録を禁止していたから",
          "あまりに複雑で記述できなかったから"
        ],
        correctIndex: 0
      },
      {
        question: "サナが卒業論文の結論で述べた主張はどれですか？",
        options: [
          "記録庫の価値は、登場する人物の重要さで測るべきではない",
          "地域史は災害や戦いを中心に書くべきだ",
          "聞き取り調査は専門家だけが行うべきだ",
          "公式の記録こそ最も信頼できる"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p13",
    level: "senior3",
    title: "The Coral Gardeners",
    englishParagraphs: [
      "From the surface, the reef looked like a construction site that had been abandoned halfway through. Grey branches lay in heaps where fish had once gathered, and the water carried a fine sediment that made everything appear slightly out of focus. Dr. Ito had been diving at this location for nineteen years, and she could remember when the same stretch of seabed had been so crowded that she had to move carefully to avoid touching anything.",
      "The immediate cause of the damage was a marine heatwave three summers earlier. When the water stays too warm for too long, corals expel the algae that live inside them and provide most of their food. The coral does not die immediately; it turns white and begins to starve. If the temperature falls quickly enough, some of it recovers. In that particular summer, the temperature did not fall for eleven weeks.",
      "Restoration work began the following year, and it was less dramatic than the term suggests. Volunteers collected fragments that had broken off but were still alive, attached them to metal frames with ordinary cable ties, and returned every few weeks to remove the algae that would otherwise smother them. The work was repetitive, physically uncomfortable, and largely invisible to anyone standing on the beach.",
      "Dr. Ito was careful about what she promised. She told the volunteers that restoration could not reverse the underlying problem, and that a reef gardened by human beings would never be identical to one that had grown on its own. If the sea continued to warm, she said, the fragments they were attaching would eventually bleach as well. Several volunteers found this discouraging. A few stopped coming.",
      "Those who continued did so for a reason that Dr. Ito considered more durable than optimism. The reef was not merely a symbol of a global problem; it was also a specific place, inhabited by specific animals, and the difference between a hundred surviving colonies and none was a real difference to them. Acting locally did not solve the larger question, but declining to act did not solve it either.",
      "By the fifth year, coverage in the restored section had risen from four percent to nineteen. Juvenile fish returned, and with them a level of noise that surprised the team when they first noticed it on a hydrophone. Dr. Ito does not describe the project as a success, and she objects when journalists use that word. She describes it, instead, as evidence that recovery is possible under conditions that human beings still have some power to influence."
    ],
    japaneseParagraphs: [
      "海面から見ると、そのサンゴ礁は途中で放棄された工事現場のように見えました。かつて魚が集まっていた場所には灰色の枝が積み重なり、水は細かい堆積物を運んでいて、すべてがわずかに焦点の合わない映像のように見えました。伊藤博士は19年間この場所で潜っており、同じ海底が、何にも触れないよう慎重に動かねばならないほど混み合っていた頃を覚えていました。",
      "被害の直接の原因は、3年前の夏に起きた海洋熱波でした。水温が高すぎる状態が長く続くと、サンゴは体内に共生し、食物の大部分を供給している藻類を放出してしまいます。サンゴはすぐには死にません。白くなり、飢え始めるのです。水温が十分に速く下がれば、一部は回復します。しかしその年の夏、水温は11週間下がりませんでした。",
      "再生の作業は翌年に始まりましたが、その言葉が思わせるほど劇的なものではありませんでした。ボランティアが、折れたもののまだ生きている断片を集め、ありふれた結束バンドで金属の枠に固定し、数週間ごとに戻ってきては、放っておけば断片を覆ってしまう藻を取り除きました。作業は反復的で、体力的に不快で、そして砂浜に立つ人からはほとんど見えないものでした。",
      "伊藤博士は、約束する内容に慎重でした。再生作業では根本的な問題を元に戻すことはできないこと、人の手で育てられたサンゴ礁は、自力で育ったものと決して同じにはならないことを、彼女はボランティアに伝えました。海が温暖化し続ければ、いま固定している断片もいずれ白化するだろう、とも言いました。何人かのボランティアはこれを聞いて気落ちしました。数人は来なくなりました。",
      "続けた人たちがそうしたのは、伊藤博士が楽観よりも長続きすると考える理由からでした。そのサンゴ礁は地球規模の問題の象徴であるだけでなく、特定の生き物が住む特定の場所でもあり、生き残る群体が100あるかゼロかは、その生き物たちにとって現実の違いだったのです。局所的に行動しても、より大きな問いは解決しません。しかし行動しないことでも、やはり解決はしないのです。",
      "5年目までに、再生区画の被度は4パーセントから19パーセントへ上がりました。稚魚が戻り、それとともに、水中聴音器で初めて気づいたときにチームを驚かせるほどの音がよみがえりました。伊藤博士はこの事業を成功とは呼びませんし、記者がその言葉を使うと異議を唱えます。彼女はその代わりに、人間がまだいくらか影響を及ぼす力を持つ条件のもとでは回復が起こりうる、という証拠だと説明しています。"
    ],
    vocabularyHighlight: [
      { word: "abandoned", translation: "見捨てられた、放棄された" },
      { word: "sediment", translation: "堆積物、沈殿物" },
      { word: "seabed", translation: "海底" },
      { word: "marine", translation: "海の、海洋の" },
      { word: "expel", translation: "追い出す、排出する" },
      { word: "starve", translation: "飢える" },
      { word: "restoration", translation: "回復、修復" },
      { word: "fragments", translation: "断片、破片" },
      { word: "repetitive", translation: "反復的な" },
      { word: "discouraging", translation: "落胆させる" },
      { word: "durable", translation: "耐久性のある、長続きする" },
      { word: "juvenile", translation: "幼い、未成熟の" }
    ],
    description: "サンゴ礁の再生に取り組む研究者とボランティアを描いた高校3年レベルの読解です。科学的説明と、行動の意味をめぐる論述を含みます。",
    pointReward: 200,
    questions: [
      {
        question: "サンゴが白くなる仕組みとして本文で説明されているのはどれですか？",
        options: [
          "水温が高すぎる状態が続くと、体内の藻類を放出してしまう",
          "堆積物に覆われて光が届かなくなる",
          "魚に食べられて骨格だけが残る",
          "塩分濃度の低下で組織が壊れる"
        ],
        correctIndex: 0
      },
      {
        question: "再生作業の実際の内容はどのようなものでしたか？",
        options: [
          "生きた断片を結束バンドで枠に固定し、定期的に藻を取り除く",
          "人工のサンゴを海底に沈める",
          "海水の温度を下げる装置を設置する",
          "被害を受けた区画を立ち入り禁止にする"
        ],
        correctIndex: 0
      },
      {
        question: "伊藤博士がボランティアに伝えた内容として正しいものはどれですか？",
        options: [
          "再生では根本的な問題は元に戻せず、断片もいずれ白化しうる",
          "数年で元通りの生態系に戻せる",
          "この海域だけは温暖化の影響を受けない",
          "作業には特別な資格が必要である"
        ],
        correctIndex: 0
      },
      {
        question: "作業を続けた人たちの動機として本文が挙げているのはどれですか？",
        options: [
          "そこが特定の生き物が住む具体的な場所であり、生き残る数の差が現実の差だから",
          "作業が国から高く評価されているから",
          "楽観的に考えれば必ず解決すると信じているから",
          "報酬が支払われるようになったから"
        ],
        correctIndex: 0
      },
      {
        question: "伊藤博士がこの事業を「成功」と呼ばない理由に最も近いものはどれですか？",
        options: [
          "回復が可能だと示す証拠であって、問題の解決ではないから",
          "被度がまだ4パーセントのままだから",
          "ボランティアが集まらなかったから",
          "稚魚が戻ってこなかったから"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p14",
    level: "advanced",
    title: "The Cartographer's Deliberate Error",
    englishParagraphs: [
      "In 1937, a small publishing house in Michigan issued a road map that contained a town which did not exist. The town, named Agloe, was placed at a rural crossroads and derived its name from the initials of the two men who had compiled the map. It was not a mistake. It was a trap, inserted deliberately so that any competitor who copied the map would reproduce the fiction and thereby convict itself of plagiarism.",
      "The technique was standard practice in the industry. Publishers of dictionaries inserted invented words, and directories included fictitious subscribers whose telephones rang in the offices of the publisher. These devices, known collectively as copyright traps, rested on a straightforward assumption: that a fabrication has no independent existence, and that its appearance in a rival's work therefore constitutes proof of copying rather than of independent observation.",
      "What happened next complicated the assumption considerably. Some years later, a general store was built at the crossroads. Its proprietors, consulting the map in order to determine what the location was called, named the business the Agloe General Store. When a competing publisher subsequently printed a map showing Agloe, the original company alleged infringement. The competitor replied that Agloe was demonstrably real, since a building bearing that name stood at the indicated coordinates.",
      "The dispute is frequently recounted as an amusing anecdote, but its implications are not trivial. A fiction, once recorded in a document that people treat as authoritative, can generate the very conditions that make it true. Cartography is a particularly clear case because maps are consulted precisely by those who do not already know the terrain, and their readers are consequently disposed to defer to them.",
      "Comparable dynamics operate wherever an institution both describes a population and is believed to describe it accurately. Credit ratings influence the borrowing costs that determine whether a firm can meet its obligations. Diagnostic categories shape which symptoms clinicians look for and which patients report. In each instance the description is not merely an imperfect representation of a prior reality; it participates in constituting the reality it purports to represent.",
      "None of this implies that documents are omnipotent, and the Agloe episode itself indicates the limits. The store eventually closed, and later editions of the map removed the town. A description can create facts only where the surrounding conditions permit; a crossroads can accommodate a shop, but no amount of cartographic confidence would have produced a harbour there. The interesting question is therefore not whether representations shape the world, which they plainly do, but under what conditions the effect is strong enough to matter, and who bears the cost when the representation is wrong."
    ],
    japaneseParagraphs: [
      "1937年、ミシガン州の小さな出版社が、存在しない町を載せた道路地図を発行しました。アグローと名づけられたその町は、田舎の交差点に置かれ、地図を編纂した二人の男の頭文字からその名を取っていました。それは誤りではありませんでした。罠だったのです。地図を複製した競合他社がその虚構をそのまま再現し、それによって自らの盗用を証明してしまうよう、意図的に仕込まれていました。",
      "この手法は業界の標準的なやり方でした。辞書の出版社は造語を紛れ込ませ、名鑑には、電話をかけると出版社の事務所につながる架空の加入者が含まれていました。総称して「著作権の罠」と呼ばれるこれらの仕掛けは、単純な前提に基づいていました。捏造されたものには独立した存在がなく、したがってそれが競合の著作物に現れることは、独自の調査ではなく複製の証拠になる、という前提です。",
      "ところが、その後に起きたことがこの前提を大きく複雑にしました。数年後、その交差点に雑貨店が建てられたのです。店主たちは、その場所が何と呼ばれているのかを知るために地図を参照し、店をアグロー雑貨店と名づけました。のちに競合の出版社がアグローを載せた地図を印刷したとき、元の会社は権利侵害を主張しました。競合はこう答えました。示された座標にその名を掲げた建物が立っている以上、アグローは明白に実在する、と。",
      "この紛争はしばしば愉快な逸話として語られますが、その含意は些細なものではありません。虚構は、人々が権威あるものとして扱う文書にひとたび記載されると、それを真実にする条件そのものを生み出しうるのです。地図学はとりわけ分かりやすい例です。地図はまさに、その土地をまだ知らない者によって参照されるものであり、読者はしたがって地図に従おうとする傾向を持つからです。",
      "同様の力学は、ある制度が集団を記述し、かつその記述が正確だと信じられている場面ならどこでも働きます。信用格付けは借入費用に影響し、その費用が、企業が債務を履行できるかどうかを左右します。診断の分類は、臨床医がどの症状を探すか、患者がどの症状を訴えるかを形づくります。いずれの場合も、記述は先に存在する現実の不完全な写しにとどまりません。記述しようとしている当の現実を構成することに、記述自身が加わっているのです。",
      "とはいえ、これは文書が万能だということではなく、アグローの一件そのものが限界を示しています。店はやがて閉店し、のちの版の地図からその町は削除されました。記述が事実を作り出せるのは、周囲の条件がそれを許す場合に限られます。交差点は店を収めることができますが、地図がどれほど自信をもって描こうと、そこに港が生じることはありません。したがって興味深い問いは、表象が世界を形づくるかどうか（それは明らかにそうです）ではなく、その効果が問題になるほど強く働くのはどのような条件のもとか、そして表象が誤っていたとき誰がその代償を負うのか、ということです。"
    ],
    vocabularyHighlight: [
      { word: "compiled", translation: "編集した、まとめた" },
      { word: "deliberately", translation: "意図的に、故意に" },
      { word: "competitor", translation: "競争相手" },
      { word: "plagiarism", translation: "盗用、剽窃" },
      { word: "fictitious", translation: "架空の、虚偽の" },
      { word: "fabrication", translation: "捏造、作り事" },
      { word: "proprietors", translation: "所有者、経営者" },
      { word: "infringement", translation: "侵害、違反" },
      { word: "implications", translation: "含意、影響" },
      { word: "authoritative", translation: "権威のある、信頼できる" },
      { word: "obligations", translation: "義務、債務" },
      { word: "constituting", translation: "構成している" },
      { word: "omnipotent", translation: "全能の" },
      { word: "accommodate", translation: "収容する、対応する" }
    ],
    description: "地図に仕込まれた架空の町が実在化した実話から、記述が現実を形づくる力を論じる社会人・上級レベルの評論です。抽象名詞と長い複文を多用します。",
    pointReward: 260,
    questions: [
      {
        question: "アグローという町が地図に載せられた本来の目的は何でしたか？",
        options: [
          "地図を複製した競合の盗用を証明するための罠",
          "測量の誤りを後で修正するための目印",
          "地元住民の要望に応えるため",
          "新しい道路の建設予定地を示すため"
        ],
        correctIndex: 0
      },
      {
        question: "「著作権の罠」が前提としていた考え方はどれですか？",
        options: [
          "捏造されたものには独立した存在がないので、出現すれば複製の証拠になる",
          "地図は必ず複数の出版社が共同で作るべきである",
          "架空の情報は読者に害を与えない",
          "競合他社は必ず現地調査を行う"
        ],
        correctIndex: 0
      },
      {
        question: "アグローが「実在する」ことになった経緯はどれですか？",
        options: [
          "地図を見た店主が、その交差点の店をアグロー雑貨店と名づけた",
          "住民が投票で町名を決めた",
          "州政府が正式に町として登録した",
          "別の出版社が現地を測量した"
        ],
        correctIndex: 0
      },
      {
        question: "筆者が信用格付けや診断分類を挙げているのはなぜですか？",
        options: [
          "記述が、記述しようとする現実の構成に加わる例として",
          "地図よりも正確な記録の例として",
          "国家が管理すべき制度の例として",
          "統計的な誤差が大きい分野の例として"
        ],
        correctIndex: 0
      },
      {
        question: "筆者が最後に「興味深い問い」として挙げているのはどれですか？",
        options: [
          "効果が問題になるほど強く働く条件と、誤りの代償を誰が負うか",
          "表象が世界を形づくるかどうか",
          "地図の出版社に法的責任があるかどうか",
          "アグロー雑貨店がいつ閉店したか"
        ],
        correctIndex: 0
      }
    ]
  },
  {
    id: "p15",
    level: "advanced",
    title: "What the Trial Could Not Measure",
    englishParagraphs: [
      "The programme was evaluated with unusual rigour. Two thousand participants were assigned at random either to receive a modest unconditional payment for two years or to continue with the existing arrangements, and the outcomes were tracked through administrative records rather than self-reports. The design anticipated most of the objections that such studies ordinarily attract, and the researchers pre-registered their hypotheses in order to preclude the selective reporting that has damaged confidence in comparable work.",
      "The headline finding was that employment rates did not differ significantly between the two groups. Advocates had predicted an increase, on the grounds that financial security would permit people to search for suitable work rather than accept the first available position. Critics had predicted a decrease, on the assumption that unconditional income erodes the incentive to work at all. Neither expectation was borne out, and both camps proceeded to claim vindication, which is a reliable indication that a result has been found inconvenient.",
      "Secondary outcomes were more informative, though they attracted less attention. Recipients reported substantially lower psychological distress, visited emergency departments less frequently, and were markedly more likely to complete vocational courses that they had previously abandoned. Their children missed fewer days of school. These effects were large enough to survive correction for multiple comparisons, which is not a trivial hurdle.",
      "The difficulty is that a policy debate conducted in terms of employment rates cannot accommodate such findings. A trial can only measure what it was designed to measure, and the choice of primary outcome is not itself an empirical question; it encodes a prior judgement about what the programme is for. If the purpose is to move people into jobs, the trial recorded a failure. If the purpose is to reduce the corrosive effects of insecurity, it recorded a substantial success. The data are compatible with both descriptions because the disagreement is not, at bottom, about the data.",
      "This is a recurring problem in evidence-based policy, and it is frequently misdiagnosed as a shortage of evidence. Commissioning another trial will not resolve a dispute about ends, however large the sample. What the additional evidence can do is narrow the range of defensible claims: after this study, one can no longer assert that unconditional payments cause large-scale withdrawal from the labour market, since that specific prediction was tested and failed.",
      "That is a genuine contribution, and it is worth distinguishing from the contribution that was hoped for. Rigorous evaluation rarely settles political questions, and it is not discredited by failing to do so. Its value lies in the steady elimination of claims that turn out not to be true, which leaves the remaining disagreement clearer, better informed, and harder to disguise as a technical matter."
    ],
    japaneseParagraphs: [
      "その制度は異例の厳密さで評価されました。2,000人の参加者が無作為に、2年間ささやかな無条件給付を受ける群と、従来の制度を続ける群に割り当てられ、結果は自己申告ではなく行政記録を通じて追跡されました。この設計は、この種の研究が通常受ける批判の大半をあらかじめ想定しており、研究者たちは、同種の研究への信頼を損なってきた「都合のよい報告」を封じるために、仮説を事前登録していました。",
      "主要な結果は、就業率が両群の間で有意に異ならなかったというものでした。推進派は増加を予測していました。経済的な安定があれば、人はとりあえず就ける仕事に飛びつくのではなく、自分に合った仕事を探せるようになるから、という理由です。批判派は減少を予測していました。無条件の所得は、そもそも働く誘因を損なうという想定からです。どちらの予測も裏づけられず、そして両陣営とも自説の正しさを主張し始めました。これは、ある結果が都合の悪いものであったことを示す、確実な兆候です。",
      "副次的な結果のほうが多くを語っていましたが、注目は集めませんでした。受給者は心理的苦痛が大幅に低いと報告し、救急外来の受診頻度が下がり、以前に途中でやめていた職業訓練課程を修了する割合が著しく高くなりました。その子どもたちの欠席日数も減りました。これらの効果は、多重比較の補正を経てもなお残るほど大きく、それは決して低い水準の関門ではありません。",
      "問題は、就業率という言葉で行われる政策論争が、こうした知見を受け止められないことです。試験は、測るように設計されたものしか測れません。そして主要評価項目の選択それ自体は経験的な問いではなく、その制度が何のためにあるのかについての、あらかじめの判断を含んでいます。目的が人を職に就かせることなら、この試験は失敗を記録しました。目的が生活の不安定さがもたらす蝕みを減らすことなら、相当な成功を記録しました。データが両方の記述と両立するのは、対立が根本のところでデータについてのものではないからです。",
      "これは根拠に基づく政策で繰り返し現れる問題であり、しばしば「根拠が足りない」と誤診されます。目的をめぐる対立は、標本をどれだけ大きくしても、もう一度試験を実施することでは解決しません。追加の根拠にできるのは、擁護可能な主張の範囲を狭めることです。この研究の後では、無条件給付が労働市場からの大規模な離脱を引き起こすとは、もはや主張できません。その特定の予測は検証され、支持されなかったからです。",
      "それは本物の貢献であり、期待されていた貢献とは区別する価値があります。厳密な評価が政治的な問いに決着をつけることはめったにありませんが、決着をつけられないからといって、その価値が損なわれるわけではありません。その価値は、真実でないと判明した主張を着実に取り除いていく点にあります。そうすることで、残る対立はより明瞭で、より情報に裏打ちされ、そして技術的な問題であるかのように装うことが難しくなるのです。"
    ],
    vocabularyHighlight: [
      { word: "rigour", translation: "厳密さ、厳格さ" },
      { word: "participants", translation: "参加者" },
      { word: "unconditional", translation: "無条件の" },
      { word: "administrative", translation: "行政の、管理の" },
      { word: "anticipated", translation: "予期した" },
      { word: "objections", translation: "反対、異議" },
      { word: "preclude", translation: "妨げる、排除する" },
      { word: "erodes", translation: "むしばむ、侵食する" },
      { word: "incentive", translation: "動機、誘因" },
      { word: "vindication", translation: "正しさの証明、擁護" },
      { word: "distress", translation: "苦痛、苦悩" },
      { word: "vocational", translation: "職業の、職業訓練の" },
      { word: "empirical", translation: "経験的な、実証的な" },
      { word: "corrosive", translation: "むしばむ、腐食性の" },
      { word: "defensible", translation: "擁護できる" },
      { word: "discredited", translation: "信用を失った" }
    ],
    description: "無条件給付の社会実験を題材に、評価研究が何を測れて何を測れないのかを論じる社会人・上級レベルの評論です。学術的な語彙と譲歩構文を含みます。",
    pointReward: 260,
    questions: [
      {
        question: "この研究が「異例の厳密さ」で行われたと言える根拠として本文が挙げているのはどれですか？",
        options: [
          "無作為割当・行政記録による追跡・仮説の事前登録",
          "参加者が2,000人と多かったこと",
          "研究期間が2年に及んだこと",
          "推進派と批判派の両方が参加したこと"
        ],
        correctIndex: 0
      },
      {
        question: "就業率についての結果はどのようなものでしたか？",
        options: [
          "両群で有意な差がなく、推進派・批判派どちらの予測も裏づけられなかった",
          "給付を受けた群で大きく増加した",
          "給付を受けた群で大きく減少した",
          "測定できなかった"
        ],
        correctIndex: 0
      },
      {
        question: "副次的な結果として報告されていないものはどれですか？",
        options: [
          "受給者の平均所得が2倍になった",
          "心理的苦痛が大幅に低下した",
          "救急外来の受診が減った",
          "子どもの欠席日数が減った"
        ],
        correctIndex: 0
      },
      {
        question: "筆者によれば、主要評価項目の選択はどのような性質のものですか？",
        options: [
          "経験的な問いではなく、制度が何のためにあるかについての事前の判断を含む",
          "統計的な検定によって客観的に決まる",
          "参加者の希望によって決まる",
          "研究費の額によって決まる"
        ],
        correctIndex: 0
      },
      {
        question: "筆者が考える、厳密な評価研究の価値はどれですか？",
        options: [
          "真実でないと判明した主張を着実に取り除き、残る対立を明瞭にすること",
          "政治的な対立に最終的な決着をつけること",
          "より大きな標本を集める必要性を示すこと",
          "政策の目的を研究者が決められるようにすること"
        ],
        correctIndex: 0
      }
    ]
  },
];
