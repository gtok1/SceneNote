import assert from "node:assert/strict";
import { it } from "node:test";

import * as metadataQuery from "./metadataQuery";

it("T-33 Edge 목록 조회는 자동 재시도·창 복귀·재연결 재조회를 하지 않는다", () => {
  assert.deepEqual(metadataQuery.EDGE_LIST_QUERY_OPTIONS, {
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
});

it("T-34 보존: 공개 메타데이터의 기존 수동 갱신 정책을 유지한다", () => {
  assert.deepEqual(metadataQuery.MANUAL_METADATA_QUERY_OPTIONS, {
    staleTime: Infinity,
    gcTime: 24 * 60 * 60_000,
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false
  });
});
