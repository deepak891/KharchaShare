/**
 * App-wide constants shared across screens and components.
 *
 * Screens should import from here rather than declaring their own copies.
 * Screen-specific mock data (expense lists, settle balances) stays in the
 * screen file since it is not shared.
 */

// ── Mock user (replace with real auth later) ─────────────────────────────────

export const MOCK_USER_NAME = 'Deepak';

// ── AI expense parser ─────────────────────────────────────────────────────────

/** Default participants used when calling the AI expense parser. */
export const GROUP_PARTICIPANTS = ['Deepak', 'Raj', 'Priya', 'Ankit'] as const;

// ── Group creation presets ────────────────────────────────────────────────────

export const EMOJI_OPTIONS = [
  { emoji: '✈️' }, { emoji: '🏠' }, { emoji: '🍽️' }, { emoji: '🏔️' },
  { emoji: '🎉' }, { emoji: '🌊' }, { emoji: '🚗' }, { emoji: '🛒' },
  { emoji: '🎬' }, { emoji: '🏋️' }, { emoji: '🏏' }, { emoji: '🎓' },
] as const;

export const COLOR_OPTIONS = [
  { hex: '#DBEAFE' }, { hex: '#DCFCE7' }, { hex: '#FEF3C7' }, { hex: '#FCE7F3' },
  { hex: '#EDE9FE' }, { hex: '#FEE2E2' }, { hex: '#ECFDF5' }, { hex: '#FFF7ED' },
] as const;
