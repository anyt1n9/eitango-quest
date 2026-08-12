/**
 * PDF取り込みが使えないときに返す見本の単語。
 *
 * AIキーが無い、または応答を解釈できなかったときに、
 * 取り込み機能の動きだけは確かめられるようにするためのもの。
 * 実際のPDFから抽出した結果ではないので、
 * 呼び出し側は必ず「見本である」と伝えること。
 *
 * 分量があるだけで server.ts の読み書きの邪魔になるので分けてある。
 */
export function getPdfMockWords(): any[] {
  const mockBase = [
    {
      word: "significant",
      translation: "重要な、意義深い",
      level: "senior3",
      options: ["重要な、意義深い", "一時的な", "表面的な", "不十分な"],
      sentence: "The project had a [_____] impact on our environmental footprint.",
      sentenceTranslation: "そのプロジェクトは私たちの環境フットプリントに重要な影響を与えました。",
      sentenceOptions: ["significant", "minor", "synthetic", "vague"]
    },
    {
      word: "evaluate",
      translation: "～を評価する、査定する",
      level: "advanced",
      options: ["～を評価する、査定する", "～を破壊する", "～を無視する", "～を維持する"],
      sentence: "We need more data to [_____] the effectiveness of this system.",
      sentenceTranslation: "このシステムの有効性を評価するためにはさらなるデータが必要です。",
      sentenceOptions: ["evaluate", "demolish", "disregard", "stabilize"]
    },
    {
      word: "infrastructure",
      translation: "社会的基盤、インフラ",
      level: "advanced",
      options: ["社会的基盤、インフラ", "農業、農耕", "娯楽施設", "通信エラー"],
      sentence: "The government is investing heavily in rural communication [_____].",
      sentenceTranslation: "政府は農村部の通信インフラに多大な投資を行っています。",
      sentenceOptions: ["infrastructure", "agriculture", "recreation", "obstacle"]
    },
    {
      word: "analyze",
      translation: "～を分析する",
      level: "senior2",
      options: ["～を分析する", "～を要約する", "～を誇張する", "～を否定する"],
      sentence: "Our research team will [_____] the chemical composition of the water.",
      sentenceTranslation: "私たちの研究チームは水の化学組成を分析する予定です。",
      sentenceOptions: ["analyze", "summarize", "exaggerate", "deny"]
    },
    {
      word: "collaborate",
      translation: "共同で取り組む、協力する",
      level: "senior3",
      options: ["共同で取り組む、協力する", "対立する、喧嘩する", "孤立する", "～を妨害する"],
      sentence: "Scientists around the world [_____] to find a cure for the disease.",
      sentenceTranslation: "世界中の科学者たちがその病気の治療法を見つけるために協力しています。",
      sentenceOptions: ["collaborate", "compete", "isolate", "interfere"]
    },
    {
      word: "comprehensive",
      translation: "包括的な、総合的な",
      level: "advanced",
      options: ["包括的な、総合的な", "部分的な、限定的な", "単純な、初歩的な", "理解困難な"],
      sentence: "The book provides a [_____] guide to organic chemistry.",
      sentenceTranslation: "その本は有機化学への包括的なガイドを提供しています。",
      sentenceOptions: ["comprehensive", "fractional", "elementary", "incomprehensible"]
    },
    {
      word: "acquire",
      translation: "～を獲得する、身につける",
      level: "senior3",
      options: ["～を獲得する、身につける", "～を紛失する", "～を引き渡す", "～を拒絶する"],
      sentence: "It takes years of practice to [_____] a new language perfectly.",
      sentenceTranslation: "新しい言語を完璧に身につけるには、何年もの練習が必要です。",
      sentenceOptions: ["acquire", "abandon", "deliver", "reject"]
    },
    {
      word: "innovation",
      translation: "革新、技術革新",
      level: "senior3",
      options: ["革新、技術革新", "伝統、慣習", "模倣、コピー", "停滞、沈滞"],
      sentence: "Technological [_____] drives economic growth in modern societies.",
      sentenceTranslation: "技術革新は現代社会における経済成長を牽引しています。",
      sentenceOptions: ["innovation", "custom", "imitation", "stagnation"]
    },
    {
      word: "precise",
      translation: "正確な、精密な",
      level: "senior2",
      options: ["正確な、精密な", "曖昧な、適当な", "巨大な", "大まかな"],
      sentence: "The surgeon made a [_____] incision to remove the tumor.",
      sentenceTranslation: "外科医は腫瘍を取り除くために正確な切開を行いました。",
      sentenceOptions: ["precise", "vague", "mammoth", "rough"]
    },
    {
      word: "hypothesis",
      translation: "仮説",
      level: "advanced",
      options: ["仮説", "定説、定説的な事実", "反論、抗議", "実験装置"],
      sentence: "The scientist formulated a [_____] to explain the observed phenomenon.",
      sentenceTranslation: "その科学者は観察された現象を説明するための仮説を立てました。",
      sentenceOptions: ["hypothesis", "dogma", "protest", "apparatus"]
    }
  ];
  return mockBase;
}

