export type SortOrder = "asc" | "desc";

export type SortState<TSort extends string> = {
  order: SortOrder;
  sort: TSort;
};

export function parseSortState<TSort extends string>({
  allowedSorts,
  defaultOrder,
  defaultSort,
  order,
  sort
}: {
  allowedSorts: readonly TSort[];
  defaultOrder: SortOrder;
  defaultSort: TSort;
  order?: string | null;
  sort?: string | null;
}): SortState<TSort> {
  return {
    order: order === "asc" || order === "desc" ? order : defaultOrder,
    sort: allowedSorts.includes(sort as TSort) ? sort as TSort : defaultSort
  };
}

export function toggleSortState<TSort extends string>(
  current: SortState<TSort>,
  nextSort: TSort
): SortState<TSort> {
  if (current.sort !== nextSort) {
    return { sort: nextSort, order: "desc" };
  }

  return {
    sort: nextSort,
    order: current.order === "desc" ? "asc" : "desc"
  };
}

export function compareNullableNumber(a: number | undefined | null, b: number | undefined | null): number {
  const left = Number.isFinite(a) ? Number(a) : Number.NEGATIVE_INFINITY;
  const right = Number.isFinite(b) ? Number(b) : Number.NEGATIVE_INFINITY;

  return left - right;
}

export function applySort<T, TSort extends string>(
  rows: T[],
  sortState: SortState<TSort>,
  selectors: Record<TSort, (row: T) => number | undefined | null>
): T[] {
  const direction = sortState.order === "asc" ? 1 : -1;

  return rows.slice().sort((a, b) => {
    const compared = compareNullableNumber(selectors[sortState.sort](a), selectors[sortState.sort](b));
    return compared === 0 ? 0 : compared * direction;
  });
}

export function buildSortQuery<TSort extends string>(
  current: SortState<TSort>,
  nextSort: TSort,
  existing?: URLSearchParams
): string {
  const next = toggleSortState(current, nextSort);
  const params = new URLSearchParams(existing);
  params.set("sort", next.sort);
  params.set("order", next.order);
  return params.toString();
}

export function sortIndicator<TSort extends string>(current: SortState<TSort>, sort: TSort): string {
  if (current.sort !== sort) return "";
  return current.order === "asc" ? " ↑" : " ↓";
}
