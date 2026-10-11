# 49. 작품 감독·작가(제작진) 표시 — 1단계

작성일: 2026-10-09
대상 브랜치 기준: `main` (`6734575`) + 미커밋 작업(`docs/41`~`48` 등). 이 시점 `npm test` 1000개 중 999개 통과 — 실패 1개(`recommendationEngine.test.ts` "uses latest-popular fallback ordering with an empty library")는 무관한 기존 결함
선행 문서: **`docs/00_ui_style_rules.md`(웹·앱 공통 UI 규칙)**, `docs/39`(작품 상세 히어로), `docs/35`(Edge Function 배포 drift)

> 사용자 요청: "모든 화면에서 작품의 감독, 작가도 표시 가능하면 가능하게끔."

---

## 1. 문제 정의와 가능한 범위

지금은 출연진(cast)만 받고, 감독·작가는 어디에도 없다.

| 화면 | 지금 받는 데이터 | 1단계(이 명세) |
|------|-----------------|----------------|
| 작품 상세 | `get-content-detail` 응답(외부 상세, cast 포함) | **표시** |
| 추천 빠른 보기(`RecommendationQuickViewModal`) | 열 때 같은 `get-content-detail`을 이미 부른다 | **표시** |
| 비슷한 작품 빠른 보기(`SimilarContentQuickViewModal`) | 같음 | **표시** |
| 검색 결과·추천 카드, 라이브러리·홈·핀·공유 화면 | 목록 응답·DB에 제작진 없음. 카드마다 상세를 부르면 요청 수가 카드 수만큼 늘어난다(라이브러리 출연진도 같은 이유로 꺼져 있음: `useLibraryItemCast`) | **범위 밖 → 2단계**(DB 저장, 9장) |

**실측(읽기 전용, 2026-10-09)**
- **TMDB** `append_to_response=credits`(이미 요청 중)의 `credits.crew`에 감독·작가가 한국어 이름으로 온다.
  - 더 글로리(tv 136283): `Writer:김은숙 / Director:안길호`, `created_by: 김은숙, 안길호`
  - 기생충(movie 496243): `Director:봉준호 / Screenplay:봉준호, 한진원 / Story:봉준호 / Adaptation:김대환` + 조감독류(Assistant·Second Unit 등)
  - 일부 작품은 `crew`가 비어 있다.
- **AniList**: `Media.staff(perPage: 25, sort: [RELEVANCE, ID])`의 `edges.role`에 역할이 온다(이름은 일본어 native). 예: 장송의 프리렌 `Original Story:山田鐘人 / Director:斎藤圭一郎 / Series Composition:鈴木智尋 / Action Director:岩澤亨 …`
- **외부 호출 수는 늘지 않는다.** TMDB는 이미 받는 응답이고, AniList는 기존 질의에 필드만 더한다.

## 2. 근본 원인

- `supabase/functions/_shared/externalContent.ts`
  - `TmdbDetail.credits`가 `cast`만 타입에 있다(109행).
  - `fetchTmdbDetail`이 `mapTmdbCast`만 만든다(195행).
  - AniList 상세 질의(`ANILIST_DETAIL_QUERY`, 407행~)에 `staff`가 없다.
- `ContentMeta`(`_shared/types.ts:28`)·`get-content-detail` 응답(90·136·176행)·앱 `ContentDetailResponse`(`src/services/contentSearch.ts:113`)에 제작진 필드가 없다.

## 3. 설계 결정

### D-1. 역할은 셋이다: 감독(director)·작가(writer)·원작(original). 작가가 없을 때만 크리에이터(creator)
| 역할 | 표시 | TMDB `crew.job` | AniList `role`(괄호 부분 제거, 대소문자 무시) |
|------|------|-----------------|---------------------------------------------|
| director | 감독 | `Director`, `Series Director` | `director`, `chief director`, `series director` |
| writer | 작가 | `Writer`, `Screenplay`, `Teleplay`, `Story`, `Head Writer`, `Adaptation`, `Series Composition` | `series composition`, `script`, `screenplay`, `scenario` |
| original | 원작 | `Novel`, `Original Story`, `Comic Book`, `Author`, `Graphic Novel`, `Book`, `Original Concept` | `original creator`, `original story`, `original work` |
| creator | 크리에이터 | TV `created_by` — **director·writer가 모두 없을 때만** | 없음 |

- 그 밖의 직무(조감독, 액션 감독, 스크립트 슈퍼바이저, 캐릭터 디자인 등)는 버린다.
- `created_by`는 감독·작가가 섞여 있어(더 글로리) 감독·작가가 없을 때만 쓴다.

### D-2. 정리 규칙
- 역할마다 같은 사람(id)은 한 번만 나온다. 한 사람이 여러 역할이면 각 역할에 나온다(봉준호: 감독·작가).
- 역할마다 최대 3명이다(나타난 순서대로).
- 이름은 trim하고, 비면 버린다.
- **이름 표기**
  - TMDB: `name`. ko-KR로 요청하므로 한국어가 있으면 한국어다.
  - AniList: 출연진(`mapAniListVoiceActors`)과 같다. `name.native` 우선, 없으면 `name.full`. `original_name`은 `name.full`.

### D-3. AniList 작품에서 staff가 비면 한국어 보조 조회의 TMDB crew를 쓴다
지금 출연진이 `aniListCast.length ? aniListCast : koreanFallback?.cast`인 것과 같은 방식이다. 보조 조회(`append_to_response=credits`, 345~356행)의 `credits.crew`도 매핑한다. Kitsu·TVmaze는 보조 조회의 crew, 없으면 `[]`다.

### D-4. 응답 계약
- `ContentMeta.crew: CrewMemberMeta[]`
- `get-content-detail`의 외부 상세 두 경로(90·176행)에 `crew`를 넣는다. DB 대체 경로(136행)는 `crew: []`다.
- 앱 타입은 `crew?: CrewMember[]`(옵셔널)다. 재배포 전 구 서버 응답에도 앱이 깨지지 않게 하기 위함이다. 없으면 표시하지 않는다.

### D-5. 표시는 한 줄 요약이다
- 순수 함수 `createCrewSummary(crew)`
  - 역할 순서: 감독 → 작가 → 원작 → 크리에이터
  - 역할마다 이름 최대 2명, 넘으면 "외 N명"
  - `" · "`로 잇는다. 예: "감독 봉준호 · 작가 봉준호, 한진원"
- **작품 상세 히어로**(`ContentDetailHero`): 장르 배지 아래 한 줄. `typography.label` `textMuted`, `numberOfLines={2}`. 요약이 비면 렌더하지 않는다.
- **빠른 보기 두 곳**: "작품 소개" 다음에 섹션 "제작진"(각 모달의 기존 섹션 모양 그대로). 상세를 불러오는 중이거나 비면 섹션이 없다(자리를 미리 비워 두지 않는다).
- **접근성**: 히어로 줄 `accessibilityLabel`은 요약 문장 그대로다(" · " → ", ").
- 이름을 눌러 인물 상세로 가는 기능은 없다. 인물 상세는 배우·성우 분류만 지원한다(`docs/34`).

### D-6. 배포
- `get-content-detail` 재배포가 필요하다(사람). 운영은 v16(2026-07-09)이고 이미 stale이다(`npm run edge:drift`).
- 재배포하면 9월 이후 쌓인 다른 변경도 함께 나간다. 배포 전 `edge:drift`·테스트로 확인한다.
- `add-to-library`·`bulk-register-netflix`도 `fetchContentDetail`을 쓰지만 `crew`를 쓰지 않는다. 이 기능 때문에 재배포할 필요는 없다.

> D-N은 구현자가 임의로 바꾸면 안 된다. 바꿔야 한다고 판단되면 구현하지 말고 보고한다.

## 4. 기각한 대안

| 대안 | 기각 이유 |
|------|----------|
| TMDB `aggregate_credits`(TV 전 시즌 제작진) 추가 요청 | 응답이 커지고 요청이 하나 늘어난다. `credits`로 대부분 충분하다(최신 시즌 기준) |
| 카드마다 상세를 불러와 목록에도 표시 | 카드 수만큼 Edge 호출·TMDB 호출이 늘어난다(출연진도 같은 이유로 꺼 둠) |
| 1단계에서 DB(`contents`)에 저장 | 마이그레이션·백필·목록 질의 변경이 필요하다. 2단계로 분리한다 |
| `created_by`를 항상 "작가"로 | 감독이 섞여 들어온다(더 글로리 `created_by: 김은숙, 안길호`) |
| 역할별 이름 전부 표시 | 히어로가 길어진다. 최대 2명 + "외 N명" |

## 5. 계약

### 5.1 `supabase/functions/_shared/contentCrew.ts` (신규, 순수 — Deno API·네트워크 import 금지)
```ts
export type CrewRole = "director" | "writer" | "original" | "creator";
export interface CrewMemberMeta {
  id: number;
  name: string;
  original_name: string | null;
  role: CrewRole;
  job: string;              // 원본 직무/역할 문자열(trim)
  profile_url: string | null;
}
export const CREW_ROLE_LIMIT = 3;

export interface TmdbCrewInput { id?: number; name?: string | null; original_name?: string | null; job?: string | null; profile_path?: string | null }
export interface TmdbCreatorInput { id?: number; name?: string | null; original_name?: string | null; profile_path?: string | null }
export function mapTmdbCrew(crew: readonly TmdbCrewInput[] | undefined, createdBy?: readonly TmdbCreatorInput[] | undefined): CrewMemberMeta[];

export interface AniListStaffEdgeInput {
  role?: string | null;
  node?: { id?: number; name?: { full?: string | null; native?: string | null } | null; image?: { large?: string | null; medium?: string | null } | null } | null;
}
export function mapAniListStaff(edges: readonly AniListStaffEdgeInput[] | undefined): CrewMemberMeta[];
```
- **`mapTmdbCrew`**
  1. `crew`를 순서대로 돈다. `job.trim()`이 D-1 표 TMDB 집합(대소문자 정확히)에 들면 그 역할이다. `id`가 숫자가 아니거나 이름이 비면 버린다.
  2. 역할마다 id 중복을 제거하고 최대 3명을 남긴다.
  3. director·writer가 둘 다 0명이고 `createdBy`가 있으면, `createdBy`를 `role: "creator"`, `job: "Creator"`로 같은 규칙에 따라 더한다.
  4. 결과 순서는 director → writer → original → creator, 역할 안에서는 나타난 순서다.
  5. `profile_url = profile_path ? "https://image.tmdb.org/t/p/w185" + profile_path : null`.
- **`mapAniListStaff`**
  1. `role`에서 괄호 부분을 지우고(`/\s*\(.*?\)\s*/g` → `" "`) trim·소문자로 만든 값이 D-1 표 AniList 집합에 들면 그 역할이다.
  2. `job`은 원래 `role`(trim)이다.
  3. 이름은 `node.name.native?.trim() || node.name.full?.trim()`, `original_name`은 `node.name.full?.trim() || null`, `profile_url`은 `image.large ?? image.medium ?? null`이다.
  4. id 중복 제거·역할당 최대 3명·결과 순서는 TMDB와 같다. creator는 없다.

### 5.2 `supabase/functions/_shared/types.ts`
`ContentMeta`에 `crew: CrewMemberMeta[];`를 더한다(`./contentCrew.ts`에서 타입 import).

### 5.3 `supabase/functions/_shared/externalContent.ts`
- **TMDB 타입**: `TmdbDetail.credits`에 `crew?: TmdbCrewInput[]`, `TmdbDetail`에 `created_by?: TmdbCreatorInput[]`를 더한다.
- **`fetchTmdbDetail`**: 반환에 `crew: mapTmdbCrew(detail.credits?.crew, isMovie ? undefined : detail.created_by)`.
- **한국어 보조 조회(345~364행)**: 같은 응답에서 `crew = mapTmdbCrew(detail.credits?.crew, detail.created_by)`를 만들고, `TmdbKoreanFallback`에 `crew: CrewMemberMeta[]`를 더한다(실패 시 `[]`).
- **AniList 상세 질의**: `characters` 다음에 아래 필드를 더하고, 응답 타입에 `staff?: { edges?: AniListStaffEdgeInput[] | null } | null`을 더한다.
  ```graphql
  staff(perPage: 25, sort: [RELEVANCE, ID]) { edges { role node { id name { full native } image { large medium } } } }
  ```
- **`ContentMeta`를 반환하는 모든 곳에 `crew`를 넣는다.** 현재 `cast:`가 있는 반환은 219·569·652·707행이다. Edge Function은 `typecheck`에서 빠지므로 빠뜨려도 잡히지 않는다. **`grep -n "cast:" supabase/functions/_shared/externalContent.ts`로 전부 확인한다.**
  - AniList(569행): `crew: aniListCrew.length ? aniListCrew : koreanFallback?.crew ?? []`
  - Kitsu·TVmaze(652행): `crew: koreanFallback?.crew ?? []`
  - 707행: `crew: []`

### 5.4 `supabase/functions/get-content-detail/index.ts`
90·176행 응답 `content`에 `crew: contentMeta.crew`, 136행(DB 대체)에 `crew: []`를 넣는다. 다른 동작은 그대로다.

### 5.5 앱 타입·순수 함수
```ts
// src/types/content.ts (추가)
export type CrewRole = "director" | "writer" | "original" | "creator";
export interface CrewMember {
  id: number;
  name: string;
  original_name: string | null;
  role: CrewRole;
  job: string;
  profile_url: string | null;
}

// src/services/contentSearch.ts ContentDetailResponse.content에 추가
crew?: CrewMember[];

// src/utils/contentCrew.ts (신규)
export const CREW_ROLE_LABELS: Record<CrewRole, string> = { director: "감독", writer: "작가", original: "원작", creator: "크리에이터" };
export const CREW_SECTION_TITLE = "제작진";
export interface CrewSummary {
  parts: { role: CrewRole; label: string; names: string[]; extra: number }[];
  text: string;               // 예: "감독 봉준호 · 작가 봉준호, 한진원"
  accessibilityLabel: string; // text의 " · "를 ", "로
}
export function createCrewSummary(crew: readonly CrewMember[] | null | undefined, namesPerRole = 2): CrewSummary;
```
- **`createCrewSummary`**
  1. 역할 순서는 director → writer → original → creator다.
  2. 역할마다 이름을 trim하고 빈 것을 버린 뒤, 이름 기준으로 중복을 제거한다.
  3. 앞에서 `namesPerRole`명을 `names`로, 나머지 수를 `extra`로 둔다.
  4. 이름이 0명인 역할은 뺀다.
  5. 각 부분은 `` `${label} ${names.join(", ")}${extra ? ` 외 ${extra}명` : ""}` ``이다. `text`는 부분들을 `" · "`로 잇는다.
  6. 비면 `{ parts: [], text: "", accessibilityLabel: "" }`.

### 5.6 화면
| 파일 | 변경 |
|------|------|
| `src/components/content/ContentDetailHero.tsx` | props `crewLine?: string \| null`, `crewAccessibilityLabel?: string`. 장르 배지 아래, 경고 위에 `{crewLine ? <Text accessibilityLabel={crewAccessibilityLabel} numberOfLines={2} style={[typography.label, styles.muted]}>{crewLine}</Text> : null}` |
| `app/content/[id].tsx` | `const crew = createCrewSummary(externalDetail.data?.content.crew)`를 `ContentDetailHero`에 `crewLine={crew.text \|\| null}`, `crewAccessibilityLabel={crew.accessibilityLabel}`로 넘긴다 |
| `src/components/content/RecommendationQuickViewModal.tsx` | `createCrewSummary(content?.crew)`. "작품 소개" 다음에 `{crew.text ? <InfoSection title={CREW_SECTION_TITLE}><Text style={styles.value}>{crew.text}</Text></InfoSection> : null}` |
| `src/components/content/SimilarContentQuickViewModal.tsx` | 같은 방식, 이 파일의 `Section`과 `styles.text` 사용 |

## 6. 엣지 케이스

| # | 상황 | 기대 동작 | 연결 |
|---|------|----------|------|
| E-1 | 영화: 감독 1명, 각본 2명, 조감독 여러 명 | "감독 봉준호 · 작가 봉준호, 한진원"(조감독 제외) | T-1, S-1 |
| E-2 | 드라마: Writer 1, Director 1, `created_by` 2 | 감독·작가만, 크리에이터 없음 | T-2 |
| E-3 | crew 비어 있고 `created_by`만 | "크리에이터 …" | T-3 |
| E-4 | crew·created_by 모두 비어 있음 | 표시 없음(히어로 줄·섹션 없음) | T-4, S-3 |
| E-5 | 같은 사람이 Screenplay·Story 둘 다 | 작가에 한 번 | T-1 |
| E-6 | 감독 5명 | 데이터 3명, 화면 "감독 A, B 외 1명" | T-5, S-2 |
| E-7 | AniList `Director (eps 1-12)`, `Action Director`, `Original Story` | 감독(괄호 제거), 액션 감독 제외, 원작 | A-1 |
| E-8 | AniList 이름 native 없음 | `full` 사용 | A-2 |
| E-9 | AniList staff 비고 TMDB 보조 조회 crew 있음 | 보조 crew 사용(D-3) | M-2 |
| E-10 | 구 서버(재배포 전) 응답에 `crew` 없음 | 표시 없음, 오류 없음 | S-3, M-1 |
| E-11 | 외부 API 실패로 DB 대체 응답 | `crew: []`, 표시 없음 | M-1 |
| E-12 | 앱 글자 1.3배·좁은 폭 | 히어로 줄 2줄 줄임표, 넘침 없음 | M-3 |

## 7. 테스트 표

**모든 행을 테스트로 옮긴다. 줄이지 않는다. 한 행 = `it` 하나.** 모든 행은 구현 전에 실패해야 한다(신규 모듈).

### `supabase/functions/_shared/contentCrew.test.ts` (신규, `.ts` 확장자 import)
| ID | 입력 | 기대 |
|----|------|------|
| T-1 | `mapTmdbCrew([{id:1,name:"봉준호",job:"Director"},{id:2,name:"김성식",job:"Assistant Director"},{id:1,name:"봉준호",job:"Story"},{id:1,name:"봉준호",job:"Screenplay"},{id:3,name:"한진원",job:"Screenplay"},{id:4,name:"이정훈",job:"Second Unit Director"},{id:5,name:"김대환",job:"Adaptation"}])` | `[director 1 봉준호(job "Director"), writer 1 봉준호(job "Story"), writer 3 한진원, writer 5 김대환]`(id·role·name·job 확인, 순서 그대로) |
| T-2 | crew `[{id:10,name:"김은숙",job:"Writer"},{id:11,name:"안길호",job:"Director"}]`, createdBy `[{id:10,name:"김은숙"},{id:11,name:"안길호"}]` | `[director 11 안길호, writer 10 김은숙]` — creator 없음 |
| T-3 | crew `[]`, createdBy `[{id:20,name:" 노희경 "}]` | `[{ id:20, name:"노희경", role:"creator", job:"Creator", original_name:null, profile_url:null }]` |
| T-4 | `mapTmdbCrew(undefined)`, `mapTmdbCrew([], [])`, `mapTmdbCrew([{name:"이름만",job:"Director"},{id:7,name:"  ",job:"Director"}])` | 셋 다 `[]` |
| T-5 | Director 5명(id 1~5) | director 3명(id 1,2,3) |
| T-6 | `{id:30,name:"원작자",job:"Novel",profile_path:"/a.jpg"}` | `role:"original"`, `profile_url:"https://image.tmdb.org/t/p/w185/a.jpg"` |
| A-1 | `mapAniListStaff([{role:"Original Story",node:{id:1,name:{native:"山田鐘人",full:"Kanehito Yamada"}}},{role:"Director (eps 1-12)",node:{id:2,name:{native:"斎藤圭一郎"}}},{role:"Action Director",node:{id:3,name:{native:"岩澤亨"}}},{role:"Series Composition",node:{id:4,name:{native:"鈴木智尋"}}}])` | `[director 2 斎藤圭一郎(job "Director (eps 1-12)"), writer 4 鈴木智尋, original 1 山田鐘人(original_name "Kanehito Yamada")]` |
| A-2 | `{role:"Director",node:{id:9,name:{native:null,full:"Ryu Ishikawa"},image:{medium:"m.jpg"}}}` | `name:"Ryu Ishikawa"`, `original_name:"Ryu Ishikawa"`, `profile_url:"m.jpg"` |
| A-3 | `mapAniListStaff(undefined)`, 역할 `"Character Design"`만 | 둘 다 `[]` |

### `src/utils/contentCrew.test.ts` (신규)
`m(id, name, role)` 헬퍼로 `CrewMember`를 만든다(`original_name: null`, `job: role`, `profile_url: null`).
| ID | 입력 | 기대 |
|----|------|------|
| S-1 | `[m(1,"봉준호","writer"), m(1,"봉준호","director"), m(3,"한진원","writer")]` | `text: "감독 봉준호 · 작가 봉준호, 한진원"`, `accessibilityLabel: "감독 봉준호, 작가 봉준호, 한진원"`, `parts` 2개 |
| S-2 | director 3명(A·B·C) | `"감독 A, B 외 1명"`, `parts[0].extra === 1` |
| S-3 | `[]`, `undefined`, `null`, 이름이 공백뿐인 항목 | 모두 `{ parts: [], text: "", accessibilityLabel: "" }` |
| S-4 | original 1명(X) + creator 1명(Y) | `"원작 X · 크리에이터 Y"` |
| S-5 | `CREW_ROLE_LABELS`, `CREW_SECTION_TITLE` | 5.5 값과 `deepEqual`, `"제작진"` |
| S-6 | director 2명(같은 이름 "A", id 다름) | `"감독 A"`(이름 기준 중복 제거) |

### 수동 확인 (UI-14.3, 사람 — `get-content-detail` 재배포 후)

| ID | 플랫폼 | 확인 |
|----|--------|------|
| M-1 | 웹 1440 | 영화(기생충)·한국 드라마(더 글로리) 상세 히어로에 감독·작가 줄. 제작진이 없는 작품은 줄 없음. 재배포 전에는 아무것도 안 보이고 오류 없음 |
| M-2 | 웹 375 | 추천·비슷한 작품 빠른 보기에 "제작진" 섹션. 애니(프리렌)는 일본어 이름 + 원작 |
| M-3 | 앱(iOS 세로) | 히어로 줄 2줄 줄임표, 글자 1.3배 잘림 없음, VoiceOver가 쉼표로 읽음 |

## 8. 변경 파일

| 파일 | 변경 |
|------|------|
| `supabase/functions/_shared/contentCrew.ts` | 신규(5.1) |
| `supabase/functions/_shared/contentCrew.test.ts` | 신규, T-1~T-6, A-1~A-3 |
| `supabase/functions/_shared/types.ts` | 5.2 |
| `supabase/functions/_shared/externalContent.ts` | 5.3 |
| `supabase/functions/get-content-detail/index.ts` | 5.4 |
| `src/types/content.ts` | 5.5 타입 |
| `src/services/contentSearch.ts` | `ContentDetailResponse.content.crew?` |
| `src/utils/contentCrew.ts` | 신규(5.5) |
| `src/utils/contentCrew.test.ts` | 신규, S-1~S-6 |
| `src/components/content/ContentDetailHero.tsx` | 5.6 |
| `app/content/[id].tsx` | 5.6 |
| `src/components/content/RecommendationQuickViewModal.tsx` | 5.6 |
| `src/components/content/SimilarContentQuickViewModal.tsx` | 5.6 |

## 9. 범위 밖과 2단계

| 항목 | 이유·방법 |
|------|----------|
| 검색·추천 카드, 라이브러리·홈·핀·공유 화면 표시 | **2단계.** `contents`에 제작진(jsonb 또는 별도 테이블)을 저장한다. `add-to-library`·`get-content-detail`에서 쓰고, 기존 작품은 상세를 열 때 채운다. 목록 질의에 포함하는 마이그레이션이 필요해 별도 명세로 한다 |
| 감독·작가 이름으로 인물 상세 열기·좋아하는 인물 등록 | 인물 기능은 배우·성우 분류만 지원(`docs/34`) |
| 감독·작가로 검색·추천 가중치 | 별도 |
| 일본 제작진 한국어 이름 | `docs/38`(인물 한글명) 확장 필요 |
| TV 전 시즌 제작진(`aggregate_credits`) | 기각한 대안 |

## 10. 확실하지 않음 — 별도 검증 필요
1. AniList `staff(sort: [RELEVANCE, ID])`는 2026-10-09 실측으로 동작을 확인했다. 질의 비용 제한(분당 요청 수)은 상세 1회당 요청 수가 그대로라 영향이 없다고 판단하지만, 배포 후 `get-content-detail` 오류율로 확인한다.
2. TMDB `credits.crew`의 TV 감독·작가는 최신 시즌 기준이다. 시즌마다 바뀐 작품은 최신 시즌 제작진만 보인다.
