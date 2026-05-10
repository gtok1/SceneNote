# SceneNote — Edge Function 설계 및 구현 가이드

**버전:** 1.0.0
**작성일:** 2026-05-02
**작성자:** Supabase Backend Architect
**상태:** 확정 (MVP 기준)
**기반 문서:** 04_architecture.md, 05_erd_rls.md, 06_backend_schema.sql

---

## 1. MVP Edge Function 목록

| 함수명 | 목적 | HTTP Method | 인증 필요 | 우선순위 |
|--------|------|-------------|----------|---------|
| `search-content` | 외부 API(TMDB + AniList 우선) 검색 결과 통합 반환 | POST | Yes | P0 |
| `get-content-detail` | 특정 작품 상세 정보 조회 (시즌 요약 포함) | POST | Yes | P0 |
| `add-to-library` | 검색 결과를 라이브러리에 추가 (콘텐츠 메타데이터 저장 + user_library_items 생성) | POST | Yes | P0 |
| `fetch-episodes` | 특정 시즌의 에피소드 목록 lazy load (DB 없으면 외부 API 호출 후 저장) | POST | Yes | P0 |

### 핵심 원칙 (04_architecture.md 확정 사항 재확인)

- **외부 API 키는 절대 클라이언트에 노출하지 않는다.** 모든 외부 API 호출은 Edge Functions를 통한다.
- **콘텐츠 메타데이터 쓰기는 service_role만 가능하다.** 클라이언트는 RLS로 차단된다.
- **단순 사용자 CRUD (핀 생성/수정/삭제, 에피소드 체크, 라이브러리 상태 변경)는 Edge Function 없이 클라이언트에서 직접 Supabase SDK를 호출한다.**
- **검색 결과를 bulk 캐싱하지 않는다.** 검색 TTL 캐시(1시간)만 허용.

---

## 2. 각 Edge Function 상세 설계

---

### 2.1 EF-001: `search-content`

#### 목적

외부 API(TMDB, AniList)에서 콘텐츠를 검색하고, 결과를 공통 스키마로 정규화하여 반환한다. `external_search_cache`를 활용해 동일 검색어에 대한 중복 API 호출을 방지한다.

#### Request

```
POST /functions/v1/search-content
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

```typescript
// Request Body
{
  query: string;           // 검색어 (필수, 1~100자)
  media_type?: 'anime' | 'drama' | 'movie' | 'all';  // 기본값: 'all'
  page?: number;           // 페이지 번호 (기본값: 1)
}
```

#### Response

```typescript
// 200 OK
{
  results: ContentSearchResult[];
  total: number;
  page: number;
  has_next: boolean;
  from_cache: boolean;     // 캐시에서 반환된 결과인지 여부
  partial: boolean;        // 일부 API만 성공한 경우 true
}

// ContentSearchResult 타입 (정규화된 공통 스키마)
interface ContentSearchResult {
  external_source: 'tmdb' | 'anilist' | 'kitsu' | 'tvmaze';
  external_id: string;
  content_type: 'anime' | 'kdrama' | 'jdrama' | 'movie' | 'other';
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  has_seasons: boolean;    // 시리즈 여부
  episode_count: number | null;
}

// 400 Bad Request
{ error: 'INVALID_REQUEST', message: string }

// 401 Unauthorized
{ error: 'UNAUTHORIZED', message: 'Valid JWT required' }

// 503 Service Unavailable (모든 외부 API 실패 시)
{ error: 'ALL_APIS_FAILED', message: string }
```

#### 내부 로직 흐름

```
1. JWT 검증 (auth.getUser() 호출)
   └── 실패 시 401 반환

2. Request Body 유효성 검증
   └── query 필수, 1~100자
   └── 실패 시 400 반환

3. 캐시 키 생성
   └── query_hash = crypto.subtle.digest('SHA-256', `${query}:${media_type}:${page}`)
   └── source 별로 각각 캐시 조회 (TMDB 캐시, AniList 캐시)

4. external_search_cache 조회
   └── WHERE query_hash = $hash AND source = $source AND expires_at > now()
   └── 캐시 HIT: response_json 반환 (from_cache: true)
   └── 캐시 MISS: 외부 API 호출 단계로 이동

5. 외부 API 병렬 호출 (Promise.allSettled)
   └── media_type에 따라 호출 대상 결정:
       - 'anime': AniList GraphQL + TMDB REST (AniList 우선)
       - 'drama': TMDB REST 전용
       - 'movie': TMDB REST 전용
       - 'all': TMDB REST + AniList GraphQL 병렬
   └── 각 API 타임아웃: 5초 (AbortController)

6. 결과 정규화
   └── 각 API 응답을 ContentSearchResult 공통 타입으로 변환
   └── 성공한 API 결과만 수집
   └── 실패한 API 존재 시 partial: true 설정

7. external_search_cache UPSERT (성공한 API별로 저장)
   └── TTL: now() + interval '1 hour'
   └── ON CONFLICT (query_hash, source) DO UPDATE SET ...
   └── service_role 클라이언트 사용

8. 정규화된 결과 반환
   └── 결과 병합, 중복 제거 (동일 external_id + source 기준)
   └── 페이지네이션 적용
```

#### 외부 API 호출 전략

| 항목 | TMDB | AniList |
|------|------|---------|
| 프로토콜 | REST | GraphQL |
| 인증 | Authorization: Bearer API_KEY | 인증 불필요 (공개 API) |
| 타임아웃 | 5초 | 5초 |
| Rate Limit | 40 req/sec (확실하지 않음 — Uncertain) | 90 req/min (확실하지 않음 — Uncertain) |
| Fallback | AniList로 대체 (anime 한정) | TMDB로 대체 불가 (애니 전용) |

#### 캐싱 전략

- **캐시 키:** `SHA-256(query:media_type:page)` per API source
- **TTL:** 1시간 (검색 결과)
- **캐시 단위:** API source별로 분리 저장 (`source` 컬럼 활용)
- **캐시 히트 조건:** `query_hash = $hash AND source = $source AND expires_at > now()`

---

### 2.2 EF-002: `get-content-detail`

#### 목적

특정 외부 API 콘텐츠의 상세 정보(시즌 요약 포함)를 반환한다. DB에 이미 저장된 콘텐츠라면 DB에서 반환하고, 없으면 외부 API를 호출한다. DB 저장(upsert)은 이 함수에서 수행하지 않는다 — 저장은 `add-to-library`에서만 발생한다.

#### Request

```
POST /functions/v1/get-content-detail
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

```typescript
// Request Body
{
  api_source: 'tmdb' | 'anilist' | 'kitsu' | 'tvmaze';
  external_id: string;
}
```

#### Response

```typescript
// 200 OK
{
  content: ContentDetail;
  seasons: SeasonSummary[];    // 시리즈인 경우. 영화는 빈 배열.
  from_db: boolean;            // DB에서 반환된 데이터인지 외부 API에서 온 것인지
}

interface ContentDetail {
  external_source: 'tmdb' | 'anilist' | 'kitsu' | 'tvmaze';
  external_id: string;
  content_type: 'anime' | 'kdrama' | 'jdrama' | 'movie' | 'other';
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  // 이미 라이브러리에 저장된 경우 내부 content_id도 포함
  content_id?: string;          // contents.id (DB에 있을 때만)
}

interface SeasonSummary {
  season_number: number;
  title: string | null;
  episode_count: number | null;
  air_year: number | null;
  // DB에 저장된 경우 내부 season_id 포함
  season_id?: string;           // seasons.id (DB에 있을 때만)
}

// 404 Not Found
{ error: 'CONTENT_NOT_FOUND', message: string }

// 503 Service Unavailable
{ error: 'API_ERROR', message: string }
```

#### 내부 로직 흐름

```
1. JWT 검증

2. DB에서 (api_source, external_id) 기준 콘텐츠 조회
   └── content_external_ids WHERE api_source = $source AND external_id = $id
   └── 존재하면: contents + seasons JOIN 조회 후 반환 (from_db: true)

3. DB에 없으면: 외부 API 호출
   └── TMDB: GET /movie/{id} 또는 /tv/{id}
   └── AniList: GraphQL query (Media by id)
   └── 응답 정규화 후 반환 (from_db: false)
   └── 이 단계에서 DB 저장 금지 — add-to-library에서만 저장

4. 시즌 정보 포함하여 반환
```

#### 캐싱 전략

- 콘텐츠 상세 정보는 DB 자체가 캐시 역할을 한다.
- DB에 없을 때만 외부 API를 호출하고, 결과를 `external_search_cache`에 TTL 24시간으로 저장한다 (선택적 최적화 — 반복 상세 조회 방어).

---

### 2.3 EF-003: `add-to-library`

#### 목적

사용자가 검색 결과에서 "라이브러리에 추가"를 탭할 때 호출된다. 콘텐츠 메타데이터를 DB에 저장(UPSERT)하고, `user_library_items` 레코드를 생성한다. 에피소드는 lazy load 방침에 따라 이 단계에서 저장하지 않는다.

#### Request

```
POST /functions/v1/add-to-library
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

```typescript
// Request Body
{
  api_source: 'tmdb' | 'anilist' | 'kitsu' | 'tvmaze';
  external_id: string;
  watch_status: 'wishlist' | 'watching' | 'completed' | 'dropped';  // 기본값: 'wishlist'
}
```

#### Response

```typescript
// 201 Created
{
  library_item_id: string;   // user_library_items.id
  content_id: string;        // contents.id
  status: WatchStatus;
}

// 409 Conflict (이미 라이브러리에 있는 경우)
{
  error: 'ALREADY_IN_LIBRARY',
  library_item_id: string;   // 기존 항목의 id
  content_id: string;
  current_status: WatchStatus;
}

// 400 Bad Request
{ error: 'INVALID_REQUEST', message: string }

// 401 Unauthorized
{ error: 'UNAUTHORIZED', message: string }

// 503 Service Unavailable
{ error: 'API_ERROR', message: string }
```

#### 내부 로직 흐름

```
1. JWT 검증
   └── user_id = jwt.sub (auth.uid() 추출)

2. 중복 체크
   └── content_external_ids WHERE api_source = $source AND external_id = $id
   └── 있으면 contents.id 확인
   └── user_library_items WHERE user_id = $uid AND content_id = $content_id
   └── 이미 존재하면 409 반환

3. 외부 API에서 콘텐츠 상세 조회
   └── TMDB 또는 AniList API 호출 (get-content-detail 로직 재사용)
   └── 실패 시 503 반환

4. contents UPSERT (service_role 클라이언트)
   └── ON CONFLICT (source_api, source_id) DO UPDATE
       SET poster_url = EXCLUDED.poster_url,
           title_primary = EXCLUDED.title_primary,
           updated_at = now()
   └── 반환된 contents.id 저장

5. content_external_ids UPSERT
   └── ON CONFLICT (api_source, external_id) DO NOTHING

6. 시리즈인 경우: seasons UPSERT
   └── 외부 API에서 시즌 목록 조회
   └── ON CONFLICT (content_id, season_number) DO UPDATE
   └── 에피소드는 저장하지 않음 (fetch-episodes에서 lazy load)

7. user_library_items INSERT
   └── user_id = JWT에서 추출한 auth.uid()  ← 절대 클라이언트 전달값 사용 금지
   └── content_id = 4번에서 저장/조회된 contents.id
   └── status = request.watch_status

8. metadata_sync_logs INSERT (감사 로그)
   └── operation: 'add_to_library'
   └── status: 'success' | 'partial' | 'failed'
   └── request_payload, response_snapshot 포함

9. 201 반환
```

**보안 주의사항:**
- `user_id`는 반드시 서버에서 JWT를 파싱하여 추출해야 한다. 클라이언트가 전달한 `user_id` 값을 신뢰하지 않는다.
- `service_role` 키는 환경변수에서만 읽는다. 코드에 하드코딩 절대 금지.

---

### 2.4 EF-004: `fetch-episodes`

#### 목적

에피소드 목록 화면(SCR-009) 진입 시 호출된다. DB에 해당 시즌의 에피소드가 있으면 DB에서 반환하고, 없으면 외부 API를 호출한 후 저장하고 반환한다. DB가 캐시 역할을 한다.

#### Request

```
POST /functions/v1/fetch-episodes
Authorization: Bearer <supabase-anon-key>
Content-Type: application/json
```

```typescript
// Request Body
{
  content_id: string;   // contents.id (내부 UUID)
  season_id: string;    // seasons.id (내부 UUID)
}
```

#### Response

```typescript
// 200 OK
{
  episodes: EpisodeInfo[];
  from_db: boolean;
  season_id: string;
}

interface EpisodeInfo {
  id: string;                    // episodes.id
  episode_number: number;
  title: string | null;
  air_date: string | null;       // ISO 8601 date string
  duration_seconds: number | null;
}

// 404 Not Found (season이 DB에 없는 경우)
{ error: 'SEASON_NOT_FOUND', message: string }

// 503 Service Unavailable
{ error: 'API_ERROR', message: string }
```

#### 내부 로직 흐름

```
1. JWT 검증

2. seasons 테이블에서 season_id 확인
   └── 없으면 404 반환
   └── 있으면 content_id, api_source, source_id 추출

3. episodes 테이블에서 해당 season_id 에피소드 조회
   └── WHERE season_id = $season_id
   └── 결과가 있으면 DB에서 반환 (from_db: true)

4. DB에 에피소드 없으면: 외부 API 호출
   └── contents → source_api, source_id 조회
   └── TMDB: GET /tv/{id}/season/{season_number}
   └── AniList: 에피소드 목록 지원 여부 확인 필요 (확실하지 않음 — Uncertain)
   └── 응답 정규화

5. episodes UPSERT (service_role)
   └── ON CONFLICT (season_id, episode_number) DO UPDATE
       SET title = EXCLUDED.title,
           air_date = EXCLUDED.air_date,
           duration_seconds = EXCLUDED.duration_seconds,
           updated_at = now()

6. 저장된 에피소드 목록 반환 (from_db: false)
```

#### 캐싱 전략

- **DB = 캐시.** 한 번 저장된 에피소드는 DB에서 직접 반환한다.
- 외부 API 데이터 변경 동기화(신규 에피소드 추가, 제목 수정 등)는 Phase 2에서 처리한다.
- **MVP 한계:** 방영 중인 작품의 신규 에피소드 추가는 사용자가 인식하지 못할 수 있다. 이 제한을 UI에서 "데이터는 최초 로드 시점 기준입니다"로 안내하는 것을 권장한다. (확실하지 않음 — Uncertain: 어느 API가 최신 에피소드를 얼마나 빠르게 반영하는지 검증 필요)

---

## 3. `search-content` 구현 예시 (TypeScript/Deno)

```typescript
// supabase/functions/search-content/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { encodeHex } from "https://deno.land/std@0.208.0/encoding/hex.ts";

// ============================================================
// 공통 타입 정의
// ============================================================

type ExternalSource = "tmdb" | "anilist" | "kitsu" | "tvmaze";
type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";
type MediaTypeFilter = "anime" | "drama" | "movie" | "all";

interface ContentSearchResult {
  external_source: ExternalSource;
  external_id: string;
  content_type: ContentType;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  has_seasons: boolean;
  episode_count: number | null;
}

interface SearchRequest {
  query: string;
  media_type?: MediaTypeFilter;
  page?: number;
}

interface SearchResponse {
  results: ContentSearchResult[];
  total: number;
  page: number;
  has_next: boolean;
  from_cache: boolean;
  partial: boolean;
}

// ============================================================
// 캐시 유틸리티
// ============================================================

async function generateQueryHash(
  query: string,
  source: ExternalSource,
  mediaType: MediaTypeFilter,
  page: number
): Promise<string> {
  const input = `${query}:${source}:${mediaType}:${page}`;
  const msgUint8 = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  return encodeHex(new Uint8Array(hashBuffer));
}

// ============================================================
// TMDB API 호출 및 정규화
// ============================================================

async function searchTmdb(
  query: string,
  mediaType: MediaTypeFilter,
  page: number
): Promise<ContentSearchResult[]> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY not configured");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

  try {
    // 검색 엔드포인트 결정: 장르 필터는 클라이언트 정규화 시 처리
    const endpoint = mediaType === "movie"
      ? `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&page=${page}&language=ko-KR`
      : `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&page=${page}&language=ko-KR`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    return normalizeTmdbResults(data.results ?? [], mediaType);
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeTmdbResults(
  // deno-lint-ignore no-explicit-any
  items: any[],
  mediaType: MediaTypeFilter
): ContentSearchResult[] {
  return items
    .filter((item) => {
      // media_type 필터 적용
      if (mediaType === "movie") return item.media_type === "movie" || item.title !== undefined;
      if (mediaType === "drama") return item.media_type === "tv" || item.name !== undefined;
      return true;
    })
    .map((item): ContentSearchResult | null => {
      const isMovie = item.media_type === "movie" || item.title !== undefined;
      const isTv = item.media_type === "tv" || item.name !== undefined;

      if (!isMovie && !isTv) return null;

      const posterUrl = item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : null;

      const airYear = isMovie
        ? item.release_date ? new Date(item.release_date).getFullYear() : null
        : item.first_air_date ? new Date(item.first_air_date).getFullYear() : null;

      // 콘텐츠 타입 추론 (TMDB는 kdrama/jdrama 구분 정보 없음 — 추가 메타데이터 필요)
      // 확실하지 않음 (Uncertain): origin_country 필드로 구분 시도 가능하나 완전하지 않음
      const contentType: ContentType = isMovie ? "movie" : "other";

      return {
        external_source: "tmdb",
        external_id: String(item.id),
        content_type: contentType,
        title_primary: isMovie ? item.title : item.name,
        title_original: isMovie ? item.original_title : item.original_name,
        poster_url: posterUrl,
        overview: item.overview || null,
        air_year: airYear,
        has_seasons: isTv,
        episode_count: null, // TMDB 검색 결과에 에피소드 수 없음 (상세 조회 필요)
      };
    })
    .filter((item): item is ContentSearchResult => item !== null);
}

// ============================================================
// AniList GraphQL API 호출 및 정규화
// ============================================================

const ANILIST_SEARCH_QUERY = `
  query SearchAnime($search: String!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        hasNextPage
      }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
        id
        title {
          romaji
          english
          native
        }
        coverImage {
          large
        }
        description(asHtml: false)
        startDate {
          year
        }
        episodes
        format
        status
      }
    }
  }
`;

async function searchAniList(
  query: string,
  page: number
): Promise<{ results: ContentSearchResult[]; hasNextPage: boolean; total: number }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5초 타임아웃

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_SEARCH_QUERY,
        variables: { search: query, page, perPage: 20 },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`AniList GraphQL error: ${data.errors[0]?.message}`);
    }

    const pageData = data.data?.Page;
    return {
      results: normalizeAniListResults(pageData?.media ?? []),
      hasNextPage: pageData?.pageInfo?.hasNextPage ?? false,
      total: pageData?.pageInfo?.total ?? 0,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// deno-lint-ignore no-explicit-any
function normalizeAniListResults(items: any[]): ContentSearchResult[] {
  return items.map((item): ContentSearchResult => {
    // AniList는 명확하게 ANIME 타입이므로 content_type = 'anime'
    return {
      external_source: "anilist",
      external_id: String(item.id),
      content_type: "anime",
      title_primary: item.title?.english ?? item.title?.romaji ?? item.title?.native ?? "",
      title_original: item.title?.native ?? null,
      poster_url: item.coverImage?.large ?? null,
      overview: item.description ?? null,
      air_year: item.startDate?.year ?? null,
      has_seasons: true, // 애니는 기본적으로 시리즈로 취급
      episode_count: item.episodes ?? null,
    };
  });
}

// ============================================================
// Edge Function 메인 핸들러
// ============================================================

Deno.serve(async (req: Request) => {
  // CORS 처리 (Expo 앱에서 호출 시 필요)
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");
  }

  // ---- 1. Supabase 클라이언트 초기화 ----
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 서비스 롤 클라이언트 (캐시 읽기/쓰기용 — RLS 우회)
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ---- 2. JWT 인증 검증 ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const jwt = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  // ---- 3. Request Body 파싱 및 유효성 검증 ----
  let body: SearchRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Invalid JSON body");
  }

  const { query, media_type = "all", page = 1 } = body;

  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return jsonError(400, "INVALID_REQUEST", "query is required");
  }
  if (query.length > 100) {
    return jsonError(400, "INVALID_REQUEST", "query must be 100 characters or less");
  }

  const trimmedQuery = query.trim();
  const targetSources: ExternalSource[] = getTargetSources(media_type);

  // ---- 4. 캐시 조회 ----
  const cachedResults: ContentSearchResult[] = [];
  const cacheMissedSources: ExternalSource[] = [];

  for (const source of targetSources) {
    const queryHash = await generateQueryHash(trimmedQuery, source, media_type, page);

    const { data: cacheRow } = await adminClient
      .from("external_search_cache")
      .select("response_json")
      .eq("query_hash", queryHash)
      .eq("source", source)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cacheRow) {
      // 캐시 히트: response_json에서 results 배열 추출
      const cached = cacheRow.response_json as { results: ContentSearchResult[] };
      cachedResults.push(...cached.results);
    } else {
      cacheMissedSources.push(source);
    }
  }

  // 모든 소스가 캐시 히트인 경우 즉시 반환
  if (cacheMissedSources.length === 0) {
    return jsonSuccess<SearchResponse>({
      results: paginate(cachedResults, page),
      total: cachedResults.length,
      page,
      has_next: cachedResults.length > page * 20,
      from_cache: true,
      partial: false,
    });
  }

  // ---- 5. 캐시 미스 소스에 대해 외부 API 병렬 호출 ----
  const apiCallPromises = cacheMissedSources.map((source) => {
    if (source === "tmdb") {
      return searchTmdb(trimmedQuery, media_type, page)
        .then((results) => ({ source, results, hasNextPage: false, total: results.length, error: null }))
        .catch((error) => ({ source, results: [] as ContentSearchResult[], hasNextPage: false, total: 0, error: error.message }));
    } else if (source === "anilist") {
      return searchAniList(trimmedQuery, page)
        .then(({ results, hasNextPage, total }) => ({ source, results, hasNextPage, total, error: null }))
        .catch((error) => ({ source, results: [] as ContentSearchResult[], hasNextPage: false, total: 0, error: error.message }));
    }
    // kitsu, tvmaze는 Phase 2 구현
    return Promise.resolve({ source, results: [] as ContentSearchResult[], hasNextPage: false, total: 0, error: "Not implemented" });
  });

  const apiResults = await Promise.allSettled(apiCallPromises);

  // ---- 6. 결과 집계 및 캐시 저장 ----
  const newResults: ContentSearchResult[] = [];
  let hasPartialFailure = false;

  for (const settled of apiResults) {
    if (settled.status === "rejected") {
      hasPartialFailure = true;
      continue;
    }

    const { source, results, error } = settled.value;
    if (error) {
      hasPartialFailure = true;
      console.error(`API call failed for ${source}:`, error);
      continue;
    }

    newResults.push(...results);

    // 성공한 API 결과를 캐시에 저장
    const queryHash = await generateQueryHash(trimmedQuery, source as ExternalSource, media_type, page);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후

    await adminClient
      .from("external_search_cache")
      .upsert({
        query_hash: queryHash,
        query_text: trimmedQuery,
        source,
        response_json: { results },
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: "query_hash,source",
      });
  }

  // ---- 7. 결과 병합 및 반환 ----
  const allResults = [...cachedResults, ...newResults];

  // 전체 실패 시
  if (allResults.length === 0 && hasPartialFailure) {
    return jsonError(503, "ALL_APIS_FAILED", "All external APIs failed");
  }

  const totalCount = allResults.length;

  return jsonSuccess<SearchResponse>({
    results: paginate(allResults, page),
    total: totalCount,
    page,
    has_next: totalCount > page * 20,
    from_cache: false,
    partial: hasPartialFailure,
  });
});

// ============================================================
// 유틸리티 함수
// ============================================================

function getTargetSources(mediaType: MediaTypeFilter): ExternalSource[] {
  switch (mediaType) {
    case "anime": return ["anilist", "tmdb"];
    case "drama": return ["tmdb"];
    case "movie": return ["tmdb"];
    case "all": return ["tmdb", "anilist"];
    default: return ["tmdb", "anilist"];
  }
}

function paginate<T>(items: T[], page: number, perPage = 20): T[] {
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

function jsonSuccess<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
```

---

## 4. `add-to-library` 구현 예시 (TypeScript/Deno)

```typescript
// supabase/functions/add-to-library/index.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================
// 공통 타입 정의
// ============================================================

type ExternalSource = "tmdb" | "anilist" | "kitsu" | "tvmaze";
type WatchStatus = "wishlist" | "watching" | "completed" | "dropped";
type ContentType = "anime" | "kdrama" | "jdrama" | "movie" | "other";

interface AddToLibraryRequest {
  api_source: ExternalSource;
  external_id: string;
  watch_status?: WatchStatus;
}

interface ContentMeta {
  content_type: ContentType;
  title_primary: string;
  title_original: string | null;
  poster_url: string | null;
  overview: string | null;
  air_year: number | null;
  has_seasons: boolean;
  seasons?: SeasonMeta[];
}

interface SeasonMeta {
  season_number: number;
  title: string | null;
  episode_count: number | null;
  air_year: number | null;
}

// ============================================================
// 외부 API 조회: TMDB
// ============================================================

async function fetchTmdbDetail(
  externalId: string
): Promise<ContentMeta> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) throw new Error("TMDB_API_KEY not configured");

  // TV vs Movie 판별: 먼저 TV로 시도하고 실패하면 Movie로 시도
  // 확실하지 않음 (Uncertain): api_source만으로 movie/tv를 구분할 수 없는 경우,
  // 검색 결과에서 media_type을 함께 전달받도록 Request Body를 확장하는 것을 권장.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    // TV 시도
    let response = await fetch(
      `https://api.themoviedb.org/3/tv/${externalId}?language=ko-KR&append_to_response=seasons`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      // Movie 시도
      response = await fetch(
        `https://api.themoviedb.org/3/movie/${externalId}?language=ko-KR`,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        }
      );
    }

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status} for id ${externalId}`);
    }

    const data = await response.json();
    const isMovie = data.title !== undefined;

    const posterUrl = data.poster_path
      ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
      : null;

    const seasons: SeasonMeta[] = isMovie ? [] : (data.seasons ?? []).map(
      // deno-lint-ignore no-explicit-any
      (s: any): SeasonMeta => ({
        season_number: s.season_number,
        title: s.name ?? null,
        episode_count: s.episode_count ?? null,
        air_year: s.air_date ? new Date(s.air_date).getFullYear() : null,
      })
    ).filter((s: SeasonMeta) => s.season_number > 0); // 시즌 0 (스페셜) 제외

    return {
      content_type: isMovie ? "movie" : "other", // kdrama/jdrama 구분은 추가 정보 필요
      title_primary: isMovie ? data.title : data.name,
      title_original: isMovie ? data.original_title : data.original_name,
      poster_url: posterUrl,
      overview: data.overview || null,
      air_year: isMovie
        ? (data.release_date ? new Date(data.release_date).getFullYear() : null)
        : (data.first_air_date ? new Date(data.first_air_date).getFullYear() : null),
      has_seasons: !isMovie,
      seasons,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 외부 API 조회: AniList
// ============================================================

const ANILIST_DETAIL_QUERY = `
  query GetAnimeDetail($id: Int!) {
    Media(id: $id, type: ANIME) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        large
      }
      description(asHtml: false)
      startDate {
        year
      }
      episodes
      format
      status
    }
  }
`;

async function fetchAniListDetail(externalId: string): Promise<ContentMeta> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: ANILIST_DETAIL_QUERY,
        variables: { id: parseInt(externalId, 10) },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.errors) {
      throw new Error(`AniList GraphQL error: ${data.errors[0]?.message}`);
    }

    const media = data.data?.Media;
    if (!media) {
      throw new Error(`AniList: content not found for id ${externalId}`);
    }

    return {
      content_type: "anime",
      title_primary: media.title?.english ?? media.title?.romaji ?? media.title?.native ?? "",
      title_original: media.title?.native ?? null,
      poster_url: media.coverImage?.large ?? null,
      overview: media.description ?? null,
      air_year: media.startDate?.year ?? null,
      has_seasons: true,
      seasons: [
        // AniList는 시즌 개념이 별도 작품(series)으로 분리됨. 단일 시즌으로 처리.
        // 확실하지 않음 (Uncertain): AniList relations API로 시즌 구조 파악 가능하나 복잡도 높음.
        {
          season_number: 1,
          title: null,
          episode_count: media.episodes ?? null,
          air_year: media.startDate?.year ?? null,
        },
      ],
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 외부 API 디스패처
// ============================================================

async function fetchContentDetail(
  source: ExternalSource,
  externalId: string
): Promise<ContentMeta> {
  switch (source) {
    case "tmdb":
      return fetchTmdbDetail(externalId);
    case "anilist":
      return fetchAniListDetail(externalId);
    default:
      // kitsu, tvmaze는 Phase 2 구현
      throw new Error(`API source '${source}' not implemented in MVP`);
  }
}

// ============================================================
// Edge Function 메인 핸들러
// ============================================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonError(405, "METHOD_NOT_ALLOWED", "POST method required");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // service_role 클라이언트 (contents, seasons, metadata_sync_logs 쓰기)
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  // ---- 1. JWT 인증 검증 ----
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonError(401, "UNAUTHORIZED", "Valid JWT required");
  }

  const jwt = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return jsonError(401, "UNAUTHORIZED", "Invalid or expired JWT");
  }

  const userId = user.id; // JWT에서 추출. 클라이언트 전달값 사용 금지.

  // ---- 2. Request Body 파싱 ----
  let body: AddToLibraryRequest;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "INVALID_REQUEST", "Invalid JSON body");
  }

  const { api_source, external_id, watch_status = "wishlist" } = body;

  if (!api_source || !external_id) {
    return jsonError(400, "INVALID_REQUEST", "api_source and external_id are required");
  }

  const validSources = ["tmdb", "anilist", "kitsu", "tvmaze"];
  if (!validSources.includes(api_source)) {
    return jsonError(400, "INVALID_REQUEST", `Invalid api_source. Must be one of: ${validSources.join(", ")}`);
  }

  const validStatuses = ["wishlist", "watching", "completed", "dropped"];
  if (!validStatuses.includes(watch_status)) {
    return jsonError(400, "INVALID_REQUEST", `Invalid watch_status. Must be one of: ${validStatuses.join(", ")}`);
  }

  // ---- 3. 중복 체크 ----
  const { data: existingExternalId } = await adminClient
    .from("content_external_ids")
    .select("content_id")
    .eq("api_source", api_source)
    .eq("external_id", external_id)
    .maybeSingle();

  if (existingExternalId) {
    const contentId = existingExternalId.content_id;

    const { data: existingLibraryItem } = await adminClient
      .from("user_library_items")
      .select("id, status")
      .eq("user_id", userId)
      .eq("content_id", contentId)
      .maybeSingle();

    if (existingLibraryItem) {
      return jsonError(409, "ALREADY_IN_LIBRARY", "Content already in user library");
    }
  }

  // ---- 4. 외부 API에서 콘텐츠 상세 조회 ----
  let contentMeta: ContentMeta;
  try {
    contentMeta = await fetchContentDetail(api_source, external_id);
  } catch (error) {
    await logSync(adminClient, {
      content_id: null,
      api_source,
      operation: "add_to_library",
      status: "failed",
      request_payload: { api_source, external_id, watch_status },
      error_message: error instanceof Error ? error.message : String(error),
    });
    return jsonError(503, "API_ERROR", "Failed to fetch content from external API");
  }

  // ---- 5. contents UPSERT (service_role) ----
  const { data: upsertedContent, error: contentError } = await adminClient
    .from("contents")
    .upsert({
      content_type: contentMeta.content_type,
      source_api: api_source,
      source_id: external_id,
      title_primary: contentMeta.title_primary,
      title_original: contentMeta.title_original,
      poster_url: contentMeta.poster_url,
      overview: contentMeta.overview,
      air_year: contentMeta.air_year,
    }, {
      onConflict: "source_api,source_id",
    })
    .select("id")
    .single();

  if (contentError || !upsertedContent) {
    await logSync(adminClient, {
      content_id: null,
      api_source,
      operation: "upsert_content",
      status: "failed",
      request_payload: { api_source, external_id },
      error_message: contentError?.message ?? "Unknown error",
    });
    return jsonError(500, "DB_ERROR", "Failed to save content metadata");
  }

  const contentId = upsertedContent.id;

  // ---- 6. content_external_ids UPSERT ----
  await adminClient
    .from("content_external_ids")
    .upsert({
      content_id: contentId,
      api_source,
      external_id,
    }, {
      onConflict: "api_source,external_id",
      ignoreDuplicates: true,
    });

  // ---- 7. seasons UPSERT (시리즈인 경우만) ----
  if (contentMeta.has_seasons && contentMeta.seasons && contentMeta.seasons.length > 0) {
    const seasonRows = contentMeta.seasons.map((s) => ({
      content_id: contentId,
      season_number: s.season_number,
      title: s.title,
      episode_count: s.episode_count,
      air_year: s.air_year,
    }));

    await adminClient
      .from("seasons")
      .upsert(seasonRows, {
        onConflict: "content_id,season_number",
      });

    // 에피소드는 저장하지 않음 — fetch-episodes에서 lazy load
  }

  // ---- 8. user_library_items INSERT ----
  const { data: libraryItem, error: libraryError } = await adminClient
    .from("user_library_items")
    .insert({
      user_id: userId,           // 반드시 JWT에서 추출한 값 사용
      content_id: contentId,
      status: watch_status,
    })
    .select("id, status")
    .single();

  if (libraryError) {
    // UNIQUE 제약 위반 (중복 체크 이후에 다른 요청이 먼저 INSERT한 경우)
    if (libraryError.code === "23505") {
      return jsonError(409, "ALREADY_IN_LIBRARY", "Content already added by concurrent request");
    }
    return jsonError(500, "DB_ERROR", "Failed to add to library");
  }

  // ---- 9. metadata_sync_logs INSERT (감사 로그) ----
  await logSync(adminClient, {
    content_id: contentId,
    api_source,
    operation: "add_to_library",
    status: "success",
    request_payload: { api_source, external_id, watch_status },
    response_snapshot: {
      title_primary: contentMeta.title_primary,
      content_type: contentMeta.content_type,
      season_count: contentMeta.seasons?.length ?? 0,
    },
  });

  // ---- 10. 응답 반환 ----
  return new Response(
    JSON.stringify({
      library_item_id: libraryItem.id,
      content_id: contentId,
      status: libraryItem.status,
    }),
    {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
});

// ============================================================
// 유틸리티: 감사 로그 기록
// ============================================================

async function logSync(
  // deno-lint-ignore no-explicit-any
  adminClient: any,
  params: {
    content_id: string | null;
    api_source: string;
    operation: string;
    status: "success" | "partial" | "failed";
    request_payload?: object;
    response_snapshot?: object;
    error_message?: string;
  }
): Promise<void> {
  await adminClient.from("metadata_sync_logs").insert({
    content_id: params.content_id,
    api_source: params.api_source,
    operation: params.operation,
    status: params.status,
    request_payload: params.request_payload ?? null,
    response_snapshot: params.response_snapshot ?? null,
    error_message: params.error_message ?? null,
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
```

---

## 5. 외부 API 통합 전략

### 5.1 외부 API 특성 비교

| 항목 | TMDB | AniList | Kitsu | TVmaze |
|------|------|---------|-------|--------|
| **프로토콜** | REST | GraphQL | REST (JSON:API) | REST |
| **인증** | API Key (Bearer) | 없음 (공개) | 없음 / OAuth (쓰기) | 없음 (공개) |
| **콘텐츠 강점** | 영화, 드라마, 글로벌 | 애니메이션 특화 | 애니메이션 특화 | 방영 스케줄 특화 |
| **한국어 지원** | language=ko-KR 파라미터 지원 | title.native(일본어), title.english | 제한적 (확실하지 않음 — Uncertain) | 제한적 (확실하지 않음 — Uncertain) |
| **Rate Limit** | 40 req/sec (확실하지 않음 — Uncertain) | 90 req/min (확실하지 않음 — Uncertain) | 알 수 없음 (확실하지 않음 — Uncertain) | 알 수 없음 (확실하지 않음 — Uncertain) |
| **이미지 품질** | 우수 (w92~w1280 다양한 크기) | 보통 | 보통 | 보통 |
| **에피소드 정보** | 시즌별 상세 제공 | episodes 필드 (총 수) | 에피소드별 상세 제공 | 방영 일정 특화 |
| **MVP 우선순위** | 1순위 (드라마, 영화) | 1순위 (애니) | Phase 2 | Phase 2 |

### 5.2 MVP에서 우선 지원할 API와 이유

**TMDB (MVP 필수):**
- 드라마(한국/일본)와 영화의 가장 방대한 메타데이터 보유.
- `language=ko-KR` 파라미터로 한국어 제목 및 줄거리 제공.
- 시즌/에피소드 구조가 명확하게 REST API로 제공됨.
- 포스터 이미지 CDN이 안정적이고 다양한 크기 지원.

**AniList (MVP 필수):**
- 애니메이션 데이터 완성도가 TMDB보다 높음.
- GraphQL로 필요한 필드만 선택 조회 가능 (응답 크기 최적화).
- 인증 없이 공개 API 사용 가능 (관리 포인트 감소).
- 한국어 제목은 지원하지 않으나 `title.native`(일본어)와 `title.english` 제공.

**Kitsu, TVmaze (Phase 2 이후):**
- Kitsu: AniList와 중복. 추가 커버리지가 필요한 경우 보완용.
- TVmaze: 방영 중인 작품의 방영 스케줄 추적 기능에 특화 — Phase 2 "새 에피소드 알림" 기능 도입 시 검토.

### 5.3 API 키 관리 방법

```bash
# Supabase CLI로 Secrets 설정
supabase secrets set TMDB_API_KEY=your_tmdb_api_key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Edge Function 내에서 읽기
const apiKey = Deno.env.get("TMDB_API_KEY");
```

**Supabase Dashboard 경로:** Project Settings > Edge Functions > Secrets

**절대 금지 사항:**
- 코드에 API 키 하드코딩
- `.env` 파일을 git에 커밋
- 클라이언트(Expo 앱) 번들에 API 키 포함

### 5.4 Rate Limit 대응 전략

| 전략 | 설명 | 적용 시점 |
|------|------|-----------|
| **TTL 캐싱** | 동일 검색어의 1시간 내 반복 요청은 캐시에서 반환 | MVP 기본 적용 |
| **병렬 호출** | `Promise.allSettled`로 TMDB + AniList 병렬 호출, 최대 5초 대기 | MVP 기본 적용 |
| **graceful degradation** | 한 API 실패 시 다른 API 결과만 반환 + `partial: true` | MVP 기본 적용 |
| **지수 백오프 재시도** | Rate Limit 응답(429) 수신 시 1초, 2초, 4초 대기 후 재시도 | Phase 1 강화 |
| **캐시 TTL 연장** | 인기 검색어 캐시를 6시간~24시간으로 연장 | Phase 2 |

### 5.5 API 장애 시 Fallback 전략

```
검색 요청 (media_type=all)
    │
    ├── TMDB 호출
    │       ├── 성공: 결과 수집
    │       └── 실패(타임아웃/5xx): 스킵, partial=true 설정
    │
    ├── AniList 호출
    │       ├── 성공: 결과 수집
    │       └── 실패(타임아웃/5xx): 스킵, partial=true 설정
    │
    ├── 하나 이상 성공: 성공 결과 반환 (partial=true 포함)
    └── 전부 실패: 503 All APIs Failed
```

**애니메이션 전용 fallback:**
- AniList 실패 시 TMDB anime 검색으로 fallback (커버리지 차이 있음)
- 확실하지 않음 (Uncertain): TMDB의 애니메이션 커버리지가 AniList 대비 얼마나 부족한지 정량 검증 필요

---

## 6. 주요 DB 쿼리 예시

### 6.1 특정 사용자의 특정 에피소드 핀 목록

```sql
-- 에피소드 핀 목록: timestamp_seconds ASC NULLS LAST 정렬
SELECT
  tp.id,
  tp.timestamp_seconds,
  tp.display_time_label,
  tp.memo,
  tp.emotion,
  tp.is_spoiler,
  tp.created_at,
  tp.updated_at,
  -- 태그 목록 집계 (JSON 배열)
  COALESCE(
    json_agg(
      json_build_object('id', t.id, 'name', t.name)
      ORDER BY t.name
    ) FILTER (WHERE t.id IS NOT NULL),
    '[]'::json
  ) AS tags
FROM timeline_pins tp
LEFT JOIN timeline_pin_tags tpt ON tpt.pin_id = tp.id
LEFT JOIN tags t ON t.id = tpt.tag_id
WHERE tp.user_id = auth.uid()
  AND tp.episode_id = $episode_id
GROUP BY tp.id
ORDER BY tp.timestamp_seconds ASC NULLS LAST, tp.created_at ASC;
```

```typescript
// Supabase JS 클라이언트 (직접 SDK 호출 — Edge Function 불필요)
const { data, error } = await supabase
  .from("timeline_pins")
  .select(`
    id,
    timestamp_seconds,
    display_time_label,
    memo,
    emotion,
    is_spoiler,
    created_at,
    updated_at,
    timeline_pin_tags (
      tags (id, name)
    )
  `)
  .eq("episode_id", episodeId)
  .order("timestamp_seconds", { ascending: true, nullsFirst: false })
  .order("created_at", { ascending: true });
```

### 6.2 특정 태그가 달린 핀 목록

```sql
-- 특정 태그의 모든 핀 조회
SELECT
  tp.id,
  tp.content_id,
  tp.episode_id,
  tp.timestamp_seconds,
  tp.display_time_label,
  tp.memo,
  tp.emotion,
  tp.is_spoiler,
  tp.created_at,
  c.title_primary AS content_title,
  c.poster_url
FROM timeline_pin_tags tpt
JOIN timeline_pins tp ON tp.id = tpt.pin_id
JOIN contents c ON c.id = tp.content_id
WHERE tpt.tag_id = $tag_id
  AND tp.user_id = auth.uid()
ORDER BY tp.created_at DESC;
```

```typescript
// Supabase JS 클라이언트
const { data, error } = await supabase
  .from("timeline_pin_tags")
  .select(`
    timeline_pins!inner (
      id,
      content_id,
      episode_id,
      timestamp_seconds,
      display_time_label,
      memo,
      emotion,
      is_spoiler,
      created_at,
      contents!inner (title_primary, poster_url)
    )
  `)
  .eq("tag_id", tagId)
  .order("timeline_pins.created_at", { ascending: false });
```

### 6.3 라이브러리 목록 (최신 핀 개수 포함)

```sql
-- 라이브러리 목록 + 콘텐츠 메타데이터 + 핀 개수 JOIN
SELECT
  uli.id AS library_item_id,
  uli.status,
  uli.added_at,
  uli.updated_at,
  c.id AS content_id,
  c.title_primary,
  c.poster_url,
  c.content_type,
  c.air_year,
  COUNT(tp.id) AS pin_count
FROM user_library_items uli
JOIN contents c ON c.id = uli.content_id
LEFT JOIN timeline_pins tp ON tp.content_id = uli.content_id
  AND tp.user_id = uli.user_id
WHERE uli.user_id = auth.uid()
  AND ($status = 'all' OR uli.status = $status)
GROUP BY uli.id, c.id
ORDER BY uli.updated_at DESC;
```

```typescript
// Supabase JS 클라이언트
// 주의: pin_count는 별도 count 쿼리 또는 SQL 뷰가 필요. 아래는 단순 버전.
const { data, error } = await supabase
  .from("user_library_items")
  .select(`
    id,
    status,
    added_at,
    updated_at,
    contents!inner (
      id,
      title_primary,
      poster_url,
      content_type,
      air_year
    )
  `)
  .eq("user_id", userId)
  .order("updated_at", { ascending: false });

// pin_count가 필요한 경우: 별도 쿼리로 content_id별 count 조회 후 클라이언트에서 merge
```

### 6.4 에피소드 진행률 Upsert (체크/언체크)

```sql
-- 에피소드 완료 표시 (UPSERT)
INSERT INTO user_episode_progress (user_id, episode_id, content_id, watched_at)
VALUES (auth.uid(), $episode_id, $content_id, now())
ON CONFLICT (user_id, episode_id)
DO UPDATE SET watched_at = now();

-- 에피소드 완료 해제 (DELETE)
DELETE FROM user_episode_progress
WHERE user_id = auth.uid()
  AND episode_id = $episode_id;
```

```typescript
// Supabase JS 클라이언트

// 에피소드 체크 (완료 표시) — Optimistic Update 권장
const checkEpisode = async (episodeId: string, contentId: string) => {
  const { error } = await supabase
    .from("user_episode_progress")
    .upsert({
      user_id: userId,
      episode_id: episodeId,
      content_id: contentId,
      watched_at: new Date().toISOString(),
    }, {
      onConflict: "user_id,episode_id",
    });
  if (error) throw error;
};

// 에피소드 언체크 (완료 해제)
const uncheckEpisode = async (episodeId: string) => {
  const { error } = await supabase
    .from("user_episode_progress")
    .delete()
    .eq("episode_id", episodeId);
  if (error) throw error;
};
```

### 6.5 계정 삭제 시 사용자 데이터 처리

```sql
-- 계정 삭제는 auth.users 레코드 삭제로 시작.
-- CASCADE 체인이 자동으로 모든 사용자 데이터를 정리함.

-- 1. auth.users 삭제 (service_role 전용 — Edge Function 또는 Supabase Dashboard)
DELETE FROM auth.users WHERE id = $user_id;

-- CASCADE 체인:
-- auth.users → profiles (CASCADE)
-- auth.users → user_library_items (CASCADE)
-- auth.users → user_episode_progress (CASCADE)
-- auth.users → timeline_pins (CASCADE)
--   └── timeline_pins → timeline_pin_tags (CASCADE)
-- auth.users → tags (CASCADE)
--   └── tags → timeline_pin_tags (CASCADE)
-- auth.users → reviews (CASCADE)

-- contents, episodes는 RESTRICT로 보호됨 — 콘텐츠 메타데이터 유지
```

**계정 삭제 플로우 (권장):**

```typescript
// Edge Function: delete-account (Phase 1 이후 구현)
// 1. JWT에서 user_id 추출
// 2. 삭제 전 선택적 데이터 내보내기 (Phase 2 기능)
// 3. auth.users DELETE (service_role)
//    → CASCADE로 모든 사용자 데이터 자동 삭제
// 4. metadata_sync_logs에 계정 삭제 이벤트 기록 (content_id = null)
```

---

## 7. 데이터 무결성 전략

### 7.1 콘텐츠 ID 중복 방지

`content_external_ids` 테이블의 `UNIQUE (api_source, external_id)` 제약이 동일 외부 콘텐츠의 중복 저장을 방지한다.

```sql
-- 중복 삽입 시 자동 처리 (add-to-library Edge Function)
INSERT INTO content_external_ids (content_id, api_source, external_id)
VALUES ($content_id, 'tmdb', '1429')
ON CONFLICT (api_source, external_id) DO NOTHING;
-- 충돌 시 기존 레코드 유지. 다른 사용자가 동일 콘텐츠를 먼저 추가한 경우를 처리.
```

### 7.2 핀 고아 레코드 방지

| FK 관계 | ON DELETE 정책 | 이유 |
|---------|---------------|------|
| `timeline_pins.user_id → auth.users` | `CASCADE` | 계정 삭제 시 핀 자동 삭제 |
| `timeline_pins.content_id → contents` | `RESTRICT` | 콘텐츠 삭제 전 핀 정리 필요 (서비스 레벨 처리) |
| `timeline_pins.episode_id → episodes` | `SET NULL` | 에피소드 메타 삭제 시 핀 자체는 보존 (영화 핀과 동일 처리) |
| `timeline_pin_tags.pin_id → timeline_pins` | `CASCADE` | 핀 삭제 시 태그 연결 자동 삭제 |
| `timeline_pin_tags.tag_id → tags` | `CASCADE` | 태그 삭제 시 핀-태그 연결 자동 삭제 |

### 7.3 계정 삭제 시 CASCADE 처리 검증

```sql
-- 계정 삭제 전 확인 쿼리 (운영 참고용)
SELECT
  (SELECT COUNT(*) FROM user_library_items WHERE user_id = $uid) AS library_count,
  (SELECT COUNT(*) FROM timeline_pins WHERE user_id = $uid) AS pin_count,
  (SELECT COUNT(*) FROM user_episode_progress WHERE user_id = $uid) AS progress_count,
  (SELECT COUNT(*) FROM tags WHERE user_id = $uid) AS tag_count;
```

### 7.4 `timestamp_seconds >= 0` 이중 검증

| 레이어 | 검증 방법 | 코드 위치 |
|--------|---------|---------|
| **DB 레벨** | `CHECK (timestamp_seconds IS NULL OR timestamp_seconds >= 0)` | `06_backend_schema.sql` Section 3.11 |
| **앱 레벨** | Zod 스키마 `z.number().int().min(0).nullable()` | 핀 생성 폼 (React Hook Form + Zod) |
| **변환 레벨** | `parseTimestamp()` 함수가 음수 반환 시 null 처리 | `formatTimestamp` 유틸리티 |

```typescript
// 앱 레벨 Zod 스키마 (참고용)
const createPinSchema = z.object({
  content_id: z.string().uuid(),
  episode_id: z.string().uuid().nullable(),
  timestamp_seconds: z.number().int().min(0).nullable(),
  display_time_label: z.string().max(10).nullable(),
  memo: z.string().max(500).nullable(),
  emotion: z.enum(['excited', 'moved', 'funny', 'sad', 'surprised', 'angry', 'scared', 'love', 'boring', 'none']).nullable(),
  is_spoiler: z.boolean().default(false),
}).refine(
  // timestamp_seconds와 memo 중 하나는 반드시 존재 (DB CHECK 제약과 동일)
  (data) => data.timestamp_seconds !== null || data.memo !== null,
  { message: "타임스탬프 또는 메모 중 하나는 필수입니다" }
);
```

### 7.5 `timestamp_seconds > episode duration` 앱 레벨 처리

```typescript
// 에피소드 duration_seconds가 있는 경우 초과 검증 (soft warning)
const validateTimestamp = (
  timestampSeconds: number,
  episodeDurationSeconds: number | null
): { valid: boolean; warning: string | null } => {
  if (episodeDurationSeconds && timestampSeconds > episodeDurationSeconds) {
    return {
      valid: true, // MVP에서는 hard block 하지 않음
      warning: `입력한 시간(${formatTimestamp(timestampSeconds)})이 에피소드 길이(${formatTimestamp(episodeDurationSeconds)})를 초과합니다.`,
    };
  }
  return { valid: true, warning: null };
};
// DB 레벨에서는 duration 초과 체크를 하지 않음 (에피소드 duration이 null일 수 있음)
```

---

## 8. Supabase 무료/저가 플랜 리스크

### 8.1 무료 플랜(Free Tier) 주요 제한

| 항목 | 무료 플랜 제한 | MVP 예상 사용량 | 위험도 |
|------|--------------|---------------|--------|
| **DB 용량** | 500 MB | 사용자 1,000명 기준 ~ 100 MB 추정 | 낮음 |
| **Edge Function 호출 횟수** | 500,000 회/월 | 100 MAU × 100회/월 = 10,000 회 | 낮음 |
| **Edge Function 실행 시간** | 500,000 CPU ms/월 | 각 함수 평균 500ms, 10,000회 = 5,000,000 ms 예상 | **주의** |
| **Storage** | 1 GB | 미사용 (포스터는 외부 CDN URL) | 없음 |
| **Bandwidth (Egress)** | 5 GB/월 | 10,000회 × 평균 10 KB = 100 MB | 낮음 |
| **Auth MAU** | 50,000 | 100 MAU | 없음 |
| **Realtime** | 200 동시 연결 | 미사용 (MVP에서 Realtime 미사용) | 없음 |

**확실하지 않음 (Uncertain):** Supabase 무료 플랜의 Edge Function CPU 제한이 정확히 적용되는 방식은 공식 문서 기준으로 확인 필요.

### 8.2 MVP 트래픽에서 과금 발생 가능 시나리오

**시나리오 1: 검색 Edge Function 과다 사용**
```
검색 요청 1회 = TMDB + AniList 병렬 호출 (각 최대 5초)
캐시 미스 시 CPU 시간: ~1,000 ms
캐시 히트 시 CPU 시간: ~100 ms

위험: 베타 테스트에서 100명이 각자 50회 검색(캐시 미스) = 5,000,000 CPU ms → 무료 한도 초과
대응: 캐시 TTL 기간 내 동일 검색어 반복 검색 시 캐시 히트 유도로 CPU 사용 절감
```

**시나리오 2: add-to-library 트랜잭션 비용**
```
add-to-library 1회 = 외부 API 호출 + 5개 테이블 UPSERT
CPU 시간: ~500~2,000 ms (외부 API 응답 시간에 따라 가변)

위험: 초기 라이브러리 구축 시 사용자 1인당 50개 작품 추가 = 50 × 1,000 ms = 50,000 CPU ms/user
```

### 8.3 비용 최적화 방향

**즉시 적용 가능한 최적화:**

```typescript
// 1. 검색 캐시 TTL을 적절히 설정 (검색어 인기도에 따라 조정 불필요, 기본 1시간으로 충분)

// 2. add-to-library에서 외부 API 호출 최소화
//    → get-content-detail 결과를 클라이언트에서 캐싱하고 add-to-library에 함께 전달
//    → Request Body에 선택적으로 contentMeta를 포함하면 외부 API 재호출 생략 가능
interface AddToLibraryRequest {
  api_source: ExternalSource;
  external_id: string;
  watch_status?: WatchStatus;
  // 선택적: 클라이언트가 이미 조회한 메타데이터를 전달하면 API 재호출 생략
  prefetched_meta?: {
    title_primary: string;
    content_type: ContentType;
    poster_url?: string | null;
  };
}

// 3. Edge Function cold start 최소화
//    → import 경량화, 불필요한 의존성 제거
//    → Deno의 esm.sh 캐싱 활용
```

**Phase 1 전환 검토 기준 (Pro 플랜 $25/월):**
- MAU > 500명
- Edge Function CPU 사용량 > 400,000 ms/월 (80% 도달 시 경보)
- DB 용량 > 400 MB (80% 도달 시 경보)

```sql
-- DB 용량 모니터링 쿼리 (Supabase Dashboard SQL Editor에서 실행)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

---

## 부록 A: Edge Function 환경 변수 체크리스트

Supabase Dashboard > Project Settings > Edge Functions > Secrets에 반드시 설정해야 하는 환경 변수:

| 변수명 | 필수 여부 | 설명 |
|--------|---------|------|
| `TMDB_API_KEY` | 필수 (MVP) | TMDB Read Access Token (Bearer 인증용) |
| `SUPABASE_URL` | 자동 제공 | Edge Function 환경에서 자동 설정됨 |
| `SUPABASE_ANON_KEY` | 자동 제공 | Edge Function 환경에서 자동 설정됨 |
| `SUPABASE_SERVICE_ROLE_KEY` | 자동 제공 | Edge Function 환경에서 자동 설정됨 |
| `ANILIST_API_KEY` | 불필요 (공개 API) | AniList는 공개 GraphQL API |

**주의:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Function 런타임에서 자동으로 `Deno.env.get()`으로 접근 가능하다. 별도 설정 불필요.

---

## 부록 B: 로컬 개발 환경 설정

```bash
# 로컬 Supabase 시작
npx supabase start

# Edge Function 로컬 실행
npx supabase functions serve search-content --env-file .env.local

# .env.local 파일 (git에 커밋 금지)
TMDB_API_KEY=your_actual_tmdb_api_key
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_local_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_service_role_key

# Edge Function 테스트 (curl)
curl -X POST http://localhost:54321/functions/v1/search-content \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{"query": "진격의 거인", "media_type": "anime"}'

# 배포
npx supabase functions deploy search-content
npx supabase functions deploy add-to-library
npx supabase functions deploy get-content-detail
npx supabase functions deploy fetch-episodes
```

---

## 부록 C: 미결정 사항 (Edge Function 관련)

| 번호 | 사항 | 현재 방향 | 결정 필요 시점 |
|------|------|-----------|---------------|
| EF-TBD-001 | add-to-library에서 TMDB ID가 TV/Movie 구분 방법 | Request Body에 `media_type` 필드 추가 권장 | EF 구현 전 |
| EF-TBD-002 | AniList 시즌 구조 표현 방법 | 단일 시즌(season_number=1)으로 저장 (확실하지 않음) | fetch-episodes 구현 전 |
| EF-TBD-003 | 만료된 캐시 레코드 자동 정리 방법 | pg_cron 스케줄러 (무료 플랜 지원 여부 확인 필요) | Phase 1 |
| EF-TBD-004 | 검색 결과 페이지네이션 cursor 방식 전환 여부 | 현재 offset 방식. cursor 방식은 Phase 2 검토 | Phase 2 |
| EF-TBD-005 | TMDB 한국 드라마 vs. 일본 드라마 자동 구분 | origin_country 필드 활용 (확실하지 않음 — Uncertain) | get-content-detail 구현 시 |
