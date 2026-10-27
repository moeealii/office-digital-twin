import type { TidyState } from './engine-api';
export const EMPTY_TIDY: TidyState = {
  enabled: false, preparing: false, hiddenCount: 0, selection: null, selectedId: '', lastHidden: null,
  parts: false, shell: false, muted: false, error: null, bounds: null, items: [],
};
