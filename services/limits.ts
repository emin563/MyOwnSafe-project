export const FREE_LIMITS = {
  documents: 25,
  categories: 5,
  tags: 25,
} as const;

export type LimitKind = keyof typeof FREE_LIMITS;

export function getFreeLimit(kind: LimitKind): number {
  return FREE_LIMITS[kind];
}

