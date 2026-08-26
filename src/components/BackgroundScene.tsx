/**
 * 背景の飾り。明るいテーマはジャングル、暗いテーマは海。
 *
 * 画面の中身には一切触れない（`pointer-events: none` と `aria-hidden`）。
 * カードは今までどおり不透明なので、背景が入っても文字と地のコントラストは変わらない。
 * 動くのは `transform` と `opacity` だけで、画像は使わない（図形はここに焼いてある）。
 *
 * 出題中（クイズ・復習）は App 側で出さない。視界のすみで何かが動くと、
 * 単語より先にそちらへ目が行くため。
 * 端末の「視差効果を減らす」設定と、メニューの切り替えで止まる。
 */

interface Props {
  /** 動かすか。端末の設定で止める場合は false を渡す */
  motion: boolean;
  /** 利用者が選んだ背景画像（data URL）。あるときは、はじめからの飾りの代わりに出す */
  image?: string | null;
}

export default function BackgroundScene({ motion, image }: Props) {
  // 写真を選んでいるときは、その上に薄い幕をかける。
  // 幕が無いと、カードの外に出ている小さな文字が写真の柄に紛れて読めなくなる
  if (image) {
    return (
      <div className="bg-scene" data-testid="background_scene" data-kind="image" aria-hidden="true">
        <div className="bg-photo" style={{ backgroundImage: `url(${image})` }} />
        <div className="bg-photo-veil" />
      </div>
    );
  }

  return (
    <div
      className="bg-scene"
      data-motion={motion ? "on" : "off"}
      data-testid="background_scene"
      data-kind="scene"
      aria-hidden="true"
    >
      {/* ジャングル（明るいテーマ） */}
      <div className="bg-jungle">
        <span className="bg-canopy bg-canopy--far">
          <svg viewBox="0 0 800 300" preserveAspectRatio="none">
            <path d="M0 300V150c40-30 60 10 100-14s70 6 108-22 66 12 104-10 74 16 112-8 70 14 108-6 88 14 118-6 50 8 50 8s58 12 100 4v208Z" />
          </svg>
        </span>
        <span className="bg-sunbeam bg-sunbeam--1" />
        <span className="bg-sunbeam bg-sunbeam--2" />
        <span className="bg-sunbeam bg-sunbeam--3" />
        <span className="bg-canopy bg-canopy--near">
          <svg viewBox="0 0 800 220" preserveAspectRatio="none">
            <path d="M0 220V96c46 4 58-30 96-26s54 30 92 22 62-34 100-24 58 34 96 26 64-30 102-22 60 26 98 22 62-18 116-14s58 22 100 16v140Z" />
          </svg>
        </span>
      <span className="bg-vine bg-vine--v1">
        <svg viewBox="0 0 40 310">
          <path d="M20 0C19 108 21 217 18 310" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="28" cy="28" rx="9" ry="5" transform="rotate(28 28 28)" /><ellipse cx="12" cy="56" rx="9" ry="5" transform="rotate(-28 12 56)" /><ellipse cx="28" cy="85" rx="9" ry="5" transform="rotate(28 28 85)" /><ellipse cx="12" cy="113" rx="9" ry="5" transform="rotate(-28 12 113)" /><ellipse cx="28" cy="141" rx="9" ry="5" transform="rotate(28 28 141)" /><ellipse cx="12" cy="169" rx="9" ry="5" transform="rotate(-28 12 169)" /><ellipse cx="28" cy="197" rx="9" ry="5" transform="rotate(28 28 197)" /><ellipse cx="12" cy="225" rx="9" ry="5" transform="rotate(-28 12 225)" /><ellipse cx="28" cy="254" rx="9" ry="5" transform="rotate(28 28 254)" /><ellipse cx="12" cy="282" rx="9" ry="5" transform="rotate(-28 12 282)" />
        </svg>
      </span>
      <span className="bg-vine bg-vine--v2">
        <svg viewBox="0 0 40 430">
          <path d="M20 0C20 150 20 301 20 430" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="28" cy="29" rx="9" ry="5" transform="rotate(28 28 29)" /><ellipse cx="12" cy="57" rx="9" ry="5" transform="rotate(-28 12 57)" /><ellipse cx="28" cy="86" rx="9" ry="5" transform="rotate(28 28 86)" /><ellipse cx="12" cy="115" rx="9" ry="5" transform="rotate(-28 12 115)" /><ellipse cx="28" cy="143" rx="9" ry="5" transform="rotate(28 28 143)" /><ellipse cx="12" cy="172" rx="9" ry="5" transform="rotate(-28 12 172)" /><ellipse cx="28" cy="201" rx="9" ry="5" transform="rotate(28 28 201)" /><ellipse cx="12" cy="229" rx="9" ry="5" transform="rotate(-28 12 229)" /><ellipse cx="28" cy="258" rx="9" ry="5" transform="rotate(28 28 258)" /><ellipse cx="12" cy="287" rx="9" ry="5" transform="rotate(-28 12 287)" /><ellipse cx="28" cy="315" rx="9" ry="5" transform="rotate(28 28 315)" /><ellipse cx="12" cy="344" rx="9" ry="5" transform="rotate(-28 12 344)" /><ellipse cx="28" cy="373" rx="9" ry="5" transform="rotate(28 28 373)" /><ellipse cx="12" cy="401" rx="9" ry="5" transform="rotate(-28 12 401)" />
        </svg>
      </span>
      <span className="bg-vine bg-vine--v3">
        <svg viewBox="0 0 40 260">
          <path d="M20 0C21 91 19 182 21 260" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <ellipse cx="28" cy="29" rx="9" ry="5" transform="rotate(28 28 29)" /><ellipse cx="12" cy="58" rx="9" ry="5" transform="rotate(-28 12 58)" /><ellipse cx="28" cy="87" rx="9" ry="5" transform="rotate(28 28 87)" /><ellipse cx="12" cy="116" rx="9" ry="5" transform="rotate(-28 12 116)" /><ellipse cx="28" cy="144" rx="9" ry="5" transform="rotate(28 28 144)" /><ellipse cx="12" cy="173" rx="9" ry="5" transform="rotate(-28 12 173)" /><ellipse cx="28" cy="202" rx="9" ry="5" transform="rotate(28 28 202)" /><ellipse cx="12" cy="231" rx="9" ry="5" transform="rotate(-28 12 231)" />
        </svg>
      </span>
      <span className="bg-frond bg-frond--tl">
        <svg viewBox="0 -48 220 96">
          <path d="M13.1 0C21.7 -3.8 21.7 -3.8 21.9 -13.2C13.3 -9.4 13.3 -9.4 13.1 0Z M13.1 0C13.3 9.4 13.3 9.4 21.9 13.2C21.7 3.8 21.7 3.8 13.1 0Z M35.0 0C50.2 -6.8 50.2 -6.8 50.6 -23.5C35.3 -16.7 35.3 -16.7 35.0 0Z M35.0 0C35.3 16.7 35.3 16.7 50.6 23.5C50.2 6.8 50.2 6.8 35.0 0Z M56.9 0C76.1 -8.6 76.1 -8.6 76.5 -29.6C57.3 -21.0 57.3 -21.0 56.9 0Z M56.9 0C57.3 21.0 57.3 21.0 76.5 29.6C76.1 8.6 76.1 8.6 56.9 0Z M78.8 0C99.9 -9.4 99.9 -9.4 100.4 -32.6C79.2 -23.1 79.2 -23.1 78.8 0Z M78.8 0C79.2 23.1 79.2 23.1 100.4 32.6C99.9 9.4 99.9 9.4 78.8 0Z M100.6 0C122.0 -9.5 122.0 -9.5 122.5 -32.9C101.1 -23.4 101.1 -23.4 100.6 0Z M100.6 0C101.1 23.4 101.1 23.4 122.5 32.9C122.0 9.5 122.0 9.5 100.6 0Z M122.5 0C142.6 -9.0 142.6 -9.0 143.1 -31.0C123.0 -22.0 123.0 -22.0 122.5 0Z M122.5 0C123.0 22.0 123.0 22.0 143.1 31.0C142.6 9.0 142.6 9.0 122.5 0Z M144.4 0C161.8 -7.8 161.8 -7.8 162.2 -26.8C144.8 -19.1 144.8 -19.1 144.4 0Z M144.4 0C144.8 19.1 144.8 19.1 162.2 26.8C161.8 7.8 161.8 7.8 144.4 0Z M166.2 0C179.7 -6.0 179.7 -6.0 180.0 -20.7C166.6 -14.7 166.6 -14.7 166.2 0Z M166.2 0C166.6 14.7 166.6 14.7 180.0 20.7C179.7 6.0 179.7 6.0 166.2 0Z M188.1 0C196.3 -3.7 196.3 -3.7 196.5 -12.6C188.3 -9.0 188.3 -9.0 188.1 0Z M188.1 0C188.3 9.0 188.3 9.0 196.5 12.6C196.3 3.7 196.3 3.7 188.1 0Z" />
          <path d="M0 0C63 -3 147 -4 210 -5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="bg-frond bg-frond--tr">
        <svg viewBox="0 -56 180 112">
          <path d="M13.4 0C25.2 -5.2 25.2 -5.2 25.5 -18.1C13.7 -12.9 13.7 -12.9 13.4 0Z M13.4 0C13.7 12.9 13.7 12.9 25.5 18.1C25.2 5.2 25.2 5.2 13.4 0Z M35.8 0C56.2 -9.1 56.2 -9.1 56.7 -31.5C36.3 -22.4 36.3 -22.4 35.8 0Z M35.8 0C36.3 22.4 36.3 22.4 56.7 31.5C56.2 9.1 56.2 9.1 35.8 0Z M58.2 0C82.8 -11.0 82.8 -11.0 83.4 -38.0C58.7 -27.0 58.7 -27.0 58.2 0Z M58.2 0C58.7 27.0 58.7 27.0 83.4 38.0C82.8 11.0 82.8 11.0 58.2 0Z M80.5 0C106.0 -11.4 106.0 -11.4 106.6 -39.3C81.1 -27.9 81.1 -27.9 80.5 0Z M80.5 0C81.1 27.9 81.1 27.9 106.6 39.3C106.0 11.4 106.0 11.4 80.5 0Z M102.9 0C126.3 -10.4 126.3 -10.4 126.8 -36.0C103.4 -25.6 103.4 -25.6 102.9 0Z M102.9 0C103.4 25.6 103.4 25.6 126.8 36.0C126.3 10.4 126.3 10.4 102.9 0Z M125.3 0C144.0 -8.3 144.0 -8.3 144.4 -28.8C125.7 -20.5 125.7 -20.5 125.3 0Z M125.3 0C125.7 20.5 125.7 20.5 144.4 28.8C144.0 8.3 144.0 8.3 125.3 0Z M147.6 0C159.2 -5.2 159.2 -5.2 159.5 -17.8C147.9 -12.7 147.9 -12.7 147.6 0Z M147.6 0C147.9 12.7 147.9 12.7 159.5 17.8C159.2 5.2 159.2 5.2 147.6 0Z" />
          <path d="M0 0C51 -3 119 -5 170 -6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="bg-leaf" style={{ left: "8%", width: 44, height: 44, animationDuration: "14s", animationDelay: "0s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      <span className="bg-leaf" style={{ left: "22%", width: 36, height: 36, animationDuration: "15s", animationDelay: "-6s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      <span className="bg-leaf" style={{ left: "35%", width: 52, height: 52, animationDuration: "18s", animationDelay: "-11s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      <span className="bg-leaf" style={{ left: "47%", width: 33, height: 33, animationDuration: "19s", animationDelay: "-3s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      <span className="bg-leaf" style={{ left: "58%", width: 46, height: 46, animationDuration: "16s", animationDelay: "-14s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      <span className="bg-leaf" style={{ left: "69%", width: 40, height: 40, animationDuration: "17s", animationDelay: "-8s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      <span className="bg-leaf" style={{ left: "80%", width: 30, height: 30, animationDuration: "20s", animationDelay: "-17s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      <span className="bg-leaf" style={{ left: "91%", width: 48, height: 48, animationDuration: "15s", animationDelay: "-2s" }}>
        <svg viewBox="0 0 24 24"><path d="M4 20c0-8 6-16 16-16 0 9-6 16-16 16Z" /></svg>
      </span>
      </div>

      {/* 海（暗いテーマ） */}
      <div className="bg-ocean">
        <span className="bg-shaft bg-shaft--1" />
        <span className="bg-shaft bg-shaft--2" />
        <span className="bg-shaft bg-shaft--3" />
      <span className="bg-ray bg-ray--r1">
        <span className="bg-ray-wander"><span className="bg-ray-tilt"><span className="bg-ray-surge">
          <svg className="bg-manta" viewBox="0 0 200 200"><g className="bg-wing bg-wing--l"><path d="M80 52 C58 62 34 84 15 112 C10 120 15 127 23 123 C50 110 70 117 84 137 C88 108 87 78 80 52 Z" /></g><g className="bg-wing bg-wing--r"><path d="M120 52 C142 62 166 84 185 112 C190 120 185 127 177 123 C150 110 130 117 116 137 C112 108 113 78 120 52 Z" /></g><path className="bg-tail" d="M97 146 C98 162 99 176 100 189 C100 191 102 191 102 189 C102 175 102 161 103 146 Z" /><path d="M100 40 C114 40 124 50 126 66 C129 92 126 122 118 142 C113 154 107 160 100 160 C93 160 87 154 82 142 C74 122 71 92 74 66 C76 50 86 40 100 40 Z" /><path d="M86 47 C84 41 82 36 81 31 C80 27 85 25 86 29 C88 35 90 41 92 46 Z" /><path d="M114 47 C116 41 118 36 119 31 C120 27 115 25 114 29 C112 35 110 41 108 46 Z" /></svg>
        </span></span></span>
      </span>
      <span className="bg-ray bg-ray--r2">
        <span className="bg-ray-wander"><span className="bg-ray-tilt"><span className="bg-ray-surge">
          <svg className="bg-manta" viewBox="0 0 200 200"><g className="bg-wing bg-wing--l"><path d="M80 52 C58 62 34 84 15 112 C10 120 15 127 23 123 C50 110 70 117 84 137 C88 108 87 78 80 52 Z" /></g><g className="bg-wing bg-wing--r"><path d="M120 52 C142 62 166 84 185 112 C190 120 185 127 177 123 C150 110 130 117 116 137 C112 108 113 78 120 52 Z" /></g><path className="bg-tail" d="M97 146 C98 162 99 176 100 189 C100 191 102 191 102 189 C102 175 102 161 103 146 Z" /><path d="M100 40 C114 40 124 50 126 66 C129 92 126 122 118 142 C113 154 107 160 100 160 C93 160 87 154 82 142 C74 122 71 92 74 66 C76 50 86 40 100 40 Z" /><path d="M86 47 C84 41 82 36 81 31 C80 27 85 25 86 29 C88 35 90 41 92 46 Z" /><path d="M114 47 C116 41 118 36 119 31 C120 27 115 25 114 29 C112 35 110 41 108 46 Z" /></svg>
        </span></span></span>
      </span>
      <span className="bg-ray bg-ray--r3">
        <span className="bg-ray-wander"><span className="bg-ray-tilt"><span className="bg-ray-surge">
          <svg className="bg-manta" viewBox="0 0 200 200"><g className="bg-wing bg-wing--l"><path d="M80 52 C58 62 34 84 15 112 C10 120 15 127 23 123 C50 110 70 117 84 137 C88 108 87 78 80 52 Z" /></g><g className="bg-wing bg-wing--r"><path d="M120 52 C142 62 166 84 185 112 C190 120 185 127 177 123 C150 110 130 117 116 137 C112 108 113 78 120 52 Z" /></g><path className="bg-tail" d="M97 146 C98 162 99 176 100 189 C100 191 102 191 102 189 C102 175 102 161 103 146 Z" /><path d="M100 40 C114 40 124 50 126 66 C129 92 126 122 118 142 C113 154 107 160 100 160 C93 160 87 154 82 142 C74 122 71 92 74 66 C76 50 86 40 100 40 Z" /><path d="M86 47 C84 41 82 36 81 31 C80 27 85 25 86 29 C88 35 90 41 92 46 Z" /><path d="M114 47 C116 41 118 36 119 31 C120 27 115 25 114 29 C112 35 110 41 108 46 Z" /></svg>
        </span></span></span>
      </span>
        <span className="bg-bubble" style={{ left: "22%", width: 6, height: 6, animationDuration: "15s" }} />
        <span className="bg-bubble" style={{ left: "37%", width: 4, height: 4, animationDuration: "19s", animationDelay: "-7s" }} />
        <span className="bg-bubble" style={{ left: "64%", width: 8, height: 8, animationDuration: "22s", animationDelay: "-13s" }} />
        <span className="bg-bubble" style={{ left: "83%", width: 5, height: 5, animationDuration: "17s", animationDelay: "-4s" }} />
      </div>
    </div>
  );
}
