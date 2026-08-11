import { GrammarTopic } from "../types";

/**
 * 文法の解説。
 *
 * この教材は単語と訳の1対1の暗記に寄っていて、文法の解説がまったく無かった。
 * 単語をいくら覚えても、それを並べて文にする規則を知らなければ、
 * 長文は読めないし英作文も書けない。結局は文法の参考書を別に買うことになる。
 *
 * 語義（senses.ts）や語法（wordUsage.ts）が辞書やコーパスから機械的に作った
 * データなのに対し、ここは書き下ろしである。出典を示せる類のものではないので、
 * その代わりに中学・高校で扱う順序に沿って並べ、
 * 各項目を「説明 → 例文 → よくある間違い → 練習」の同じ形にそろえてある。
 *
 * `verbFrames` は WordNet の文型番号で、収録語のデータから
 * 「実際にその形をとる動詞」を引くために持たせている（src/grammar.ts）。
 * 解説を読んで終わりにせず、覚えた単語と結び付けるため。
 */
export const grammarTopics: GrammarTopic[] = [
  // ===== 初級（中学） =============================================
  {
    id: "g_be_verb",
    level: "junior",
    category: "文の組み立て",
    title: "be動詞と一般動詞",
    summary: "英語の文には動詞が必ず1つ要る。be動詞と一般動詞は混ぜて使わない。",
    sections: [
      {
        heading: "be動詞は「＝」の働きをする",
        body: "am / is / are は「AはBだ」「AはBにいる」と言うときに使う。主語によって形が変わり、I は am、he / she / it と単数の名詞は is、you と複数の名詞は are をとる。"
      },
      {
        heading: "一般動詞は動作や状態を表す",
        body: "play, study, like, live のように、be動詞以外の動詞をまとめて一般動詞という。主語が三人称単数（he / she / it や単数の名詞）で現在の話をするときは、語尾に -s / -es が付く。"
      },
      {
        heading: "1つの文に動詞は1つ",
        body: "日本語では「私は学生です」「私は英語を勉強します」がどちらも「です・ます」で終わるため、英語でも be動詞を付けたくなる。しかし一般動詞がある文に be動詞は要らない。"
      }
    ],
    examples: [
      { english: "I am a student.", japanese: "私は学生です。", note: "「私＝学生」なので be動詞" },
      { english: "She is in the library.", japanese: "彼女は図書館にいます。", note: "居場所を言う be動詞" },
      { english: "He studies English every day.", japanese: "彼は毎日英語を勉強します。", note: "三人称単数なので studies" },
      { english: "They live in Osaka.", japanese: "彼らは大阪に住んでいます。", note: "主語が複数なので -s は付かない" }
    ],
    mistakes: [
      { wrong: "I am study English.", right: "I study English.", why: "study という一般動詞があるので be動詞は要らない。" },
      { wrong: "He study English.", right: "He studies English.", why: "主語が三人称単数の現在形なので -es が付く。" },
      { wrong: "She is not have a car.", right: "She does not have a car.", why: "一般動詞の否定文は do / does を使う。" }
    ],
    questions: [
      {
        question: "My brother [_____] soccer every Sunday.",
        options: ["play", "plays", "is play", "is plays"],
        correctIndex: 1,
        explanation: "主語 My brother は三人称単数で現在の習慣なので plays。一般動詞の文に is は付けない。"
      },
      {
        question: "We [_____] in the same class.",
        options: ["am", "is", "are", "be"],
        correctIndex: 2,
        explanation: "主語 We は複数なので are。"
      },
      {
        question: "Tom [_____] not like carrots.",
        options: ["is", "do", "does", "are"],
        correctIndex: 2,
        explanation: "一般動詞 like の否定文で、主語が三人称単数なので does not。"
      }
    ]
  },
  {
    id: "g_noun_article",
    level: "junior",
    category: "名詞のあつかい",
    title: "名詞の複数形と a / an / the",
    summary: "数えられる名詞は「1つなら a/an、2つ以上なら複数形」。特定できるものには the。",
    sections: [
      {
        heading: "数えられる名詞は裸で置かない",
        body: "book, dog, student のように数えられる名詞は、単数のときに a / an を付けるか、複数形にするかのどちらかにする。日本語には冠詞が無いため、ここが最も抜けやすい。"
      },
      {
        heading: "a と an の使い分けは音で決まる",
        body: "次に来る語の発音が母音で始まるなら an。綴りではなく音で決まるので、an hour（h を読まない）や a university（ユと読む）のような例がある。"
      },
      {
        heading: "the は「どれのことか分かる」とき",
        body: "一度出てきたもの、その場に1つしかないもの、修飾語で絞り込まれたものには the を使う。初めて話に出すときは a / an で、二度目からは the になるのが基本。"
      },
      {
        heading: "数えられない名詞には a を付けない",
        body: "water, information, advice, homework などは数えられない名詞で、a も複数形も付かない。量を言うときは a glass of water, a piece of advice のように単位を足す。"
      }
    ],
    examples: [
      { english: "I bought a book yesterday. The book was expensive.", japanese: "昨日、本を1冊買いました。その本は高かったです。", note: "初出は a、二度目は the" },
      { english: "She waited for an hour.", japanese: "彼女は1時間待ちました。", note: "hour は母音で始まる音なので an" },
      { english: "There are many students in the gym.", japanese: "体育館にはたくさんの生徒がいます。", note: "複数形 students" },
      { english: "Can you give me some advice?", japanese: "助言をもらえますか。", note: "advice は数えられないので an advice とは言わない" }
    ],
    mistakes: [
      { wrong: "I have pen.", right: "I have a pen.", why: "数えられる名詞を単数で裸のまま置けない。" },
      { wrong: "I got many informations.", right: "I got a lot of information.", why: "information は数えられないので複数形にしない。" },
      { wrong: "I play the soccer.", right: "I play soccer.", why: "スポーツ名に the は付けない（楽器には付ける: play the piano）。" }
    ],
    questions: [
      {
        question: "She is [_____] honest person.",
        options: ["a", "an", "the", "（何も入れない）"],
        correctIndex: 1,
        explanation: "honest は h を読まず母音の音で始まるので an。綴りではなく音で決める。"
      },
      {
        question: "I need [_____] to finish this work.",
        options: ["a time", "times", "some time", "a times"],
        correctIndex: 2,
        explanation: "「時間」の意味の time は数えられない名詞なので some time。"
      },
      {
        question: "We saw a cat. [_____] cat was sleeping.",
        options: ["A", "An", "The", "Some"],
        correctIndex: 2,
        explanation: "一度出てきて「どの猫か」が分かるので the。"
      }
    ]
  },
  {
    id: "g_pronoun",
    level: "junior",
    category: "名詞のあつかい",
    title: "代名詞の使い分け",
    summary: "I / my / me / mine は、文のどこで使うかで形が決まる。",
    sections: [
      {
        heading: "4つの形を役割で覚える",
        body: "主語になるのが主格（I, you, he, she, it, we, they）、名詞の前に置いて「〜の」を表すのが所有格（my, your, his, her, its, our, their）、動詞や前置詞の後ろに来るのが目的格（me, you, him, her, it, us, them）、「〜のもの」と単独で使うのが所有代名詞（mine, yours, his, hers, ours, theirs）。"
      },
      {
        heading: "所有格の後ろには必ず名詞が来る",
        body: "my は単独では使えない。「私のです」と言いたいときは mine を使う。"
      },
      {
        heading: "it は前に出た「もの・こと」を指す",
        body: "同じ名詞を繰り返さないために使う。天気・時刻・距離を言うときにも、意味を持たない主語として it を置く。"
      }
    ],
    examples: [
      { english: "He gave me his umbrella.", japanese: "彼は私に自分の傘をくれました。", note: "me は目的格、his は所有格" },
      { english: "This bag is mine.", japanese: "このかばんは私のものです。", note: "単独なので mine" },
      { english: "It is rainy today.", japanese: "今日は雨です。", note: "天気の it。訳には出ない" },
      { english: "I know them very well.", japanese: "私は彼らをとてもよく知っています。", note: "動詞の後ろなので目的格 them" }
    ],
    mistakes: [
      { wrong: "This pen is my.", right: "This pen is mine.", why: "所有格 my は名詞の前でしか使えない。" },
      { wrong: "He talked to I.", right: "He talked to me.", why: "前置詞の後ろは目的格。" },
      { wrong: "Me and my friend went there.", right: "My friend and I went there.", why: "主語なので主格 I を使い、相手を先に置くのが自然。" }
    ],
    questions: [
      {
        question: "Please wait for [_____].",
        options: ["we", "our", "us", "ours"],
        correctIndex: 2,
        explanation: "前置詞 for の後ろなので目的格 us。"
      },
      {
        question: "Is this your bag? — No, it's not [_____].",
        options: ["my", "mine", "me", "myself"],
        correctIndex: 1,
        explanation: "後ろに名詞が無く単独で使うので所有代名詞 mine。"
      },
      {
        question: "[_____] takes about ten minutes to walk there.",
        options: ["It", "That", "This", "There"],
        correctIndex: 0,
        explanation: "時間・天気・距離を言うときの、意味を持たない主語の it。"
      }
    ]
  },
  {
    id: "g_present",
    level: "junior",
    category: "動詞の形",
    title: "現在形と現在進行形",
    summary: "現在形は「いつもそうすること」、現在進行形は「今している最中のこと」。",
    sections: [
      {
        heading: "現在形は習慣・事実",
        body: "毎日すること、いつも変わらない事実を表す。「今この瞬間」を表すのではない点に注意する。every day, usually, always などがよく一緒に使われる。"
      },
      {
        heading: "現在進行形は be動詞 + 動詞のing形",
        body: "話している今、その動作の途中であることを表す。now, at the moment などと一緒に使われる。"
      },
      {
        heading: "進行形にしない動詞がある",
        body: "know, like, want, have（持っている）, believe など、状態を表す動詞は普通は進行形にしない。「今知っている最中」という言い方がそもそも成り立たないため。"
      }
    ],
    examples: [
      { english: "I walk to school every day.", japanese: "私は毎日歩いて学校に行きます。", note: "習慣なので現在形" },
      { english: "I am walking to school now.", japanese: "私は今、歩いて学校に向かっています。", note: "今の最中なので進行形" },
      { english: "Water boils at 100 degrees.", japanese: "水は100度で沸騰します。", note: "変わらない事実" },
      { english: "She is having lunch.", japanese: "彼女は昼食を食べているところです。", note: "have が「食べる」の意味なら進行形にできる" }
    ],
    mistakes: [
      { wrong: "I am knowing him.", right: "I know him.", why: "know は状態を表すので進行形にしない。" },
      { wrong: "Look! It rains.", right: "Look! It is raining.", why: "今まさに降っているので進行形。" },
      { wrong: "He is go to school now.", right: "He is going to school now.", why: "進行形は be動詞 + ing形。" }
    ],
    questions: [
      {
        question: "Be quiet. The baby [_____].",
        options: ["sleeps", "is sleeping", "sleep", "is sleep"],
        correctIndex: 1,
        explanation: "今その最中のことなので現在進行形。"
      },
      {
        question: "My father [_____] coffee every morning.",
        options: ["is drinking", "drink", "drinks", "are drinking"],
        correctIndex: 2,
        explanation: "毎朝の習慣なので現在形。主語が三人称単数なので drinks。"
      },
      {
        question: "I [_____] what you mean.",
        options: ["am understanding", "understand", "understands", "am understand"],
        correctIndex: 1,
        explanation: "understand は状態を表す動詞なので進行形にしない。"
      }
    ]
  },
  {
    id: "g_past",
    level: "junior",
    category: "動詞の形",
    title: "過去形と過去進行形",
    summary: "過去形は「終わったこと」、過去進行形は「そのときしていた最中のこと」。",
    sections: [
      {
        heading: "規則変化と不規則変化",
        body: "多くの動詞は -ed を付けて過去形にするが、go → went、see → saw のように形が変わるものがある。不規則動詞の一覧は「動詞の活用表」の画面で確認できる。"
      },
      {
        heading: "過去進行形は was / were + ing形",
        body: "過去のある時点で進行中だったことを表す。「〜していたとき、…した」のように、背景と出来事を組み合わせて使うことが多い。"
      },
      {
        heading: "否定文・疑問文では動詞を原形に戻す",
        body: "did を使った時点で過去であることは示せているので、その後ろの動詞は原形にする。"
      }
    ],
    examples: [
      { english: "I visited my grandmother last week.", japanese: "先週、祖母を訪ねました。", note: "規則変化の過去形" },
      { english: "He went to Kyoto in 2019.", japanese: "彼は2019年に京都へ行きました。", note: "不規則変化 go → went" },
      { english: "I was reading when she called me.", japanese: "彼女が電話してきたとき、私は本を読んでいました。", note: "背景が過去進行形、出来事が過去形" },
      { english: "Did you see the movie?", japanese: "その映画を見ましたか。", note: "did の後ろは原形 see" }
    ],
    mistakes: [
      { wrong: "Did you went there?", right: "Did you go there?", why: "did がすでに過去を表しているので動詞は原形。" },
      { wrong: "I didn't saw him.", right: "I didn't see him.", why: "否定文でも did の後ろは原形。" },
      { wrong: "Yesterday I go to the park.", right: "Yesterday I went to the park.", why: "yesterday があるので過去形にする。" }
    ],
    questions: [
      {
        question: "She [_____] her homework before dinner.",
        options: ["finish", "finished", "finishes", "was finish"],
        correctIndex: 1,
        explanation: "before dinner という過去の出来事なので過去形 finished。"
      },
      {
        question: "What [_____] you doing at eight last night?",
        options: ["are", "did", "were", "was"],
        correctIndex: 2,
        explanation: "過去進行形で主語が you なので were。"
      },
      {
        question: "I didn't [_____] anything strange.",
        options: ["heard", "hear", "hearing", "hears"],
        correctIndex: 1,
        explanation: "didn't の後ろは原形。"
      }
    ]
  },
  {
    id: "g_future",
    level: "junior",
    category: "動詞の形",
    title: "未来の表し方（will と be going to）",
    summary: "その場で決めたことは will、前から決めていたことは be going to。",
    sections: [
      {
        heading: "will はその場で決めた気持ち",
        body: "話しているときに決めたこと、そうなるだろうという予想を表す。後ろは必ず動詞の原形。"
      },
      {
        heading: "be going to は前から決めていた予定",
        body: "すでに決まっている予定や、今の様子から見て起こりそうなことを表す。"
      },
      {
        heading: "時・条件を表す節では未来形にしない",
        body: "when, if, before, after, until などが導く節の中では、未来のことでも現在形を使う。「明日晴れたら」は if it will be sunny ではなく if it is sunny。"
      }
    ],
    examples: [
      { english: "It's cold. I will close the window.", japanese: "寒いですね。窓を閉めます。", note: "その場で決めた" },
      { english: "I am going to visit Kyoto next month.", japanese: "来月、京都を訪れる予定です。", note: "前から決まっている予定" },
      { english: "Look at those clouds. It is going to rain.", japanese: "あの雲を見て。雨が降りそうです。", note: "今の様子からの予測" },
      { english: "I will call you when I arrive.", japanese: "着いたら電話します。", note: "when の中は現在形 arrive" }
    ],
    mistakes: [
      { wrong: "I will to go there.", right: "I will go there.", why: "will の後ろは動詞の原形。to は要らない。" },
      { wrong: "If it will rain, I will stay home.", right: "If it rains, I will stay home.", why: "条件を表す if の中は現在形にする。" },
      { wrong: "I am going to buy it tomorrow, I decided now.", right: "I will buy it tomorrow.", why: "今決めたことなら will が自然。" }
    ],
    questions: [
      {
        question: "We [_____] leave as soon as the rain stops.",
        options: ["will", "are go to", "will to", "going to"],
        correctIndex: 0,
        explanation: "will + 原形。as soon as の中は現在形 stops になっている点も確認する。"
      },
      {
        question: "Please tell me when he [_____] back.",
        options: ["will come", "comes", "will comes", "coming"],
        correctIndex: 1,
        explanation: "時を表す when の節の中では、未来のことでも現在形を使う。"
      },
      {
        question: "She has already bought the ticket. She [_____] the concert.",
        options: ["will attend", "is going to attend", "attends", "attended"],
        correctIndex: 1,
        explanation: "すでにチケットを買っていて予定が決まっているので be going to。"
      }
    ]
  },
  {
    id: "g_modal",
    level: "junior",
    category: "動詞の形",
    title: "助動詞（can, may, must, should）",
    summary: "助動詞は動詞に意味を足す。後ろは必ず原形で、-s も付かない。",
    sections: [
      {
        heading: "助動詞の後ろは原形",
        body: "主語が三人称単数でも、助動詞の後ろの動詞に -s は付かない。助動詞自体も形を変えない。"
      },
      {
        heading: "それぞれの意味",
        body: "can は「できる・してもよい」、may は「してもよい・かもしれない」、must は「しなければならない・にちがいない」、should は「したほうがよい」。"
      },
      {
        heading: "否定にすると意味が大きく変わる",
        body: "must not は「してはいけない」という強い禁止、don't have to は「しなくてよい」という不要を表す。日本語ではどちらも「〜しなくていい」と訳しがちなので区別する。"
      }
    ],
    examples: [
      { english: "She can play the piano.", japanese: "彼女はピアノを弾けます。", note: "can の後ろは原形。cans とはならない" },
      { english: "You must not touch this machine.", japanese: "この機械に触れてはいけません。", note: "強い禁止" },
      { english: "You don't have to come tomorrow.", japanese: "明日は来なくてもかまいません。", note: "不要。禁止ではない" },
      { english: "He must be tired.", japanese: "彼は疲れているにちがいありません。", note: "強い推量の must" }
    ],
    mistakes: [
      { wrong: "He can plays tennis.", right: "He can play tennis.", why: "助動詞の後ろは原形。" },
      { wrong: "You must not to go.", right: "You must not go.", why: "助動詞の後ろは原形なので to は付けない。" },
      { wrong: "You mustn't answer if you don't want.", right: "You don't have to answer if you don't want to.", why: "「答えなくてよい」は不要を表す don't have to。" }
    ],
    questions: [
      {
        question: "You [_____] wear a helmet here. It is a rule.",
        options: ["must", "don't have to", "may not", "can"],
        correctIndex: 0,
        explanation: "規則なので「しなければならない」の must。"
      },
      {
        question: "It [_____] rain later. Take an umbrella.",
        options: ["must", "may", "should", "can"],
        correctIndex: 1,
        explanation: "「かもしれない」という可能性を表す may。"
      },
      {
        question: "You [_____] hurry. We still have an hour.",
        options: ["must not", "don't have to", "should not have to", "can not"],
        correctIndex: 1,
        explanation: "「急ぐ必要はない」という不要なので don't have to。must not は禁止になってしまう。"
      }
    ]
  },
  {
    id: "g_question",
    level: "junior",
    category: "文の組み立て",
    title: "疑問文と否定文の作り方",
    summary: "be動詞の文は語順を入れかえ、一般動詞の文は do / does / did を借りてくる。",
    sections: [
      {
        heading: "be動詞・助動詞がある文",
        body: "その語を主語の前に出せば疑問文になり、後ろに not を付ければ否定文になる。新しい語を足す必要はない。"
      },
      {
        heading: "一般動詞の文",
        body: "文の中に助けになる語が無いので、do / does / did を借りてくる。借りた時点で人称と時制はそちらが背負うため、動詞は原形に戻る。"
      },
      {
        heading: "答え方",
        body: "Yes / No で答えるときは、質問に使われた語をそのまま使う。Do you 〜? には Yes, I do.、Is he 〜? には Yes, he is. と返す。"
      }
    ],
    examples: [
      { english: "Are you a student?", japanese: "あなたは学生ですか。", note: "be動詞を前に出す" },
      { english: "Does she live near here?", japanese: "彼女はこの近くに住んでいますか。", note: "does を借り、動詞は原形 live" },
      { english: "I do not eat meat.", japanese: "私は肉を食べません。", note: "一般動詞の否定は do not" },
      { english: "Did they win the game?", japanese: "彼らは試合に勝ちましたか。", note: "did を借りたので win は原形" }
    ],
    mistakes: [
      { wrong: "Do you are busy?", right: "Are you busy?", why: "be動詞がある文に do は要らない。" },
      { wrong: "Does he plays soccer?", right: "Does he play soccer?", why: "does を借りた時点で三単現は済んでいるので原形。" },
      { wrong: "Do you like it? — Yes, I like.", right: "Do you like it? — Yes, I do.", why: "答えでは質問に使われた do をそのまま使う。" }
    ],
    questions: [
      {
        question: "[_____] your sister go to college?",
        options: ["Do", "Does", "Is", "Are"],
        correctIndex: 1,
        explanation: "一般動詞 go の疑問文で主語が三人称単数なので Does。"
      },
      {
        question: "[_____] they at home yesterday?",
        options: ["Did", "Do", "Were", "Was"],
        correctIndex: 2,
        explanation: "be動詞の過去で主語が複数なので Were。"
      },
      {
        question: "He [_____] have any brothers.",
        options: ["isn't", "don't", "doesn't", "not"],
        correctIndex: 2,
        explanation: "一般動詞 have の否定で主語が三人称単数なので doesn't。"
      }
    ]
  },
  {
    id: "g_wh",
    level: "junior",
    category: "文の組み立て",
    title: "疑問詞のある疑問文",
    summary: "疑問詞を文の先頭に置き、その後ろは疑問文の語順にする。",
    sections: [
      {
        heading: "基本の形",
        body: "what（何）、who（誰）、when（いつ）、where（どこ）、why（なぜ）、how（どのように）を先頭に置き、その後ろは Yes / No 疑問文と同じ語順にする。"
      },
      {
        heading: "疑問詞が主語のときは語順を変えない",
        body: "Who came here? のように疑問詞そのものが主語になっている場合、do / does は使わず、そのまま動詞を続ける。"
      },
      {
        heading: "how と組み合わせる表現",
        body: "how many（いくつ）、how much（いくら・どれだけ）、how long（どのくらいの長さ・期間）、how often（どのくらいの頻度で）のように、how の後ろに語を足して尋ねる範囲を絞る。"
      }
    ],
    examples: [
      { english: "Where do you live?", japanese: "どこに住んでいますか。", note: "疑問詞 + do + 主語 + 原形" },
      { english: "Who broke this window?", japanese: "誰がこの窓を割ったのですか。", note: "who が主語なので did は使わない" },
      { english: "How many books do you have?", japanese: "本を何冊持っていますか。", note: "how many + 複数名詞" },
      { english: "How long have you studied English?", japanese: "どのくらいの期間、英語を勉強していますか。", note: "期間を尋ねる how long" }
    ],
    mistakes: [
      { wrong: "Where you live?", right: "Where do you live?", why: "一般動詞の疑問文なので do が要る。" },
      { wrong: "Who did break the window?", right: "Who broke the window?", why: "who が主語なので did を使わずそのまま過去形にする。" },
      { wrong: "How many book do you have?", right: "How many books do you have?", why: "how many の後ろは複数形。" }
    ],
    questions: [
      {
        question: "[_____] does this bag cost?",
        options: ["How many", "How much", "How long", "How often"],
        correctIndex: 1,
        explanation: "値段を尋ねるので How much。"
      },
      {
        question: "[_____] wants to join us?",
        options: ["Who", "Who does", "Whom", "Who do"],
        correctIndex: 0,
        explanation: "who が主語なので、そのまま動詞 wants が続く。"
      },
      {
        question: "[_____] did you go to the station?",
        options: ["What", "Who", "How", "Which"],
        correctIndex: 2,
        explanation: "手段を尋ねる How（例: by bus）。"
      }
    ]
  },
  {
    id: "g_imperative",
    level: "junior",
    category: "文の組み立て",
    title: "命令文・感嘆文・提案の表現",
    summary: "命令文は主語を省いて動詞で始める。感嘆文は What / How で始める。",
    sections: [
      {
        heading: "命令文は動詞の原形から始める",
        body: "相手（you）が明らかなので主語を書かない。否定の命令は Don't で始める。please を付けると丁寧になる。"
      },
      {
        heading: "誘う・提案する言い方",
        body: "Let's + 原形 で「〜しましょう」、Shall we 〜? で「〜しませんか」、Why don't we 〜? で「〜しませんか」と誘える。"
      },
      {
        heading: "感嘆文は名詞なら What、形容詞・副詞なら How",
        body: "What a beautiful garden! のように名詞のかたまりが続くなら What、How beautiful! のように形容詞や副詞が続くなら How で始める。"
      }
    ],
    examples: [
      { english: "Open the window, please.", japanese: "窓を開けてください。", note: "原形で始める" },
      { english: "Don't be afraid.", japanese: "怖がらないで。", note: "be動詞の否定命令は Don't be" },
      { english: "Let's take a break.", japanese: "休憩しましょう。", note: "Let's + 原形" },
      { english: "What a beautiful garden this is!", japanese: "なんて美しい庭でしょう。", note: "名詞が続くので What" }
    ],
    mistakes: [
      { wrong: "You open the window, please.", right: "Open the window, please.", why: "命令文では主語を書かない。" },
      { wrong: "Let's to go.", right: "Let's go.", why: "Let's の後ろは原形。to は要らない。" },
      { wrong: "How a beautiful garden!", right: "What a beautiful garden!", why: "名詞のかたまりが続くので What。" }
    ],
    questions: [
      {
        question: "[_____] late for the meeting.",
        options: ["Not be", "Don't be", "Doesn't be", "No be"],
        correctIndex: 1,
        explanation: "be動詞の否定命令は Don't be。"
      },
      {
        question: "[_____] fast he runs!",
        options: ["What", "What a", "How", "How a"],
        correctIndex: 2,
        explanation: "副詞 fast が続くので How。"
      },
      {
        question: "[_____] we meet at six?",
        options: ["Let's", "Shall", "Why don't", "How about"],
        correctIndex: 1,
        explanation: "Shall we 〜? で「〜しませんか」と誘う。"
      }
    ]
  },
  {
    id: "g_there_is",
    level: "junior",
    category: "文の組み立て",
    title: "There is / There are",
    summary: "「〜がある・いる」と存在を伝える形。be動詞は後ろの名詞に合わせる。",
    sections: [
      {
        heading: "There に「そこ」の意味は無い",
        body: "この there は文を始めるための語で、場所の意味は持たない。実際の主語は be動詞の後ろに来る名詞なので、単数なら is、複数なら are を使う。"
      },
      {
        heading: "特定のものには使わない",
        body: "There is 〜 は聞き手がまだ知らないものを話に出すときの形。すでにどれか分かっているものについては、ふつうの文で言う（Your bag is on the table.）。"
      },
      {
        heading: "過去・疑問・否定",
        body: "過去なら There was / There were、疑問文は Is there 〜? / Are there 〜?、否定は There is no 〜 または There isn't any 〜 とする。"
      }
    ],
    examples: [
      { english: "There is a cat under the table.", japanese: "テーブルの下に猫が1匹います。", note: "後ろが単数なので is" },
      { english: "There are some books on the desk.", japanese: "机の上に本が何冊かあります。", note: "後ろが複数なので are" },
      { english: "Were there many people at the concert?", japanese: "コンサートには人がたくさんいましたか。", note: "過去の疑問文" },
      { english: "There is no time left.", japanese: "残された時間はありません。", note: "no を使った否定" }
    ],
    mistakes: [
      { wrong: "There is many students.", right: "There are many students.", why: "後ろの名詞が複数なので are。" },
      { wrong: "There is your bag on the table.", right: "Your bag is on the table.", why: "特定のものには There is を使わない。" },
      { wrong: "There has a park near my house.", right: "There is a park near my house.", why: "存在を表すのは there is。have は使わない。" }
    ],
    questions: [
      {
        question: "[_____] a lot of water in the bottle.",
        options: ["There is", "There are", "There have", "It is"],
        correctIndex: 0,
        explanation: "water は数えられない名詞なので is を使う。"
      },
      {
        question: "[_____] any messages for me?",
        options: ["Is there", "Are there", "There is", "Have there"],
        correctIndex: 1,
        explanation: "messages が複数なので Are there。"
      },
      {
        question: "[_____] thirty students in this class last year.",
        options: ["There is", "There was", "There were", "There are"],
        correctIndex: 2,
        explanation: "過去で複数なので There were。"
      }
    ]
  },
  {
    id: "g_conjunction",
    level: "junior",
    category: "文をつなぐ",
    title: "接続詞（and, but, because, when, if, that）",
    summary: "語と語、文と文をつなぐ。つないだ先の文にも主語と動詞が要る。",
    sections: [
      {
        heading: "対等につなぐ接続詞",
        body: "and（そして）、but（しかし）、or（または）、so（だから）は、同じ働きのものどうしを対等につなぐ。"
      },
      {
        heading: "主従をつくる接続詞",
        body: "because（〜なので）、when（〜のとき）、if（もし〜なら）、although（〜だけれども）、that（〜ということ）は、片方の文をもう片方に従える。前に置いても後ろに置いてもよいが、前に置いたときはコンマで区切る。"
      },
      {
        heading: "日本語との違いに注意する",
        body: "日本語の「〜なので、…」は because を文頭に置いて1文にできるが、Because 〜. だけで文を終えることはできない。また、but と although を同時に使わない。"
      }
    ],
    examples: [
      { english: "I was tired, so I went to bed early.", japanese: "疲れていたので、早く寝ました。", note: "so は結果をつなぐ" },
      { english: "Because it was raining, we stayed home.", japanese: "雨が降っていたので、家にいました。", note: "前に置いたのでコンマで区切る" },
      { english: "I think that he is right.", japanese: "彼は正しいと思います。", note: "that 以下がひとかたまりの内容" },
      { english: "Although he was tired, he kept working.", japanese: "疲れていたけれども、彼は働き続けました。", note: "although の文に but は付けない" }
    ],
    mistakes: [
      { wrong: "I couldn't come. Because I was sick.", right: "I couldn't come because I was sick.", why: "because の部分だけでは文にならない。前の文につなぐ。" },
      { wrong: "Although he was tired, but he kept working.", right: "Although he was tired, he kept working.", why: "although と but は重ねて使わない。" },
      { wrong: "I know he is honest man.", right: "I know that he is an honest man.", why: "that は省略できるが、冠詞 an は省略できない。" }
    ],
    questions: [
      {
        question: "I stayed home [_____] I had a cold.",
        options: ["so", "because", "but", "although"],
        correctIndex: 1,
        explanation: "後ろが理由なので because。"
      },
      {
        question: "[_____] he studied hard, he failed the exam.",
        options: ["Because", "So", "Although", "If"],
        correctIndex: 2,
        explanation: "「〜だけれども」と譲歩を表すので Although。"
      },
      {
        question: "Call me [_____] you get home.",
        options: ["when", "that", "so", "but"],
        correctIndex: 0,
        explanation: "「〜したとき」と時を表すので when。"
      }
    ]
  },
  {
    id: "g_preposition",
    level: "junior",
    category: "名詞のあつかい",
    title: "前置詞（時・場所）",
    summary: "at は点、on は接している面や日付、in は広がりや内側。",
    sections: [
      {
        heading: "時を表すとき",
        body: "at は時刻など「点」（at seven）、on は日付や曜日（on Monday）、in は月・年・季節など幅のある期間（in April）に使う。"
      },
      {
        heading: "場所を表すとき",
        body: "at は地点（at the station）、on は面に接していること（on the wall）、in は囲まれた内側（in the box）を表す。"
      },
      {
        heading: "前置詞の後ろは名詞のかたまり",
        body: "動詞を続けたいときは動名詞（-ing）にする。to 不定詞は置けない。"
      }
    ],
    examples: [
      { english: "The meeting starts at ten on Monday.", japanese: "会議は月曜の10時に始まります。", note: "時刻は at、曜日は on" },
      { english: "There is a picture on the wall.", japanese: "壁に絵がかかっています。", note: "面に接しているので on" },
      { english: "She was born in 2005.", japanese: "彼女は2005年に生まれました。", note: "年には in" },
      { english: "Thank you for helping me.", japanese: "手伝ってくれてありがとう。", note: "前置詞 for の後ろは動名詞" }
    ],
    mistakes: [
      { wrong: "I will see you in Monday.", right: "I will see you on Monday.", why: "曜日には on を使う。" },
      { wrong: "I'm looking forward to see you.", right: "I'm looking forward to seeing you.", why: "この to は前置詞なので後ろは動名詞。" },
      { wrong: "He arrived to the station.", right: "He arrived at the station.", why: "arrive は at / in をとる。to は使わない。" }
    ],
    questions: [
      {
        question: "The train leaves [_____] 6:30.",
        options: ["in", "on", "at", "for"],
        correctIndex: 2,
        explanation: "時刻という「点」なので at。"
      },
      {
        question: "She is good [_____] playing the guitar.",
        options: ["at", "in", "on", "to"],
        correctIndex: 0,
        explanation: "be good at 〜ing で「〜が得意だ」。"
      },
      {
        question: "We stayed [_____] Tokyo for three days.",
        options: ["at", "in", "on", "to"],
        correctIndex: 1,
        explanation: "都市のような広がりのある場所には in。"
      }
    ]
  },
  {
    id: "g_adj_adv",
    level: "junior",
    category: "名詞のあつかい",
    title: "形容詞と副詞の置き場所",
    summary: "形容詞は名詞を、副詞は動詞・形容詞・文全体を説明する。",
    sections: [
      {
        heading: "形容詞は名詞の前か be動詞の後ろ",
        body: "a big dog のように名詞の前に置くか、The dog is big. のように be動詞の後ろに置く。日本語の「大きい犬」と語順が同じなので前者は迷いにくい。"
      },
      {
        heading: "副詞は動詞を説明する",
        body: "多くは形容詞に -ly を付けて作る（careful → carefully）。頻度を表す副詞（always, usually, often, sometimes, never）は一般動詞の前、be動詞の後ろに置く。"
      },
      {
        heading: "形が同じで意味が違う語に注意",
        body: "hard は形容詞「難しい・熱心な」と副詞「熱心に」の両方で使うが、hardly は「ほとんど〜ない」という別の意味になる。"
      }
    ],
    examples: [
      { english: "He is a careful driver.", japanese: "彼は慎重な運転手です。", note: "名詞 driver を説明する形容詞" },
      { english: "He drives carefully.", japanese: "彼は慎重に運転します。", note: "動詞 drives を説明する副詞" },
      { english: "She is always kind to us.", japanese: "彼女はいつも私たちに親切です。", note: "be動詞の後ろに always" },
      { english: "I hardly know him.", japanese: "私は彼をほとんど知りません。", note: "hardly は「ほとんど〜ない」" }
    ],
    mistakes: [
      { wrong: "He speaks English very good.", right: "He speaks English very well.", why: "動詞 speaks を説明するので副詞 well。" },
      { wrong: "She always is late.", right: "She is always late.", why: "頻度の副詞は be動詞の後ろ。" },
      { wrong: "He worked hardly.", right: "He worked hard.", why: "hardly は「ほとんど〜ない」で意味が逆になる。" }
    ],
    questions: [
      {
        question: "The test was [_____] difficult.",
        options: ["extreme", "extremely", "extremeness", "more extreme"],
        correctIndex: 1,
        explanation: "形容詞 difficult を説明するので副詞 extremely。"
      },
      {
        question: "I [_____] go to bed before eleven.",
        options: ["am usually", "usually", "usual", "usually am"],
        correctIndex: 1,
        explanation: "一般動詞 go の前に頻度の副詞を置く。"
      },
      {
        question: "She sings very [_____].",
        options: ["beautiful", "beautifully", "beauty", "more beautiful"],
        correctIndex: 1,
        explanation: "動詞 sings を説明するので副詞 beautifully。"
      }
    ]
  },

  // ===== 中級1（高校1年） =========================================
  {
    id: "g_sentence_patterns",
    level: "senior",
    category: "文の組み立て",
    title: "5つの文型（SV / SVC / SVO / SVOO / SVOC）",
    summary: "英文はこの5つの骨組みでできている。動詞ごとにとれる形が決まっている。",
    verbFrames: [1, 2, 6, 7, 8, 9, 14, 15, 5],
    sections: [
      {
        heading: "文型とは動詞のとる形のこと",
        body: "英語は語順で意味が決まるので、動詞の後ろに何がいくつ来るかが読解の手がかりになる。第1文型 SV（主語＋動詞）、第2文型 SVC（主語＝補語）、第3文型 SVO（目的語が1つ）、第4文型 SVOO（目的語が2つ）、第5文型 SVOC（目的語＝補語）の5つに分けるのが一般的である。"
      },
      {
        heading: "SVC と SVO の見分け方",
        body: "動詞の後ろの語が主語とイコールで結べるなら補語（SVC）、結べないなら目的語（SVO）である。He became a teacher.（彼＝先生）は SVC、He met a teacher.（彼≠先生）は SVO。"
      },
      {
        heading: "SVOO は「人にものを」の順",
        body: "give, tell, show, send, teach, buy などがこの形をとる。前置詞を使って書き換えると give something to someone、buy something for someone のようになり、動詞によって to と for が分かれる。"
      },
      {
        heading: "SVOC は「OをCの状態にする」",
        body: "make, call, keep, find, leave などがこの形をとる。O と C の間にイコールの関係がある。We call him Ken.（彼＝Ken）"
      }
    ],
    examples: [
      { english: "The sun rises in the east.", japanese: "太陽は東から昇ります。", note: "SV。in the east は修飾語" },
      { english: "She became a doctor.", japanese: "彼女は医者になりました。", note: "SVC。彼女＝医者" },
      { english: "He gave me a present.", japanese: "彼は私にプレゼントをくれました。", note: "SVOO。me が人、a present がもの" },
      { english: "The news made us happy.", japanese: "その知らせは私たちを幸せにしました。", note: "SVOC。us＝happy" }
    ],
    mistakes: [
      { wrong: "He explained me the rule.", right: "He explained the rule to me.", why: "explain は SVOO をとらない。to を使う。" },
      { wrong: "She made me to clean the room.", right: "She made me clean the room.", why: "make が使役の意味のときは原形不定詞。" },
      { wrong: "I discussed about the problem.", right: "I discussed the problem.", why: "discuss は前置詞を挟まずに目的語をとる。" }
    ],
    questions: [
      {
        question: "My mother bought [_____].",
        options: ["me a new bag", "a new bag me", "to me a new bag", "for me a new bag"],
        correctIndex: 0,
        explanation: "SVOO は「人＋もの」の順。前置詞を使うなら bought a new bag for me となる。"
      },
      {
        question: "We found the movie [_____].",
        options: ["interestingly", "interesting", "to interest", "interest"],
        correctIndex: 1,
        explanation: "SVOC で the movie＝interesting なので形容詞。"
      },
      {
        question: "The soup [_____] delicious.",
        options: ["tastes", "tastes to", "is tasted", "tasting"],
        correctIndex: 0,
        explanation: "taste は SVC をとり、後ろに形容詞が続く。"
      }
    ]
  },
  {
    id: "g_present_perfect",
    level: "senior",
    category: "動詞の形",
    title: "現在完了（have + 過去分詞）",
    summary: "過去の出来事を「今とつなげて」語る形。過去形とは見ている位置が違う。",
    requires: ["g_past"],
    sections: [
      {
        heading: "現在完了は「今」の話である",
        body: "have + 過去分詞は、過去に起きたことが今どうなっているかを伝える。過去形が「そのときのこと」を切り離して語るのに対し、現在完了は今との結び付きを保つ。"
      },
      {
        heading: "3つの使い方",
        body: "完了「〜したところだ」（just, already, yet）、経験「〜したことがある」（ever, never, once, before）、継続「ずっと〜している」（for, since）。どれになるかは一緒に使う語で見分けられることが多い。"
      },
      {
        heading: "はっきりした過去の時点とは一緒に使えない",
        body: "yesterday, last year, in 2019, when I was a child のように過去の一点を指す語がある文では、現在完了ではなく過去形を使う。今と切り離された話になるためである。"
      },
      {
        heading: "have been to と have gone to",
        body: "have been to 〜 は「行ったことがある・行ってきたところだ」、have gone to 〜 は「行ってしまって今ここにいない」。"
      }
    ],
    examples: [
      { english: "I have just finished my homework.", japanese: "ちょうど宿題を終えたところです。", note: "完了" },
      { english: "Have you ever been to Australia?", japanese: "オーストラリアに行ったことがありますか。", note: "経験" },
      { english: "She has lived here for ten years.", japanese: "彼女はここに10年住んでいます。", note: "継続。for + 期間" },
      { english: "I have known him since 2015.", japanese: "2015年から彼を知っています。", note: "since + 起点" }
    ],
    mistakes: [
      { wrong: "I have seen him yesterday.", right: "I saw him yesterday.", why: "yesterday という過去の一点があるので過去形。" },
      { wrong: "She has lived here since ten years.", right: "She has lived here for ten years.", why: "期間の長さには for、起点には since。" },
      { wrong: "He has gone to Kyoto and he is here now.", right: "He has been to Kyoto.", why: "have gone to は「行ってしまって今いない」の意味。" }
    ],
    questions: [
      {
        question: "I [_____] my key. I can't open the door.",
        options: ["lose", "lost", "have lost", "was losing"],
        correctIndex: 2,
        explanation: "なくした結果として今開けられない。今とつながっているので現在完了。"
      },
      {
        question: "How long [_____] you known each other?",
        options: ["do", "did", "have", "are"],
        correctIndex: 2,
        explanation: "継続を尋ねる現在完了。"
      },
      {
        question: "He [_____] to Paris three years ago.",
        options: ["has gone", "went", "has been", "goes"],
        correctIndex: 1,
        explanation: "three years ago という過去の一点があるので過去形。"
      }
    ]
  },
  {
    id: "g_perfect_others",
    level: "senior",
    category: "動詞の形",
    title: "過去完了と未来完了",
    summary: "過去完了は「過去のある時点より前」、未来完了は「未来のある時点までに」。",
    requires: ["g_present_perfect"],
    sections: [
      {
        heading: "過去完了は時間の順序を示す",
        body: "had + 過去分詞。過去の出来事が2つあり、どちらが先かをはっきりさせたいときに、先に起きたほうを過去完了にする。順序が文脈から明らかなら過去形で済ませることも多い。"
      },
      {
        heading: "未来完了は締め切りを示す",
        body: "will have + 過去分詞。「来月までには終わっているだろう」のように、未来のある時点で完了している状態を表す。by 〜（〜までに）と一緒に使うことが多い。"
      },
      {
        heading: "完了進行形",
        body: "have been + ing で、その時点まで続いてきた動作を強調できる。継続の意味をより明確にしたいときに使う。"
      }
    ],
    examples: [
      { english: "The train had already left when I got to the station.", japanese: "駅に着いたときには、電車はもう出てしまっていました。", note: "着く前に出発した" },
      { english: "I had never seen snow before I visited Hokkaido.", japanese: "北海道を訪れるまで、雪を見たことがありませんでした。", note: "過去のある時点までの経験" },
      { english: "By next April, I will have studied English for ten years.", japanese: "来年の4月で、英語を10年間勉強したことになります。", note: "未来完了" },
      { english: "She has been waiting for two hours.", japanese: "彼女は2時間ずっと待っています。", note: "現在完了進行形" }
    ],
    mistakes: [
      { wrong: "When I arrived, he already left.", right: "When I arrived, he had already left.", why: "到着より前の出来事なので過去完了。" },
      { wrong: "I will have finished it by the time you will come.", right: "I will have finished it by the time you come.", why: "時を表す節の中は未来でも現在形。" },
      { wrong: "I have been knowing her for years.", right: "I have known her for years.", why: "know は状態動詞なので進行形にしない。" }
    ],
    questions: [
      {
        question: "She said she [_____] the book before.",
        options: ["reads", "has read", "had read", "will read"],
        correctIndex: 2,
        explanation: "said より前のことなので過去完了。"
      },
      {
        question: "By the end of this year, we [_____] here for five years.",
        options: ["live", "lived", "have lived", "will have lived"],
        correctIndex: 3,
        explanation: "未来の時点までの継続なので未来完了。"
      },
      {
        question: "I [_____] for an hour when he finally appeared.",
        options: ["waited", "have waited", "had been waiting", "will wait"],
        correctIndex: 2,
        explanation: "彼が現れるまで続いていた動作なので過去完了進行形。"
      }
    ]
  },
  {
    id: "g_passive",
    level: "senior",
    category: "動詞の形",
    title: "受動態（be + 過去分詞）",
    summary: "「される側」を主語にする形。誰がしたかを言う必要がないときに使う。",
    requires: ["g_sentence_patterns"],
    sections: [
      {
        heading: "作り方",
        body: "能動態の目的語を主語に置き、動詞を be + 過去分詞に変える。動作をした人を示したいときだけ by 〜 を足す。示す必要が無ければ書かないほうが自然である。"
      },
      {
        heading: "受動態が選ばれる理由",
        body: "誰がしたか分からない・言う必要がない・言いたくないとき、また話題の中心を「される側」に置きたいときに使う。学術的な文章や新聞でよく現れる。"
      },
      {
        heading: "目的語を持たない動詞は受動態にできない",
        body: "happen, occur, appear, rise のような自動詞には目的語が無いので受動態にならない。「その事故は起こられた」とは言えないのと同じである。"
      },
      {
        heading: "SVOO・SVOC の受動態",
        body: "目的語が2つある文はどちらも主語にできる（I was given a book. / A book was given to me.）。SVOC の受動態では補語がそのまま残る（He was called Ken.）。"
      }
    ],
    examples: [
      { english: "This temple was built in 1397.", japanese: "この寺は1397年に建てられました。", note: "誰が建てたかは重要でない" },
      { english: "English is spoken in many countries.", japanese: "英語は多くの国で話されています。", note: "by 〜 は不要" },
      { english: "I was given a nice present.", japanese: "私は素敵な贈り物をもらいました。", note: "SVOO の受動態" },
      { english: "The window was broken by someone.", japanese: "窓は誰かによって割られました。", note: "動作主を示す by" }
    ],
    mistakes: [
      { wrong: "The accident was happened last night.", right: "The accident happened last night.", why: "happen は自動詞なので受動態にできない。" },
      { wrong: "This book is wrote by him.", right: "This book was written by him.", why: "過去分詞は written。write - wrote - written。" },
      { wrong: "I was interested in the movie by it.", right: "I was interested in the movie.", why: "be interested in は決まった形で、by は不要。" }
    ],
    questions: [
      {
        question: "The letter [_____] yesterday.",
        options: ["sent", "was sent", "was send", "is sent"],
        correctIndex: 1,
        explanation: "yesterday なので過去の受動態 was sent。"
      },
      {
        question: "A big earthquake [_____] in this area last year.",
        options: ["was occurred", "occurred", "is occurred", "has been occurred"],
        correctIndex: 1,
        explanation: "occur は自動詞なので受動態にしない。"
      },
      {
        question: "This song [_____] by young people.",
        options: ["is loving", "loves", "is loved", "was loving"],
        correctIndex: 2,
        explanation: "「愛されている」なので現在の受動態。"
      }
    ]
  },
  {
    id: "g_infinitive",
    level: "senior",
    category: "動詞から作る形",
    title: "不定詞（to + 動詞の原形）",
    summary: "名詞・形容詞・副詞のどれとして働いているかを見分ける。",
    verbFrames: [28, 24, 32],
    sections: [
      {
        heading: "名詞的用法",
        body: "「〜すること」。主語・目的語・補語になる。To read books is fun. のように主語に置くと頭でっかちになるため、It is fun to read books. と it で受ける形がよく使われる。"
      },
      {
        heading: "形容詞的用法",
        body: "「〜するための・〜すべき」。直前の名詞を後ろから説明する。something to drink（飲むための何か）のように、-thing で終わる語との組み合わせが多い。"
      },
      {
        heading: "副詞的用法",
        body: "目的「〜するために」、結果「〜してその結果」、感情の原因「〜して」、判断の根拠「〜するとは」を表す。目的をはっきりさせたいときは in order to を使う。"
      },
      {
        heading: "意味上の主語と否定",
        body: "誰がするのかを示すには for 〜 を前に置く（It is difficult for me to swim.）。人の性質を評価する文では of を使う（It is kind of you to help me.）。否定は not to 〜 と、to の前に not を置く。"
      }
    ],
    examples: [
      { english: "It is important to keep your promise.", japanese: "約束を守ることは大切です。", note: "名詞的用法。it が形式主語" },
      { english: "I want something to eat.", japanese: "何か食べるものがほしいです。", note: "形容詞的用法" },
      { english: "She went to the station to meet her friend.", japanese: "彼女は友達に会うために駅へ行きました。", note: "副詞的用法（目的）" },
      { english: "He told me not to worry.", japanese: "彼は私に心配しないように言いました。", note: "否定は not to" }
    ],
    mistakes: [
      { wrong: "It is difficult of me to answer.", right: "It is difficult for me to answer.", why: "難易を表す形容詞では for を使う。of は人の性質を評価するとき。" },
      { wrong: "I want that you come.", right: "I want you to come.", why: "want は that節をとらず、want 人 to 〜 の形をとる。" },
      { wrong: "He decided to not go.", right: "He decided not to go.", why: "not は to の前に置く。" }
    ],
    questions: [
      {
        question: "I have a lot of work [_____] today.",
        options: ["do", "to do", "doing", "done"],
        correctIndex: 1,
        explanation: "work を後ろから説明する形容詞的用法。"
      },
      {
        question: "It was careless [_____] to leave the door open.",
        options: ["for him", "of him", "to him", "by him"],
        correctIndex: 1,
        explanation: "careless は人の性質を評価する形容詞なので of。"
      },
      {
        question: "She grew up [_____] a famous pianist.",
        options: ["to become", "becoming", "to becoming", "become"],
        correctIndex: 0,
        explanation: "「成長して〜になった」という結果を表す副詞的用法。"
      }
    ]
  },
  {
    id: "g_gerund",
    level: "senior",
    category: "動詞から作る形",
    title: "動名詞（-ing）と、不定詞との使い分け",
    summary: "動詞を名詞のように使う形。どちらをとるかは動詞ごとに決まっている。",
    verbFrames: [33],
    requires: ["g_infinitive"],
    sections: [
      {
        heading: "動名詞は名詞と同じ場所に置ける",
        body: "主語・目的語・補語になり、前置詞の後ろにも置ける。前置詞の後ろに to 不定詞は置けないので、この点で不定詞と区別がはっきりする。"
      },
      {
        heading: "動名詞だけをとる動詞",
        body: "enjoy, finish, stop, mind, avoid, give up, practice, admit などは動名詞をとる。すでに始まっている・経験していることに向くと考えると覚えやすい。"
      },
      {
        heading: "不定詞だけをとる動詞",
        body: "want, hope, decide, promise, expect, plan, refuse などは不定詞をとる。これから先のことに向く動詞である。"
      },
      {
        heading: "どちらもとるが意味が変わる動詞",
        body: "remember / forget / try / stop は使い分けで意味が変わる。remember to do は「これからすることを覚えている」、remember doing は「したことを覚えている」。stop to do は「〜するために立ち止まる」、stop doing は「〜するのをやめる」。"
      }
    ],
    examples: [
      { english: "I enjoy reading before bed.", japanese: "寝る前に読書を楽しみます。", note: "enjoy は動名詞をとる" },
      { english: "He decided to study abroad.", japanese: "彼は留学することに決めました。", note: "decide は不定詞をとる" },
      { english: "She is good at solving problems.", japanese: "彼女は問題を解くのが得意です。", note: "前置詞 at の後ろは動名詞" },
      { english: "Remember to lock the door.", japanese: "ドアに鍵をかけるのを忘れないでね。", note: "これからすること" }
    ],
    mistakes: [
      { wrong: "I enjoyed to talk with you.", right: "I enjoyed talking with you.", why: "enjoy は動名詞をとる。" },
      { wrong: "He is interested in to learn Japanese.", right: "He is interested in learning Japanese.", why: "前置詞の後ろは動名詞。" },
      { wrong: "I stopped to smoke last year.", right: "I stopped smoking last year.", why: "「やめた」なら stop doing。stop to do は「〜するために立ち止まる」。" }
    ],
    questions: [
      {
        question: "Would you mind [_____] the window?",
        options: ["to open", "opening", "open", "opened"],
        correctIndex: 1,
        explanation: "mind は動名詞をとる。"
      },
      {
        question: "I'll never forget [_____] you for the first time.",
        options: ["to meet", "meeting", "met", "to meeting"],
        correctIndex: 1,
        explanation: "「会ったこと」という過去の経験なので動名詞。"
      },
      {
        question: "They promised [_____] on time.",
        options: ["coming", "to come", "come", "to coming"],
        correctIndex: 1,
        explanation: "promise はこれからのことを表す不定詞をとる。"
      }
    ]
  },
  {
    id: "g_participle",
    level: "senior",
    category: "動詞から作る形",
    title: "分詞の形容詞用法（-ing と -ed）",
    summary: "現在分詞は「している」、過去分詞は「される・された」。名詞を説明する。",
    sections: [
      {
        heading: "1語なら前、2語以上なら後ろ",
        body: "a sleeping baby のように分詞1語なら名詞の前、the baby sleeping in the bed のように語句が続くなら名詞の後ろに置く。"
      },
      {
        heading: "-ing と -ed の向きの違い",
        body: "exciting は「（周りを）わくわくさせる」、excited は「（自分が）わくわくしている」。感情を表す動詞では、ものには -ing、人には -ed が付くことが多い。"
      },
      {
        heading: "後置修飾は関係代名詞の短縮と考えられる",
        body: "the man standing there は the man who is standing there と同じ内容で、who is が省かれた形と見ることができる。長文ではこの形が頻繁に現れる。"
      }
    ],
    examples: [
      { english: "Look at the running boy.", japanese: "走っている少年を見て。", note: "1語なので前に置く" },
      { english: "The language spoken in Brazil is Portuguese.", japanese: "ブラジルで話されている言語はポルトガル語です。", note: "語句が続くので後ろに置く" },
      { english: "The movie was exciting.", japanese: "その映画はわくわくするものでした。", note: "映画が周りを興奮させる" },
      { english: "I was excited about the news.", japanese: "私はその知らせにわくわくしました。", note: "自分が興奮している" }
    ],
    mistakes: [
      { wrong: "I was very boring during the class.", right: "I was very bored during the class.", why: "自分が退屈していたので -ed。-ing だと「私は退屈な人間だ」になる。" },
      { wrong: "The man standing is my teacher there.", right: "The man standing there is my teacher.", why: "説明する語句は名詞の直後にまとめて置く。" },
      { wrong: "This is a book writing by him.", right: "This is a book written by him.", why: "本は「書かれる」側なので過去分詞。" }
    ],
    questions: [
      {
        question: "The results were [_____].",
        options: ["surprising", "surprised", "surprise", "to surprise"],
        correctIndex: 0,
        explanation: "結果が人を驚かせるので -ing。"
      },
      {
        question: "Who is the girl [_____] the piano?",
        options: ["play", "played", "playing", "to play"],
        correctIndex: 2,
        explanation: "「ピアノを弾いている少女」なので現在分詞。"
      },
      {
        question: "I found a wallet [_____] on the street.",
        options: ["leaving", "left", "leave", "to leave"],
        correctIndex: 1,
        explanation: "財布は「置き去りにされた」側なので過去分詞。"
      }
    ]
  },
  {
    id: "g_comparison",
    level: "senior",
    category: "名詞のあつかい",
    title: "比較（原級・比較級・最上級）",
    summary: "as 〜 as で同じくらい、-er / more で比べ、-est / most でいちばん。",
    sections: [
      {
        heading: "3つの形",
        body: "原級 as + 原級 + as（同じくらい）、比較級 -er / more + than（より〜）、最上級 the + -est / most（いちばん〜）。短い語には -er / -est、長い語には more / most を使う。"
      },
      {
        heading: "比較の対象をそろえる",
        body: "比べるものどうしは同じ種類にする。「東京の人口は大阪より多い」は The population of Tokyo is larger than that of Osaka. のように that of を使って、人口と人口を比べる形にする。"
      },
      {
        heading: "程度を表す語を足す",
        body: "比較級を強めるには much, far, a lot を使う。very は比較級を修飾できない。"
      },
      {
        heading: "よく使う言い回し",
        body: "the + 比較級, the + 比較級（〜すればするほど…）、比較級 + and + 比較級（ますます〜）、one of the + 最上級 + 複数名詞（最も〜なもののひとつ）。"
      }
    ],
    examples: [
      { english: "This bag is as heavy as that one.", japanese: "このかばんはあれと同じくらい重いです。", note: "原級。as と as の間は原級" },
      { english: "Today is much colder than yesterday.", japanese: "今日は昨日よりずっと寒いです。", note: "much が比較級を強める" },
      { english: "He is one of the best players in the team.", japanese: "彼はチームで最もよい選手のひとりです。", note: "後ろは複数形 players" },
      { english: "The more you practice, the better you become.", japanese: "練習すればするほど上達します。", note: "the + 比較級, the + 比較級" }
    ],
    mistakes: [
      { wrong: "This is more better than that.", right: "This is much better than that.", why: "better はすでに比較級なので more は付けない。" },
      { wrong: "She is very taller than me.", right: "She is much taller than me.", why: "very は比較級を修飾できない。" },
      { wrong: "He is one of the best player.", right: "He is one of the best players.", why: "one of の後ろは複数形。" }
    ],
    questions: [
      {
        question: "This question is [_____] difficult as that one.",
        options: ["so", "as", "more", "than"],
        correctIndex: 1,
        explanation: "as + 原級 + as で同程度を表す。"
      },
      {
        question: "Health is [_____] important than money.",
        options: ["much", "very", "far more", "the most"],
        correctIndex: 2,
        explanation: "important は長い語なので more、それを far が強める。"
      },
      {
        question: "The population of Osaka is smaller than [_____] of Tokyo.",
        options: ["it", "that", "one", "this"],
        correctIndex: 1,
        explanation: "人口と人口を比べるので that of。"
      }
    ]
  },

  // ===== 中級2（高校2年） =========================================
  {
    id: "g_relative_pronoun",
    level: "senior2",
    category: "文をつなぐ",
    title: "関係代名詞（who / which / that / whose）",
    summary: "名詞を、文まるごとで後ろから説明する。長文を読む鍵になる形。",
    requires: ["g_participle"],
    sections: [
      {
        heading: "関係代名詞は接続詞と代名詞を兼ねる",
        body: "2つの文をつなぎ、同時に後ろの文の中で主語や目的語の役割も果たす。だから関係代名詞の後ろは、その分だけ語が欠けた形になる。この「欠け」を探すのが読解のこつである。"
      },
      {
        heading: "使い分け",
        body: "説明する名詞（先行詞）が人なら who、ものなら which、どちらでも that が使える。「〜の」にあたる所有格は人でもものでも whose。目的格の who(m) / which / that は省略できる。"
      },
      {
        heading: "主格は省略できない",
        body: "後ろの文で主語の役割をしている関係代名詞は省略できない。省略できるのは目的語の役割をしているときだけである。"
      },
      {
        heading: "コンマの有無で意味が変わる",
        body: "コンマなし（限定用法）は「どの〜か」を絞り込む。コンマあり（非限定用法）は補足の説明を足すだけで、絞り込みはしない。He has two sons who are doctors.（医者の息子が2人、他にもいるかもしれない）と He has two sons, who are doctors.（息子は2人で、2人とも医者）は内容が違う。"
      }
    ],
    examples: [
      { english: "I know a man who speaks five languages.", japanese: "私は5か国語を話す人を知っています。", note: "who の後ろは主語が欠けている" },
      { english: "This is the book (which) I bought yesterday.", japanese: "これは私が昨日買った本です。", note: "目的格なので省略できる" },
      { english: "I have a friend whose father is a pilot.", japanese: "父親がパイロットの友人がいます。", note: "所有格 whose" },
      { english: "My uncle, who lives in Osaka, is a doctor.", japanese: "私のおじは大阪に住んでいて、医者です。", note: "非限定用法。おじは1人" }
    ],
    mistakes: [
      { wrong: "The man who he helped me was kind.", right: "The man who helped me was kind.", why: "who がすでに主語なので he は要らない。" },
      { wrong: "This is the house which I live.", right: "This is the house which I live in.", why: "live in の in が残っている必要がある。または where を使う。" },
      { wrong: "My mother, that lives in Nara, is a teacher.", right: "My mother, who lives in Nara, is a teacher.", why: "非限定用法では that は使えない。" }
    ],
    questions: [
      {
        question: "The girl [_____] won the prize is my sister.",
        options: ["which", "who", "whose", "whom"],
        correctIndex: 1,
        explanation: "先行詞が人で、後ろの文の主語なので who。"
      },
      {
        question: "I met a boy [_____] name I couldn't remember.",
        options: ["who", "which", "whose", "that"],
        correctIndex: 2,
        explanation: "「その少年の名前」と所有の関係なので whose。"
      },
      {
        question: "This is the camera [_____] I've been looking for.",
        options: ["who", "what", "which", "whose"],
        correctIndex: 2,
        explanation: "先行詞がもので、for の目的語が欠けているので which。"
      }
    ]
  },
  {
    id: "g_relative_adverb",
    level: "senior2",
    category: "文をつなぐ",
    title: "関係副詞と、前置詞＋関係代名詞",
    summary: "後ろの文が完全なら関係副詞、語が欠けていれば関係代名詞。",
    requires: ["g_relative_pronoun"],
    sections: [
      {
        heading: "関係副詞は場所・時・理由・方法を受ける",
        body: "where（場所）、when（時）、why（理由）、how（方法）。関係代名詞と違い、後ろには語の欠けていない完全な文が続く。"
      },
      {
        heading: "前置詞＋関係代名詞に書き換えられる",
        body: "the town where I was born は the town in which I was born と同じ。前置詞が必要かどうかは、元の文で使う前置詞から決まる。"
      },
      {
        heading: "the way と how は重ねない",
        body: "「〜する方法」は the way か how のどちらか一方だけを使う。the way how とは言わない。"
      },
      {
        heading: "what は先行詞を含む",
        body: "what は「〜すること・もの」の意味で、それ自体に先行詞が含まれている。前に名詞は置かない。"
      }
    ],
    examples: [
      { english: "This is the town where I grew up.", japanese: "ここが私の育った町です。", note: "where の後ろは完全な文" },
      { english: "I remember the day when we first met.", japanese: "私たちが初めて会った日を覚えています。", note: "時を受ける when" },
      { english: "The house in which he lives is very old.", japanese: "彼が住んでいる家はとても古いです。", note: "前置詞 + 関係代名詞" },
      { english: "That is what I wanted to say.", japanese: "それが私の言いたかったことです。", note: "what は先行詞を含む" }
    ],
    mistakes: [
      { wrong: "This is the place which I met her.", right: "This is the place where I met her.", why: "後ろが完全な文なので関係副詞 where。" },
      { wrong: "Tell me the way how you solved it.", right: "Tell me how you solved it.", why: "the way と how は重ねない。" },
      { wrong: "This is the thing what I need.", right: "This is what I need.", why: "what は先行詞を含むので前に名詞を置かない。" }
    ],
    questions: [
      {
        question: "I don't know the reason [_____] he left so early.",
        options: ["which", "why", "what", "whose"],
        correctIndex: 1,
        explanation: "reason を受ける関係副詞は why。"
      },
      {
        question: "The building [_____] we had the meeting is new.",
        options: ["which", "that", "in which", "what"],
        correctIndex: 2,
        explanation: "後ろが完全な文なので in which（＝ where）。"
      },
      {
        question: "[_____] surprised me was his calm voice.",
        options: ["That", "Which", "What", "Who"],
        correctIndex: 2,
        explanation: "「私を驚かせたこと」という主語のかたまりを作るので what。"
      }
    ]
  },
  {
    id: "g_participle_construction",
    level: "senior2",
    category: "文をつなぐ",
    title: "分詞構文",
    summary: "接続詞と主語を省いて -ing で始める形。文章でよく使われる。",
    requires: ["g_participle"],
    sections: [
      {
        heading: "作り方",
        body: "接続詞を消し、副詞節の主語が主節と同じなら消し、動詞を -ing にする。When he saw me, he smiled. → Seeing me, he smiled."
      },
      {
        heading: "意味は文脈から決まる",
        body: "時「〜するとき」、理由「〜なので」、条件「〜すれば」、付帯状況「〜しながら」など、接続詞を消した分だけ意味は文脈に委ねられる。読むときは前後関係から補う。"
      },
      {
        heading: "受け身なら過去分詞で始める",
        body: "Being written in easy English, this book is popular. の Being は省略でき、Written in easy English, 〜 となる。長文で文頭の過去分詞を見たらこの形を疑う。"
      },
      {
        heading: "主語が違うときは残す（独立分詞構文）",
        body: "副詞節と主節で主語が違う場合は、分詞の前に主語を残す。It being rainy, we stayed home."
      }
    ],
    examples: [
      { english: "Walking along the street, I met an old friend.", japanese: "通りを歩いていると、旧友に会いました。", note: "時を表す" },
      { english: "Not knowing what to say, he kept silent.", japanese: "何を言えばよいか分からず、彼は黙っていました。", note: "否定は Not を前に置く" },
      { english: "Written in simple English, this book sells well.", japanese: "やさしい英語で書かれているので、この本はよく売れます。", note: "Being が省略された受け身" },
      { english: "The sun having set, we went home.", japanese: "日が沈んだので、私たちは帰宅しました。", note: "主語が違うので残す" }
    ],
    mistakes: [
      { wrong: "Looking out of the window, the mountain was beautiful.", right: "Looking out of the window, I saw a beautiful mountain.", why: "分詞の主語は主節の主語と同じになる。山が窓の外を見たことになってしまう。" },
      { wrong: "Knowing not the answer, he said nothing.", right: "Not knowing the answer, he said nothing.", why: "否定語は分詞の前に置く。" },
      { wrong: "Wrote in easy English, the book is popular.", right: "Written in easy English, the book is popular.", why: "受け身なので過去分詞。" }
    ],
    questions: [
      {
        question: "[_____] tired, she went to bed early.",
        options: ["Feel", "Feeling", "Felt", "To feel"],
        correctIndex: 1,
        explanation: "「疲れを感じて」と能動なので現在分詞。"
      },
      {
        question: "[_____] from a distance, it looks like a face.",
        options: ["Seeing", "Seen", "To see", "See"],
        correctIndex: 1,
        explanation: "「見られると」と受け身なので過去分詞。"
      },
      {
        question: "[_____] no bus, we had to walk.",
        options: ["Being", "There being", "It being", "Having"],
        correctIndex: 1,
        explanation: "There is 〜 の分詞構文は There being 〜。"
      }
    ]
  },
  {
    id: "g_subjunctive",
    level: "senior2",
    category: "動詞の形",
    title: "仮定法",
    summary: "事実と違うことを言うために、時制をひとつ前にずらす。",
    requires: ["g_perfect_others"],
    sections: [
      {
        heading: "仮定法過去は「今の事実と違うこと」",
        body: "If + 主語 + 過去形, 主語 + would / could / might + 原形。時制は過去でも、指しているのは現在である。be動詞は主語にかかわらず were を使うのが本来の形。"
      },
      {
        heading: "仮定法過去完了は「過去の事実と違うこと」",
        body: "If + 主語 + had + 過去分詞, 主語 + would have + 過去分詞。「あのときこうしていれば、こうなっていただろう」という後悔や推測を表す。"
      },
      {
        heading: "if を使わない言い方",
        body: "I wish + 仮定法（〜ならいいのに）、as if + 仮定法（まるで〜のように）、without / but for（〜が無ければ）、It's time + 仮定法過去（もう〜する時間だ）。"
      },
      {
        heading: "直説法の if と混同しない",
        body: "起こりうることを言う if は普通の時制を使う（If it rains tomorrow, I will stay home.）。仮定法は「起こらない・起こらなかった」ことに使う。"
      }
    ],
    examples: [
      { english: "If I had more time, I would travel abroad.", japanese: "もっと時間があれば、海外を旅行するのに。", note: "今は時間が無い" },
      { english: "If I had studied harder, I would have passed.", japanese: "もっと勉強していれば、合格していただろうに。", note: "実際は合格しなかった" },
      { english: "I wish I could speak French.", japanese: "フランス語が話せたらいいのに。", note: "実際は話せない" },
      { english: "He talks as if he knew everything.", japanese: "彼はまるで何でも知っているかのように話します。", note: "実際は知らない" }
    ],
    mistakes: [
      { wrong: "If I will have time, I would go.", right: "If I had time, I would go.", why: "仮定法の if の中に will は入れない。" },
      { wrong: "If I was you, I would accept it.", right: "If I were you, I would accept it.", why: "仮定法では be動詞は were を使う。" },
      { wrong: "If I had known it, I would tell you.", right: "If I had known it, I would have told you.", why: "過去の事実に反する話なので主節も would have + 過去分詞。" }
    ],
    questions: [
      {
        question: "If I [_____] a bird, I could fly to you.",
        options: ["am", "was", "were", "will be"],
        correctIndex: 2,
        explanation: "現在の事実に反する仮定なので were。"
      },
      {
        question: "I wish I [_____] harder when I was young.",
        options: ["studied", "had studied", "study", "would study"],
        correctIndex: 1,
        explanation: "過去の事実に反する願望なので had + 過去分詞。"
      },
      {
        question: "Without your help, I [_____] finished it.",
        options: ["wouldn't have", "won't have", "don't have", "hadn't"],
        correctIndex: 0,
        explanation: "「助けが無ければ終えられなかっただろう」なので would have + 過去分詞の否定。"
      }
    ]
  },
  {
    id: "g_modal_perfect",
    level: "senior2",
    category: "動詞の形",
    title: "助動詞 + have + 過去分詞",
    summary: "過去のことを今の視点から推測したり、悔やんだりする形。",
    requires: ["g_modal", "g_present_perfect"],
    sections: [
      {
        heading: "過去への推測",
        body: "must have + 過去分詞（〜したにちがいない）、may / might have + 過去分詞（〜したかもしれない）、cannot have + 過去分詞（〜したはずがない）。"
      },
      {
        heading: "過去への後悔・非難",
        body: "should have + 過去分詞（〜すべきだったのに、しなかった）、need not have + 過去分詞（〜する必要は無かったのに、した）。どちらも「実際はそうしなかった／してしまった」という含みを持つ。"
      },
      {
        heading: "would have は仮定法とつながる",
        body: "would have + 過去分詞は「（あのとき）〜していただろう」で、仮定法過去完了の主節と同じ形である。"
      }
    ],
    examples: [
      { english: "He must have missed the train.", japanese: "彼は電車に乗り遅れたにちがいありません。", note: "過去への強い推測" },
      { english: "You should have told me earlier.", japanese: "もっと早く言ってくれればよかったのに。", note: "実際は言わなかった" },
      { english: "She cannot have said such a thing.", japanese: "彼女がそんなことを言ったはずがありません。", note: "強い否定の推測" },
      { english: "You need not have hurried.", japanese: "急ぐ必要は無かったのに。", note: "実際は急いだ" }
    ],
    mistakes: [
      { wrong: "He must had missed the train.", right: "He must have missed the train.", why: "助動詞の後ろは原形なので have。" },
      { wrong: "You should have to tell me.", right: "You should have told me.", why: "「〜すべきだった」は should have + 過去分詞。" },
      { wrong: "She mustn't have said it.", right: "She cannot have said it.", why: "「〜したはずがない」は cannot have + 過去分詞。" }
    ],
    questions: [
      {
        question: "The light is on. Someone [_____] in the room.",
        options: ["must be", "must have been", "cannot be", "should be"],
        correctIndex: 0,
        explanation: "今の状態への推測なので must be。過去の推測なら must have been。"
      },
      {
        question: "I'm sorry. I [_____] you sooner.",
        options: ["should call", "should have called", "must call", "would call"],
        correctIndex: 1,
        explanation: "しなかったことへの後悔なので should have + 過去分詞。"
      },
      {
        question: "He [_____] the news. He looked so calm.",
        options: ["must have heard", "cannot have heard", "should have heard", "may hear"],
        correctIndex: 1,
        explanation: "落ち着いていたことから「聞いたはずがない」と判断する。"
      }
    ]
  },
  {
    id: "g_causative",
    level: "senior2",
    category: "動詞から作る形",
    title: "使役動詞と知覚動詞",
    summary: "make / let / have と、see / hear / feel。後ろの動詞は原形になる。",
    verbFrames: [25, 24],
    requires: ["g_sentence_patterns"],
    sections: [
      {
        heading: "使役動詞は「させる」の強さが違う",
        body: "make は強制して「させる」、let は許して「させてやる」、have は当然の仕事として「してもらう」。いずれも make / let / have + 人 + 原形の形をとる。"
      },
      {
        heading: "get だけは to 不定詞をとる",
        body: "同じ「〜させる」でも get は get + 人 + to 不定詞。形が違うので区別して覚える。"
      },
      {
        heading: "知覚動詞は原形と -ing で意味が変わる",
        body: "see 人 原形 は動作の全体を見た、see 人 -ing はその途中を見た、という違いを表す。"
      },
      {
        heading: "受け身になると to が現れる",
        body: "能動では原形だったものが、受動態にすると to 不定詞になる。He was made to wait.（待たされた）"
      }
    ],
    examples: [
      { english: "My mother made me clean my room.", japanese: "母は私に部屋を掃除させました。", note: "make + 人 + 原形" },
      { english: "Let me help you.", japanese: "手伝わせてください。", note: "let + 人 + 原形" },
      { english: "I got him to fix my bike.", japanese: "彼に自転車を直してもらいました。", note: "get だけ to 不定詞" },
      { english: "I saw her crossing the street.", japanese: "彼女が通りを渡っているところを見ました。", note: "渡っている途中" }
    ],
    mistakes: [
      { wrong: "She made me to wait.", right: "She made me wait.", why: "make の後ろは原形。" },
      { wrong: "I had him to carry the box.", right: "I had him carry the box.", why: "have の後ろも原形。" },
      { wrong: "He was made wait for an hour.", right: "He was made to wait for an hour.", why: "受動態になると to が現れる。" }
    ],
    questions: [
      {
        question: "The teacher let us [_____] home early.",
        options: ["to go", "go", "going", "went"],
        correctIndex: 1,
        explanation: "let + 人 + 原形。"
      },
      {
        question: "I'll get someone [_____] this door.",
        options: ["repair", "repairing", "to repair", "repaired"],
        correctIndex: 2,
        explanation: "get は to 不定詞をとる。"
      },
      {
        question: "I heard my name [_____].",
        options: ["call", "calling", "called", "to call"],
        correctIndex: 2,
        explanation: "名前は「呼ばれる」側なので過去分詞。"
      }
    ]
  },
  {
    id: "g_noun_clause",
    level: "senior2",
    category: "文をつなぐ",
    title: "名詞節と間接疑問",
    summary: "文まるごとを名詞のかたまりとして扱う。間接疑問は語順が平叙文に戻る。",
    verbFrames: [26],
    requires: ["g_conjunction"],
    sections: [
      {
        heading: "that節は「〜ということ」",
        body: "think, know, believe, say, hope などの後ろに置いて、内容をひとかたまりで表す。目的語のときは that を省略できる。"
      },
      {
        heading: "間接疑問は疑問文の語順にしない",
        body: "疑問詞のある文が他の文に組み込まれると、疑問文の語順（do you 〜）ではなく平叙文の語順（you 〜）に戻る。ここは日本語話者が最も間違えやすい点のひとつである。"
      },
      {
        heading: "whether と if",
        body: "「〜かどうか」は whether または if。ただし主語になるときや、前置詞の後ろ、or not がすぐ後に続くときは whether を使う。"
      },
      {
        heading: "形式主語の it",
        body: "that節が主語だと頭が重くなるので、It is 〜 that ... の形にすることが多い。"
      }
    ],
    examples: [
      { english: "I think (that) he is honest.", japanese: "彼は正直だと思います。", note: "目的語の that は省略できる" },
      { english: "Do you know where she lives?", japanese: "彼女がどこに住んでいるか知っていますか。", note: "where の後ろは平叙文の語順" },
      { english: "I'm not sure whether he will come.", japanese: "彼が来るかどうか分かりません。", note: "「〜かどうか」" },
      { english: "It is clear that he is right.", japanese: "彼が正しいことは明らかです。", note: "形式主語の it" }
    ],
    mistakes: [
      { wrong: "Do you know where does she live?", right: "Do you know where she lives?", why: "組み込まれた疑問は平叙文の語順に戻る。" },
      { wrong: "I don't know that he will come or not.", right: "I don't know whether he will come or not.", why: "「〜かどうか」は whether / if。" },
      { wrong: "That he is honest is clear.", right: "It is clear that he is honest.", why: "文法上は誤りではないが、形式主語の it を使うほうが自然。" }
    ],
    questions: [
      {
        question: "Could you tell me [_____] the station is?",
        options: ["where is", "where", "that where", "which"],
        correctIndex: 1,
        explanation: "間接疑問なので where + 主語 + 動詞の語順。"
      },
      {
        question: "[_____] he passed the exam surprised everyone.",
        options: ["That", "What", "If", "Whether"],
        correctIndex: 0,
        explanation: "「彼が合格したこと」という主語のかたまりなので That。"
      },
      {
        question: "The question is [_____] we should accept the offer.",
        options: ["that", "what", "whether", "which"],
        correctIndex: 2,
        explanation: "「〜かどうか」で be動詞の後ろなので whether。"
      }
    ]
  },

  // ===== 中級3・上級 ==============================================
  {
    id: "g_emphasis_inversion",
    level: "senior3",
    category: "文の組み立て",
    title: "強調と倒置",
    summary: "語順を変えて、伝えたい部分を前に出す。長文では読み違えやすい形。",
    requires: ["g_noun_clause"],
    sections: [
      {
        heading: "強調構文（It is 〜 that ...）",
        body: "強調したい語句を It is と that の間に挟む。It was in Kyoto that I met him.（京都で会ったのだ）。形式主語の it との違いは、挟んだ部分を元の位置に戻すと文が成り立つかどうかで見分けられる。"
      },
      {
        heading: "否定語が文頭に出ると倒置が起こる",
        body: "Never, Little, Hardly, Not only, Under no circumstances などが文頭に来ると、その後ろは疑問文と同じ語順になる。Never have I seen such a thing."
      },
      {
        heading: "場所や方向を表す語句が前に出る倒置",
        body: "On the hill stood an old castle. のように、場所を表す語句が文頭に来ると主語と動詞が入れかわることがある。主語が長いときに起こりやすい。"
      },
      {
        heading: "so / neither による受け答え",
        body: "So do I.（私もです）、Neither do I.（私もしません）も倒置の形である。"
      }
    ],
    examples: [
      { english: "It was John that broke the window.", japanese: "窓を割ったのはジョンでした。", note: "John を強調" },
      { english: "Never have I heard such a story.", japanese: "そんな話は聞いたことがありません。", note: "Never が文頭なので倒置" },
      { english: "Not only did he apologize, but he also paid for it.", japanese: "彼は謝っただけでなく、代金も払いました。", note: "Not only の後ろが倒置" },
      { english: "Little did she know what was waiting for her.", japanese: "彼女は何が待ち受けているかほとんど知りませんでした。", note: "Little も否定語" }
    ],
    mistakes: [
      { wrong: "Never I have seen such a thing.", right: "Never have I seen such a thing.", why: "否定語が文頭に出たら疑問文の語順にする。" },
      { wrong: "It was he who I met yesterday.", right: "It was he whom I met yesterday.", why: "元の文で目的語だったので whom（または that）。" },
      { wrong: "I like it. — So I do.", right: "I like it. — So do I.", why: "「私もです」は So + 助動詞 + 主語。So I do. は「本当にそうです」と別の意味になる。" }
    ],
    questions: [
      {
        question: "[_____] was the movie that I watched it twice.",
        options: ["So interesting", "Such interesting", "So interested", "Very interesting"],
        correctIndex: 0,
        explanation: "So + 形容詞 が文頭に出た倒置。So interesting was the movie that 〜。"
      },
      {
        question: "Not until yesterday [_____] the truth.",
        options: ["I knew", "did I know", "I did know", "knew I"],
        correctIndex: 1,
        explanation: "Not until 〜 が文頭なので後ろは疑問文の語順。"
      },
      {
        question: "It was in 1990 [_____] he moved to Tokyo.",
        options: ["when", "that", "which", "where"],
        correctIndex: 1,
        explanation: "強調構文では that を使う。"
      }
    ]
  },
  {
    id: "g_reported_speech",
    level: "senior3",
    category: "文をつなぐ",
    title: "話法（直接話法と間接話法）",
    summary: "人の言葉を引用符なしで伝えると、時制・代名詞・時の副詞がずれる。",
    requires: ["g_noun_clause", "g_perfect_others"],
    sections: [
      {
        heading: "時制の一致",
        body: "伝える動詞が過去形なら、引用する内容の時制もひとつ前にずらす。現在形→過去形、過去形→過去完了、will→would。"
      },
      {
        heading: "代名詞と時・場所の語も変わる",
        body: "I→he / she、my→his / her、today→that day、yesterday→the day before、tomorrow→the next day、here→there のように、話し手と場面が変わるぶんだけ置きかえる。"
      },
      {
        heading: "疑問文・命令文の伝え方",
        body: "疑問詞のある疑問は ask + 疑問詞 + 平叙文の語順、Yes / No 疑問は ask if / whether、命令は tell + 人 + to 不定詞（否定は not to）にする。"
      },
      {
        heading: "時制を一致させない場合",
        body: "変わらない事実や、今も続いていることを伝えるときは、現在形のままにすることがある。"
      }
    ],
    examples: [
      { english: "He said, \"I am tired.\" → He said that he was tired.", japanese: "彼は「疲れた」と言いました。→ 彼は疲れていると言いました。", note: "am → was、I → he" },
      { english: "She said, \"I will call you.\" → She said that she would call me.", japanese: "彼女は「電話する」と言いました。", note: "will → would、you → me" },
      { english: "He asked, \"Where do you live?\" → He asked where I lived.", japanese: "彼はどこに住んでいるか尋ねました。", note: "疑問文の語順に戻さない" },
      { english: "She told me not to worry.", japanese: "彼女は私に心配しないように言いました。", note: "否定の命令" }
    ],
    mistakes: [
      { wrong: "He asked me where did I live.", right: "He asked me where I lived.", why: "間接話法では平叙文の語順にする。" },
      { wrong: "She said me that she was busy.", right: "She told me that she was busy.", why: "say は人を目的語に直接とらない。say to me か tell me。" },
      { wrong: "He said that he will come.", right: "He said that he would come.", why: "伝える動詞が過去なので will も過去にずらす。" }
    ],
    questions: [
      {
        question: "She said, \"I saw him yesterday.\" → She said that she [_____] him the day before.",
        options: ["saw", "has seen", "had seen", "sees"],
        correctIndex: 2,
        explanation: "過去形はさらに前にずれて過去完了になる。"
      },
      {
        question: "He asked me [_____] I was free.",
        options: ["that", "what", "if", "which"],
        correctIndex: 2,
        explanation: "Yes / No 疑問を伝えるので if（whether）。"
      },
      {
        question: "My teacher told me [_____] late again.",
        options: ["don't be", "not to be", "to not be", "not being"],
        correctIndex: 1,
        explanation: "否定の命令は tell + 人 + not to 不定詞。"
      }
    ]
  },
  {
    id: "g_inanimate_subject",
    level: "senior3",
    category: "文の組み立て",
    title: "無生物主語と名詞構文",
    summary: "ものやことを主語に置く英語らしい言い方。直訳すると不自然になる。",
    sections: [
      {
        heading: "無生物主語とは",
        body: "日本語では「私は〜できなかった」と人を主語にする場面で、英語ではものやことを主語に置くことが多い。The rain prevented us from going out.（雨のせいで外出できなかった）。"
      },
      {
        heading: "よく使う動詞",
        body: "make（〜させる）、allow / enable（〜できるようにする）、prevent / keep（〜させない）、cause（引き起こす）、remind（思い出させる）、take（時間がかかる）、cost（費用がかかる）、bring（もたらす）。"
      },
      {
        heading: "訳すときは主語を副詞のように扱う",
        body: "「〜のおかげで」「〜のせいで」「〜すると」と原因や条件のように訳し、目的語を主語にすると日本語らしくなる。"
      },
      {
        heading: "名詞構文",
        body: "英語は動作を名詞で表すことを好む。his refusal to answer（彼が答えを拒んだこと）のように、名詞のかたまりを動詞の文に読み替えると理解しやすい。"
      }
    ],
    examples: [
      { english: "This photo reminds me of my childhood.", japanese: "この写真を見ると子供のころを思い出します。", note: "「写真が思い出させる」" },
      { english: "The heavy snow prevented us from leaving.", japanese: "大雪のせいで出発できませんでした。", note: "prevent 人 from 〜ing" },
      { english: "It took me two hours to finish the report.", japanese: "報告書を仕上げるのに2時間かかりました。", note: "時間を表す take" },
      { english: "His sudden departure surprised everyone.", japanese: "彼が突然出発したので、皆が驚きました。", note: "名詞構文" }
    ],
    mistakes: [
      { wrong: "The rain prevented us to go out.", right: "The rain prevented us from going out.", why: "prevent は from + 動名詞をとる。" },
      { wrong: "This medicine will make you to feel better.", right: "This medicine will make you feel better.", why: "使役の make の後ろは原形。" },
      { wrong: "I took two hours to finish it.", right: "It took me two hours to finish it.", why: "時間がかかることを言うときは it を主語にする。" }
    ],
    questions: [
      {
        question: "What [_____] you to change your mind?",
        options: ["made", "let", "had", "caused"],
        correctIndex: 3,
        explanation: "cause + 人 + to 不定詞。made なら to は付かない。"
      },
      {
        question: "The new system [_____] us to work faster.",
        options: ["enables", "makes", "lets", "prevents"],
        correctIndex: 0,
        explanation: "enable + 人 + to 不定詞で「〜できるようにする」。"
      },
      {
        question: "Five minutes' walk [_____] you to the station.",
        options: ["takes", "brings", "makes", "gives"],
        correctIndex: 1,
        explanation: "「歩けば駅に着く」を無生物主語で表す bring。"
      }
    ]
  },
  {
    id: "g_ellipsis_apposition",
    level: "advanced",
    category: "文の組み立て",
    title: "省略・同格・挿入",
    summary: "書き言葉では語が省かれ、説明が挟み込まれる。構造を復元して読む。",
    requires: ["g_relative_pronoun"],
    sections: [
      {
        heading: "繰り返しを避ける省略",
        body: "同じ語の繰り返しは省かれる。He can swim, and she can (swim), too. のように、読み手が補えるものは書かれない。比較の than の後ろでもよく省略が起こる。"
      },
      {
        heading: "関係代名詞と be動詞の省略",
        body: "the book (which is) written by him のように、主格の関係代名詞と be動詞はまとめて省略できる。文頭の過去分詞・現在分詞はこの省略の結果であることが多い。"
      },
      {
        heading: "同格",
        body: "名詞の直後に、それを言いかえる名詞やコンマ・that節を置いて説明する。the fact that he lied（彼が嘘をついたという事実）。この that は関係代名詞ではなく、後ろが完全な文になる。"
      },
      {
        heading: "挿入",
        body: "コンマやダッシュで囲まれた部分は、いったん外して読むと骨組みが見える。I think, however, that he is right."
      }
    ],
    examples: [
      { english: "The news that he had won spread quickly.", japanese: "彼が優勝したという知らせはすぐに広まりました。", note: "同格の that。後ろは完全な文" },
      { english: "The man (who was) arrested yesterday is a doctor.", japanese: "昨日逮捕された男性は医者です。", note: "who was の省略" },
      { english: "She likes tennis better than (she likes) golf.", japanese: "彼女はゴルフよりテニスが好きです。", note: "than の後ろの省略" },
      { english: "This book, which I read last year, is excellent.", japanese: "この本は、去年読んだのですが、とてもよいです。", note: "挿入されている非限定用法" }
    ],
    mistakes: [
      { wrong: "I have the news that he told me it.", right: "I have the news that he told me.", why: "同格の that節でも、動詞の目的語が二重にならないようにする。" },
      { wrong: "The fact which he lied surprised us.", right: "The fact that he lied surprised us.", why: "後ろが完全な文なので同格の that。関係代名詞は使えない。" },
      { wrong: "He is taller than me is.", right: "He is taller than I am. / He is taller than me.", why: "省略の仕方をそろえる。" }
    ],
    questions: [
      {
        question: "I was surprised at the fact [_____] she had left the company.",
        options: ["which", "what", "that", "where"],
        correctIndex: 2,
        explanation: "後ろが完全な文なので同格の that。"
      },
      {
        question: "The letter [_____] on the desk is for you.",
        options: ["leaving", "left", "leave", "is left"],
        correctIndex: 1,
        explanation: "which was left の which was が省略された形。"
      },
      {
        question: "She can play the violin better than I [_____].",
        options: ["do", "can", "am", "play"],
        correctIndex: 1,
        explanation: "can play の play が省略され、can だけが残る。"
      }
    ]
  },
  {
    id: "g_countability",
    level: "advanced",
    category: "名詞のあつかい",
    title: "可算・不可算と冠詞の応用",
    summary: "同じ語でも、数えるかどうかで意味が変わる。冠詞は情報の新旧を示す。",
    requires: ["g_noun_article"],
    sections: [
      {
        heading: "数えられるかは語ではなく意味で決まる",
        body: "同じ語でも意味によって変わる。paper は「紙」なら不可算、「論文・新聞」なら可算。room は「部屋」なら可算、「余地」なら不可算。experience は「経験」一般なら不可算、「ひとつの体験」なら可算。"
      },
      {
        heading: "無冠詞の名詞は「その働き」を表す",
        body: "go to school（勉強しに行く）と go to the school（その建物へ行く）のように、無冠詞は場所そのものではなく本来の働きを指す。in bed（寝ている）、by car（車で）なども同じ。"
      },
      {
        heading: "the の付く場面",
        body: "話し手と聞き手の間で「どれか」が共有されているとき。唯一のもの（the sun）、最上級・序数（the first）、of で限定された名詞、楽器名などに付く。"
      },
      {
        heading: "総称の言い方",
        body: "「犬というもの」を表すには A dog is 〜 / Dogs are 〜 / The dog is 〜 の3通りがあり、複数形が最もふつうに使われる。"
      }
    ],
    examples: [
      { english: "I need some paper.", japanese: "紙が要ります。", note: "材料としての紙は不可算" },
      { english: "He published three papers this year.", japanese: "彼は今年3本の論文を発表しました。", note: "論文は可算" },
      { english: "My son goes to school by bus.", japanese: "息子はバスで通学しています。", note: "無冠詞の school は「勉強する場」" },
      { english: "Dogs are loyal animals.", japanese: "犬は忠実な動物です。", note: "総称は複数形が最も自然" }
    ],
    mistakes: [
      { wrong: "I have many works to do.", right: "I have a lot of work to do.", why: "「仕事」の work は不可算。works は「作品」の意味になる。" },
      { wrong: "He is in the hospital as a doctor.", right: "He is at the hospital as a doctor.", why: "in the hospital は「入院している」の意味になりやすい。" },
      { wrong: "She plays piano very well.", right: "She plays the piano very well.", why: "楽器名には the を付ける。" }
    ],
    questions: [
      {
        question: "Could you give me [_____]?",
        options: ["an advice", "advices", "some advice", "many advice"],
        correctIndex: 2,
        explanation: "advice は不可算なので some advice。"
      },
      {
        question: "There is no [_____] for another chair in this office.",
        options: ["a room", "room", "rooms", "the room"],
        correctIndex: 1,
        explanation: "「余地」の意味の room は不可算。"
      },
      {
        question: "He went to [_____] to visit his sick friend.",
        options: ["hospital", "the hospital", "a hospital", "hospitals"],
        correctIndex: 1,
        explanation: "見舞いに行く＝建物へ行くので the hospital。無冠詞だと「入院しに行く」になる。"
      }
    ]
  }
];
