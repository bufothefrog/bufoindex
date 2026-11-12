import React from 'react';
import { Type } from 'lucide-react';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

const HEADINGS = [
  { Tag: 'h1', className: 'text-4xl font-bold', text: 'Heading 1: page title' },
  { Tag: 'h2', className: 'text-3xl font-bold', text: 'Heading 2: section title' },
  { Tag: 'h3', className: 'text-2xl font-semibold', text: 'Heading 3: subsection' },
  { Tag: 'h4', className: 'text-xl font-semibold', text: 'Heading 4: card title' },
  { Tag: 'h5', className: 'text-lg font-medium', text: 'Heading 5: small section' },
  { Tag: 'h6', className: 'text-base font-medium', text: 'Heading 6: label' },
] as const;

const BODY = [
  { className: 'text-lg', text: 'Large body text for introductions.' },
  {
    className: 'text-base',
    text: "Regular body text for main content. Long explanations of a calculator's assumptions and methodology use this size so they stay comfortable on phones and wide screens.",
  },
  { className: 'text-sm', text: 'Small text for help, captions and secondary information.' },
  { className: 'text-xs', text: 'Extra small text for fine print and chart captions.' },
] as const;

const WEIGHTS = ['font-light', 'font-normal', 'font-medium', 'font-semibold', 'font-bold'] as const;

const TEXT_COLORS = [
  { className: 'text-foreground', text: 'Primary text' },
  { className: 'text-muted-foreground', text: 'Muted text' },
  { className: 'text-primary', text: 'Primary accent' },
  { className: 'text-destructive', text: 'Error or destructive' },
] as const;

export function TypographySection() {
  return (
    <DemoSection title="Typography" intro="Font sizes, weights and text colors; figures use the mono font with tabular numerals.">
      <DemoBlock title="Type scale" icon={Type}>
        <DemoEntry name="Headings">
          <div className="space-y-4">
            {HEADINGS.map(({ Tag, className, text }) => (
              <div key={Tag} className="space-y-1">
                <Tag className={className}>{text}</Tag>
                <Code>{className}</Code>
              </div>
            ))}
          </div>
        </DemoEntry>
        <DemoEntry name="Body text">
          <div className="space-y-4">
            {BODY.map(({ className, text }) => (
              <div key={className} className="space-y-1">
                <p className={className}>{text}</p>
                <Code>{className}</Code>
              </div>
            ))}
          </div>
        </DemoEntry>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <DemoEntry name="Weights">
            <div className="space-y-3">
              {WEIGHTS.map((weight) => (
                <div key={weight}>
                  <p className={`text-lg ${weight}`}>The quick brown fox</p>
                  <Code>{weight}</Code>
                </div>
              ))}
            </div>
          </DemoEntry>
          <DemoEntry name="Text colors and figures">
            <div className="space-y-3">
              {TEXT_COLORS.map(({ className, text }) => (
                <div key={className}>
                  <p className={className}>{text}</p>
                  <Code>{className}</Code>
                </div>
              ))}
              <div>
                <p className="font-mono text-lg tabular-nums">$1,234,567.89</p>
                <Code>font-mono tabular-nums</Code>
              </div>
            </div>
          </DemoEntry>
        </div>
      </DemoBlock>
    </DemoSection>
  );
}

export default TypographySection;
