import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALL_COUNTRY_FILTER,
  COUNTRY_FILTER_OPTIONS,
  canRunSearch,
  isBrowseMode,
  matchesCountryFilter
} from "./countryFilter";

describe("country filter options", () => {
  it("offers Korea, Japan, the US and China as ISO 3166-1 alpha-2 codes", () => {
    assert.deepEqual(COUNTRY_FILTER_OPTIONS.map((option) => option.code), ["KR", "JP", "US", "CN"]);
    assert.deepEqual(COUNTRY_FILTER_OPTIONS.map((option) => option.label), ["한국", "일본", "미국", "중국"]);
  });
});

describe("country matching", () => {
  it("keeps everything when no country is selected", () => {
    assert.equal(matchesCountryFilter(["JP"], ALL_COUNTRY_FILTER), true);
    assert.equal(matchesCountryFilter(null, ALL_COUNTRY_FILTER), true);
  });

  it("matches a selected country, including co-productions", () => {
    assert.equal(matchesCountryFilter(["JP"], "JP"), true);
    assert.equal(matchesCountryFilter(["US", "JP"], "JP"), true);
    assert.equal(matchesCountryFilter(["KR"], "JP"), false);
  });

  it("is case insensitive about provider casing", () => {
    assert.equal(matchesCountryFilter(["jp"], "JP"), true);
  });

  it("drops results with no country data once a country is selected", () => {
    assert.equal(matchesCountryFilter(null, "JP"), false);
    assert.equal(matchesCountryFilter([], "JP"), false);
  });
});

describe("browse mode", () => {
  it("is on only when there is no query but a country is selected", () => {
    assert.equal(isBrowseMode("", "JP"), true);
    assert.equal(isBrowseMode("   ", "JP"), true);
    assert.equal(isBrowseMode("vivant", "JP"), false);
    assert.equal(isBrowseMode("", ALL_COUNTRY_FILTER), false);
  });

  it("allows searching with a query, or with a country instead of a query", () => {
    assert.equal(canRunSearch("vivant", ALL_COUNTRY_FILTER), true);
    assert.equal(canRunSearch("", "JP"), true);
    assert.equal(canRunSearch("", ALL_COUNTRY_FILTER), false);
    assert.equal(canRunSearch("   ", ALL_COUNTRY_FILTER), false);
  });
});
