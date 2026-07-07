# Codex 작업 요청: 회원 탈퇴(계정 삭제) Edge Function 구현 및 프로필 연결

## 배경

- 프로필 화면(`app/(tabs)/profile.tsx`)의 "회원 탈퇴" 버튼은 현재
  "MVP에서는 계정 삭제 Edge Function이 아직 연결되지 않았습니다"라는
  Alert만 띄우는 플레이스홀더다.
- 계정 삭제는 Apple App Store 심사 필수 요건(계정 생성이 있으면 삭제도 제공)이며,
  Google Play도 유사 정책이 있다. **출시 전 반드시 구현해야 한다.**

## 목표

1. 사용자 본인 계정과 모든 사용자 데이터를 삭제하는 Edge Function `delete-account` 구현.
2. 프로필 화면의 회원 탈퇴 버튼을 실제 동작으로 연결 (2단계 확인 UX 포함).

## 사전 확인 (구현 전 필수)

1. `supabase/migrations/0001_initial_schema.sql`부터 최신 마이그레이션까지 훑어
   사용자 데이터 테이블 전체 목록과 FK의 `ON DELETE` 동작을 확인한다.
   예상 대상 (실제 스키마로 검증할 것):
   - `user_library_items`, `user_episode_progress`,
     `timeline_pins`, `timeline_pin_tags`, `tags`,
     리뷰 테이블(있다면), `favorite_people`(인물 즐겨찾기, 있다면),
     `library_shares`(0012, 있다면)
   - **콘텐츠 메타데이터 테이블(`contents`, `seasons`, `episodes` 등)은
     공유 자산이므로 삭제 대상이 아니다.**
2. 각 테이블의 user FK가 `auth.users`를 직접 참조하고 `ON DELETE CASCADE`인지 확인.
   - 모두 CASCADE라면: auth 사용자 삭제만으로 충분하다.
   - 아니라면: Edge Function에서 명시적 삭제 순서를 구현하거나,
     CASCADE를 추가하는 마이그레이션(`supabase/migrations/00xx_delete_cascade.sql`)을
     먼저 작성한다. **마이그레이션 방식을 권장** (누락 위험이 적다).
   - 확인 결과(테이블 목록 + CASCADE 여부)를 결과 보고에 표로 포함할 것.

## 구현 지시

### 1. Edge Function: `supabase/functions/delete-account/index.ts`

- 기존 함수들(`add-to-library` 등)의 구조(`_shared/http.ts`의 CORS/응답 헬퍼,
  인증 처리 패턴)를 그대로 따른다.
- 처리 순서:
  1. 요청의 `Authorization` 헤더에서 JWT를 검증해 호출자 user id를 얻는다.
     본인 인증 실패 시 401. **body로 user_id를 받지 않는다** (본인 토큰만 신뢰).
  2. service_role 클라이언트로 `auth.admin.deleteUser(userId)` 호출.
     (CASCADE 마이그레이션이 적용됐다면 이것으로 사용자 데이터가 함께 삭제됨)
  3. CASCADE로 커버되지 않는 테이블이 있다면 deleteUser **전에** 명시적으로 삭제.
  4. 성공 시 `{ success: true }` 반환.
- 실패 시 원인별 에러 메시지 반환. 부분 삭제 상태(일부 테이블만 지워짐)가
  가능한 설계라면 그 사실을 명시하고 재시도 가능(idempotent)하게 만든다.
- service_role 키는 함수 환경변수(`SUPABASE_SERVICE_ROLE_KEY`)로만 접근.
  클라이언트에 노출 금지.

### 2. 클라이언트: 프로필 화면 연결

- `src/services/` 에 `deleteAccount()` 함수 추가
  (`supabase.functions.invoke("delete-account")`), `src/hooks/useAuth.ts`에
  mutation 훅 추가 (기존 `signOut` 패턴 참고).
- UX (2단계 확인):
  1. "회원 탈퇴" 탭 → Alert: 삭제되는 데이터 요약(라이브러리, 핀, 태그 등
     모든 기록이 영구 삭제됨) + "계속" / "취소"
  2. "계속" → 확인 Alert: "정말 탈퇴하시겠어요? 이 작업은 되돌릴 수 없습니다."
     + "탈퇴" (destructive 스타일) / "취소"
- 성공 시: 로컬 세션 정리(`supabase.auth.signOut()`) 후 로그인 화면
  (`app/(auth)/sign-in.tsx` 라우트)으로 이동. TanStack Query 캐시도
  `queryClient.clear()`로 비운다.
- 진행 중 버튼 비활성화 + "탈퇴 처리 중" 표시. 실패 시 한국어 에러 Alert.

### 3. 스모크 테스트

- `scripts/smoke-edge-functions.ts`에 delete-account 케이스를 추가하는 것이
  기존 패턴과 맞는지 확인하고, 맞으면 추가한다 (테스트 전용 계정 생성 → 삭제 검증).

## 범위 제외

- 삭제 유예 기간(soft delete) / 계정 복구 — MVP에서는 즉시 완전 삭제.
- 탈퇴 사유 설문.
- 공유 링크(`library_shares`)의 수신자 측 처리 UI — 링크는 owner 삭제와 함께
  데이터가 사라지므로 조회 시 "존재하지 않는 공유" 처리가 이미 되는지만 확인.

## 수용 기준 (Acceptance Criteria)

1. 테스트 계정으로 탈퇴 실행 → auth.users 및 모든 사용자 데이터 테이블에서
   해당 user 데이터가 사라진다 (SQL로 직접 검증).
2. 콘텐츠 메타데이터 테이블은 영향받지 않는다.
3. 탈퇴한 계정의 JWT로 API 호출 시 인증 실패한다.
4. 다른 사용자의 토큰으로 특정 user_id 삭제를 시도할 방법이 없다.
5. 탈퇴 성공 후 앱이 로그인 화면으로 이동하고, 이전 사용자 데이터가
   화면에 남지 않는다.
6. 두 번 연속 호출해도(이미 삭제된 계정) 서버가 500이 아닌 정상적 에러로 응답한다.
7. `npx tsc --noEmit`, `npx eslint .` 통과.

## 검증 방법

- 로컬 Supabase(`npx supabase start`, `npx supabase functions serve`)에서
  테스트 계정 생성 → 라이브러리/핀/태그 데이터 생성 → 탈퇴 → 테이블별 잔존 데이터
  SQL 확인.
- 검증에 사용한 SQL을 결과 보고에 포함할 것.
