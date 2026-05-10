# SceneNote — 장르 표시 및 통계 기능 설계서

**버전:** 1.0.0
**작성일:** 2026-05-03
**상태:** 확정
**구현 담당:** Codex

---

## 개요

사용자가 라이브러리에 등록한 작품의 장르 데이터를 외부 API(TMDB, AniList)에서 수집해 DB에 저장하고, 모든 콘텐츠 화면에 장르 배지를 표시하며, 프로필 화면에서 장르별 통계를 스와이프 가능한 그래프로 보여주는 기능이다.

---

## 확정된 의사결정

| 항목 | 결정 |
|------|------|
| 장르 저장 방식 | 정규화 (`genres` + `content_genres` 별도 테이블) |
| 장르 수집 방식 | Edge Function A안 — 콘텐츠 저장 시점에 함께 저장 |
| 통계 그래프 | 도넛 차트 + 가로 바 차트 + 랭킹 리스트 (3페이지) |
| 그래프 전환 UX | 좌우 스와이프 (`ScrollView pagingEnabled`) + 페이지 인디케이터 |
| 차트 라이브러리 | `react-native-gifted-charts` |

---

## PART 1 — DB 스키마

### 신규 테이블

기존 테이블은 수정하지 않는다. 마이그레이션 파일에 아래 SQL을 추가한다.

```sql
-- 장르 마스터 테이블
CREATE TABLE genres (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 콘텐츠↔장르 조인 테이블
CREATE TABLE content_genres (
  content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
  genre_id   UUID NOT NULL REFERENCES genres(id)   ON DELETE CASCADE,
  PRIMARY KEY (content_id, genre_id)
);
```

### RLS 정책

`genres`와 `content_genres`는 콘텐츠 메타데이터 테이블로 취급한다.
로그인 사용자는 읽기 전용, 쓰기는 service_role(Edge Function)만 허용한다.

```sql
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "genres_select" ON genres
  FOR SELECT TO authenticated USING (true);

ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "content_genres_select" ON content_genres
  FOR SELECT TO authenticated USING (true);
```

### 인덱스

```sql
CREATE INDEX idx_content_genres_content_id ON content_genres(content_id);
CREATE INDEX idx_content_genres_genre_id   ON content_genres(genre_id);
```

### 통계 RPC 함수

클라이언트가 복잡한 JOIN 쿼리를 직접 작성하지 않도록 Supabase RPC 함수로 제공한다.
이 함수도 같은 마이그레이션 파일에 포함한다.

```sql
CREATE OR REPLACE FUNCTION get_genre_stats()
RETURNS TABLE(genre_name TEXT, count BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    g.name                          AS genre_name,
    COUNT(DISTINCT uli.content_id)  AS count
  FROM user_library_items uli
  JOIN content_genres cg ON cg.content_id = uli.content_id
  JOIN genres         g  ON g.id = cg.genre_id
  WHERE uli.user_id = auth.uid()
  GROUP BY g.name
  ORDER BY count DESC;
$$;
```

- `SECURITY DEFINER`: 함수가 호출자 권한이 아닌 소유자 권한으로 실행된다. RLS 우회가 아니라 `auth.uid()`를 WHERE 절에서 직접 사용하므로 사용자 데이터만 반환된다.
- `COUNT(DISTINCT uli.content_id)`: 동일 콘텐츠가 여러 장르에 속해도 중복 카운트를 방지한다.

---

## PART 2 — Edge Function 수정

**파일:** `supabase/functions/search-content/index.ts`

콘텐츠를 `contents` 테이블에 저장하는 로직 직후에 장르 저장 로직을 추가한다.
기존 코드 구조는 변경하지 않고, 헬퍼 함수 하나를 추가한다.

### 장르 이름 정규화

TMDB와 AniList의 장르 응답 형식이 다르므로 호출 전에 문자열 배열로 통일한다.

```ts
// TMDB 응답 구조
// { "genres": [{ "id": 28, "name": "Action" }, { "id": 18, "name": "Drama" }] }
const tmdbGenreNames: string[] = tmdbResult.genres?.map((g: { id: number; name: string }) => g.name) ?? [];

// AniList 응답 구조
// { "genres": ["Action", "Adventure", "Fantasy"] }
const anilistGenreNames: string[] = anilistResult.genres ?? [];
```

### upsertGenres 헬퍼 함수

```ts
/**
 * 장르 이름 배열을 genres 테이블에 upsert하고
 * content_genres 조인 행을 생성한다.
 * supabaseAdmin은 service_role 키로 초기화된 클라이언트여야 한다.
 */
async function upsertGenres(
  supabaseAdmin: SupabaseClient,
  contentId: string,
  genreNames: string[]
): Promise<void> {
  if (genreNames.length === 0) return;

  // 1단계: genres 테이블에 upsert (name UNIQUE 제약으로 중복 방지)
  const { data: genreRows, error: genreError } = await supabaseAdmin
    .from('genres')
    .upsert(
      genreNames.map(name => ({ name })),
      { onConflict: 'name', ignoreDuplicates: false }
    )
    .select('id, name');

  if (genreError || !genreRows) {
    console.error('upsertGenres - genres upsert failed:', genreError);
    return;
  }

  // 2단계: content_genres 조인 행 upsert (복합 PK로 중복 방지)
  const { error: joinError } = await supabaseAdmin
    .from('content_genres')
    .upsert(
      genreRows.map(g => ({ content_id: contentId, genre_id: g.id })),
      { onConflict: 'content_id,genre_id', ignoreDuplicates: true }
    );

  if (joinError) {
    console.error('upsertGenres - content_genres upsert failed:', joinError);
  }
}
```

### 호출 위치

콘텐츠 저장(`contents` INSERT) 직후, 응답 반환 전에 호출한다.

```ts
// 콘텐츠 저장 후
const savedContent = await saveContent(supabaseAdmin, contentData);

// 장르 저장 (실패해도 콘텐츠 저장은 유지 — try/catch로 감쌀 것)
try {
  await upsertGenres(supabaseAdmin, savedContent.id, genreNames);
} catch (e) {
  console.error('Genre upsert skipped:', e);
}
```

> **Codex 주의:** 장르 저장 실패는 콘텐츠 저장을 롤백하지 않는다. try/catch로 오류를 로그만 남기고 계속 진행한다. 장르는 나중에 재시도하거나 빈 상태로 두어도 앱이 정상 동작해야 한다.

---

## PART 3 — 패키지 설치

```bash
npm install react-native-gifted-charts react-native-linear-gradient
expo install react-native-svg
```

> **Codex 주의:** `react-native-svg`는 반드시 `expo install`로 설치해야 Expo SDK 버전과 호환된다. `npm install`로 설치하면 버전 불일치가 발생할 수 있다.

---

## PART 4 — 타입 정의

**신규 파일:** `src/types/genre.ts`

```ts
export interface Genre {
  id: string;
  name: string;
}

export interface GenreStat {
  genre_name: string;
  count: number;
}
```

**기존 파일 수정:** `src/types/content.ts` (또는 Content 타입이 정의된 파일)

`Content` 인터페이스에 장르 필드를 추가한다.

```ts
export interface Content {
  // ... 기존 필드 유지 (삭제하지 않는다)
  genres?: string[];  // content_genres JOIN으로 가져온 장르 이름 배열
}
```

---

## PART 5 — 공통 컴포넌트

**신규 파일:** `src/components/GenreBadge.tsx`

```tsx
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  name: string;
}

export function GenreBadge({ name }: Props) {
  return (
    <View style={styles.badge}>
      <Text style={styles.text} numberOfLines={1}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    marginRight: 4,
    marginBottom: 4,
  },
  text: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '500',
  },
});
```

### 화면별 장르 표시 규칙

| 화면 | 컴포넌트 | 최대 표시 | 초과 시 |
|------|----------|-----------|---------|
| 검색 결과 카드 | `ContentCard` | 2개 | "외 N개" 텍스트 |
| 라이브러리 카드 | 라이브러리 카드 컴포넌트 | 2개 | "외 N개" 텍스트 |
| 콘텐츠 상세 | `app/content/[id]/index.tsx` | 전체 | 줄바꿈 |

**"외 N개" 패턴 구현 예시:**

```tsx
interface GenreBadgeListProps {
  genres: string[];
  maxVisible?: number;
}

export function GenreBadgeList({ genres, maxVisible = 2 }: GenreBadgeListProps) {
  if (!genres || genres.length === 0) return null;

  const visible = genres.slice(0, maxVisible);
  const rest = genres.length - maxVisible;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
      {visible.map(name => (
        <GenreBadge key={name} name={name} />
      ))}
      {rest > 0 && (
        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>외 {rest}개</Text>
      )}
    </View>
  );
}
```

---

## PART 6 — 기존 훅 수정

`content_genres` 데이터를 기존 콘텐츠 쿼리에 함께 가져오도록 select를 확장한다.

**파일:** `src/hooks/useContentSearch.ts`, `src/hooks/useLibrary.ts`

```ts
// 기존 select에 content_genres join 추가
.select(`
  *,
  content_genres(
    genres(name)
  )
`)
```

**응답 데이터를 genres 문자열 배열로 변환하는 유틸:**

```ts
// src/utils/genre.ts
export function extractGenreNames(
  contentGenres?: { genres: { name: string } | null }[]
): string[] {
  if (!contentGenres) return [];
  return contentGenres
    .map(cg => cg.genres?.name)
    .filter((name): name is string => Boolean(name));
}
```

훅 내부에서 응답 변환 시:
```ts
const genres = extractGenreNames(item.content_genres);
return { ...item, genres };
```

---

## PART 7 — 통계 훅

**신규 파일:** `src/hooks/useGenreStats.ts`

```ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryKeys } from '@/lib/query';
import type { GenreStat } from '@/types/genre';

export function useGenreStats() {
  return useQuery({
    queryKey: queryKeys.genreStats,  // query.ts에 키 추가 필요 (아래 참고)
    queryFn: async (): Promise<GenreStat[]> => {
      const { data, error } = await supabase.rpc('get_genre_stats');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,  // 5분 캐시
  });
}
```

**`src/lib/query.ts` 수정 — queryKeys에 추가:**

```ts
export const queryKeys = {
  // ... 기존 키 유지
  genreStats: ['genre-stats'] as const,
};
```

---

## PART 8 — 프로필 통계 화면

### 화면 위치

프로필 화면(`app/(tabs)/profile.tsx`) 내 기존 "간단한 감상 통계" 섹션을 이 컴포넌트로 교체하거나 확장한다.
별도 컴포넌트 파일로 분리하는 것을 권장한다: `src/components/stats/GenreStatsSection.tsx`

### 색상 팔레트

```ts
// src/constants/genreColors.ts
export const GENRE_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
  '#F97316', '#84CC16',
];
```

### StyleSheet

`GenreStatsSection` 컴포넌트 하단에 `StyleSheet.create({})`를 선언한다. 포함해야 할 스타일 키 목록:

```ts
const styles = StyleSheet.create({
  totalLabel: {},    // 총 작품 수 텍스트
  page: {},          // 각 그래프 페이지 컨테이너 (paddingHorizontal 등)
  pageTitle: {},     // 페이지 상단 제목 텍스트
  donutCenter: {},   // 도넛 중앙 레이블 컨테이너
  donutCount: {},    // 도넛 중앙 숫자
  donutLabel: {},    // 도넛 중앙 "작품" 텍스트
  legend: {},        // 범례 컨테이너 (flexWrap: 'wrap')
  legendItem: {},    // 범례 아이템 (flexDirection: 'row')
  legendDot: {},     // 색상 점 (width: 8, height: 8, borderRadius: 4)
  legendText: {},    // 범례 텍스트
  dots: {},          // 페이지 인디케이터 컨테이너
  dot: {},           // 비활성 점 (width: 6, height: 6, borderRadius: 3)
  dotActive: {},     // 활성 점 (width: 18으로 확장, 색상 강조)
  rankRow: {},       // 랭킹 행 (flexDirection: 'row', alignItems: 'center')
  rankNum: {},       // 순위 번호
  rankName: {},      // 장르 이름 (flex: 1)
  rankBarBg: {},     // 바 배경 (flex: 2, height: 6, borderRadius: 3)
  rankBar: {},       // 바 채움 (height: 6, borderRadius: 3)
  rankCount: {},     // 개수 텍스트
  empty: {},         // 빈 상태 컨테이너
  emptyText: {},     // 빈 상태 텍스트
});
```

> **Codex 주의:** 실제 스타일 값(색상, 크기, 간격)은 기존 앱의 디자인 토큰을 따른다. `src/constants/` 또는 기존 컴포넌트의 스타일을 참고해 일관성을 유지한다.

### GenreStatsSection 컴포넌트 전체 구조

```tsx
import React, { useState } from 'react';
import {
  View, Text, ScrollView, Dimensions, StyleSheet, ActivityIndicator
} from 'react-native';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { FlashList } from '@shopify/flash-list';
import { useGenreStats } from '@/hooks/useGenreStats';
import { GENRE_COLORS } from '@/constants/genreColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRAPH_COUNT = 3;

export function GenreStatsSection() {
  const { data: stats = [], isLoading } = useGenreStats();
  const [activePage, setActivePage] = useState(0);

  if (isLoading) return <ActivityIndicator />;
  if (stats.length === 0) return <EmptyStats />;

  const totalCount = stats.reduce((sum, s) => sum + Number(s.count), 0);

  // 도넛 차트 데이터
  const donutData = stats.map((item, i) => ({
    value: Number(item.count),
    label: item.genre_name,
    color: GENRE_COLORS[i % GENRE_COLORS.length],
  }));

  // 바 차트 데이터
  const barData = stats.map((item, i) => ({
    value: Number(item.count),
    label: item.genre_name.length > 6
      ? item.genre_name.slice(0, 6) + '…'
      : item.genre_name,
    frontColor: GENRE_COLORS[i % GENRE_COLORS.length],
  }));

  return (
    <View>
      {/* 총 작품 수 */}
      <Text style={styles.totalLabel}>총 {totalCount}개 작품 등록됨</Text>

      {/* 스와이프 그래프 영역 */}
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={e => {
          const page = Math.round(
            e.nativeEvent.contentOffset.x / SCREEN_WIDTH
          );
          setActivePage(page);
        }}
        scrollEventThrottle={16}
      >
        {/* Page 1: 도넛 차트 */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <Text style={styles.pageTitle}>장르 비율</Text>
          <PieChart
            donut
            data={donutData}
            radius={110}
            innerRadius={65}
            centerLabelComponent={() => (
              <View style={styles.donutCenter}>
                <Text style={styles.donutCount}>{totalCount}</Text>
                <Text style={styles.donutLabel}>작품</Text>
              </View>
            )}
          />
          {/* 범례 */}
          <View style={styles.legend}>
            {donutData.map(item => (
              <View key={item.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Page 2: 가로 바 차트 */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <Text style={styles.pageTitle}>장르별 작품 수</Text>
          <BarChart
            horizontal
            data={barData}
            barWidth={18}
            barBorderRadius={4}
            showValuesAsTopLabel
            xAxisLabelTextStyle={{ fontSize: 11 }}
            width={SCREEN_WIDTH - 80}
          />
        </View>

        {/* Page 3: 랭킹 리스트 */}
        {/* 주의: 수평 ScrollView 내부에 FlashList를 직접 넣으면 스크롤 충돌이 발생한다.
            FlatList 또는 stats.map()으로 직접 렌더링하는 것을 권장한다. */}
        <View style={[styles.page, { width: SCREEN_WIDTH }]}>
          <Text style={styles.pageTitle}>장르 랭킹</Text>
          {stats.map((item, index) => (
            <RankingRow
              key={item.genre_name}
              rank={index + 1}
              name={item.genre_name}
              count={Number(item.count)}
              max={Number(stats[0].count)}
              color={GENRE_COLORS[index % GENRE_COLORS.length]}
            />
          ))}
        </View>
      </ScrollView>

      {/* 페이지 인디케이터 */}
      <View style={styles.dots}>
        {Array.from({ length: GRAPH_COUNT }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, activePage === i && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}
```

### RankingRow 컴포넌트

```tsx
function RankingRow({
  rank, name, count, max, color,
}: {
  rank: number; name: string; count: number; max: number; color: string;
}) {
  const barWidth = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={styles.rankRow}>
      <Text style={styles.rankNum}>{rank}</Text>
      <Text style={styles.rankName} numberOfLines={1}>{name}</Text>
      <View style={styles.rankBarBg}>
        <View style={[styles.rankBar, { width: `${barWidth}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.rankCount}>{count}개</Text>
    </View>
  );
}
```

### 빈 상태 컴포넌트

```tsx
function EmptyStats() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>
        라이브러리에 작품을 추가하면{'\n'}장르 통계를 볼 수 있어요
      </Text>
    </View>
  );
}
```

---

## PART 9 — 구현 순서 (Codex 작업 체크리스트)

순서대로 진행한다. 각 단계가 완료된 후 다음 단계로 넘어간다.

```
[ ] 1. supabase/migrations/ 에 새 마이그레이션 파일 생성
       - genres 테이블 + RLS + 인덱스
       - content_genres 테이블 + RLS + 인덱스
       - get_genre_stats() RPC 함수

[ ] 2. supabase/functions/search-content/index.ts 수정
       - upsertGenres() 헬퍼 함수 추가
       - 콘텐츠 저장 직후 호출 (try/catch 필수)
       - TMDB / AniList 장르 파싱 로직 추가

[ ] 3. 패키지 설치
       - npm install react-native-gifted-charts react-native-linear-gradient
       - expo install react-native-svg

[ ] 4. src/types/genre.ts 신규 생성
       - Genre, GenreStat 인터페이스

[ ] 5. src/types/content.ts 수정
       - Content 인터페이스에 genres?: string[] 추가

[ ] 6. src/constants/genreColors.ts 신규 생성
       - GENRE_COLORS 배열

[ ] 7. src/utils/genre.ts 신규 생성
       - extractGenreNames() 유틸 함수

[ ] 8. src/components/GenreBadge.tsx 신규 생성
       - GenreBadge 컴포넌트
       - GenreBadgeList 컴포넌트 (maxVisible prop 포함)

[ ] 9. src/hooks/useContentSearch.ts 수정
       - select에 content_genres(genres(name)) 추가
       - extractGenreNames()로 genres 필드 변환

[ ] 10. src/hooks/useLibrary.ts 수정
        - 동일하게 content_genres join 추가

[ ] 11. 콘텐츠 카드 컴포넌트 수정
        - <GenreBadgeList genres={content.genres} maxVisible={2} /> 추가

[ ] 12. app/content/[id]/index.tsx 수정
        - 장르 섹션 추가 (전체 장르 표시, maxVisible 없음)

[ ] 13. src/lib/query.ts 수정
        - queryKeys에 genreStats 추가

[ ] 14. src/hooks/useGenreStats.ts 신규 생성
        - useGenreStats() 훅

[ ] 15. src/components/stats/GenreStatsSection.tsx 신규 생성
        - 도넛 + 바 차트 + 랭킹 리스트 스와이프 컴포넌트 전체

[ ] 16. app/(tabs)/profile.tsx 수정
        - <GenreStatsSection /> 삽입
```

---

## NON-NEGOTIABLE RULES (기존 규칙 유지)

| Rule | 확인 |
|------|------|
| API 키는 절대 클라이언트에 노출하지 않는다 | `upsertGenres`는 Edge Function 내부에서만 호출 |
| RLS는 약화하지 않는다 | `genres`, `content_genres`에 RLS 적용 필수 |
| service_role 키는 Edge Function에서만 사용 | 클라이언트 코드에 `service_role` 문자열 없어야 함 |
| 기존 Pin 쿼리 순서를 유지한다 | 이 기능은 Pin 쿼리에 영향을 주지 않는다 |

---

## 검증 명령어

구현 완료 후 실행한다.

```bash
npx tsc --noEmit
npx eslint .
grep -rE 'TMDB_API_KEY|ANILIST_API_KEY|service_role' app/ src/ --include='*.ts' --include='*.tsx'
# → 0 matches 이어야 함
```
