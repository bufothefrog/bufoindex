/**
 * LatexRenderer: a display formula that is wider than its box scrolls
 * sideways inside the box, so it must be reachable by keyboard. Display
 * blocks therefore take a tab stop and keep the LaTeX source as their
 * accessible name; inline formulas sit in running text and take none.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { DisplayLatex, InlineLatex } from '@/components/methodology/LatexRenderer';
import { renderLatex } from '@/components/methodology/renderLatex';

const WIDE = 'B_{\\text{FRA}} = 12 \\left(0.90\\min(A, b_1) + 0.32\\min(\\max(A - b_1, 0), b_2 - b_1)\\right)';

describe('LatexRenderer', () => {
  it('a display formula is a named, keyboard-focusable block', async () => {
    render(<DisplayLatex latex={WIDE} html={renderLatex(WIDE, false)} />);
    const block = screen.getByRole('img', { name: `Mathematical formula: ${WIDE}` });
    expect(block).toHaveAttribute('tabindex', '0');
    await userEvent.tab();
    expect(block).toHaveFocus();
  });

  it('the plain-text fallback block is focusable too', () => {
    const broken = 'x = \\bad{';
    render(<DisplayLatex latex={broken} html={null} />);
    const block = screen.getByRole('img', { name: `Mathematical formula: ${broken}` });
    expect(block).toHaveAttribute('tabindex', '0');
    expect(block).toHaveTextContent(broken);
  });

  it('an inline formula takes no tab stop', () => {
    render(<InlineLatex latex="r" html={renderLatex('r', true)} />);
    const inline = screen.getByRole('img', { name: 'Mathematical formula: r' });
    expect(inline).not.toHaveAttribute('tabindex');
  });
});
