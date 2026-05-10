---
name: Tech Lead 검토 필요 항목 목록
description: 기획 문서 작성 중 기술 결정이 필요하여 Tech Lead 검토를 요청한 항목들
type: project
---

2026-05-02 기준 Tech Lead 검토가 필요한 미결 항목 목록.

## 미결 항목

| 번호 | 출처 문서 | 항목 | 내용 |
|------|-----------|------|------|
| TL-001 | 03_screen_flow | 검색 결과 API 처리 | 외부 API 호출 순서, 병렬 처리 전략, 응답 지연 타임아웃 기준 |
| TL-002 | 03_screen_flow | 일부 API 실패 시 처리 | 성공한 API 결과만 표시 시 사용자 안내 방식 |
| TL-003 | 01_product_requirements | API 중복 결과 | 제목 유사도 기반 중복 감지 알고리즘 구현 가능 여부 및 오탐 위험 |
| TL-004 | 01_product_requirements | 영화 핀 DB 구조 | episode_id 없이 content_id 직접 참조 vs 가상 에피소드 레코드 생성 |
| TL-005 | 03_screen_flow | 로그인 Rate limiting | 로그인 5회 이상 실패 시 Rate limiting 정책 |
| TL-006 | 03_screen_flow | 회원 탈퇴 데이터 삭제 | 사용자 삭제 시 공유 메타데이터(contents 테이블) 처리 정책 |
| TL-007 | 03_screen_flow | 로그아웃 캐시 처리 | 로그아웃 후 기기 캐시 민감 정보 삭제 정책 |
| TL-008 | 03_screen_flow | 핀 목록 페이지네이션 | 에피소드 100개 이상 작품의 전체 핀 목록 페이지네이션 전략 |
| TL-009 | 09_timeline_pin_ux | 타임스탬프 포맷 변환 | 입력 중 실시간 포맷 변환 시 커서 위치 문제 |
| TL-010 | 09_timeline_pin_ux | 에피소드 런타임 신뢰도 | 외부 API 런타임 데이터 정확도, null 처리 전략 |
| TL-011 | 09_timeline_pin_ux | 고아 핀 처리 | 작품 라이브러리 삭제 시 관련 핀 CASCADE 전략 |
| TL-012 | 02_user_stories | 라이브러리 제거 시 메타데이터 | contents 테이블 공유 레코드 삭제 여부 |

**Why:** 기획자가 기술 구현을 추측하지 않고 Tech Lead와 협의하기 위한 추적 목록.
**How to apply:** 새 기획 문서 작성 시 이 목록에 신규 항목을 추가. 결정된 항목은 결과를 기록하고 목록에서 제거.
