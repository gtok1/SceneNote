---
name: scenenote-verify
description: SceneNote 코드 변경의 기능별 테스트와 완료 검사를 실행하고 결과·로그를 확인한다. 문서·스킬·Git 훅 변경에는 해당 경로와 도구를 검증한다.
---

# SceneNote 로컬 검증

## 코드 변경

[기능별 명세 목차](../../../docs/README.md)에서 관련 명세와 테스트 표를 확인한다. 검증 범위는 [변경 종류별 검증](../../../README.md#변경-종류별-검증)을 따른다. 작업 중에는 변경 함수와 사용처에 해당하는 테스트를 선택하고, 기능 코드 완료 시 전체 테스트·타입·린트 및 명세가 요구하는 검사를 실행한다.

저장소 루트에서 실행한다. `--tests`에는 실제 관련 파일을 공백으로 나열한다. 후보는 `rg --files src scripts supabase/functions -g '*.test.ts'`로 찾는다. 아래는 이 Mac에서 동작하는 Node 경로다. PATH의 Node/npm이 정상이면 `--node-bin` 옵션과 경로를 생략한다.

```sh
verify=.agents/skills/scenenote-verify/scripts/verify.py
python3 "$verify" --node-bin /opt/homebrew/opt/node@24/bin --tests src/utils/pinCache.test.ts --only test
python3 "$verify" --node-bin /opt/homebrew/opt/node@24/bin --only test typecheck lint
```

- 선택 테스트에 타입·린트도 포함하려면 첫 명령의 `--only test`를 생략한다. 웹 export가 필요하면 `--build`를 추가한다. `--plan`은 명령 미리보기다. 인수 없는 실행은 검사를 시작하지 않는다.
- `--node-bin`은 해당 검증 프로세스에만 적용된다. npm 검사에는 같은 디렉터리의 npm도 필요하다.
- 결과는 검사별 한 줄로 출력한다. 표시된 임시 폴더의 검사별 로그와 정상 종료 시 생성되는 `summary.json`에서 명령·런타임을 확인한다. `FAIL`은 해당 로그, `NOT RUN`은 실행 환경, `INCOMPLETE`·`CANCELLED`는 어디까지 실행됐는지 확인한다. 기본 제한은 검사당 900초이며 `--timeout`으로 바꿀 수 있다.
- 앱 타입·린트 범위 밖인 Edge는 관련 순수 테스트와 Deno 검사, SQL은 격리 DB 검증을 별도로 수행한다. UI 변경은 웹·iOS·Android별 결과와 미실행 사유를 기록한다.

## 문서·스킬·훅 변경

상대 링크·앵커·실제 경로와 `git diff --check`를 확인한다. 검증 CLI를 다루면 `python3 .agents/skills/scenenote-verify/scripts/test_verify.py`, Git 훅을 다루면 `python3 .githooks/test_staged_guard.py`로 격리 검사를 실행한다. 훅 상태는 `python3 .githooks/install.py --check`로 확인한다. 설치 절차와 검사 범위는 [README의 검증 명령](../../../README.md#실행빌드검증-명령)을 따른다.
