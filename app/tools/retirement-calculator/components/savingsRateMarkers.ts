/**
 * The visitor's own position on the Savings Rate Impact chart: their current
 * savings rate (a horizontal reference line), the point on the curve at their
 * planned retirement age, and one sentence that says both in words for people
 * who cannot read the chart.
 *
 * Display only: it reads the curve from lib/calculations/savingsRate and the
 * inputs the engine already has, and feeds nothing back into a calculation.
 * Kept free of Recharts so the results section can build the caption without
 * loading the chart.
 */

import { yearStartShareOf } from '@/lib/calculations/contributionSchedule';
import type { RetirementInputs } from '@/lib/calculations/retirement';
import {
  requiredSavingsCurve,
  type SavingsRateInputs,
  type SavingsRatePoint,
} from '@/lib/calculations/savingsRate';
import { formatPercent } from '@/lib/format';

/**
 * The inputs the markers read: the curve's own plus savings, the yearly part
 * of the savings and retirement age. The curve's start-of-year share comes
 * from monthlySavings and yearStartSavings (yearStartShareOf).
 */
export type SavingsRateMarkerInputs = Omit<SavingsRateInputs, 'yearStartShare'> &
  Pick<RetirementInputs, 'monthlySavings' | 'retirementAge' | 'yearStartSavings'>;

export interface SavingsRateMarkers {
  /** The required-savings curve, one point per retirement age. */
  curve: SavingsRatePoint[];
  /**
   * monthlySavings * 12 / currentIncome in percent (the engine's formula), or
   * null when there is no positive income to divide by.
   */
  currentSavingsRate: number | null;
  /** The curve's point at the planned retirement age, or null when it is not plotted. */
  plannedPoint: SavingsRatePoint | null;
  /** The plotted age range, or null when the curve is empty. */
  ageRange: { from: number; to: number } | null;
  /** The text alternative; empty when there is nothing to say. */
  sentence: string;
}

/** A box in SVG pixels (y grows downward). */
export interface LabelBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * What the label placement reads, all in SVG pixels of the chart: the SVG
 * width, the plot area (its bottom edge is the x-axis line, with the tick
 * labels under it), the planned-age dot and the dashed current-rate line (null
 * when not drawn), and the two label texts.
 */
export interface SavingsRateLabelGeometry {
  svgWidth: number;
  /** The plot area: its top-left corner (x, y) and size, as Recharts' usePlotArea gives it. */
  plot: { x: number; y: number; width: number; height: number };
  dot: { x: number; y: number } | null;
  lineY: number | null;
  dotText: string;
  rateText: string;
}

/** One label as the chart draws it: an SVG text at (x, y), y the baseline. */
export interface PlacedLabel {
  x: number;
  y: number;
  textAnchor: 'start' | 'middle' | 'end';
  /** The estimated box of the text, for the collision checks and the tests. */
  box: LabelBox;
}

/** Where the chart draws the two marker labels; null where there is no marker. */
export interface SavingsRateLabelPositions {
  rateLabel: PlacedLabel | null;
  dotLabel: PlacedLabel | null;
}

/** The labels' font size; the chart draws them at this size. */
export const MARKER_LABEL_FONT_SIZE = 12;
/** The planned-age dot's radius. */
export const MARKER_DOT_RADIUS = 6;
// Glyphs reach about 0.71 em above the baseline and 0.25 em below it; the
// width is a generous average for the label font, so an estimated box is a
// little wider than the drawn text.
const ASCENT = 0.71 * MARKER_LABEL_FONT_SIZE;
const DESCENT = 0.25 * MARKER_LABEL_FONT_SIZE;
const CHAR_WIDTH = 0.6 * MARKER_LABEL_FONT_SIZE;
/** Space between a label and the line or the plot edge. */
const GAP = 4;
/** Space between the dot and a label above or below it (no descenders there). */
const DOT_GAP = 2;
/** Half the dashed line's thickness plus a clear pixel each side. */
const LINE_CLEARANCE = 2;

const textWidth = (text: string) => text.length * CHAR_WIDTH;

const overlaps = (a: LabelBox, b: LabelBox, pad = 0) =>
  a.left < b.right + pad && b.left < a.right + pad && a.top < b.bottom + pad && b.top < a.bottom + pad;

function placed(x: number, baseline: number, textAnchor: PlacedLabel['textAnchor'], width: number): PlacedLabel {
  const left = textAnchor === 'start' ? x : textAnchor === 'end' ? x - width : x - width / 2;
  return {
    x,
    y: baseline,
    textAnchor,
    box: { left, right: left + width, top: baseline - ASCENT, bottom: baseline + DESCENT },
  };
}

/** The horizontal room a label may use: right of the y axis, inside the SVG. */
interface LabelBounds {
  left: number;
  right: number;
}

/**
 * A label above or below the dot, centered on it unless that would cross a
 * bound (the y-axis line on the left, the SVG edge on the right); near a
 * bound the text is anchored at the dot and runs inward. `bottomAt` lifts a
 * label above the dot higher, to clear the dashed line.
 */
function stacked(
  dot: { x: number; y: number },
  side: 'above' | 'below',
  width: number,
  bounds: LabelBounds,
  bottomAt = dot.y - MARKER_DOT_RADIUS - DOT_GAP,
) {
  const baseline = side === 'above' ? bottomAt - DESCENT : dot.y + MARKER_DOT_RADIUS + DOT_GAP + ASCENT;
  if (dot.x - width / 2 < bounds.left) {
    return placed(Math.max(bounds.left, dot.x - MARKER_DOT_RADIUS), baseline, 'start', width);
  }
  if (dot.x + width / 2 > bounds.right) {
    return placed(Math.min(bounds.right, dot.x + MARKER_DOT_RADIUS), baseline, 'end', width);
  }
  return placed(dot.x, baseline, 'middle', width);
}

/** A label beside the dot, vertically centered on it. */
function beside(dot: { x: number; y: number }, side: 'left' | 'right', width: number) {
  const baseline = dot.y + (ASCENT - DESCENT) / 2;
  return side === 'right'
    ? placed(dot.x + MARKER_DOT_RADIUS + GAP, baseline, 'start', width)
    : placed(dot.x - MARKER_DOT_RADIUS - GAP, baseline, 'end', width);
}

/**
 * The current-rate label at the right end of the dashed line, just above or
 * just below it, or above a box (the dot's label) that sits over the line.
 */
function rateLabelAt(lineY: number, side: 'above' | 'below', width: number, plotRight: number, bottomAt = lineY - GAP) {
  const baseline = side === 'above' ? bottomAt - DESCENT : lineY + GAP + ASCENT;
  return placed(plotRight - GAP, baseline, 'end', width);
}

/**
 * Label positions that do not collide. The planned-age label tries, in turn:
 * the far side of the dot from the dashed line (below a dot under the line,
 * above a dot over it), the near side, beside the dot to the right and to the
 * left, and last above both the dot and the line (a dot on the x axis with
 * the line just over it). It must stay right of the y-axis line (and so clear
 * of its tick labels), inside the SVG, above the x-axis line
 * (and so clear of the tick labels) and off the dashed line. The rate label
 * then goes on the other side of the line from it when that fits, so the line
 * separates the two labels however close the dot sits to it; otherwise on the
 * same side, next to the line or above the dot's label, clear of the dot and
 * its label. With no dot the rate label sits below the line, or above it
 * when the axis leaves no room below.
 */
export function savingsRateLabelPositions(geometry: SavingsRateLabelGeometry): SavingsRateLabelPositions {
  const { svgWidth, plot, dot, lineY, dotText, rateText } = geometry;
  const plotRight = plot.x + plot.width;
  const axisY = plot.y + plot.height;
  const dotWidth = textWidth(dotText);
  const rateWidth = textWidth(rateText);
  const bounds: LabelBounds = { left: plot.x + GAP, right: svgWidth - GAP };

  const insideChart = (box: LabelBox) =>
    box.left >= plot.x && box.right <= svgWidth && box.top >= 0 && box.bottom <= axisY - LINE_CLEARANCE;
  const offLine = (box: LabelBox) =>
    lineY === null || box.bottom <= lineY - LINE_CLEARANCE || box.top >= lineY + LINE_CLEARANCE;

  const rateCandidates = (first: 'above' | 'below') =>
    lineY === null
      ? []
      : [first, first === 'above' ? 'below' : 'above'].map(side =>
          rateLabelAt(lineY, side as 'above' | 'below', rateWidth, plotRight)
        );

  if (!dot) {
    const rate = rateCandidates('below');
    return { rateLabel: rate.find(r => insideChart(r.box)) ?? rate[0] ?? null, dotLabel: null };
  }

  const dotUnderLine = lineY !== null && dot.y >= lineY;
  const dotCandidates = [
    stacked(dot, dotUnderLine ? 'below' : 'above', dotWidth, bounds),
    stacked(dot, dotUnderLine ? 'above' : 'below', dotWidth, bounds),
    beside(dot, 'right', dotWidth),
    beside(dot, 'left', dotWidth),
    ...(lineY === null
      ? []
      : [stacked(dot, 'above', dotWidth, bounds, Math.min(dot.y - MARKER_DOT_RADIUS - DOT_GAP, lineY - GAP))]),
  ];
  const dotBox: LabelBox = {
    left: dot.x - MARKER_DOT_RADIUS,
    right: dot.x + MARKER_DOT_RADIUS,
    top: dot.y - MARKER_DOT_RADIUS,
    bottom: dot.y + MARKER_DOT_RADIUS,
  };

  for (const dotLabel of dotCandidates) {
    if (!insideChart(dotLabel.box) || !offLine(dotLabel.box)) continue;
    if (lineY === null) return { rateLabel: null, dotLabel };
    const labelAboveLine = dotLabel.box.bottom <= lineY;
    const candidates = rateCandidates(labelAboveLine ? 'below' : 'above');
    if (labelAboveLine) {
      candidates.push(rateLabelAt(lineY, 'above', rateWidth, plotRight, dotLabel.box.top - GAP));
    }
    const rateLabel = candidates.find(
      r => insideChart(r.box) && !overlaps(r.box, dotLabel.box, GAP) && !overlaps(r.box, dotBox, 1)
    );
    if (rateLabel) return { rateLabel, dotLabel };
  }

  // Nothing fits (a chart too small to hold both labels): fall back to the
  // first choices.
  return {
    rateLabel: lineY === null ? null : rateCandidates(dotUnderLine ? 'above' : 'below')[0],
    dotLabel: dotCandidates[0],
  };
}

/** A percent (0 to 100 and beyond) as whole percent text, "12%". */
const wholePercent = (percent: number) => formatPercent(percent / 100, { digits: 0 });

function plannedAgeSentence(
  age: number,
  point: SavingsRatePoint | null,
  range: { from: number; to: number } | null,
): string {
  if (!range) return '';
  if (!point) {
    return `Retiring at ${age} is outside the plotted ages (${range.from} to ${range.to}).`;
  }
  if (point.requiredSavingsRate <= 0) {
    return `Retiring at ${age} needs no further savings: the starting balance alone reaches the target.`;
  }
  if (point.requiredSavingsRate >= 100) {
    return `Retiring at ${age} needs 100% of current income or more.`;
  }
  return `Retiring at ${age} needs about ${wholePercent(point.requiredSavingsRate)}.`;
}

/**
 * The markers and the sentence for one set of inputs. With no positive
 * income every rate on the curve is undefined, so there is no marker and no
 * sentence at all.
 */
export function savingsRateMarkers(inputs: SavingsRateMarkerInputs): SavingsRateMarkers {
  const { startingAge, targetIncome, startingBalance, accumulationReturn, currentIncome } = inputs;
  const curve = requiredSavingsCurve({
    startingAge,
    targetIncome,
    startingBalance,
    accumulationReturn,
    currentIncome,
    yearStartShare: yearStartShareOf(inputs.monthlySavings, inputs.yearStartSavings),
  });

  const hasIncome = Number.isFinite(currentIncome) && currentIncome > 0;
  if (!hasIncome) {
    return { curve, currentSavingsRate: null, plannedPoint: null, ageRange: null, sentence: '' };
  }

  const currentSavingsRate = ((inputs.monthlySavings * 12) / currentIncome) * 100;
  const ageRange =
    curve.length > 0
      ? { from: curve[0].retirementAge, to: curve[curve.length - 1].retirementAge }
      : null;
  const plannedPoint = curve.find(p => p.retirementAge === inputs.retirementAge) ?? null;

  const sentence = [
    `Your current savings rate is ${wholePercent(currentSavingsRate)}.`,
    plannedAgeSentence(inputs.retirementAge, plannedPoint, ageRange),
  ]
    .filter(Boolean)
    .join(' ');

  return { curve, currentSavingsRate, plannedPoint, ageRange, sentence };
}
