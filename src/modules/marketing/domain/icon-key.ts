/**
 * The closed set of icons the marketing surface may use.
 *
 * Keeping this a union (instead of `string`) makes a typo in tenant content a
 * compile error, and keeps the icon set curated instead of drifting over time.
 */
export const ICON_KEYS = [
  'catalog',
  'share',
  'inbox',
  'speed',
  'organize',
  'chat',
  'centralize',
  'automate',
  'ease',
  'instagram',
  'linkedin',
  'youtube',
] as const;

export type IconKey = (typeof ICON_KEYS)[number];
