# 테마 그림 목록 — AI로 뽑아 올 그림

테마마다 아래 4장을 만들어 주면, 그 테마의 빈 화면에 자동으로 깔린다.
그림이 없는 자리는 지금처럼 색·무늬 배경이 나온다 (하나씩 채워도 된다).

2026-10-22: 5개 테마 × 4자리의 기본 배경 20장을 생성해 `public/themes/`에 WebP로 저장하고 `src/lib/themeArt.ts`에서 활성화했다. 생성에는 내장 `image_gen`을 사용했으며, 최종 프롬프트는 [theme-art-prompts.json](./theme-art-prompts.json)에 기록했다.

## 넣는 곳

- 파일 위치: `public/themes/<테마 ID>/<자리>.webp`
  - 예: `public/themes/online/party.webp`
- 형식: **webp 또는 jpg**, 한 장 **500KB 이하** 권장 (크면 화면이 느려진다)
- 다 넣었으면 알려 주면 `src/lib/themeArt.ts` 목록을 켜서 올린다

| 테마 ID | 이름 |
|---|---|
| `classic` | 고서 · 금박 |
| `gothic` | 고딕 · 갈바테인풍 |
| `phantom` | 팬텀 · 페르소나풍 |
| `arcane` | 성야 · 마도서 |
| `online` | 온라인 · 아리안로드 온라인 |

## 자리 4곳

| 자리 | 파일 이름 | 어디에 보이나 | 크기·비율 | 주의할 점 |
|---|---|---|---|---|
| 대화 무대 기본 배경 | `stage.webp` | 세션 대화 화면에서 GM이 배경 그림을 안 정했을 때 | 1920×1080 (16:9) | 가운데·아래에 인물이 서므로 **복잡하지 않게**. 흐릿한 원경, 피사계 심도 느낌 |
| 모험가들 무대 뒤 | `party.webp` | 등장인물 페이지 맨 위 PARTY 무대 | 2400×1000 (약 21:9) | 인물이 가운데 나란히 서므로 **가운데를 비워** 두고 양옆·위쪽에 장식. 위에 어두운 막이 한 겹 덮인다 |
| 전투 바닥 | `battle.webp` | 전투 그리드에서 전장 그림을 안 정했을 때 | 2048×1280 (16:10) | **위에서 내려다본(top-down) 바닥**. 격자선은 넣지 말 것 (툴이 그린다). 무늬가 너무 강하면 토큰이 안 보인다 |
| 페이지 배경 | `page.webp` | 저널·등장인물·지역 도감 페이지 뒤 | 1920×1080 | 글을 읽는 화면이라 **아주 흐리고 대비가 낮게**. 사실상 질감·무늬 정도 |

## 테마별 분위기 (프롬프트 예시)

공통으로 붙이면 좋은 말: `no text, no characters, no watermark, background art, high detail, soft lighting`
(무대·바닥·페이지에는 인물이 들어가면 안 된다)

### classic — 고서 · 금박
- 색: 짙은 갈색, 양피지, 금박
- stage: `ancient fantasy library hall, candlelight, warm amber haze, golden ornaments, depth of field`
- party: `grand fantasy theater stage, golden filigree arch, velvet curtains on both sides, empty center, spotlight from above`
- battle: `top-down view of old stone floor, weathered cobblestones, warm torch light, fantasy dungeon`
- page: `aged parchment texture with faint gold filigree border, subtle, low contrast`

### gothic — 고딕 · 갈바테인풍
- 색: 흑백, 장미빛 분홍 포인트, 할리퀸 무늬
- stage: `gothic cathedral interior at night, black and white harlequin floor, crimson rose petals, moonlight through stained glass, misty`
- party: `gothic opera stage, black and white diamond pattern, roses climbing pillars, empty center, cold spotlight`
- battle: `top-down black and white checkered marble floor, scattered rose petals, gothic`
- page: `faint black and white harlequin diamond pattern, very subtle, dark`

### phantom — 팬텀 · 페르소나풍
- 색: 빨강·검정·흰색, 하프톤 점, 사선
- stage: `stylized night city street, red and black graphic style, halftone dots, diagonal shapes, persona 5 inspired, moody`
- party: `bold red and black graphic backdrop, diagonal stripes, halftone, comic style burst, empty center`
- battle: `top-down red and black graphic floor, halftone texture, diagonal tiles, stylized`
- page: `subtle red halftone dots on black, minimal, low contrast`

### arcane — 성야 · 마도서
- 색: 남색 밤하늘, 은빛 마법진, 별
- stage: `starry night sky over a quiet magical tower, deep navy blue, silver magic circles glowing faintly, dreamy`
- party: `celestial observatory stage, silver magic circle on the floor, starfield, empty center, soft blue light`
- battle: `top-down dark navy stone floor with faint glowing silver magic circle runes`
- page: `deep navy starfield with faint silver constellation lines, subtle`

### online — 아리안로드 온라인 (블루 아카이브·SAO 감성)
- 색: 하늘색·흰색, 맑은 하늘, 얇은 HUD 선
- stage: `bright modern city plaza under clear blue sky, white buildings, soft clouds, anime background art, blue archive style`
- party: `futuristic game lobby stage, white and sky blue, holographic HUD panels on both sides, empty center, bright`
- battle: `top-down clean white tiled floor with light blue holographic grid glow, sci-fi game arena`
- page: `very light sky blue gradient with faint white hexagon HUD pattern, minimal`

## 그 밖에 넣을 수 있는 그림 (원하면)

- **모험가들 무대 배경 (캠페인마다)**: 등장인물 페이지 → GM의 「무대 배경」 버튼으로 바로 올린다. 위의 `party` 와 같은 조건.
- **프로필 배경 (캐릭터마다)**: 등장인물 → 인물 → 「고치기」 → 「프로필 배경」. 플레이어가 자기 PC 것을 직접 넣는다. 16:9, 인물 분위기에 맞는 풍경.
- **지역 도감 풍경**: 지역마다 16:9. 세션 배경으로도 쓰이니 1920×1080 권장.
