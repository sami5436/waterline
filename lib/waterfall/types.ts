/**
 * Domain model for a venture-backed cap table and a single employee equity grant.
 *
 * Everything is expressed in whole dollars and whole shares. Rates are decimals
 * in [0, 1]. Dates are ISO `YYYY-MM-DD` strings so scenarios serialize cleanly
 * into JSON for share links.
 */

/** A single preferred financing round. */
export interface Round {
  id: string;
  name: string;
  /** Total dollars invested in this round. */
  invested: number;
  /** Preferred shares issued in this round. */
  shares: number;
  /** Liquidation preference as a multiple of `invested` (1 = 1x). */
  prefMultiple: number;
  /**
   * Participating preferred ("double dip") takes its preference AND then shares
   * the residual pro-rata. Non-participating must choose one or the other.
   */
  participating: boolean;
  /**
   * Participation cap as a multiple of `invested`, applied to TOTAL proceeds
   * (preference + participation). `null` means uncapped. Ignored when
   * `participating` is false.
   */
  participationCap: number | null;
  /**
   * Payout tier. Lower numbers are paid first. Rounds sharing a seniority
   * number are pari passu and pro-rate against each other if funds run short.
   */
  seniority: number;
  /** Marks a hypothetical future round the user is modelling, not one that has closed. */
  projected?: boolean;
}

export interface CapTable {
  companyName: string;
  /** Issued common stock: founders, exercised options, converted notes. */
  commonShares: number;
  /** Entire option pool, granted and ungranted. Counted as fully diluted. */
  optionPoolShares: number;
  rounds: Round[];
}

export type GrantType = "ISO" | "NSO" | "RSU";

export interface Grant {
  /** Total shares in the grant, before vesting. */
  shares: number;
  /** Exercise price per share. RSUs use 0. */
  strike: number;
  type: GrantType;
  /** Vesting commencement date. */
  grantDate: string;
  /** Total vesting period in months (48 = the standard four years). */
  vestMonths: number;
  /** Cliff in months (12 = the standard one-year cliff). */
  cliffMonths: number;
  /** Date at which vesting is evaluated. */
  asOf: string;
  /**
   * Extra dilution you expect between now and exit that isn't modelled as an
   * explicit round: pool refreshes, bridge notes, secondary issuance.
   * Expressed as a fraction of your ownership lost, in [0, 1).
   */
  extraDilution: number;
}

export type ExerciseStrategy = "exercise-at-exit" | "early-exercise";

export interface TaxAssumptions {
  /** Combined federal + state marginal rate on ordinary income. */
  ordinaryRate: number;
  /** Combined long-term capital gains rate. */
  capitalGainsRate: number;
  /** Effective AMT rate applied to the ISO bargain element. */
  amtRate: number;
  strategy: ExerciseStrategy;
  /** Current 409A fair market value per common share, used for AMT at exercise. */
  currentFmv: number;
}

export interface Scenario {
  capTable: CapTable;
  grant: Grant;
  tax: TaxAssumptions;
  /** Upper bound of the exit-value axis on the chart, in dollars. */
  maxExit: number;
}

/* ------------------------------------------------------------------ */
/* Engine output                                                       */
/* ------------------------------------------------------------------ */

export interface SeriesPayout {
  id: string;
  name: string;
  /** True when this series gave up its preference and took common instead. */
  converted: boolean;
  /** Dollars received off the top as liquidation preference. */
  preference: number;
  /** Dollars received from the residual pool. */
  participation: number;
  total: number;
  /** total / invested. */
  multipleOnInvested: number;
  /** True when a participation cap bound this series' payout. */
  cappedOut: boolean;
}

export interface WaterfallResult {
  exitValue: number;
  /** Dollars per fully diluted common share. The number everything hinges on. */
  commonPricePerShare: number;
  /** Total dollars paid out as liquidation preference before common sees anything. */
  totalPreferencePaid: number;
  /** Dollars flowing to common stock and the option pool. */
  commonPool: number;
  series: SeriesPayout[];
  fullyDiluted: number;
}

export interface EmployeeOutcome {
  /** Shares vested as of `grant.asOf`. */
  vested: number;
  /** Vested shares after applying `extraDilution`. */
  effectiveShares: number;
  vestedFraction: number;
  monthsElapsed: number;
  /** Your ownership as a fraction of the fully diluted cap table. */
  ownershipFraction: number;
  commonPricePerShare: number;
  /** effectiveShares x pricePerShare, before paying the strike. */
  gross: number;
  /** What it costs you to turn options into shares. */
  exerciseCost: number;
  /** gross - exerciseCost, floored at zero. */
  spread: number;
  /** Estimated tax on the spread under the chosen strategy. */
  tax: number;
  /** Take-home after exercise cost and tax. */
  net: number;
  /** Cash you must produce before any exit, under the chosen strategy. */
  cashRequiredToday: number;
  /** Estimated AMT owed in the year of an early exercise. */
  amtEstimate: number;
  /** True when the price per share does not clear your strike. */
  underwater: boolean;
}

export interface Verdict {
  /**
   * The waterline: the lowest exit value at which your grant nets more than
   * zero after exercise cost. Below this you walk away with nothing.
   * `null` when no exit within the search range clears it.
   */
  waterline: number | null;
  /** Total liquidation preference stacked ahead of common. */
  preferenceOverhang: number;
  /**
   * Exit value at which common stock first receives any money at all,
   * regardless of your strike.
   */
  commonBreakeven: number | null;
  /** Shares x the most recent preferred price. The number a recruiter quotes. */
  headlineValue: number;
  /** Most recent preferred price per share. */
  lastPreferredPrice: number;
  /** Post-money valuation implied by the most recent round. */
  lastPostMoney: number;
}
