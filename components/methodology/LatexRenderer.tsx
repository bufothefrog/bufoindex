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
  // A display formula wider than its box scrolls sideways inside the box (the
  // page itself does not), so it takes a tab stop: keyboard users can then
  // scroll it with the arrow keys. Its accessible name is the LaTeX source.
  const focusProps = inline ? {} : { tabIndex: 0 };
  const focusClasses = inline
    ? ''
    : ' focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

  if (html === null) {
    // KaTeX failed on the server: show the source as plain text.
    return (
      <div className={`${baseClasses}${focusClasses} ${className} text-negative font-mono`} role="img" aria-label={label} {...focusProps}>
        {latex}
      </div>
    );
  }

  return (
    <div
      className={`${baseClasses}${focusClasses} ${className}`}
      role="img"
      aria-label={label}
      {...focusProps}
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
