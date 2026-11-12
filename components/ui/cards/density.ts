/**
 * Dense card spacing for BaseCard and its variants: tighter padding on phones,
 * so a 390px viewport keeps room for two-column stat tiles, and the BaseCard
 * default padding from sm: up. Spread it into a card's props.
 */
export const DENSE_CARD_CLASSES = {
  headerClassName: 'p-4 pb-3 sm:p-6 sm:pb-4',
  contentClassName: 'p-4 pt-0 sm:p-6 sm:pt-0',
} as const;
