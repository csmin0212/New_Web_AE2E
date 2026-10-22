"use client";

import { useEffect, useState } from "react";

// 그림이 "배경을 오려 낸 세로 스탠딩"인지, "배경이 있는 그림·정사각 얼굴·둥근 토큰"인지 가른다.
//   sprite: 가장자리가 투명하고 세로로 긴 그림 → 무대에 크게 세운다
//   token:  가장자리가 투명한 정사각형 (동그란 토큰) → 둥근 메달로 작게
//   card:   그 밖 → 액자에 담아 작게 세운다 (배경째 거대하게 서 있으면 어색하다)
// 다른 사이트 그림이라 픽셀을 못 읽으면 확장자와 비율로 짐작한다.

export type ImageShape = { kind: "sprite" | "token" | "card"; ratio: number };

const cache = new Map<string, Promise<ImageShape>>();
const done = new Map<string, ImageShape>();

function load(url: string, cors: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// 테두리 픽셀 중 투명한 비율
export function borderTransparency(data: Uint8ClampedArray, size: number): number {
  let clear = 0;
  let total = 0;
  for (let i = 0; i < size; i++) {
    for (const [x, y] of [
      [i, 0],
      [i, size - 1],
      [0, i],
      [size - 1, i],
    ]) {
      total++;
      if (data[(y * size + x) * 4 + 3] < 128) clear++;
    }
  }
  return total ? clear / total : 0;
}

export function classify(ratio: number, transparentBorder: number | null, url: string): ImageShape {
  const tall = ratio < 0.85;
  const square = ratio >= 0.85 && ratio <= 1.2;
  const cutout = transparentBorder != null ? transparentBorder > 0.3 : /\.(png|webp)(\?|$)/i.test(url);
  if (tall && cutout) return { kind: "sprite", ratio };
  if (square && transparentBorder != null && transparentBorder > 0.3) return { kind: "token", ratio };
  return { kind: "card", ratio };
}

async function detect(url: string): Promise<ImageShape> {
  try {
    const img = await load(url, true);
    const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
    try {
      const size = 32;
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0, size, size);
      return classify(ratio, borderTransparency(g.getImageData(0, 0, size, size).data, size), url);
    } catch {
      return classify(ratio, null, url);
    }
  } catch {
    // CORS 를 안 열어 준 서버 — 그냥 불러서 비율만
    try {
      const img = await load(url, false);
      return classify(img.naturalWidth / Math.max(1, img.naturalHeight), null, url);
    } catch {
      return { kind: "card", ratio: 0.75 };
    }
  }
}

export function useImageShape(url?: string): ImageShape | null {
  const [got, setGot] = useState<{ url: string; shape: ImageShape } | null>(null);
  useEffect(() => {
    if (!url || done.has(url)) return;
    let alive = true;
    let p = cache.get(url);
    if (!p) {
      p = detect(url).then((s) => (done.set(url, s), s));
      cache.set(url, p);
    }
    p.then((shape) => alive && setGot({ url, shape }));
    return () => {
      alive = false;
    };
  }, [url]);
  if (!url) return null;
  return done.get(url) ?? (got?.url === url ? got.shape : null);
}
