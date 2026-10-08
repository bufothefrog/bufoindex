/**
 * Shared spacing for the dashboard cards: tighter padding on phones so a
 * 390px viewport keeps room for two-column stat tiles, the BaseCard default
 * padding from sm: up.
 */
export const DASHBOARD_CARD_LAYOUT = {
  className: 'h-full',
  headerClassName: 'p-4 pb-3 sm:p-6 sm:pb-4',
  contentClassName: 'p-4 pt-0 sm:p-6 sm:pt-0',
} as const;
