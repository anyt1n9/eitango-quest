import React from "react";
import type { GuideId } from "../ocean/guide";

/**
 * 海の図鑑の絵（線画）。学習ノートに描いたスケッチのつもりで、線1色で描く。
 *
 * 画像は使わない（ほかの絵と同じく SVG を部品に焼く）。色は currentColor に任せるので、
 * 明暗どちらのテーマでも文字と同じ色で描かれる。光る所（チョウチンアンコウの提灯・ハダカイワシの
 * 発光器）だけは塗りつぶしの点にする。座標は 64×64 で、生き物は左を向く。
 */
const ART: Record<GuideId, React.ReactNode> = {
  seagrass: (
    <>
      <path d="M8 56h48" />
      <path d="M20 56c-1-8-1-16-3-24s-4-14-2-20" />
      <path d="M26 56c0-10 2-20 1-30s1-14 4-18" />
      <path d="M33 56c1-8-1-15 0-22s3-10 2-14" />
      <path d="M39 56c0-10 3-18 5-26s1-12-1-16" />
      <path d="M46 56c1-7 3-12 3-18" />
      <path d="M14 56c0-5-1-9-3-12" />
    </>
  ),
  "sea-turtle": (
    <>
      <path d="M32 19c-9 0-15 7-15 16s6 15 15 15 15-6 15-15-6-16-15-16Z" />
      <path d="M28 19.5c-1-2.5-1-5 .5-7s4.5-2 6 0 1.5 4.5.5 7" />
      <path d="M32 25.5l-5 3.5v6l5 3.5 5-3.5v-6Z" />
      <path d="M27 29l-6.5-2.5M37 29l6.5-2.5M27 35l-7 3M37 35l7 3M32 38.5V48" />
      <path d="M19 27c-5-3-10-4-15-2 3 3 8 5 13 5.5" />
      <path d="M45 27c5-3 10-4 15-2-3 3-8 5-13 5.5" />
      <path d="M22 45c-3 2-4 5-4 8 3-1 6-3 7.5-5.5" />
      <path d="M42 45c3 2 4 5 4 8-3-1-6-3-7.5-5.5" />
      <path d="M32 50v4" />
    </>
  ),
  "manta-ray": (
    <>
      <path d="M32 17c-3 0-5 1.5-6 4-7 2.5-15 8-21 16 8 1 16-.5 22-3 1.5 3 3 5 5 5s3.5-2 5-5c6 2.5 14 4 22 3-6-8-14-13.5-21-16-1-2.5-3-4-6-4Z" />
      <path d="M28.5 18c-1.5-1.5-2-3.5-1.5-5.5M35.5 18c1.5-1.5 2-3.5 1.5-5.5" />
      <path d="M28 25c2.5 1 5.5 1 8 0" />
      <path d="M32 39v19" />
    </>
  ),
  anchovy: (
    <>
      <g>
        <path d="M6 20c4-4 10-5.5 16-4.5 3 .5 5.5 2 7 4.5-1.5 2.5-4 4-7 4.5-6 1-12-.5-16-4.5Z" />
        <path d="M29 20l5-4v8Z" />
        <circle cx="11" cy="19" r="1" fill="currentColor" stroke="none" />
        <path d="M14 21.5h11" />
      </g>
      <g>
        <path d="M24 33c4-4 10-5.5 16-4.5 3 .5 5.5 2 7 4.5-1.5 2.5-4 4-7 4.5-6 1-12-.5-16-4.5Z" />
        <path d="M47 33l5-4v8Z" />
        <circle cx="29" cy="32" r="1" fill="currentColor" stroke="none" />
        <path d="M32 34.5h11" />
      </g>
      <g>
        <path d="M10 46c4-4 10-5.5 16-4.5 3 .5 5.5 2 7 4.5-1.5 2.5-4 4-7 4.5-6 1-12-.5-16-4.5Z" />
        <path d="M33 46l5-4v8Z" />
        <circle cx="15" cy="45" r="1" fill="currentColor" stroke="none" />
        <path d="M18 47.5h11" />
      </g>
    </>
  ),
  coral: (
    <>
      <path d="M14 57h36" />
      <path d="M32 57V40c0-6-1-12 1-18s1-10 0-14" />
      <path d="M32 44c-5-1-9-5-10-11s-1-9-4-13" />
      <path d="M22 31c-4-1-7-4-8-8" />
      <path d="M33 26c3-2 5-5 6-9" />
      <path d="M32 49c6-1 11-5 13-11s4-9 7-12" />
      <path d="M45 38c3 0 6-2 8-4" />
      <path d="M44 41c-1-4-2-8-1-12" />
    </>
  ),
  "brain-coral": (
    <>
      <path d="M6 50h52" />
      <path d="M10 50c0-13 10-23 22-23s22 10 22 23" />
      <path d="M15 46c1-6 5-10 10-12" />
      <path d="M20 47c0-4 3-7 7-8 4-1 6 2 10 2s6-2 9-1" />
      <path d="M26 47c2-2 5-3 8-2s5 2 9 1" />
      <path d="M21 38c3-3 7-5 12-5s8 2 12 1" />
      <path d="M48 46c0-2 1-4 2-5" />
    </>
  ),
  butterflyfish: (
    <>
      <path d="M8 33c3-.5 5-1.5 7.5-3 4-8 10-12.5 18.5-12.5 8 0 13 6 13 15.5S42 48.5 34 48.5c-8.5 0-14.5-4.5-18.5-12.5-2.5-1.5-4.5-2.5-7.5-3Z" />
      <path d="M47 33l9-7v14Z" />
      <path d="M21.5 22c-1 7-1 15 0 23" />
      <circle cx="19" cy="31" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="40" cy="39" r="2.4" />
      <path d="M26 18.5c3-3 8-4.5 13-3.5" />
    </>
  ),
  damselfish: (
    <>
      <path d="M8 31c5-6.5 13-9 22-7 4.5 1 8 3.5 10 7-2 3.5-5.5 6-10 7-9 2-17-.5-22-7Z" />
      <path d="M40 31l9-8-2.5 8 2.5 8Z" />
      <circle cx="14" cy="29.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M18 25c4-4 10-5 15-3" />
      <path d="M21 30.5c2 2.5 5 4 8.5 4.5" />
      <path d="M22 58c0-6 2-10 4-13M26 51c3-1 5-3 6-6M22 54c-3-1-5-4-6-7" />
      <path d="M14 58h20" />
    </>
  ),
  "sea-fan": (
    <>
      <path d="M24 58h16M32 58v-8" />
      <path d="M32 50c-3-6-8-11-15-14s-9-10-8-16" />
      <path d="M32 50c-1-8-5-15-9-21s-3-12-1-17" />
      <path d="M32 50c0-9 0-17-1-25s1-11 2-15" />
      <path d="M32 50c2-8 5-15 9-21s3-12 2-16" />
      <path d="M32 50c3-6 8-11 15-14s9-10 8-16" />
      <path d="M14 30c5-2 11-3 18-3s13 1 18 3" />
      <path d="M11 22c6-3 13-4 21-4s15 1 21 4" />
      <path d="M20 39c4-1 8-2 12-2s8 1 12 2" />
    </>
  ),
  "humphead-wrasse": (
    <>
      <path d="M7 35c1.5-5 5-9 9-11 2-6 6-10 12-10 4.5 0 7 2.5 9 5.5 6 1 11 4 15 8.5l6-5.5v18l-6-5c-5 5-12 7.5-20 7.5-12 0-21-3-25-8Z" />
      <path d="M7 35c2 1.5 4.5 1.5 6.5 0" />
      <circle cx="19" cy="27" r="1.3" fill="currentColor" stroke="none" />
      <path d="M22 26.5l5-2M22 29.5l5 1" />
      <path d="M26 34.5c3.5 1 7 3 9 6" />
      <path d="M37 19.5c4-1 8 0 11 2" />
    </>
  ),
  "whale-shark": (
    <>
      <path d="M4 31c0-4 5-7 13-8 12-1.5 24-2.5 34-7l6-7c-.5 6-.5 11 1 15" />
      <path d="M4 31c0 4 5 6.5 13 7 12 .5 24 0 34-3l5 7c-.5-5-.5-9 0-12l2-1" />
      <path d="M4 31.5h7" />
      <path d="M14 26.5v10M16.5 26v10.5" />
      <path d="M29 22.5l5-7 3 6.5" />
      <path d="M22 37c2 3 5 4 8 4" />
      <g fill="currentColor" stroke="none">
        <circle cx="21" cy="28" r=".9" /><circle cx="25" cy="31" r=".9" /><circle cx="27" cy="27" r=".9" />
        <circle cx="31" cy="30" r=".9" /><circle cx="33" cy="34" r=".9" /><circle cx="36" cy="27" r=".9" />
        <circle cx="38" cy="31" r=".9" /><circle cx="42" cy="28" r=".9" /><circle cx="43" cy="32" r=".9" />
        <circle cx="47" cy="29" r=".9" /><circle cx="22" cy="33" r=".9" /><circle cx="29" cy="35" r=".9" />
      </g>
    </>
  ),
  jellyfish: (
    <>
      <path d="M14 30c0-10.5 8-18 18-18s18 7.5 18 18c-3 2-6 2-9 0-3 2-6 2-9 0-3 2-6 2-9 0-3 2-6 2-9 0Z" />
      <path d="M22 22c2-3 5-5 8-5.5" />
      <path d="M29 32c-1 6 2 9 0 14s1 8 0 11" />
      <path d="M35 32c1 6-2 9 0 14s-1 8 0 11" />
      <path d="M19 32c-1 4 1 7 0 11s1 6-1 9" />
      <path d="M45 32c1 4-1 7 0 11s-1 6 1 9" />
      <path d="M24.5 32.5c-.5 5 1 8 .5 12" />
      <path d="M39.5 32.5c.5 5-1 8-.5 12" />
    </>
  ),
  lanternfish: (
    <>
      <path d="M7 32c4-6 12-8.5 22-8.5 8 0 14 3 18.5 8.5-4.5 5-10.5 8-18.5 8-10 0-18-2.5-22-8Z" />
      <path d="M47.5 32l8.5-7v14Z" />
      <circle cx="15" cy="30" r="3.2" />
      <circle cx="15" cy="30" r="1.3" fill="currentColor" stroke="none" />
      <path d="M8 33.5c1.5.8 3.5 1 5 .5" />
      <path d="M30 23.5c2-2.5 5-3.5 8-3" />
      <g fill="currentColor" stroke="none">
        <circle cx="19" cy="36.5" r="1.1" /><circle cx="23" cy="37.3" r="1.1" /><circle cx="27" cy="37.8" r="1.1" />
        <circle cx="31" cy="37.8" r="1.1" /><circle cx="35" cy="37.3" r="1.1" /><circle cx="39" cy="36.4" r="1.1" />
        <circle cx="43" cy="35" r="1.1" /><circle cx="25" cy="33.6" r="1.1" /><circle cx="33" cy="33.6" r="1.1" />
      </g>
    </>
  ),
  "marine-snow": (
    <>
      <path d="M17 10v6M17 22l2 2-2 2-2-2Z" />
      <path d="M40 6v5M38.5 15.5l3 .5-1 2.5-2.5-1Z" />
      <path d="M28 24v5M27 33h3l-1 3-2-1Z" />
      <path d="M50 22v6M49 32l2.5 1-1 2.5-2.5-1Z" />
      <path d="M12 38v5M11 47l2.5-.5.5 2.5-2.5.5Z" />
      <path d="M37 41v5M36 50l3 .5-.5 2.5-3-.5Z" />
      <g fill="currentColor" stroke="none">
        <circle cx="24" cy="14" r="1" /><circle cx="46" cy="44" r="1" /><circle cx="20" cy="54" r="1" />
        <circle cx="56" cy="12" r="1" /><circle cx="8" cy="28" r="1" /><circle cx="54" cy="56" r="1" />
      </g>
    </>
  ),
  anglerfish: (
    <>
      <path d="M12 38c0-12 9-21 21-21 10.5 0 18.5 7.5 18.5 17.5 0 8.5-6.5 15-15 15-6.5 0-11-2-15-5.5-4 0-7.5-2-9.5-6Z" />
      <path d="M12 38c4 1 9 .5 13.5-3" />
      <path d="M13.5 38.5l1.5 3 1.5-3.2 1.5 3 1.5-3.4 1.5 2.8 1.5-3.4" />
      <circle cx="28" cy="27" r="1.6" fill="currentColor" stroke="none" />
      <path d="M27 18c-3-6-8-9-14-8" />
      <circle cx="11" cy="10.5" r="2.6" fill="currentColor" stroke="none" />
      <path d="M11 3.5v2M4 10.5h2M6 5.5l1.5 1.5M6 15.5l1.5-1.5M16 5.5l-1.5 1.5" />
      <path d="M51.5 34.5l6.5-6v13Z" />
      <path d="M34 37c3 1 6 3 7.5 6" />
    </>
  ),
};

export default function OceanGuideArt({ id, className = "w-16 h-16" }: { id: GuideId; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      data-art={id}
    >
      {ART[id]}
    </svg>
  );
}

/** 絵のある生き物（テストで、図鑑のどの生き物にも絵があることを見る） */
export const ART_IDS = Object.keys(ART) as GuideId[];
