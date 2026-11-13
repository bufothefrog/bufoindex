/**
 * LaTeX Renderer Component
 * Shows a formula that renderLatex already turned into KaTeX markup on the
 * server, so no KaTeX code runs in the browser.
 */

import React from 'react';

export interface LatexRendererProps {
  /** The LaTeX source; the accessible name, and the fallback text when html is null. */
  latex: string;
  /** renderLatex output for latex. */
  html: string | null;
  inline?: boolean;
  className?: string;
}

export function LatexRenderer({
  latex,
  html,
  inline = false,
  className = '',
}: LatexRendererProps) {
  const baseClasses = inline
    ? 'inline-block'
    : 'block text-center my-4 overflow-x-auto';
  const label = `Mathematical formula: ${latex}`;

  if (html === null) {
    // KaTeX failed on the server: show the source as plain text.
    return (
      <div className={`${baseClasses} ${className} text-negative font-mono`} role="img" aria-label={label}>
        {latex}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses} ${className}`}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Inline LaTeX component for text
 */
export function InlineLatex({ latex, html, className }: Omit<LatexRendererProps, 'inline'>) {
  return <LatexRenderer latex={latex} html={html} inline={true} className={className} />;
}

/**
 * Display LaTeX component for standalone formulas
 */
export function DisplayLatex({ latex, html, className = '' }: Omit<LatexRendererProps, 'inline'>) {
  return (
    <LatexRenderer
      latex={latex}
      html={html}
      inline={false}
      className={`p-4 bg-muted/30 rounded-lg border ${className}`}
    />
  );
}
