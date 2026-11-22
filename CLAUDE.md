# SceneNote · Claude Code

작업을 시작할 때 [공통 작업 지침](AGENTS.md)을 읽는다. 기능별 명세는 [문서 목차](docs/README.md#요구사항과-설계-문서)에서 고른다.

새 기능이나 설계 결정에는 [역할 정의](.claude/agents/)에서 필요한 에이전트를 선택한다.

| 역할 | 담당 작업 |
| --- | --- |
| `mvp-product-planner` | 화면 정의, 사용자 흐름, MVP 범위 |
| `mobile-app-architect` | 시스템 설계, 기술 결정, 데이터 흐름 |
| `rn-expo-ui-architect` | Expo·React Native 화면 구현과 UI 검토 |
| `supabase-backend-architect` | DB 스키마, RLS, Edge Functions |

여러 역할의 산출물을 하나의 계획으로 합칠 때는 [orchestrate](.claude/skills/orchestrate/SKILL.md)를, 기능별 테스트와 마무리 로컬 검사에는 [scenenote-verify](.claude/skills/scenenote-verify/SKILL.md)를 사용한다.

역할별 `.claude/agent-memory/`는 과거 작업 기록이다. 현재 코드·후속 명세·사용자 요청과 대조한다. 재사용할 결정이나 피드백은 해당 역할의 `MEMORY.md`에서 기존 항목을 찾아 갱신하거나 주제별 메모를 연결한다. 개인 정보와 비밀값은 기록하지 않는다. 역할 frontmatter의 모델 별칭은 Claude 전용 설정이다.
