export type ReviewSort = "recent" | "oldest" | "highest" | "lowest";

export function parseReviewFilters(params: {
  stars?: string;
  sort?: string;
}): {
  stars: number | null;
  sort: ReviewSort;
} {
  const parsedStars = Number(params.stars);
  const stars =
    Number.isInteger(parsedStars) && parsedStars >= 1 && parsedStars <= 5
      ? parsedStars
      : null;
  const sort: ReviewSort =
    params.sort === "oldest" ||
    params.sort === "highest" ||
    params.sort === "lowest"
      ? params.sort
      : "recent";

  return { stars, sort };
}

export function filterAndSortReviews<
  T extends { rating: number; created_at: string },
>(reviews: T[], stars: number | null, sort: ReviewSort): T[] {
  const filtered = stars
    ? reviews.filter((review) => review.rating === stars)
    : reviews;

  return [...filtered].sort((left, right) => {
    const leftDate = Date.parse(left.created_at);
    const rightDate = Date.parse(right.created_at);

    if (sort === "oldest") return leftDate - rightDate;
    if (sort === "highest") {
      return right.rating - left.rating || rightDate - leftDate;
    }
    if (sort === "lowest") {
      return left.rating - right.rating || rightDate - leftDate;
    }
    return rightDate - leftDate;
  });
}
