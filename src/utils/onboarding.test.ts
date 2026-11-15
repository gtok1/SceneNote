import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getOnboardingActions } from "./onboarding";

describe("getOnboardingActions", () => {
  it("T-11 shows next and the sign-in link on the first slide", () => {
    assert.deepEqual(getOnboardingActions(0, 3), {
      showBack: false,
      showNext: true,
      showSignUp: false,
      showSignInLink: true
    });
  });

  it("T-12 shows back, next and the sign-in link on the middle slide", () => {
    assert.deepEqual(getOnboardingActions(1, 3), {
      showBack: true,
      showNext: true,
      showSignUp: false,
      showSignInLink: true
    });
  });

  it("T-13 replaces next with sign-up on the last slide and preserves back and sign-in", () => {
    assert.deepEqual(getOnboardingActions(2, 3), {
      showBack: true,
      showNext: false,
      showSignUp: true,
      showSignInLink: true
    });
  });

  it("T-14 clamps invalid indexes, defaults an empty slide count and floors fractional indexes", () => {
    assert.deepEqual(getOnboardingActions(-1, 3), {
      showBack: false, showNext: true, showSignUp: false, showSignInLink: true
    });
    assert.deepEqual(getOnboardingActions(9, 3), {
      showBack: true, showNext: false, showSignUp: true, showSignInLink: true
    });
    assert.deepEqual(getOnboardingActions(NaN, 3), {
      showBack: false, showNext: true, showSignUp: false, showSignInLink: true
    });
    assert.deepEqual(getOnboardingActions(0, 0), {
      showBack: false, showNext: false, showSignUp: true, showSignInLink: true
    });
    assert.deepEqual(getOnboardingActions(1.7, 3), {
      showBack: true, showNext: true, showSignUp: false, showSignInLink: true
    });
  });
});
