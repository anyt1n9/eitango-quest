export interface Passage {
  id: string;
  level: "junior" | "senior" | "senior2" | "senior3" | "advanced";
  title: string;
  englishParagraphs: string[];
  japaneseParagraphs: string[];
  vocabularyHighlight: { word: string; translation: string }[];
  description: string;
  pointReward: number;
}

export const passages: Passage[] = [
  {
    id: "p1",
    level: "junior",
    title: "The Beautiful Secret of the Old Library",
    englishParagraphs: [
      "There is a beautiful and quiet library in my town. Many children like to study there after school. Yesterday, I went to the library to read important books about flowers and water.",
      "I found an important book. The book was very old, but beautiful. It said, 'Reading is important for your dreams and future. Water is important for flowers, and books are important for the mind.' That was a simple other secret."
    ],
    japaneseParagraphs: [
      "私の町には、美しく静かな図書館があります。多くの子供たちが放課後、そこで勉強するのが好きです。昨日、私は花と水に関する大切な本を読むために図書館へ行きました。",
      "私は一冊の重要な本を見つけました。その本はとても古かったのですが、美しかったです。そこにはこう書かれていました。『読書はあなたの夢と将来にとって重要です。水が花にとって重要であるように、本は心にとって重要なのです。』それはシンプルで、もう一つの秘密でした。"
    ],
    vocabularyHighlight: [
      { word: "beautiful", translation: "美しい、きれいな" },
      { word: "library", translation: "図書館" },
      { word: "important", translation: "重要な、大切な" }
    ],
    description: "中学レベルの重要語彙（beautiful, library, important）を含む心温まる短いお話です。",
    pointReward: 50
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
      "夏期の期間中、高い山々を探索することを好む人々がいます。そこには多くの興味深くユニークな野生動物が存在していることを私たちは知っています。彼らは活動的で、きれいた川の近くに住んでいます。",
      "地域のリーダーたちは美しい自然を保護したいと考えています。森を探索することは、私たちの環境を深く理解するための手引きとなります。人間の生活は自然に依存しているため、自然を思いやることは私たちの最優先の義務です。"
    ],
    vocabularyHighlight: [
      { word: "explore", translation: "探索する、調査する" },
      { word: "term", translation: "期間、専門用語" },
      { word: "exist", translation: "存在する、実在する" },
      { word: "depend", translation: "依存する" }
    ],
    description: "高校1年生レベルの重要語（explore, term, exist, depend）を使用した、自然探検に関するエッセイです。",
    pointReward: 60
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
    pointReward: 70
  },
  {
    id: "p4",
    level: "senior3",
    title: "The Silent Disaster and Rebuilding Hope",
    englishParagraphs: [
      "The violent storm was a sudden disaster that became a trigger for a significant transition in our neighborhood. The regional airline and several shipping organizations stopped overnight operations due to severe damage. There was great fear, but the prompt provision of clean water and warm food brought comfort to the suffering families.",
      "The brave founder of the local estate decided to make a massive sacrifice of his personal assets to support the radical rebuild attempt. People showed great courage to clear blockages and restore electrical systems.",
      "Today, the community is highly resilient and united. It is a absolute delight to see how they overcame a temporary failure and created a sustainable partnership."
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
      { word: "asset", translation: "資産" },
      { word: "founder", translation: "創設者" }
    ],
    description: "新規追加された高校3年生レベルの語句（significant, sacrifice, trigger, disaster, overnight, transition, provision, asset, founder, courage）を厳選することなくストーリーに昇華し、地域社会の再建を描いた躍動的な長文です。",
    pointReward: 80
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
      { word: "scrutinize", translation: "細かく調べる、吟味する" },
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
    pointReward: 100
  }
];
