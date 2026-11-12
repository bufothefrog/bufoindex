/**
 * Server-side KaTeX rendering for the methodology pages (audit H8). The page,
 * a server component, renders every formula to HTML here, so KaTeX's
 * JavaScript stays on the server and the browser receives finished markup.
 * Only types may be imported from this module into a client component.
 */

import katex from 'katex';
import type { FormulaRegistryEntry } from '@/lib/formulas/types';

const KATEX_OPTIONS = {
  throwOnError: false,
  strict: false,
  // Security: don't allow arbitrary commands
  trust: false,
  macros: {
    // Common financial math macros
    '\\FV': '\\text{FV}',
    '\\PV': '\\text{PV}',
    '\\PMT': '\\text{PMT}',
    '\\rate': 'r',
    '\\periods': 't',
    '\\dollars': '\\$',
  },
} as const;

/** A formula with its LaTeX rendered; null where KaTeX failed (LatexRenderer shows the source). */
export interface RenderedFormula extends FormulaRegistryEntry {
  latexHtml: string | null;
  /** Rendered variable symbols, keyed like `variables`. */
  variableHtml: Readonly<Record<string, string | null>>;
}

/** KaTeX markup for one formula, display or inline; null when KaTeX throws. */
export function renderLatex(latex: string, inline: boolean): string | null {
  try {
    // KaTeX writes \gdef definitions into the macros object, so each call gets a copy.
    return katex.renderToString(latex, { ...KATEX_OPTIONS, macros: { ...KATEX_OPTIONS.macros }, displayMode: !inline });
  } catch (error) {
    console.warn('KaTeX rendering error:', error);
    return null;
  }
}

/** The formula with its display formula and its variable symbols rendered. */
export function renderFormula(formula: FormulaRegistryEntry): RenderedFormula {
  return {
    ...formula,
    latexHtml: renderLatex(formula.latex, false),
    variableHtml: Object.fromEntries(
      Object.entries(formula.variables).map(([key, variable]) => [key, renderLatex(variable.symbol, true)])
    ),
  };
}
