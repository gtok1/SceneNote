# 17. 시즌 단위 라이브러리 추적 명세서

작성일: 2026-09-06 · 대상: `user_library_items` 스키마 + 검색/상세/추가 경로

## 1. 문제 정의

TMDB 드라마의 시즌을 **검색에서 구분할 수 없고, 등록 상태도 시즌별로 가질 수 없다.**

재현 (VIVANT, TMDB id `218038`):
- `vivant` 검색 → 카드 **1개**만 나옴. 시즌1(2023)과 시즌2(2026)를 구분해 고를 수 없다.
- 시즌1만 등록했는데 시즌2 카드에도 "시청 1회"가 붙는다. (2026-09-06 임시 조치로 "다른 시즌 등록됨"으로 바꿨으나 근본 해결 아님)

## 2. 근본 원인 — 제공자 모델 차이가 사용자 기록까지 전파됨

| | 애니 (AniList) | 드라마 (TMDB) |
|---|---|---|
| 시즌2의 정체 | **별도 media id** → 별도 `contents` 행 | **같은 show id**의 하위 시즌 → 같은 `contents` 행 |
| 검색 결과 | 시즌마다 별도 카드 (정상) | 쇼 하나로 통합 |
| 등록 단위 | 시즌 = 작품 = 라이브러리 항목 (정상) | 쇼 단위로 공유 |

결정적 제약 ([0001_initial_schema.sql:230](../supabase/migrations/0001_initial_schema.sql)):

```sql
CONSTRAINT user_library_items_user_content_unique UNIQUE (user_id, content_id)
```

한 사용자가 한 `content_id`에 대해 **행을 하나만** 가질 수 있다. TMDB 드라마는 쇼 전체가 `content_id` 하나이므로, 시즌별 상태·본 횟수·완료 여부를 물리적으로 저장할 수 없다.

지금까지의 수정(시즌 검색 파싱, 현재 방영 시즌 기본 표시, `mergeSearchPages` first-wins, "다른 시즌 등록됨" 라벨)은 전부 이 제약의 **하류 증상**을 다룬 것이다.

## 3. 이미 갖춰진 것 (재사용 가능)

| 자산 | 상태 |
|---|---|
| `seasons` 테이블 (`content_id`, `season_number`, `episode_count`, `air_year`) | ✅ 존재, `add-to-library`가 채움 |
| `episodes` / `user_episode_progress` | ✅ 에피소드 단위 진행률 |
| `user_library_items.manual_watched_season_number` / `..._episode_number` | ✅ 진행 위치 포인터 |
| 상세 화면 시즌 탭 (시즌 1/2/3) | ✅ 동작 중 |
| `applyTmdbSeasonMetadata` / `pickCurrentSeason` (tmdb 어댑터) | ✅ 시즌 메타 계산 |

**부족한 것은 단 하나: 시즌 단위의 "등록/상태" 저장 단위.**

## 4. 설계 결정

### D-1. `user_library_items`에 `season_number`를 추가한다 (contents는 건드리지 않는다)

```sql
ALTER TABLE user_library_items ADD COLUMN season_number INTEGER;
```

- `NULL` = **작품 전체** 등록 (영화, 단일 시즌, 애니, 그리고 **기존 모든 행**)
- `1,2,3...` = 해당 시즌만 등록

CLAUDE.md의 핵심 분리 원칙과 일치한다 — 콘텐츠 메타데이터(`contents`/`seasons`)는 외부 API 모델을 그대로 따르고, **시즌 단위 개념은 사용자 기록 레이어에만** 도입한다.

### D-2. UNIQUE 제약을 부분 인덱스 2개로 교체한다

Postgres는 UNIQUE에서 NULL을 서로 다른 값으로 취급하므로 `UNIQUE(user_id, content_id, season_number)` 하나로는 **작품 전체 행이 중복 생성된다.** 반드시 분리한다.

```sql
ALTER TABLE user_library_items
  DROP CONSTRAINT IF EXISTS user_library_items_user_content_unique;

CREATE UNIQUE INDEX user_library_items_user_content_whole_unique
  ON user_library_items (user_id, content_id)
  WHERE season_number IS NULL;

CREATE UNIQUE INDEX user_library_items_user_content_season_unique
  ON user_library_items (user_id, content_id, season_number)
  WHERE season_number IS NOT NULL;
```

### D-3. 기존 데이터는 마이그레이션하지 않는다 (`NULL` 유지)

이미 등록된 행이 시즌1을 의미했는지 작품 전체를 의미했는지 **알 수 없다.** 추측해서 시즌 번호를 넣으면 사용자 기록을 왜곡한다. 전부 `NULL`(작품 전체)로 두고, UI에서 "작품 전체로 등록됨"으로 정직하게 표시한다.

### D-4. 검색은 방영된 시즌을 별도 카드로 펼친다

TMDB TV 결과 중 **이미 방영을 시작한 시즌이 2개 이상**이면 시즌별 카드로 펼친다.

- 대상: 시즌 조회를 이미 수행하는 **상위 3건**만 (추가 API 비용 없음 — `fetchTmdbSeasons` 재사용)
- 상한: 최근 방영 시즌 **5개**까지 (`MAX_EXPANDED_SEASONS`). 장수 시리즈가 결과를 도배하는 것 방지
- 각 카드: `external_id`는 **그대로**(쇼 id), `season_number`를 부여, 제목은 의미 있는 시즌명이 있으면 그것을, 없으면 `{제목} 시즌 N`
- 미방영 시즌은 제외 (`pickCurrentSeason`과 동일한 기준)

### D-5. 등록 상태 판정은 (content, season) 쌍으로 한다

검색 카드의 라이브러리 매칭 키를 `external_source:external_id` → `external_source:external_id:season_number`로 확장한다.

판정 순서:
1. 같은 `season_number` 행이 있으면 → 그 행의 상태/본 횟수 표시
2. `season_number IS NULL` 행만 있으면 → **"작품 전체로 등록됨"** (그 행의 상태를 이 시즌 것으로 주장하지 않는다)
3. 아무 행도 없으면 → 미등록

### D-6. `add-to-library`가 `season_number`를 받는다

요청에 `season_number`(선택)를 추가. 지정되면 해당 시즌 행을, 없으면 작품 전체 행을 upsert한다. `contents`/`seasons` 저장 로직은 변경 없음.

## 5. 기각한 대안

| 대안 | 기각 사유 |
|---|---|
| TMDB 시즌마다 별도 `contents` 행 생성 (`tmdb:218038:s2` 등) | 콘텐츠 정체성이 외부 API 모델과 어긋난다. `seasons` 테이블·시즌 탭 UI와 기능이 중복되고, `content_external_ids`·인물 필모그래피·추천 엔진의 동일성 판정까지 전부 재설계해야 한다 |
| 스키마는 그대로 두고 표시만 시즌 인식 | 등록 단위가 여전히 쇼 하나다. "시즌2는 등록 안 했다"를 표현할 방법이 근본적으로 없다. 2026-09-06 임시 조치("다른 시즌 등록됨")가 정확히 이 한계 |
| 기존 행을 시즌1로 일괄 마이그레이션 | 그 행이 시즌1을 의미했다는 근거가 없다. 사용자 기록 왜곡 |
| 검색에서 모든 시즌 무제한 펼침 | 장수 시리즈가 결과를 도배한다. D-4의 상한이 필요 |

## 6. 데이터 모델

**변경**: `user_library_items`에 `season_number INTEGER NULL` 추가 + UNIQUE 제약 교체 (D-2)
**불변**: `contents`, `seasons`, `episodes`, `user_episode_progress`, RLS 정책 전부 그대로

RLS는 기존 `auth.uid() = user_id` 정책이 새 컬럼에도 그대로 적용되므로 추가 정책 불필요.

## 7. 화면 명세

**검색 결과**
- VIVANT 검색 시 `VIVANT 시즌 1 (2023.07 · 10화)`와 `VIVANT 시즌 2 (2026.07 · 10화)` 두 카드
- 각 카드의 등록 배지는 D-5 판정을 따른다
- 카드 탭 → 상세 화면의 **해당 시즌 탭이 선택된 상태**로 진입 (`season` 파라미터 추가)

**콘텐츠 상세**
- `season` 파라미터를 받으면 해당 시즌 탭을 초기 선택
- 헤더의 전체 화수/최초 방영일은 **작품 전체 기준 유지** (기존 동작)

## 8. 엣지 케이스

| # | 상황 | 기대 |
|---|---|---|
| E-1 | 시즌이 1개뿐인 드라마 | 펼치지 않음. 기존과 동일하게 카드 1개 |
| E-2 | 시즌 3이 announced만 되고 미방영 | 카드 생성 안 함 (D-4) |
| E-3 | 애니(AniList) 결과 | 펼치지 않음. 이미 시즌=작품 |
| E-4 | 영화 | 펼치지 않음 |
| E-5 | 기존 `NULL` 행만 있는 상태에서 시즌2 카드 | "작품 전체로 등록됨" (D-5-2) |
| E-6 | 시즌2 등록 후 시즌1 카드 | 시즌1은 미등록으로 표시 (독립) |
| E-7 | 시즌 10개짜리 장수 시리즈 | 최근 5개까지만 (D-4) |
| E-8 | `season_number` 없이 기존 클라이언트가 add-to-library 호출 | 작품 전체 행으로 동작 (하위 호환) |

## 9. 테스트 표

**단위 — 시즌 펼치기**

| 입력 | 기대 |
|---|---|
| 방영 시즌 2개(2023, 2026) + 미방영 1개 | 카드 2개, 미방영 제외 |
| 방영 시즌 1개 | 펼치지 않음 (원본 1건) |
| 방영 시즌 7개 | 최근 5개 |
| `content_type: "movie"` | 펼치지 않음 |

**단위 — 등록 상태 판정**

| 라이브러리 행 | 카드 시즌 | 기대 |
|---|---|---|
| `season_number: 2` | 2 | 그 행의 상태 |
| `season_number: 2` | 1 | 미등록 |
| `season_number: NULL` | 2 | "작품 전체로 등록됨" |
| 없음 | 2 | 미등록 |

**통합**

| # | 시나리오 | 기대 |
|---|---|---|
| I-1 | 시즌2 카드에서 추가 | `season_number: 2` 행 생성, 시즌1 카드는 미등록 유지 |
| I-2 | 같은 시즌 카드에서 재추가 | 부분 유니크 인덱스로 중복 없이 갱신 |
| I-3 | 기존 NULL 행 보유 상태에서 시즌2 추가 | NULL 행과 시즌2 행이 **공존** (충돌 없음) |

## 10. 확실하지 않음 — 별도 검증 필요

- **기존 `NULL` 행과 시즌 행의 공존 UX**: 라이브러리 목록에서 같은 작품이 두 줄로 보일 수 있다. 목록 화면의 그룹핑 규칙은 이 명세 범위 밖이며, 구현 후 실제 데이터로 확인이 필요하다.
- **추천 엔진 영향**: `recommendationEngine`의 라이브러리 동일성 판정이 `content_id` 기준이라 시즌 행이 늘면 가중치가 중복 계산될 수 있다. 구현 시 `user_library_items` 조회 지점을 점검할 것.
- **AniList 시즌과의 표기 통일**: 애니는 별도 작품이라 "시즌 N" 접미사가 붙지 않는다. 표기 일관성은 후속 과제.
