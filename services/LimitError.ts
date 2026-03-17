import type { LimitKind } from './limits';

export class LimitError extends Error {
  readonly kind: LimitKind;
  readonly limit: number;

  constructor(kind: LimitKind, limit: number) {
    super(`${kind} limit reached`);
    this.name = 'LimitError';
    this.kind = kind;
    this.limit = limit;
  }
}

export function isLimitError(err: unknown): err is LimitError {
  return err instanceof Error && err.name === 'LimitError' && 'kind' in err && 'limit' in err;
}

