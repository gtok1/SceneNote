export function createReviewLabel(
  rating: number | null | undefined,
  oneLineReview: string | null | undefined
): string | null {
  const parts = [
    typeof rating === "number" ? `★ ${formatRating(rating)}/10` : null,
    typeof oneLineReview === "string" && oneLineReview.trim() ? truncateReview(oneLineReview, 10) : null
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : null;
}

function formatRating(rating: number): string {
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

function truncateReview(review: string, maxLength: number): string {
  const characters = Array.from(review.trim());
  if (characters.length <= maxLength) return review.trim();
  return `${characters.slice(0, maxLength).join("")}...`;
}
