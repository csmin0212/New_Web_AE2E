# TRPG 세션 툴 (trpg-vtt)

아리안로드 2E 캠페인(이상동몽, 아리안로드 온라인)용 세션 툴. 캠페인마다 설정만 다르고 엔진은 하나다.

## 지금 되는 것 (1~2단계)

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
