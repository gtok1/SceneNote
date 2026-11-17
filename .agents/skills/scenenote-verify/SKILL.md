---
name: scenenote-verify
description: SceneNote 코드 작업 중 기능별 테스트를 선택하거나 마무리 로컬 검사를 간결한 결과와 별도 로그로 실행한다. 문서·훅 변경은 해당 도구만 검증한다. 읽기 전용 질문이나 운영 배포에는 사용하지 않는다.
---

# SceneNote 로컬 검증

- `AGENTS.md`에서 해당 기능 명세를 고르고 기존 변경을 보존한다. 검증 범위는 [변경 종류별 기준](../../../docs/development_next_steps.md#변경-종류별-검증)을 따른다.
- 실행할 Node 환경을 먼저 고른다. 이 Mac의 기본 Node는 simdjson 누락이 관찰됐고 Node 24가 동작하므로 아래 명령에는 `--node-bin /opt/homebrew/opt/node@24/bin`을 추가한다. 다른 환경에서 PATH의 Node/npm이 정상이면 생략한다. 옵션은 해당 검증과 하위 프로세스의 PATH에만 적용하며 전역 설정·의존성을 바꾸거나 다른 런타임으로 자동 재시도하지 않는다. npm 검사를 요청하면 선택한 디렉터리의 npm도 필요하다.
- 작업 중에는 변경 함수·사용처·명세 테스트 표를 보고 관련 `.test.ts` 파일을 선택한다. 파일 검색은 `rg --files src scripts supabase/functions -g '*.test.ts'`로 한다. 파일명만으로 영향 범위를 확정하지 않는다. 아래 명령은 저장소 루트에서 실행한다.

```sh
# 현재 Mac 예시. 정상 PATH 환경에서는 --node-bin 옵션을 생략할 수 있다.
# 중간 검증: 지정한 파일만 실행. --plan을 붙이면 실행 없이 명령만 확인.
python3 .agents/skills/scenenote-verify/scripts/verify.py --node-bin /opt/homebrew/opt/node@24/bin --tests src/utils/pinCache.test.ts --only test
# 선택 테스트 + 앱 타입·린트
python3 .agents/skills/scenenote-verify/scripts/verify.py --node-bin /opt/homebrew/opt/node@24/bin --tests src/utils/pinCache.test.ts
# 기능 코드 완료: AGENTS/명세가 요구하는 전체 검사 유지
python3 .agents/skills/scenenote-verify/scripts/verify.py --node-bin /opt/homebrew/opt/node@24/bin --only test typecheck lint
```

- 위 테스트 경로는 예시다. 실제 관련 파일로 바꾸고, 여러 파일은 공백으로 나열한다. 선택 테스트는 기존 TSX 로더를 사용하며 전체 테스트를 대체하지 않는다. 인수 없는 실행은 검사를 시작하지 않는다. 웹 export가 필요한 작업만 `--build`를 추가한다.
- 문서·스킬·훅만 변경하면 전체 앱 검사를 자동 실행하지 않는다. 링크·경로·diff와 변경 도구의 격리 검사를 확인한다: `python3 .agents/skills/scenenote-verify/scripts/test_verify.py`, `python3 .githooks/test_staged_guard.py`. 편집할 때마다 전체 검사·서버 재시작·배포를 연결하지 않는다.
- 결과는 검사별 한 줄이고 전체 로그는 표시된 임시 폴더에 저장한다(폴더 700, 파일 600). `summary.json`은 실제 명령과 Node/npm 경로를 포함하며 정상 종료 시 작성한다. 중도 실패·취소 때는 없을 수 있다. `--plan`은 실행 경로 미리보기이며 런타임/검사 통과 증거가 아니다. 필요한 실패 부분만 읽는다. 기본 제한은 검사당 900초이며 `--timeout`으로 조정한다. 종료 0은 요청 검사 통과, 1은 검사 실패, 2는 인수/환경 문제다. `NOT RUN`은 검사 미실행, `INCOMPLETE`는 일부 실행 뒤 환경 문제로 중단된 상태다. `CANCELLED`(130/143)는 취소이며 해당 검사 프로세스 그룹을 정리한다. 개별 `FAIL`은 로그를 보고 원인을 판단한다.
- 앱 타입/린트는 `supabase/functions`를 제외한다. Edge는 관련 순수 테스트와 Deno 검사, SQL은 격리 검증이 별도로 필요하다. 원격 smoke/import/DB 적용/배포는 이 도구가 실행하지 않는다. UI는 웹·iOS·Android 결과를 따로 보고한다.
- 훅 상태는 `python3 .githooks/install.py --check`로 확인한다. 설치 작업일 때만 `python3 .githooks/install.py`를 실행한다. 기존 훅·`core.hooksPath`·공유 hooks 디렉터리 링크는 보존하고 설치를 중단한다. 훅은 커밋할 때 staged 공백·충돌 표시와 환경/대표 개인키 경로(파일 종류 변경 포함)만 확인하고 정상일 때 출력하지 않는다. 공백 검사는 Git의 whitespace·attributes 설정을 따른다. 파일 내용의 비밀값 전수검사나 앱 검사 통과를 보증하지 않으며 commit/push/배포를 생성하지 않는다. 같은 Git 저장소의 linked worktree에도 공통 훅이 적용되므로 해당 worktree에 guard 파일이 없으면 커밋이 실패한다.
- `AGENTS.md`와 `CLAUDE.md`의 검증 경로를 통해 이 스킬을 적용한다. 스킬을 읽는 것은 검증 스크립트 실행과 다르며, 편집 때마다 자동 실행되는 이벤트 훅은 설치하지 않는다. 현재 세션에 변경된 지침이나 스킬 목록이 즉시 다시 로드됐다고 가정하지 않는다.
- 완료에는 실행 범위·통과/실패/미실행과 남은 플랫폼 검증을 구분한다. 시간·토큰 절감률은 적용 전후 측정 없이 단정하지 않는다.
