export const ACTION_LIST_PAGE_SIZE = 50

export function getVisibleActionCount({
  increment = ACTION_LIST_PAGE_SIZE,
  totalCount,
  visibleCount,
}: {
  increment?: number
  totalCount: number
  visibleCount: number
}) {
  return Math.min(totalCount, visibleCount + increment)
}

export function getInitialVisibleActionCount(totalCount: number) {
  return Math.min(totalCount, ACTION_LIST_PAGE_SIZE)
}
