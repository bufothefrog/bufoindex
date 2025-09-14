/**
 * LaTeX Renderer Component
 * Renders mathematical formulas using KaTeX
 */

'use client';

import React, { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export interface LatexRendererProps {
  latex: string;
  inline?: boolean;
  className?: string;
  onRenderError?: (error: Error) => void;
}

export function LatexRenderer({ 
  latex, 
  inline = false, 
  className = '', 
  onRenderError 
}: LatexRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !latex) return;

    try {
      // Clear previous content
      containerRef.current.innerHTML = '';

      // Render the LaTeX
      katex.render(latex, containerRef.current, {
        displayMode: !inline,
        throwOnError: false,
        strict: false,
        trust: false, // Security: don't allow arbitrary commands
        macros: {
          // Common financial math macros
          '\\FV': '\\text{FV}',
          '\\PV': '\\text{PV}',
          '\\PMT': '\\text{PMT}',
          '\\rate': 'r',
          '\\periods': 't',
          '\\dollars': '\\$',
        }
      });
    } catch (error) {
      console.warn('KaTeX rendering error:', error);
      
      // Fallback to plain text
      if (containerRef.current) {
        containerRef.current.textContent = latex;
        containerRef.current.style.color = '#ef4444'; // Tailwind red-500
        containerRef.current.style.fontFamily = 'monospace';
      }

      onRenderError?.(error as Error);
    }
  }, [latex, inline, onRenderError]);

  const baseClasses = inline 
    ? 'inline-block' 
    : 'block text-center my-4 overflow-x-auto';

  return (
    <div
      ref={containerRef}
      className={`${baseClasses} ${className}`}
      role="img"
      aria-label={`Mathematical formula: ${latex}`}
    />
  );
}

/**
 * Inline LaTeX component for text
 */
export function InlineLatex({ latex, className, onRenderError }: Omit<LatexRendererProps, 'inline'>) {
  return (
    <LatexRenderer
      latex={latex}
      inline={true}
      className={className}
      onRenderError={onRenderError}
    />
  );
}

/**
 * Display LaTeX component for standalone formulas
 */
export function DisplayLatex({ latex, className, onRenderError }: Omit<LatexRendererProps, 'inline'>) {
  return (
    <LatexRenderer
      latex={latex}
      inline={false}
      className={`p-4 bg-muted/30 rounded-lg border ${className}`}
      onRenderError={onRenderError}
    />
  );
}