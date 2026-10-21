# TRPG 세션 툴 (trpg-vtt)

아리안로드 2E 캠페인(이상동몽, 아리안로드 온라인)용 세션 툴. 캠페인마다 설정만 다르고 엔진은 하나다.

## 세션 화면

```
┌ 위 띠: 캠페인 · 대화/전투 탭 · 내 화면 테마 · 초대 코드 · 연출(GM) · 기록 ┐
│ 무대                                                   │ 기록(LOG)     │
│  대화: 비주얼노벨 (갈바테인식)                           │ 전체/대화/    │
│  전투: 이니셔티브 띠 + 그리드 + 유닛 카드                 │ 굴림/잡담     │
└ 아래 띠: 파티 얼굴(누르면 시트) · 화자 고르기 · 입력 ─────────────────────┘
```

- **대화 모드**: CVGwent 스토리 화면 구조. 위아래 검은 띠, 테두리 두른 스탠딩, 말하는 사람 가슴께 말풍선과 「칭호 이름」 이름표.
  말하는 인물은 앞으로 나오고 나머지는 어두워지며 뒤로 빠진다. GM 서술·@행동은 아래 띠 지문, 새 대사는 타자기.
  그림이 있는 화자는 말하면 자동으로 무대에 오른다(최대 4명). GM이 고정 출연진도 세울 수 있다.
- **페이즈**: 오프닝·미들·클라이맥스·엔딩·자유. 바꾸면 모두의 화면에 컷인.
- **전투 모드**: 한 칸 5m 그리드, 토큰 끌어 옮기기(칸·m 표시), 행동치 순 이니셔티브, 라운드·차례 넘기기.
  플레이어는 자기 토큰만 옮길 수 있다.
- **테마 4종** (`src/lib/themes.ts`): 고서·금박 / 고딕·갈바테인풍 / 팬텀·페르소나풍 / 성야·마도서.
  GM이 캠페인 기본을 고르고, 각자 자기 화면에서만 바꿔 볼 수 있다. 새 테마는 색 변수 + `data-skin` 장식을 추가하면 된다.
- **연출 패널 (GM)**: 모드·페이즈·장소, 테마, 배경·CG, 무대 출연진, NPC 화자(이름·스탠딩·색), 전투 준비(그리드·전장 그림·토큰), 시트 불러오기.

### Roll20 캐릭터 내보내기

`roll20/vtt-character-export.js` 를 Roll20 캠페인의 Mod (API) Scripts 에 붙여넣고, 채팅에 `!vtt-export`(토큰 선택) 또는 `!vtt-export 이름`.
핸드아웃 「VTT 내보내기 · 이름」에 모든 속성·반복 항목(스킬·장비)·매크로가 JSON 으로 들어간다.
(툴 쪽 가져오기는 실제 시트 JSON 을 보고 맞춘다)

### 그림 넣기

`public/` 아래 넣고 `/경로` 로 쓰거나 https 주소를 쓴다. 캐릭터 카드 `⋯` → 얼굴 아이콘·스탠딩(배경 투명 PNG)·이름 색.
`public/local/` 은 git 에 올라가지 않는 개인 폴더다 (로컬 데모 그림).

## 1~2단계 기능

- **로그인·캠페인**: 구글 로그인 → GM이 캠페인을 만들고 6자리 초대 코드를 나눠줌 → 플레이어가 코드로 참가
- **시트 불러오기**: 구글 시트 탭 하나 = 캐릭터 하나. 능력치, HP/MP/페이트 최대치, 배운 스킬(SL 1 이상)
  - 시트가 원본. 툴은 현재 HP/MP/페이트만 들고 있고, "시트 다시 불러오기"로 최대치를 갱신
  - 파서는 ARON `src/lib/charsheet.ts` 에서 옮겨 옴 (이상동몽·ARON 같은 양식)
- **캐릭터 카드**: HP/MP/페이트 게이지 (클릭해서 `-12`, `+5`, `30` 입력), 능력치 클릭 → 판정 (보정·페이트·GM 비밀)
- **채팅**
  - `대사` · `@행동` · `(잡담` · `/me 행동`
  - `/c 2D+5 명중` 판정 (크리티컬: 6이 2개 이상, 펌블: 전부 1)
  - `/r 6d6+13 대미지` 일반 굴림 · `/gr 3D+2` GM에게만 보이는 굴림
  - `/w 이름 내용` 귓속말 (참가자 이름 또는 캐릭터 이름) · `/img URL` 이미지
  - GM은 화자를 PC·NPC·직접 입력한 `[칭호] 이름` 으로 바꿔 말할 수 있음

## 데이터 구조 (무료 한도 안에서 돌도록)

| 저장소 | 경로 | 내용 |
|---|---|---|
| Firestore | `campaigns/{cid}` | 이름, GM, 초대 코드 |
| | `campaigns/{cid}/members/{uid}` | 참가자 |
| | `campaigns/{cid}/characters/{id}` | 시트 사본 + 현재 HP/MP/페이트 |
| | `inviteCodes/{code}`, `users/{uid}/campaigns/{cid}` | 참가용 · 홈 목록용 |
| Realtime DB | `chat/{cid}/public/{id}` | 공개 채팅·굴림 |
| | `chat/{cid}/inbox/{uid}/{id}` | 귓속말·비밀 굴림 (받는 사람만 읽기 가능) |
| | `gm/{cid}`, `codes/{cid}`, `members/{cid}/{uid}` | 채팅 권한 확인용 |

채팅은 Realtime DB(전송량 기준 과금)에 둬서 메시지가 많아도 Firestore 읽기 한도를 쓰지 않는다.
보안 규칙: `firestore.rules`, `database.rules.json`.

## 로컬 실행 (에뮬레이터)

Firebase 에뮬레이터는 Java 21 이상이 필요하다.

```bash
npm install
npm run emulators        # 다른 터미널에서
npm run dev
```

`.env.local` 에 `NEXT_PUBLIC_USE_EMULATORS=1`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-trpg-vtt` 를 넣는다.

> **경로에 한글이 있으면 Firestore 에뮬레이터가 규칙 파일을 못 읽는다** (`바탕 화면`).
> 영문 경로에 junction 을 만들어 거기서 실행하면 된다:
> `mklink /J C:\dev\trpg-vtt "C:\Users\joy64\바탕 화면\MyCode\trpg-vtt"`

## 실제 Firebase 연결 (무료 Spark 요금제)

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트 생성 (요금제는 Spark 그대로, 카드 등록 없음)
2. Authentication → 로그인 방법 → **Google** 사용 설정
3. Firestore Database 생성, Realtime Database 생성
4. 프로젝트 설정 → 웹 앱 추가 → 구성값을 `.env.local` 에 (`.env.example` 참고), `NEXT_PUBLIC_USE_EMULATORS=0`
5. 규칙 배포: `firebase deploy --only firestore:rules,database --project <프로젝트ID>`
6. Vercel 배포 시 같은 환경 변수 등록. Authentication → 승인된 도메인에 Vercel 도메인 추가

### 구글 시트

- 서비스 계정 없이: 시트를 "링크가 있는 모든 사용자 보기"로 공유하면 CSV로 읽는다
- 비공개 시트: `GOOGLE_SERVICE_ACCOUNT_JSON` 에 서비스 계정 JSON (ARON 것 재사용 가능), 시트를 그 이메일에 공유

## 다음 단계

3. 그리드 맵 + 토큰 (Realtime DB) · 4. 스킬 버튼 MP 차감, 포션, 대미지·방어력, BS 마커 · 5. 대사창·컷인 연출

## 테스트

```bash
npm test   # 주사위, 채팅 명령, 시트 파서
```
