export interface OnboardingActions {
  showBack: boolean;
  showNext: boolean;
  showSignUp: boolean;
  showSignInLink: true;
}

export function getOnboardingActions(index: number, total: number): OnboardingActions {
  const slideCount = Number.isFinite(total) && total >= 1 ? Math.floor(total) : 1;
  const currentIndex = Math.max(0, Math.min(Number.isNaN(index) ? 0 : Math.floor(index), slideCount - 1));
  const showSignUp = currentIndex === slideCount - 1;
  return { showBack: currentIndex > 0, showNext: !showSignUp, showSignUp, showSignInLink: true };
}
