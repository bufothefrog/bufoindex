/**
 * The account model of profile version 3 (types only).
 *
 * portfolio.accounts is the single list of what the visitor owns: each row
 * has a kind, a name, one typed balance and optional holdings. The tax
 * treatment follows from the kind (ACCOUNT_KINDS in ./accounts.ts). The
 * derivations that read these rows live in ./accounts.ts.
 */

/** What an account is; the label of each lives in lib/constants/labels.ts. */
export type AccountKind =
  | '401k' // "401(k) or similar" (403(b), 457, TSP)
  | 'roth-401k' // "Roth 401(k)"
  | 'traditional-ira' // "Traditional IRA"
  | 'roth-ira' // "Roth IRA"
  | 'hsa' // "HSA"
  | 'brokerage' // "Brokerage (taxable)"
  | 'cash'; // "Cash or savings": never rebalanced, always holds the visitor's cash reserve

/** One account the visitor owns. */
export interface AccountRow {
  /** Holdings and newCash rows refer to it; a suggested row uses ACCOUNT_KINDS[kind].suggestedId. */
  id: string;
  /** An invalid stored value reads as 'brokerage' (the row default). */
  kind: AccountKind;
  /** May be ''; display falls back to the kind label. */
  name: string;
  /**
   * Typed dollars, 0 or more. Used while the account's holdings are worth 0;
   * kept, never cleared, when holdings are added.
   */
  balance: number;
  /** Honored only on kind 'brokerage'; normalization forces false on every other kind. */
  holdsEmergencyFund: boolean;
}

/** Calculator-only (rebalancer screen 'new-cash', surface 'calculator'): one run's new cash for one account. */
export interface NewCashRow {
  /** The AccountRow id it applies to. */
  id: string;
  /** Dollars, 0 or more. */
  amount: number;
}
