import { SenseExample, SenseQuizItem } from "../types";

/**
 * 語義分別クイズのデータ（書き下ろし）。
 *
 * 1つの綴りが文によって別の意味になる語を集め、意味ごとに例文と和訳を付けている。
 * 出題では例文を1つ見せ、その文での意味を同じ語の語義の中から選ばせる。
 *
 * 語義データ（senses.ts）から機械的に作らなかったのは、あちらの品詞と用例の対応が
 * 粗いため。辞書の訳に付いた品詞の推定が外れている語（present の「出席している」が
 * 動詞に分類されている、など）や、用例と訳が別の語義を指している語
 * （milk の用例 "Cows need to be milked" に「情報を引き出す」が付く、など）が
 * 3〜4割混ざり、そのまま出すと正解が誤った設問になった。
 *
 * 決まり（tests/senseQuiz.data.test.ts が確かめる）
 *   - 先頭の語義は、単語データが教えている訳と同じ意味にする
 *     （その語義の問題だけを間隔反復と苦手単語に記録するため）
 *   - 同じ語の語義どうしは訳が重ならないようにする（正解が2つにならないように）
 *   - 例文の中の対象の語を {} で囲む。活用形（booked / lit / tore など）でよい
 *   - 例文はその語義でしか読めない文にする（文脈で意味が1つに決まること）
 *
 * 出典のあるデータではないので、内容は1項目ずつ読んで確かめるほかない。
 * 起動時には要らないので src/senseQuiz.ts の loadSenseQuiz() で遅延読み込みする。
 */

const s = (meaning: string, example: string, translation: string): SenseExample =>
  ({ meaning, example, translation });

export const senseQuiz: SenseQuizItem[] = [
  // ───────────── 初級 ─────────────
  { word: "book", senses: [
    s("本", "I borrowed a {book} from the library.", "私は図書館で本を借りました。"),
    s("予約する", "I {booked} a table for two at the restaurant.", "私はそのレストランに2人分の席を予約しました。")
  ] },
  { word: "park", senses: [
    s("公園", "We played soccer in the {park}.", "私たちは公園でサッカーをしました。"),
    s("駐車する", "You can't {park} your car here.", "ここに車を駐車してはいけません。")
  ] },
  { word: "watch", senses: [
    s("腕時計", "My father gave me a new {watch} for my birthday.", "父は誕生日に新しい腕時計をくれました。"),
    s("じっと見る、見守る", "We {watched} the fireworks from the bridge.", "私たちは橋の上から花火を見ました。")
  ] },
  { word: "train", senses: [
    s("電車", "I take the {train} to school every day.", "私は毎日電車で学校に行きます。"),
    s("訓練する", "The coach {trains} the team every morning.", "コーチは毎朝チームを訓練しています。")
  ] },
  { word: "store", senses: [
    s("店", "I bought this pen at the {store} near the station.", "私はこのペンを駅の近くの店で買いました。"),
    s("蓄える、しまっておく", "Squirrels {store} nuts for the winter.", "リスは冬に備えて木の実を蓄えます。")
  ] },
  { word: "present", senses: [
    s("プレゼント", "Thank you for the birthday {present}.", "誕生日のプレゼントをありがとう。"),
    s("現在の", "Who is the {present} leader of the club?", "そのクラブの現在のリーダーは誰ですか。"),
    s("出席している", "All the students were {present} at the meeting.", "生徒は全員その会に出席していました。")
  ] },
  { word: "free", senses: [
    s("暇な", "Are you {free} this afternoon?", "今日の午後は暇ですか。"),
    s("無料の", "The museum is {free} on Sundays.", "その博物館は日曜日は無料です。"),
    s("自由な", "The bird was finally {free} to fly away.", "その鳥はついに自由に飛んでいけるようになりました。")
  ] },
  { word: "fine", senses: [
    s("元気な", "I'm {fine}, thank you.", "元気です、ありがとう。"),
    s("罰金", "He had to pay a {fine} for parking there.", "彼はそこに駐車したので罰金を払わなければなりませんでした。"),
    s("細かい", "The sand on this beach is very {fine}.", "この浜辺の砂はとても細かい。")
  ] },
  { word: "cool", senses: [
    s("涼しい", "It's {cool} in the mornings in autumn.", "秋は朝が涼しい。"),
    s("かっこいい", "Your new jacket looks really {cool}.", "あなたの新しい上着は本当にかっこいいね。")
  ] },
  { word: "hard", senses: [
    s("硬い", "This bread is too {hard} to eat.", "このパンは硬すぎて食べられません。"),
    s("難しい", "The math test was very {hard}.", "数学のテストはとても難しかった。"),
    s("一生懸命に", "She studied {hard} for the exam.", "彼女は試験に向けて一生懸命勉強しました。")
  ] },
  { word: "light", senses: [
    s("軽い", "This bag is {light}, so I can carry it easily.", "このかばんは軽いので、楽に運べます。"),
    s("光、明かり", "The {light} from the window woke me up.", "窓から差しこむ光で目が覚めました。"),
    s("火をつける", "He {lit} a candle on the table.", "彼はテーブルのろうそくに火をつけました。")
  ] },
  { word: "kind", senses: [
    s("親切な", "She is {kind} to everyone.", "彼女は誰にでも親切です。"),
    s("種類", "What {kind} of music do you like?", "どんな種類の音楽が好きですか。")
  ] },
  { word: "right", senses: [
    s("右の", "Raise your {right} hand.", "右手を挙げてください。"),
    s("正しい", "Your answer is {right}.", "あなたの答えは正しい。"),
    s("権利", "Every child has the {right} to education.", "すべての子どもには教育を受ける権利があります。")
  ] },
  { word: "close", senses: [
    s("閉める", "Please {close} the door.", "ドアを閉めてください。"),
    s("近い", "The station is {close} to my house.", "駅は私の家の近くにあります。")
  ] },
  { word: "well", senses: [
    s("元気な", "I hope you get {well} soon.", "早く元気になるといいですね。"),
    s("上手に", "She sings very {well}.", "彼女はとても上手に歌います。"),
    s("井戸", "The villagers get water from an old {well}.", "村人たちは古い井戸から水をくみます。")
  ] },
  { word: "can", senses: [
    s("〜できる", "I {can} swim fast.", "私は速く泳ぐことができます。"),
    s("缶", "He opened a {can} of tuna.", "彼はツナ缶を1つ開けました。")
  ] },
  { word: "still", senses: [
    s("まだ", "Is it {still} raining?", "まだ雨は降っていますか。"),
    s("じっとした、静止した", "Please stand {still} while I take your picture.", "写真を撮るあいだ、じっと立っていてください。")
  ] },
  { word: "even", senses: [
    s("〜でさえ", "{Even} a child can do it.", "子どもでさえそれはできます。"),
    s("偶数の", "Two, four and six are {even} numbers.", "2、4、6は偶数です。")
  ] },
  { word: "sound", senses: [
    s("音", "I heard a strange {sound} outside.", "外で奇妙な音が聞こえました。"),
    s("〜のように思われる", "That {sounds} like a good idea.", "それはいい考えのように思えます。")
  ] },
  { word: "spring", senses: [
    s("春", "Cherry blossoms come out in {spring}.", "桜の花は春に咲きます。"),
    s("ばね", "The old sofa has a broken {spring}.", "その古いソファーはばねが壊れています。"),
    s("泉、わき水", "There are many hot {springs} in Japan.", "日本には温泉がたくさんあります。")
  ] },
  { word: "match", senses: [
    s("試合", "We won the tennis {match}.", "私たちはテニスの試合に勝ちました。"),
    s("似合う、調和する", "Your bag {matches} your shoes.", "あなたのかばんは靴と合っています。")
  ] },
  { word: "ring", senses: [
    s("指輪", "She wears a gold {ring}.", "彼女は金の指輪をしています。"),
    s("鳴る", "The phone {rang} during the class.", "授業中に電話が鳴りました。")
  ] },
  { word: "bank", senses: [
    s("銀行", "I opened an account at the {bank}.", "私は銀行で口座を開きました。"),
    s("土手、岸", "We had a picnic on the {bank} of the river.", "私たちは川の土手でピクニックをしました。")
  ] },
  { word: "letter", senses: [
    s("手紙", "I wrote a {letter} to my grandmother.", "私は祖母に手紙を書きました。"),
    s("文字", "The word \"cat\" has three {letters}.", "cat という語は3文字です。")
  ] },
  { word: "space", senses: [
    s("空間、場所", "There is no {space} for a piano in my room.", "私の部屋にはピアノを置く場所がありません。"),
    s("宇宙", "She wants to travel into {space} someday.", "彼女はいつか宇宙へ行きたいと思っています。")
  ] },
  { word: "wave", senses: [
    s("波", "A big {wave} hit the boat.", "大きな波がボートに当たりました。"),
    s("手を振る", "She {waved} goodbye to us.", "彼女は私たちに手を振って別れを告げました。")
  ] },
  { word: "wind", senses: [
    s("風", "The {wind} is very strong today.", "今日は風がとても強い。"),
    s("曲がりくねる", "The road {winds} through the mountains.", "その道は山の中を曲がりくねって続いています。")
  ] },
  { word: "room", senses: [
    s("部屋", "My {room} is on the second floor.", "私の部屋は2階にあります。"),
    s("余地、空き", "Is there {room} for one more person in the car?", "車にもう1人乗れる余裕はありますか。")
  ] },
  { word: "hand", senses: [
    s("手", "Wash your {hands} before dinner.", "夕食の前に手を洗いなさい。"),
    s("手渡す", "Could you {hand} me the salt?", "塩を取ってもらえますか。")
  ] },
  { word: "class", senses: [
    s("授業", "We have five {classes} today.", "今日は授業が5つあります。"),
    s("学級、クラス", "Our {class} won the relay race.", "私たちのクラスがリレーで優勝しました。")
  ] },
  { word: "change", senses: [
    s("変える", "I {changed} my mind.", "私は考えを変えました。"),
    s("おつり、小銭", "Here is your {change}.", "こちらがおつりです。")
  ] },
  { word: "run", senses: [
    s("走る", "He {runs} in the park every morning.", "彼は毎朝公園を走ります。"),
    s("経営する", "Her family {runs} a small hotel.", "彼女の家族は小さなホテルを経営しています。")
  ] },
  { word: "coach", senses: [
    s("指導者、コーチ", "Our {coach} is very strict.", "私たちのコーチはとても厳しい。"),
    s("長距離バス", "We traveled to London by {coach}.", "私たちは長距離バスでロンドンへ行きました。")
  ] },
  { word: "subject", senses: [
    s("教科", "My favorite {subject} is science.", "私の好きな教科は理科です。"),
    s("話題", "Let's change the {subject}.", "話題を変えましょう。")
  ] },
  { word: "sentence", senses: [
    s("文", "Write a {sentence} using this word.", "この語を使って文を書きなさい。"),
    s("判決、刑", "The judge gave him a ten-year {sentence}.", "裁判官は彼に懲役10年の判決を言い渡しました。")
  ] },
  { word: "fly", senses: [
    s("飛ぶ", "Birds {fly} south in winter.", "鳥は冬になると南へ飛んでいきます。"),
    s("ハエ", "A {fly} landed on my sandwich.", "ハエが私のサンドイッチにとまりました。")
  ] },
  { word: "bat", senses: [
    s("バット", "He hit the ball with a {bat}.", "彼はバットでボールを打ちました。"),
    s("コウモリ", "A {bat} flew out of the cave.", "洞くつからコウモリが飛び出してきました。")
  ] },
  { word: "fan", senses: [
    s("ファン、愛好者", "I'm a big {fan} of that singer.", "私はあの歌手の大ファンです。"),
    s("扇風機、うちわ", "Turn on the {fan}. It's hot in here.", "扇風機をつけて。ここは暑いよ。")
  ] },
  { word: "miss", senses: [
    s("〜しそこなう、乗り遅れる", "I {missed} the last bus.", "私は最終バスに乗り遅れました。"),
    s("恋しく思う", "I {miss} my friends in Osaka.", "大阪の友だちが恋しい。")
  ] },
  { word: "save", senses: [
    s("救う", "The doctor {saved} his life.", "その医者が彼の命を救いました。"),
    s("節約する", "We should {save} water.", "私たちは水を節約するべきです。"),
    s("保存する", "Don't forget to {save} the file.", "ファイルを保存するのを忘れないで。")
  ] },
  { word: "point", senses: [
    s("要点", "What's the {point} of this story?", "この話の要点は何ですか。"),
    s("得点", "Our team got three {points} in the first half.", "私たちのチームは前半に3点を取りました。"),
    s("指さす", "It's rude to {point} at people.", "人を指さすのは失礼です。")
  ] },
  { word: "stand", senses: [
    s("立つ", "Please {stand} up.", "立ってください。"),
    s("我慢する", "I can't {stand} this noise.", "この騒音には我慢できません。")
  ] },
  { word: "table", senses: [
    s("テーブル", "Put the plates on the {table}.", "お皿をテーブルに置いてください。"),
    s("表", "Look at the {table} on page 10.", "10ページの表を見てください。")
  ] },
  { word: "top", senses: [
    s("頂上", "We reached the {top} of the mountain.", "私たちは山の頂上に着きました。"),
    s("最高の、一流の", "She is one of the {top} students in her class.", "彼女はクラスで最も優秀な生徒の1人です。")
  ] },
  { word: "board", senses: [
    s("板、掲示板", "Look at the notice on the {board}.", "掲示板のお知らせを見てください。"),
    s("乗り込む", "We {boarded} the plane at nine.", "私たちは9時に飛行機に乗り込みました。"),
    s("委員会、理事会", "The {board} decided to build a new gym.", "理事会は新しい体育館を建てることに決めました。")
  ] },
  { word: "case", senses: [
    s("場合", "In that {case}, I'll call you later.", "その場合は、後で電話します。"),
    s("事件", "The police are investigating the {case}.", "警察はその事件を捜査しています。"),
    s("入れ物、ケース", "Put your glasses back in their {case}.", "めがねをケースに戻しなさい。")
  ] },
  { word: "mind", senses: [
    s("心、精神", "She has a sharp {mind}.", "彼女は頭の回転が速い。"),
    s("気にする、嫌がる", "Do you {mind} if I open the window?", "窓を開けてもかまいませんか。")
  ] },
  { word: "note", senses: [
    s("メモ", "I left a {note} on your desk.", "あなたの机にメモを置いておきました。"),
    s("音符", "She can read musical {notes}.", "彼女は楽譜の音符が読めます。")
  ] },
  { word: "back", senses: [
    s("戻って", "He came {back} home at six.", "彼は6時に家に戻ってきました。"),
    s("背中", "My {back} hurts after the long walk.", "長く歩いたあとで背中が痛い。")
  ] },
  { word: "head", senses: [
    s("頭", "He hit his {head} on the door.", "彼はドアに頭をぶつけました。"),
    s("向かう", "After school, we {headed} for the station.", "放課後、私たちは駅へ向かいました。")
  ] },
  { word: "minute", senses: [
    s("分", "Wait a {minute}, please.", "ちょっと待ってください。"),
    s("ごく小さい、細かな", "There were {minute} differences between the two pictures.", "2枚の絵にはごくわずかな違いがありました。")
  ] },
  { word: "glass", senses: [
    s("コップ", "Can I have a {glass} of water?", "水を1杯もらえますか。"),
    s("ガラス", "This window is made of thick {glass}.", "この窓は厚いガラスでできています。"),
    s("めがね", "I can't read without my {glasses}.", "めがねがないと字が読めません。")
  ] },
  { word: "paper", senses: [
    s("紙", "Write your answer on this {paper}.", "答えはこの紙に書いてください。"),
    s("新聞", "My father reads the {paper} every morning.", "父は毎朝新聞を読みます。"),
    s("論文、レポート", "I have to write a {paper} on climate change.", "私は気候変動についてのレポートを書かなければなりません。")
  ] },
  { word: "story", senses: [
    s("話、物語", "My grandmother told me an interesting {story}.", "祖母がおもしろい話をしてくれました。"),
    s("（建物の）階", "Our school is a four-{story} building.", "私たちの学校は4階建てです。")
  ] },
  { word: "time", senses: [
    s("時間", "I don't have {time} to watch TV.", "テレビを見る時間がありません。"),
    s("〜回、〜倍", "I've been to Kyoto three {times}.", "私は京都に3回行ったことがあります。")
  ] },
  { word: "turn", senses: [
    s("回す", "{Turn} the key to the right.", "鍵を右に回してください。"),
    s("曲がる", "{Turn} left at the next corner.", "次の角を左に曲がってください。"),
    s("順番", "It's your {turn} to clean the room.", "部屋の掃除はあなたの番です。")
  ] },
  { word: "play", senses: [
    s("（スポーツを）プレーする", "We {play} baseball after school.", "私たちは放課後に野球をします。"),
    s("劇", "Our class performed a {play} at the festival.", "私たちのクラスは文化祭で劇を上演しました。"),
    s("演奏する", "She {plays} the piano very well.", "彼女はピアノをとても上手にひきます。")
  ] },
  { word: "party", senses: [
    s("パーティー", "We had a birthday {party} for Ken.", "私たちはケンの誕生日パーティーを開きました。"),
    s("政党", "Which political {party} won the election?", "どの政党が選挙に勝ちましたか。")
  ] },
  { word: "ground", senses: [
    s("地面", "The apple fell to the {ground}.", "リンゴが地面に落ちました。"),
    s("根拠、理由", "On what {grounds} do you say that?", "何を根拠にそう言うのですか。")
  ] },
  { word: "kid", senses: [
    s("子ども", "The {kids} are playing in the park.", "子どもたちが公園で遊んでいます。"),
    s("からかう、冗談を言う", "Don't worry. I'm just {kidding}.", "心配しないで。冗談だよ。")
  ] },
  { word: "key", senses: [
    s("鍵", "I lost the {key} to my bike.", "自転車の鍵をなくしました。"),
    s("秘訣、手がかり", "Practice is the {key} to success.", "練習こそが成功の秘訣です。")
  ] },
  { word: "pool", senses: [
    s("プール", "Let's swim in the {pool}.", "プールで泳ごう。"),
    s("（お金などを）出し合う", "We {pooled} our money to buy a gift for her.", "私たちはお金を出し合って彼女への贈り物を買いました。")
  ] },
  { word: "spot", senses: [
    s("場所、地点", "This is a good {spot} for a picnic.", "ここはピクニックにいい場所です。"),
    s("しみ、斑点", "There's a {spot} of ink on your shirt.", "あなたのシャツにインクのしみがついています。"),
    s("見つける", "I {spotted} my friend in the crowd.", "人ごみの中で友だちを見つけました。")
  ] },
  { word: "yard", senses: [
    s("庭", "The children are playing in the {yard}.", "子どもたちは庭で遊んでいます。"),
    s("ヤード（長さの単位）", "He kicked the ball fifty {yards}.", "彼はボールを50ヤード蹴りました。")
  ] },
  { word: "rule", senses: [
    s("規則", "You must follow the school {rules}.", "校則は守らなければなりません。"),
    s("統治する", "The king {ruled} the country for forty years.", "その王は40年間国を治めました。")
  ] },
  { word: "will", senses: [
    s("〜だろう", "It {will} rain tomorrow.", "明日は雨が降るでしょう。"),
    s("意志", "She has a strong {will}.", "彼女は意志が強い。"),
    s("遺言", "He left all his money to his son in his {will}.", "彼は遺言で全財産を息子に残しました。")
  ] },
  { word: "may", senses: [
    s("〜してもよい", "You {may} go home now.", "もう帰ってもいいですよ。"),
    s("〜かもしれない", "Take an umbrella. It {may} rain later.", "傘を持っていきなさい。後で雨が降るかもしれません。")
  ] },
  { word: "leave", senses: [
    s("去る、出発する", "I {leave} home at seven every morning.", "私は毎朝7時に家を出ます。"),
    s("置き忘れる", "I {left} my umbrella on the train.", "電車に傘を置き忘れました。"),
    s("休暇", "She is on {leave} for two weeks.", "彼女は2週間の休暇中です。")
  ] },
  { word: "second", senses: [
    s("2番目の", "This is my {second} visit to Kyoto.", "京都に来るのはこれで2回目です。"),
    s("秒", "The runner was only one {second} behind.", "その走者はわずか1秒差でした。")
  ] },
  { word: "hold", senses: [
    s("手に持つ", "She {held} the baby in her arms.", "彼女は赤ちゃんを腕に抱いていました。"),
    s("開催する", "The festival is {held} every August.", "その祭りは毎年8月に開かれます。")
  ] },
  { word: "bright", senses: [
    s("明るい", "The room is very {bright} in the morning.", "その部屋は朝とても明るい。"),
    s("頭のよい", "She is a {bright} student.", "彼女は頭のよい生徒です。")
  ] },
  { word: "spell", senses: [
    s("つづる", "How do you {spell} your name?", "あなたの名前はどうつづりますか。"),
    s("呪文、魔法", "The witch cast a {spell} on the prince.", "魔女は王子に魔法をかけました。")
  ] },
  { word: "temple", senses: [
    s("寺", "We visited an old {temple} in Nara.", "私たちは奈良の古い寺を訪れました。"),
    s("こめかみ", "He pressed his fingers against his {temples}.", "彼はこめかみに指を当てました。")
  ] },
  { word: "lot", senses: [
    s("たくさん", "I have a {lot} of homework today.", "今日は宿題がたくさんあります。"),
    s("区画、用地", "They built a house on an empty {lot}.", "彼らは空き地に家を建てました。")
  ] },

  // ───────────── 中級（高校1年）─────────────
  { word: "last", senses: [
    s("続く、持続する", "The meeting {lasted} three hours.", "会議は3時間続きました。"),
    s("最後の", "This is the {last} train tonight.", "これが今夜の最終電車です。"),
    s("この前の", "I met him {last} week.", "私は先週彼に会いました。")
  ] },
  { word: "patient", senses: [
    s("我慢強い", "Be {patient}. The bus will come soon.", "辛抱して。バスはもうすぐ来るよ。"),
    s("患者", "The doctor saw twenty {patients} today.", "その医者は今日20人の患者を診ました。")
  ] },
  { word: "account", senses: [
    s("口座", "I opened a bank {account} last week.", "私は先週銀行口座を開きました。"),
    s("説明、報告", "He gave a detailed {account} of the accident.", "彼は事故について詳しく説明しました。")
  ] },
  { word: "claim", senses: [
    s("主張する", "He {claims} that he saw a UFO.", "彼はUFOを見たと主張しています。"),
    s("（当然の権利として）要求する", "You can {claim} your lost bag at the office.", "なくしたかばんは事務所で受け取れます。")
  ] },
  { word: "fall", senses: [
    s("落ちる、転ぶ", "Be careful not to {fall} on the ice.", "氷の上で転ばないように気をつけて。"),
    s("秋", "The leaves turn red in the {fall}.", "秋になると葉が赤くなります。")
  ] },
  { word: "interest", senses: [
    s("興味、関心", "She has a strong {interest} in history.", "彼女は歴史に強い関心があります。"),
    s("利子", "The bank pays two percent {interest}.", "その銀行は2パーセントの利子を払います。")
  ] },
  { word: "lead", senses: [
    s("導く、案内する", "This road {leads} to the station.", "この道は駅に通じています。"),
    s("鉛", "Old water pipes were made of {lead}.", "古い水道管は鉛でできていました。")
  ] },
  { word: "toast", senses: [
    s("トースト", "I had {toast} and eggs for breakfast.", "朝食にトーストと卵を食べました。"),
    s("乾杯", "Let's drink a {toast} to the bride and groom.", "新郎新婦に乾杯しましょう。")
  ] },
  { word: "rest", senses: [
    s("休息する", "Let's {rest} here for a while.", "ここでしばらく休みましょう。"),
    s("残り", "I'll do the {rest} of the work tomorrow.", "残りの仕事は明日やります。")
  ] },
  { word: "novel", senses: [
    s("小説", "I'm reading a {novel} by Natsume Soseki.", "私は夏目漱石の小説を読んでいます。"),
    s("斬新な、目新しい", "She came up with a {novel} idea.", "彼女は斬新なアイデアを思いつきました。")
  ] },
  { word: "measure", senses: [
    s("措置、対策", "The government took {measures} to stop the disease.", "政府はその病気を食い止めるための措置をとりました。"),
    s("測る", "Let's {measure} the size of the room.", "部屋の大きさを測りましょう。")
  ] },
  { word: "raise", senses: [
    s("上げる", "{Raise} your hand if you have a question.", "質問があれば手を挙げてください。"),
    s("育てる", "She {raised} three children by herself.", "彼女は1人で3人の子どもを育てました。"),
    s("（お金を）集める", "The students {raised} money for the hospital.", "生徒たちは病院のためにお金を集めました。")
  ] },
  { word: "feature", senses: [
    s("特徴", "The main {feature} of this phone is its camera.", "この電話のいちばんの特徴はカメラです。"),
    s("目玉にする、主演させる", "The movie {features} a famous actor.", "その映画は有名な俳優を主役にしています。")
  ] },
  { word: "degree", senses: [
    s("温度・角度の単位", "It's thirty {degrees} today.", "今日は30度あります。"),
    s("学位", "She has a {degree} in economics.", "彼女は経済学の学位を持っています。"),
    s("程度", "I agree with you to some {degree}.", "ある程度はあなたに賛成です。")
  ] },
  { word: "order", senses: [
    s("命令", "The soldiers followed the captain's {orders}.", "兵士たちは隊長の命令に従いました。"),
    s("注文", "Can I take your {order}?", "ご注文をうかがいましょうか。"),
    s("順序", "The names are listed in alphabetical {order}.", "名前はアルファベット順に並んでいます。")
  ] },
  { word: "address", senses: [
    s("住所", "Please write your name and {address} here.", "ここにお名前とご住所を書いてください。"),
    s("演説", "The president gave an {address} on TV.", "大統領はテレビで演説をしました。"),
    s("（問題に）取り組む", "We must {address} this problem quickly.", "私たちはこの問題にすぐ取り組まなければなりません。")
  ] },
  { word: "cover", senses: [
    s("覆う", "Snow {covered} the ground.", "雪が地面を覆いました。"),
    s("取材する、報道する", "Many reporters {covered} the event.", "多くの記者がその出来事を取材しました。"),
    s("（費用を）まかなう", "Will five thousand yen {cover} the cost?", "5,000円で費用はまかなえますか。")
  ] },
  { word: "issue", senses: [
    s("問題", "Climate change is a serious {issue}.", "気候変動は深刻な問題です。"),
    s("（雑誌などの）号", "I bought the latest {issue} of the magazine.", "私はその雑誌の最新号を買いました。"),
    s("発行する、出す", "The city {issued} a warning about the storm.", "市は嵐についての警報を出しました。")
  ] },
  { word: "charge", senses: [
    s("料金", "There is no {charge} for children.", "子どもは無料です。"),
    s("責任、管理", "Who is in {charge} of this project?", "この計画の責任者は誰ですか。"),
    s("充電する", "I need to {charge} my phone.", "電話を充電しなくては。")
  ] },
  { word: "stock", senses: [
    s("在庫", "That shirt is out of {stock}.", "そのシャツは在庫切れです。"),
    s("株", "He invested his savings in {stocks}.", "彼は貯金を株に投資しました。")
  ] },
  { word: "content", senses: [
    s("内容、中身", "The {content} of his speech was interesting.", "彼のスピーチの内容はおもしろかった。"),
    s("満足して", "She is {content} with her simple life.", "彼女は質素な暮らしに満足しています。")
  ] },
  { word: "harbor", senses: [
    s("港", "Many ships are in the {harbor}.", "港には多くの船がいます。"),
    s("（感情を）心に抱く", "He {harbors} a deep dislike of lies.", "彼はうそを強く嫌っています。")
  ] },
  { word: "mean", senses: [
    s("意味する", "What does this word {mean}?", "この語はどういう意味ですか。"),
    s("意地悪な", "Don't be {mean} to your little sister.", "妹に意地悪をしてはいけません。")
  ] },
  { word: "observe", senses: [
    s("観察する", "We {observed} the stars through a telescope.", "私たちは望遠鏡で星を観察しました。"),
    s("（規則を）守る", "Everyone must {observe} the traffic rules.", "誰もが交通規則を守らなければなりません。")
  ] },
  { word: "sign", senses: [
    s("標識、合図", "The {sign} says \"No parking.\"", "標識には「駐車禁止」と書いてあります。"),
    s("署名する", "Please {sign} your name here.", "ここに署名してください。")
  ] },
  { word: "develop", senses: [
    s("開発する、発達させる", "The company {developed} a new medicine.", "その会社は新しい薬を開発しました。"),
    s("（病気に）かかる", "She {developed} a fever after the trip.", "彼女は旅行の後で熱を出しました。")
  ] },
  { word: "fit", senses: [
    s("（大きさ・形が）合う", "These shoes {fit} me perfectly.", "この靴は私にぴったりです。"),
    s("健康な", "He runs every day to keep {fit}.", "彼は健康を保つために毎日走っています。")
  ] },
  { word: "jam", senses: [
    s("ジャム", "I put strawberry {jam} on my toast.", "私はトーストにイチゴジャムを塗りました。"),
    s("渋滞", "We were stuck in a traffic {jam} for an hour.", "私たちは1時間渋滞に巻きこまれました。")
  ] },
  { word: "mark", senses: [
    s("印", "Put a {mark} next to the correct answer.", "正しい答えの横に印をつけてください。"),
    s("点数、成績", "She got good {marks} in math.", "彼女は数学でよい点を取りました。")
  ] },
  { word: "rock", senses: [
    s("岩", "We sat on a big {rock} by the sea.", "私たちは海辺の大きな岩に座りました。"),
    s("揺らす", "She {rocked} the baby to sleep.", "彼女は赤ちゃんを揺らして寝かしつけました。")
  ] },
  { word: "sense", senses: [
    s("感覚", "Dogs have a strong {sense} of smell.", "犬は嗅覚が鋭い。"),
    s("意味", "This word is used in several different {senses}.", "この語はいくつかの違う意味で使われます。")
  ] },
  { word: "staff", senses: [
    s("職員、スタッフ", "The hotel {staff} were very kind.", "ホテルの従業員はとても親切でした。"),
    s("つえ、棒", "The old man walked with a wooden {staff}.", "その老人は木のつえをついて歩きました。")
  ] },
  { word: "stamp", senses: [
    s("切手", "I need a {stamp} for this letter.", "この手紙に貼る切手が必要です。"),
    s("踏み鳴らす", "He {stamped} his feet to keep warm.", "彼は体を温めるために足を踏み鳴らしました。")
  ] },
  { word: "tie", senses: [
    s("ネクタイ", "He wears a {tie} to work.", "彼は仕事にネクタイをしていきます。"),
    s("結ぶ", "{Tie} your shoes before you run.", "走る前に靴ひもを結びなさい。"),
    s("引き分け", "The game ended in a {tie}.", "試合は引き分けに終わりました。")
  ] },
  { word: "rare", senses: [
    s("まれな、珍しい", "It is {rare} to see snow here.", "ここで雪を見るのは珍しい。"),
    s("（肉が）生焼けの", "I'd like my steak {rare}, please.", "ステーキはレアでお願いします。")
  ] },
  { word: "own", senses: [
    s("自身の", "I want my {own} room.", "自分の部屋がほしい。"),
    s("所有する", "Who {owns} this car?", "この車の持ち主は誰ですか。")
  ] },
  { word: "vehicle", senses: [
    s("乗り物、車", "No {vehicles} are allowed in the park.", "公園内に車は入れません。"),
    s("（表現・伝達の）手段", "Music is a {vehicle} for expressing feelings.", "音楽は気持ちを表す手段です。")
  ] },
  { word: "treat", senses: [
    s("扱う", "Please {treat} these old books carefully.", "この古い本は丁寧に扱ってください。"),
    s("治療する", "The doctor {treated} her injury.", "医者は彼女のけがを治療しました。"),
    s("おごる", "I'll {treat} you to lunch today.", "今日は昼ごはんをおごるよ。")
  ] },
  { word: "strike", senses: [
    s("打つ、叩く", "The ball {struck} him on the head.", "ボールが彼の頭に当たりました。"),
    s("ストライキ", "The workers went on {strike}.", "労働者たちはストライキに入りました。"),
    s("（考えが）ふと浮かぶ", "A good idea suddenly {struck} me.", "ふといい考えが浮かびました。")
  ] },
  { word: "scale", senses: [
    s("規模", "The project was carried out on a large {scale}.", "その計画は大規模に行われました。"),
    s("はかり、体重計", "Step on the {scale} to check your weight.", "体重計に乗って体重を確かめてください。"),
    s("うろこ", "Fish are covered with {scales}.", "魚はうろこで覆われています。")
  ] },
  { word: "court", senses: [
    s("裁判所", "The case was taken to {court}.", "その件は裁判に持ちこまれました。"),
    s("（テニスなどの）コート", "They played tennis on the {court} behind the school.", "彼らは学校の裏のコートでテニスをしました。")
  ] },
  { word: "drill", senses: [
    s("訓練", "We had a fire {drill} at school today.", "今日、学校で避難訓練がありました。"),
    s("穴をあける", "He {drilled} a hole in the wall.", "彼は壁に穴をあけました。")
  ] },
  { word: "pack", senses: [
    s("荷造りする", "I {packed} my bag for the trip.", "私は旅行に向けてかばんに荷物を詰めました。"),
    s("（動物の）群れ", "A {pack} of wolves appeared in the forest.", "森にオオカミの群れが現れました。")
  ] },
  { word: "safe", senses: [
    s("安全な", "This area is {safe} even at night.", "この地域は夜でも安全です。"),
    s("金庫", "He kept the money in a {safe}.", "彼はお金を金庫にしまっていました。")
  ] },
  { word: "screen", senses: [
    s("画面", "The {screen} of my phone is broken.", "私の電話の画面が割れています。"),
    s("検査する、ふるい分ける", "All passengers are {screened} at the airport.", "乗客は全員、空港で検査を受けます。")
  ] },
  { word: "refuse", senses: [
    s("拒否する", "She {refused} to answer the question.", "彼女はその質問に答えるのを拒みました。"),
    s("ごみ、廃棄物", "The city collects {refuse} on Mondays.", "市は月曜日にごみを収集します。")
  ] },
  { word: "substance", senses: [
    s("物質", "Water is the most common {substance} on Earth.", "水は地球上で最もありふれた物質です。"),
    s("要旨、中身", "The {substance} of his speech was clear.", "彼の話の要旨ははっきりしていました。")
  ] },

  // ───────────── 中級（高校2年）─────────────
  { word: "object", senses: [
    s("物体", "A strange {object} was flying in the sky.", "奇妙な物体が空を飛んでいました。"),
    s("反対する", "Many people {object} to the new rule.", "多くの人が新しい規則に反対しています。")
  ] },
  { word: "command", senses: [
    s("命令する", "The officer {commanded} them to stop.", "警官は彼らに止まるよう命じました。"),
    s("（景色を）見渡す", "The hotel {commands} a fine view of the sea.", "そのホテルからは海がよく見渡せます。"),
    s("（言語を）使いこなす力", "She has a good {command} of English.", "彼女は英語を自在に使いこなします。")
  ] },
  { word: "mass", senses: [
    s("かたまり", "A {mass} of snow fell from the roof.", "屋根から雪のかたまりが落ちてきました。"),
    s("ミサ（礼拝）", "The family goes to {Mass} every Sunday.", "その家族は毎週日曜日にミサへ行きます。")
  ] },
  { word: "credit", senses: [
    s("信用", "The shop sold him the TV on {credit}.", "その店は信用貸しで彼にテレビを売りました。"),
    s("（授業の）単位", "I need two more {credits} to graduate.", "卒業するにはあと2単位必要です。"),
    s("功績、名誉", "She deserves the {credit} for our success.", "私たちの成功は彼女のおかげです。")
  ] },
  { word: "bill", senses: [
    s("請求書、勘定", "The waiter brought us the {bill}.", "ウエーターが勘定書を持ってきました。"),
    s("紙幣", "He paid with a ten-dollar {bill}.", "彼は10ドル紙幣で払いました。"),
    s("法案", "The {bill} was passed by Congress.", "その法案は議会で可決されました。")
  ] },
  { word: "face", senses: [
    s("直面する", "We {face} many problems.", "私たちは多くの問題に直面しています。"),
    s("顔", "Wash your {face} with cold water.", "冷たい水で顔を洗いなさい。"),
    s("（建物が）〜の方を向く", "My room {faces} the sea.", "私の部屋は海に面しています。")
  ] },
  { word: "commit", senses: [
    s("専念する、ゆだねる", "She {committed} herself to her studies.", "彼女は勉強に専念しました。"),
    s("（罪を）犯す", "He {committed} a crime when he was young.", "彼は若いころに罪を犯しました。")
  ] },
  { word: "figure", senses: [
    s("姿、形", "I saw a dark {figure} in the fog.", "霧の中に黒い人影が見えました。"),
    s("数字", "The sales {figures} for May were good.", "5月の売上の数字はよかった。"),
    s("人物", "He is an important {figure} in Japanese history.", "彼は日本史上の重要な人物です。")
  ] },
  { word: "apply", senses: [
    s("適用する、当てはまる", "This rule {applies} to everyone.", "この規則は全員に当てはまります。"),
    s("申し込む、応募する", "She {applied} for the job.", "彼女はその仕事に応募しました。"),
    s("（薬などを）塗る", "{Apply} the cream twice a day.", "クリームを1日2回塗ってください。")
  ] },
  { word: "conduct", senses: [
    s("行為、ふるまい", "His {conduct} at school was excellent.", "彼の学校での態度は立派でした。"),
    s("実施する", "They {conducted} a survey of students.", "彼らは学生を対象に調査を実施しました。"),
    s("指揮する", "Who {conducted} the orchestra tonight?", "今夜オーケストラを指揮したのは誰ですか。")
  ] },
  { word: "reflect", senses: [
    s("反映する", "The novel {reflects} life in the 1920s.", "その小説は1920年代の暮らしを反映しています。"),
    s("（水面などが）姿を映し出す", "The lake {reflected} the mountains.", "湖に山々が映っていました。"),
    s("よく考える", "Take time to {reflect} on your mistakes.", "時間をかけて自分の失敗についてよく考えなさい。")
  ] },
  { word: "company", senses: [
    s("会社", "My father works for a big {company}.", "父は大きな会社で働いています。"),
    s("一緒にいること、同席", "I really enjoyed your {company} today.", "今日はご一緒できて本当に楽しかったです。")
  ] },
  { word: "draw", senses: [
    s("描く", "She {drew} a picture of her cat.", "彼女は自分の猫の絵を描きました。"),
    s("引き分け", "The game ended in a {draw}.", "試合は引き分けに終わりました。"),
    s("（人を）引きつける", "The festival {draws} many tourists.", "その祭りは多くの観光客を引きつけます。")
  ] },
  { word: "attend", senses: [
    s("出席する", "I {attended} the meeting yesterday.", "私は昨日その会議に出席しました。"),
    s("（〜の）世話をする、対応する", "The nurses {attend} to the patients day and night.", "看護師たちは昼も夜も患者の世話をしています。")
  ] },
  { word: "tear", senses: [
    s("引き裂く", "He {tore} the letter into pieces.", "彼は手紙をびりびりに破りました。"),
    s("涙", "{Tears} ran down her cheeks.", "涙が彼女のほおを伝いました。")
  ] },
  { word: "express", senses: [
    s("表現する", "It's hard to {express} my feelings in English.", "英語で気持ちを表すのは難しい。"),
    s("急行", "Take the {express} to Osaka.", "大阪へは急行に乗ってください。")
  ] },
  { word: "appreciate", senses: [
    s("感謝する", "I really {appreciate} your help.", "手伝ってくれて本当に感謝しています。"),
    s("（価値が）上がる", "The house has {appreciated} in value.", "その家の価値は上がりました。")
  ] },
  { word: "manner", senses: [
    s("やり方、方法", "She spoke in a friendly {manner}.", "彼女は親しげな話し方をしました。"),
    s("行儀、作法", "It's bad {manners} to talk with your mouth full.", "口に物を入れたまま話すのは行儀が悪い。")
  ] },
  { word: "vessel", senses: [
    s("容器", "Water was kept in a clay {vessel}.", "水は土の器に入れてありました。"),
    s("船", "A large {vessel} entered the port.", "大きな船が港に入ってきました。"),
    s("血管", "Blood {vessels} carry blood around the body.", "血管は血液を全身に運びます。")
  ] },
  { word: "fair", senses: [
    s("公平な", "That's not {fair}!", "そんなの不公平だ！"),
    s("見本市、博覧会", "We went to a book {fair} last weekend.", "私たちは先週末、本の見本市に行きました。"),
    s("（髪が）金色の、（肌が）色白の", "The girl has {fair} hair and blue eyes.", "その女の子は金髪で青い目をしています。")
  ] },
  { word: "plant", senses: [
    s("植物", "Water the {plants} every day.", "植物には毎日水をやりなさい。"),
    s("工場", "He works at a power {plant}.", "彼は発電所で働いています。"),
    s("植える", "We {planted} roses in the garden.", "私たちは庭にバラを植えました。")
  ] },
  { word: "matter", senses: [
    s("問題、困ったこと", "What's the {matter} with you?", "どうしたのですか。"),
    s("重要である", "It doesn't {matter} to me.", "私にはどうでもいいことです。"),
    s("物質", "Everything is made of {matter}.", "あらゆるものは物質でできています。")
  ] },
  { word: "deal", senses: [
    s("扱う", "This book {deals} with climate change.", "この本は気候変動を扱っています。"),
    s("取引", "We made a {deal} with the company.", "私たちはその会社と取引をしました。")
  ] },
  { word: "state", senses: [
    s("状態", "The house was in a bad {state}.", "その家はひどい状態でした。"),
    s("州", "Texas is a large {state}.", "テキサスは大きな州です。"),
    s("述べる", "Please {state} your name and age.", "名前と年齢を述べてください。")
  ] },
  { word: "bear", senses: [
    s("我慢する", "I can't {bear} this heat.", "この暑さには耐えられません。"),
    s("熊", "A {bear} came out of the forest.", "森から熊が出てきました。")
  ] },
  { word: "bark", senses: [
    s("ほえる", "The dog {barked} at the stranger.", "犬は見知らぬ人にほえました。"),
    s("木の皮", "The {bark} of this tree is very rough.", "この木の皮はとてもざらざらしています。")
  ] },
  { word: "nail", senses: [
    s("くぎ", "He hit the {nail} with a hammer.", "彼はかなづちでくぎを打ちました。"),
    s("つめ", "She painted her {nails} red.", "彼女はつめを赤く塗りました。")
  ] },
  { word: "organ", senses: [
    s("臓器", "The heart is an important {organ}.", "心臓は大切な臓器です。"),
    s("（楽器の）オルガン", "She plays the {organ} at church.", "彼女は教会でオルガンをひきます。")
  ] },
  { word: "pole", senses: [
    s("棒、柱", "The flag is on top of a tall {pole}.", "旗は高い柱のてっぺんにあります。"),
    s("（地球の）極", "It is very cold at the North {Pole}.", "北極はとても寒い。")
  ] },
  { word: "pound", senses: [
    s("ポンド（単位）", "This book costs ten {pounds}.", "この本は10ポンドです。"),
    s("強くたたく", "Someone was {pounding} on the door.", "誰かがドアをどんどんたたいていました。")
  ] },
  { word: "race", senses: [
    s("競走", "She won the 100-meter {race}.", "彼女は100メートル走で優勝しました。"),
    s("人種", "People of every {race} live in this city.", "この都市にはあらゆる人種の人々が住んでいます。")
  ] },
  { word: "tire", senses: [
    s("疲れさせる", "Long walks {tire} me out.", "長く歩くと私はくたくたになります。"),
    s("タイヤ", "We had a flat {tire} on the highway.", "高速道路でタイヤがパンクしました。")
  ] },
  { word: "lie", senses: [
    s("横たわる", "He {lay} on the grass and looked at the sky.", "彼は草の上に寝転んで空を見ました。"),
    s("うそ", "Don't tell {lies}.", "うそをついてはいけません。")
  ] },
  { word: "flat", senses: [
    s("平らな", "The land here is very {flat}.", "このあたりの土地はとても平らです。"),
    s("パンクした", "My bike has a {flat} tire.", "私の自転車のタイヤがパンクしています。"),
    s("アパート", "She lives in a small {flat} in London.", "彼女はロンドンの小さなアパートに住んでいます。")
  ] },
  { word: "concern", senses: [
    s("心配させる", "His health {concerns} me.", "彼の健康が気がかりです。"),
    s("関係する", "This problem {concerns} all of us.", "この問題は私たち全員に関係があります。")
  ] },
  { word: "nature", senses: [
    s("自然", "I love being close to {nature}.", "私は自然の近くにいるのが好きです。"),
    s("性質、本質", "It's human {nature} to want to be loved.", "愛されたいと思うのは人間の本性です。")
  ] },
  { word: "current", senses: [
    s("現在の", "What is your {current} address?", "あなたの現住所はどこですか。"),
    s("（水・空気の）流れ", "The {current} in this river is very strong.", "この川は流れがとても速い。")
  ] },
  { word: "bound", senses: [
    s("きっと〜する", "He is {bound} to win the race.", "彼はきっとそのレースに勝つでしょう。"),
    s("〜行きの", "This train is {bound} for Tokyo.", "この電車は東京行きです。")
  ] },
  { word: "hatch", senses: [
    s("（卵が）かえる", "The eggs {hatched} yesterday.", "卵は昨日かえりました。"),
    s("（計画を）企てる", "The prisoners {hatched} a plan to escape.", "囚人たちは脱走の計画を企てました。")
  ] },
  { word: "lodge", senses: [
    s("山小屋、ロッジ", "We stayed at a ski {lodge}.", "私たちはスキー場のロッジに泊まりました。"),
    s("（苦情を）申し立てる", "She {lodged} a complaint with the manager.", "彼女は店長に苦情を申し立てました。")
  ] },
  { word: "minor", senses: [
    s("重要でない、小さい方の", "It's only a {minor} problem.", "それはささいな問題にすぎません。"),
    s("未成年者", "Alcohol is not sold to {minors}.", "未成年者には酒類を販売しません。")
  ] },
  { word: "press", senses: [
    s("押す", "{Press} the button to start.", "ボタンを押すと始まります。"),
    s("報道機関、報道陣", "The {press} was not allowed into the room.", "報道陣はその部屋に入れませんでした。")
  ] },
  { word: "season", senses: [
    s("季節", "Summer is my favorite {season}.", "夏は私のいちばん好きな季節です。"),
    s("味付けする", "{Season} the soup with salt and pepper.", "スープに塩とこしょうで味をつけてください。")
  ] },
  { word: "steep", senses: [
    s("（坂などが）急な", "The hill is very {steep}.", "その坂はとても急です。"),
    s("（値段が）法外な", "The prices at that hotel are a bit {steep}.", "あのホテルの料金は少し高すぎる。")
  ] },
  { word: "cell", senses: [
    s("細胞", "The human body has trillions of {cells}.", "人間の体には何兆もの細胞があります。"),
    s("独房", "The prisoner was kept in a small {cell}.", "その囚人は小さな独房に入れられていました。")
  ] },
  { word: "due", senses: [
    s("期限の、締め切りの", "The report is {due} on Friday.", "レポートの締め切りは金曜日です。"),
    s("到着予定の", "The next train is {due} at three o'clock.", "次の電車は3時に着く予定です。")
  ] },
  { word: "draft", senses: [
    s("下書き", "I wrote the first {draft} of my essay.", "作文の最初の下書きを書きました。"),
    s("すきま風", "There's a cold {draft} coming from the window.", "窓から冷たいすきま風が入ってきます。")
  ] },
  { word: "digest", senses: [
    s("要約", "I read a short {digest} of the news.", "ニュースの短い要約を読みました。"),
    s("消化する", "Some foods are hard to {digest}.", "消化しにくい食べ物もあります。")
  ] },
  { word: "realize", senses: [
    s("だとわかる、気づく", "I suddenly {realized} I had left my wallet at home.", "財布を家に忘れてきたことに急に気づきました。"),
    s("実現する", "She {realized} her dream of becoming a doctor.", "彼女は医者になるという夢を実現しました。")
  ] },
  { word: "abstract", senses: [
    s("抽象的な", "Love is an {abstract} idea.", "愛は抽象的な概念です。"),
    s("（論文の）要旨", "Read the {abstract} before the full paper.", "論文全体の前に要旨を読みなさい。")
  ] },
  { word: "objective", senses: [
    s("目標", "Our main {objective} is to win the league.", "私たちの第一の目標はリーグ優勝です。"),
    s("客観的な", "Try to be {objective} when you judge others.", "人を判断するときは客観的になるよう努めなさい。")
  ] },
  { word: "vain", senses: [
    s("うぬぼれの強い", "He is so {vain} about his looks.", "彼は自分の見た目をひどく鼻にかけています。"),
    s("むだな", "All our efforts were in {vain}.", "私たちの努力はすべてむだに終わりました。")
  ] },
  { word: "tap", senses: [
    s("軽くたたく", "Someone {tapped} me on the shoulder.", "誰かが私の肩を軽くたたきました。"),
    s("蛇口", "Turn off the {tap} when you brush your teeth.", "歯をみがくときは蛇口を閉めなさい。")
  ] },
  { word: "delicate", senses: [
    s("繊細な", "This is a very {delicate} glass, so be careful.", "これはとても繊細なグラスなので気をつけて。"),
    s("（問題が）微妙な、扱いにくい", "Money is a {delicate} subject in many families.", "お金は多くの家庭で扱いにくい話題です。")
  ] },
  { word: "record", senses: [
    s("記録", "She broke the world {record}.", "彼女は世界記録を破りました。"),
    s("レコード盤", "My father collects old jazz {records}.", "父は古いジャズのレコードを集めています。")
  ] },
  { word: "deed", senses: [
    s("行い", "He did a good {deed} today.", "彼は今日よい行いをしました。"),
    s("（土地などの）権利証書", "Keep the {deed} to the house in a safe place.", "家の権利証書は安全な場所に保管してください。")
  ] },

  // ───────────── 中級（高校3年）─────────────
  { word: "assume", senses: [
    s("想定する、とみなす", "I {assume} you know the rules.", "あなたは規則を知っているものと思っています。"),
    s("（責任・役職を）引き受ける", "She {assumed} the role of team leader.", "彼女はチームリーダーの役を引き受けました。")
  ] },
  { word: "dismiss", senses: [
    s("解雇する", "He was {dismissed} for being late again and again.", "彼は遅刻を繰り返したため解雇されました。"),
    s("（授業などを）終わらせる", "The teacher {dismissed} the class early.", "先生は授業を早めに終わらせました。")
  ] },
  { word: "execute", senses: [
    s("実行する", "We {executed} the plan perfectly.", "私たちは計画を完璧に実行しました。"),
    s("処刑する", "The king was {executed} in 1649.", "その王は1649年に処刑されました。")
  ] },
  { word: "spare", senses: [
    s("予備の", "Do you have a {spare} key?", "合い鍵を持っていますか。"),
    s("（時間などを）割く", "Can you {spare} a few minutes?", "少しお時間をいただけますか。")
  ] },
  { word: "tender", senses: [
    s("柔らかい", "The meat was very {tender}.", "その肉はとても柔らかかった。"),
    s("優しい", "She gave the child a {tender} smile.", "彼女はその子に優しくほほえみました。"),
    s("入札", "Three companies made {tenders} for the new bridge.", "新しい橋の工事に3社が入札しました。")
  ] },
  { word: "fault", senses: [
    s("欠点、短所", "Everyone has some {faults}.", "誰にでも欠点はあります。"),
    s("（過失の）責任", "It's not your {fault}.", "それはあなたのせいではありません。")
  ] },
  { word: "engage", senses: [
    s("従事させる", "He is {engaged} in cancer research.", "彼はがんの研究に従事しています。"),
    s("婚約させる", "They got {engaged} last month.", "2人は先月婚約しました。")
  ] },
  { word: "settle", senses: [
    s("解決する", "They finally {settled} the argument.", "彼らはようやく言い争いを決着させました。"),
    s("定住する", "His family {settled} in Canada.", "彼の家族はカナダに移り住みました。")
  ] },
  { word: "pitch", senses: [
    s("投げる", "He {pitched} the ball very fast.", "彼はとても速いボールを投げました。"),
    s("（音の）高さ", "She sang the song at a high {pitch}.", "彼女はその歌を高い音で歌いました。"),
    s("（テントを）張る", "We {pitched} our tent by the lake.", "私たちは湖のそばにテントを張りました。")
  ] },
  { word: "tip", senses: [
    s("先端", "The {tip} of my pencil broke.", "鉛筆の先が折れました。"),
    s("チップ", "We left a {tip} for the waiter.", "私たちはウエーターにチップを置いていきました。"),
    s("助言、ヒント", "He gave me some useful {tips} for the interview.", "彼は面接に役立つ助言をくれました。")
  ] },
  { word: "pupil", senses: [
    s("生徒", "There are thirty {pupils} in the class.", "そのクラスには30人の生徒がいます。"),
    s("瞳", "Your {pupils} get bigger in the dark.", "暗いところでは瞳が大きくなります。")
  ] },
  { word: "plain", senses: [
    s("簡素な、わかりやすい", "She wore a {plain} white dress.", "彼女は飾りのない白いドレスを着ていました。"),
    s("平原", "Cows were eating grass on the {plain}.", "牛が平原で草を食べていました。")
  ] },
  { word: "firm", senses: [
    s("しっかりした、堅い", "This bed is too {firm} for me.", "このベッドは私には硬すぎます。"),
    s("会社", "He works for a law {firm} in Tokyo.", "彼は東京の法律事務所で働いています。")
  ] },
  { word: "term", senses: [
    s("期間", "The president serves a four-year {term}.", "大統領の任期は4年です。"),
    s("専門用語", "\"Photosynthesis\" is a scientific {term}.", "「光合成」は科学の用語です。"),
    s("条件", "Read the {terms} of the contract carefully.", "契約の条件をよく読みなさい。")
  ] },
  { word: "yield", senses: [
    s("産出する", "This land {yields} a lot of rice.", "この土地は米がたくさんとれます。"),
    s("屈する、譲る", "He finally {yielded} to the pressure.", "彼はついに圧力に屈しました。")
  ] },
  { word: "suit", senses: [
    s("適合する、似合う", "That color really {suits} you.", "その色はあなたによく似合います。"),
    s("スーツ", "He wore a dark {suit} to the interview.", "彼は面接に濃い色のスーツを着ていきました。"),
    s("訴訟", "She filed a {suit} against the company.", "彼女はその会社を相手に訴訟を起こしました。")
  ] },
  { word: "bow", senses: [
    s("お辞儀する", "The students {bowed} to the teacher.", "生徒たちは先生にお辞儀をしました。"),
    s("弓", "He shot an arrow with a {bow}.", "彼は弓で矢を射ました。")
  ] },
  { word: "odd", senses: [
    s("変な", "That's an {odd} thing to say.", "それは妙なことを言うね。"),
    s("奇数の", "One, three and five are {odd} numbers.", "1、3、5は奇数です。")
  ] },
  { word: "reserve", senses: [
    s("取っておく", "These seats are {reserved} for elderly people.", "これらの席はお年寄りのために取ってあります。"),
    s("蓄え、埋蔵量", "The country has large oil {reserves}.", "その国には石油が大量に埋蔵されています。")
  ] },
  { word: "capital", senses: [
    s("資本", "You need a lot of {capital} to start a business.", "事業を始めるには多くの資本が必要です。"),
    s("首都", "Tokyo is the {capital} of Japan.", "東京は日本の首都です。"),
    s("大文字", "Write your name in {capital} letters.", "名前を大文字で書いてください。")
  ] },
  { word: "cabinet", senses: [
    s("戸棚", "Put the cups back in the kitchen {cabinet}.", "カップを台所の戸棚に戻してください。"),
    s("内閣", "The prime minister chose a new {cabinet}.", "首相は新しい内閣を組織しました。")
  ] },
  { word: "exploit", senses: [
    s("利用する、搾取する", "The company {exploited} its workers.", "その会社は従業員を搾取しました。"),
    s("手柄、偉業", "The book tells of his {exploits} during the war.", "その本は戦争中の彼の手柄を伝えています。")
  ] },
  { word: "hail", senses: [
    s("あられ、ひょう", "{Hail} fell heavily during the storm.", "嵐の間、ひょうが激しく降りました。"),
    s("呼び止める", "She {hailed} a taxi outside the hotel.", "彼女はホテルの前でタクシーを呼び止めました。")
  ] },
  { word: "mint", senses: [
    s("ミント、ハッカ", "This tea has fresh {mint} in it.", "このお茶には生のミントが入っています。"),
    s("造幣局", "Coins are made at the {mint}.", "硬貨は造幣局で作られます。")
  ] },
  { word: "mold", senses: [
    s("型", "Pour the chocolate into a heart-shaped {mold}.", "チョコレートをハート形の型に流しこんでください。"),
    s("かび", "There's green {mold} on the bread.", "パンに緑色のかびが生えています。")
  ] },
  { word: "pad", senses: [
    s("当て物", "He wore knee {pads} when he skated.", "彼はスケートをするときひざ当てをつけていました。"),
    s("メモ帳", "Write the number on this {pad}.", "その番号をこのメモ帳に書いてください。")
  ] },
  { word: "patron", senses: [
    s("後援者", "She is a well-known {patron} of the arts.", "彼女は芸術の後援者としてよく知られています。"),
    s("常連客", "The restaurant's {patrons} love the soup.", "そのレストランの常連客はスープが大好きです。")
  ] },
  { word: "punch", senses: [
    s("げんこつで殴る", "He {punched} the bag as hard as he could.", "彼は力いっぱいサンドバッグを殴りました。"),
    s("（穴を）あける", "{Punch} two holes in the paper.", "紙に穴を2つあけてください。")
  ] },
  { word: "rash", senses: [
    s("発疹", "I have a red {rash} on my arm.", "腕に赤い発疹が出ています。"),
    s("軽率な", "That was a {rash} decision.", "それは軽率な決断でした。")
  ] },
  { word: "stern", senses: [
    s("厳格な", "Our teacher is very {stern}.", "私たちの先生はとても厳しい。"),
    s("船尾", "We stood at the {stern} of the ship.", "私たちは船の後部に立っていました。")
  ] },
  { word: "relief", senses: [
    s("安堵", "It was a great {relief} to hear the news.", "その知らせを聞いて本当にほっとしました。"),
    s("救援（物資）", "They sent food as disaster {relief}.", "彼らは災害の救援物資として食料を送りました。")
  ] },
  { word: "lap", senses: [
    s("ひざ", "The cat sat on my {lap}.", "猫が私のひざの上に座りました。"),
    s("（競技の）1周", "She ran the last {lap} very fast.", "彼女は最後の1周をとても速く走りました。")
  ] },
  { word: "quarter", senses: [
    s("四半期", "Sales rose in the first {quarter}.", "第1四半期に売上が伸びました。"),
    s("15分", "It's a {quarter} past three.", "3時15分です。")
  ] },
  { word: "gear", senses: [
    s("伝動装置、ギア", "Shift into second {gear} on the hill.", "坂ではセカンドギアに入れてください。"),
    s("用具一式", "Don't forget your camping {gear}.", "キャンプ用品を忘れないで。")
  ] },
  { word: "critical", senses: [
    s("極めて重要な", "This is a {critical} moment for the team.", "今はチームにとって極めて重要な時だ。"),
    s("批判的な", "He is very {critical} of the new plan.", "彼は新しい計画にとても批判的です。"),
    s("（病状が）危篤の", "The patient is in {critical} condition.", "その患者は危篤状態です。")
  ] },
  { word: "hide", senses: [
    s("隠す、隠れる", "She {hid} the letter under her bed.", "彼女は手紙をベッドの下に隠しました。"),
    s("（動物の）皮", "Leather is made from animal {hides}.", "革は動物の皮から作られます。")
  ] },
  { word: "plot", senses: [
    s("話の筋", "The {plot} of the movie was hard to follow.", "その映画の筋は追うのが難しかった。"),
    s("小区画の土地", "They grow vegetables on a small {plot} of land.", "彼らは小さな区画の土地で野菜を育てています。")
  ] },
  { word: "compound", senses: [
    s("調合する", "The pharmacist {compounded} the medicine.", "薬剤師がその薬を調合しました。"),
    s("化合物", "Water is a {compound} of hydrogen and oxygen.", "水は水素と酸素の化合物です。")
  ] },
  { word: "swallow", senses: [
    s("飲み込む", "He {swallowed} the pill with some water.", "彼は錠剤を水で飲みこみました。"),
    s("ツバメ", "A {swallow} built a nest under the roof.", "ツバメが屋根の下に巣を作りました。")
  ] },
  { word: "duty", senses: [
    s("職務、義務", "It is my {duty} to help them.", "彼らを助けるのが私の務めです。"),
    s("関税", "You have to pay {duty} on these goods.", "これらの品物には関税を払う必要があります。")
  ] },
  { word: "decline", senses: [
    s("断る", "She politely {declined} the invitation.", "彼女はその招待を丁寧に断りました。"),
    s("減少する、衰える", "The population of the town is {declining}.", "その町の人口は減ってきています。")
  ] },
  { word: "chest", senses: [
    s("たんす、箱", "Put the clothes in the wooden {chest}.", "服を木のたんすにしまってください。"),
    s("胸", "He felt a sharp pain in his {chest}.", "彼は胸に鋭い痛みを感じました。")
  ] },
  { word: "lean", senses: [
    s("寄りかかる", "He {leaned} against the wall.", "彼は壁に寄りかかりました。"),
    s("（肉が）脂肪の少ない", "I prefer {lean} meat.", "私は脂身の少ない肉のほうが好きです。")
  ] },
  { word: "trunk", senses: [
    s("幹", "The {trunk} of the old tree was very thick.", "その古い木の幹はとても太かった。"),
    s("（車の）トランク", "Put the bags in the {trunk}.", "かばんはトランクに入れてください。"),
    s("（象の）鼻", "The elephant lifted the log with its {trunk}.", "象は鼻で丸太を持ち上げました。")
  ] },
  { word: "palm", senses: [
    s("手のひら", "She held the little bird in her {palm}.", "彼女は小鳥を手のひらにのせていました。"),
    s("ヤシ", "{Palm} trees line the beach.", "浜辺にはヤシの木が並んでいます。")
  ] },
  { word: "fix", senses: [
    s("固定する", "{Fix} the shelf firmly to the wall.", "棚を壁にしっかり固定してください。"),
    s("修理する", "Can you {fix} my bike?", "私の自転車を直してくれますか。"),
    s("（日時を）決める", "Let's {fix} a date for the next meeting.", "次の会議の日を決めましょう。")
  ] },
  { word: "upset", senses: [
    s("（気持ちが）動揺した", "She was {upset} by the news.", "彼女はその知らせに動揺しました。"),
    s("（胃の）調子が悪い", "I have an {upset} stomach.", "おなかの調子が悪い。")
  ] },
  { word: "sharp", senses: [
    s("鋭い", "Be careful. The knife is {sharp}.", "気をつけて。ナイフはよく切れるよ。"),
    s("（時刻が）ちょうど", "The meeting starts at nine o'clock {sharp}.", "会議は9時ちょうどに始まります。")
  ] },
  { word: "means", senses: [
    s("手段、方法", "The bicycle is a cheap {means} of transport.", "自転車は安上がりな交通手段です。"),
    s("財力、収入", "He lives beyond his {means}.", "彼は収入以上の暮らしをしています。")
  ] },
  { word: "institution", senses: [
    s("制度、慣習", "Marriage is an old social {institution}.", "結婚は古くからある社会の制度です。"),
    s("（研究・教育などの）機関", "She works at a research {institution}.", "彼女は研究機関で働いています。")
  ] },
  { word: "cast", senses: [
    s("投げる", "He {cast} a stone into the lake.", "彼は湖に石を投げ入れました。"),
    s("配役、出演者", "The {cast} of the movie is wonderful.", "その映画の出演者はすばらしい。")
  ] },
  { word: "strain", senses: [
    s("ぴんと張る、引っ張る", "Don't {strain} the rope too hard.", "ロープをあまり強く引っ張らないで。"),
    s("負担、重圧", "He was under a lot of {strain} at work.", "彼は職場で大きな重圧を受けていました。")
  ] },
  { word: "entertain", senses: [
    s("楽しませる", "The clown {entertained} the children.", "道化師が子どもたちを楽しませました。"),
    s("（考えを）心に抱く", "I would never {entertain} such an idea.", "私はそんな考えは決して抱きません。")
  ] },

  // ───────────── 上級 ─────────────
  { word: "grave", senses: [
    s("墓", "We visited our grandfather's {grave}.", "私たちは祖父の墓参りをしました。"),
    s("深刻な", "The situation is {grave}.", "事態は深刻です。")
  ] },
  { word: "utter", senses: [
    s("全くの", "It was an {utter} waste of time.", "それは全くの時間のむだでした。"),
    s("（声を）発する", "She didn't {utter} a single word.", "彼女はひと言も発しませんでした。")
  ] },
  { word: "discipline", senses: [
    s("しつけ、規律", "The school is known for its strict {discipline}.", "その学校は規律が厳しいことで知られています。"),
    s("学問分野", "Physics is a scientific {discipline}.", "物理学は科学の一分野です。")
  ] },
  { word: "grasp", senses: [
    s("つかむ", "She {grasped} his arm tightly.", "彼女は彼の腕をしっかりつかみました。"),
    s("理解する", "I couldn't {grasp} what he meant.", "彼の言いたいことが理解できませんでした。")
  ] },
  { word: "sanction", senses: [
    s("制裁", "Many countries imposed {sanctions} on the nation.", "多くの国がその国に制裁を科しました。"),
    s("認可", "The plan has the official {sanction} of the city.", "その計画は市の正式な認可を得ています。")
  ] },
  { word: "stick", senses: [
    s("くっつく", "This tape doesn't {stick} well.", "このテープはよくくっつきません。"),
    s("棒きれ", "The dog brought back the {stick}.", "犬が棒を取って戻ってきました。")
  ] },
  { word: "crane", senses: [
    s("鶴", "In Japan, the {crane} is a symbol of long life.", "日本では鶴は長寿の象徴です。"),
    s("クレーン", "A {crane} lifted the steel beams.", "クレーンが鉄の梁を持ち上げました。")
  ] },
  { word: "prime", senses: [
    s("主要な、最重要の", "Safety is our {prime} concern.", "安全が私たちの最大の関心事です。"),
    s("全盛期", "He was in the {prime} of his life.", "彼は人生の全盛期にありました。")
  ] },
  { word: "grain", senses: [
    s("穀物", "Rice and wheat are important {grains}.", "米と小麦は重要な穀物です。"),
    s("粒", "There's a {grain} of sand in my shoe.", "靴に砂粒が入っています。"),
    s("木目", "Cut the wood along the {grain}.", "木目に沿って木を切りなさい。")
  ] },
  { word: "peer", senses: [
    s("同僚、仲間", "Teenagers care a lot about what their {peers} think.", "10代の若者は仲間にどう思われるかをとても気にします。"),
    s("じっと見る", "She {peered} through the window into the dark room.", "彼女は窓越しに暗い部屋をじっとのぞきこみました。")
  ] },
  { word: "wound", senses: [
    s("傷", "The {wound} on his arm healed quickly.", "彼の腕の傷はすぐに治りました。"),
    s("巻いた（wind の過去形）", "He {wound} the old clock every night.", "彼は毎晩その古い時計のねじを巻きました。")
  ] },
  { word: "trace", senses: [
    s("跡、痕跡", "The thief left no {trace}.", "泥棒は何の痕跡も残しませんでした。"),
    s("なぞって写す", "{Trace} the map onto thin paper.", "地図を薄い紙になぞって写してください。")
  ] },
  { word: "dense", senses: [
    s("密な", "The forest was so {dense} that we got lost.", "森がとても深かったので私たちは道に迷いました。"),
    s("頭の鈍い", "Sorry, I'm being {dense}. Could you explain it again?", "ごめん、ぴんとこなくて。もう一度説明してくれる？")
  ] },
  { word: "toll", senses: [
    s("通行料金", "We paid a {toll} on the highway.", "高速道路で通行料を払いました。"),
    s("犠牲者数、被害", "The death {toll} from the earthquake rose to fifty.", "その地震による死者の数は50人に増えました。")
  ] },
  { word: "hamper", senses: [
    s("妨げる", "Heavy snow {hampered} the rescue work.", "大雪が救助作業を妨げました。"),
    s("（ふた付きの）かご", "We packed sandwiches in a picnic {hamper}.", "私たちはピクニック用のかごにサンドイッチを詰めました。")
  ] },
  { word: "quarry", senses: [
    s("採石場", "The stone for the castle came from a nearby {quarry}.", "城の石は近くの採石場から運ばれました。"),
    s("（追われる）獲物", "The hunters followed their {quarry} into the woods.", "狩人たちは獲物を追って森に入りました。")
  ] }
];
