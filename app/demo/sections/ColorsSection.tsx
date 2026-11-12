import React from 'react';
import { Palette, Pipette, SwatchBook } from 'lucide-react';
import { TONES, TONE_BORDER, TONE_FILL, TONE_SURFACE, TONE_TEXT } from '@/lib/design-system/tone';
import { cn } from '@/lib/utils';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

/** Written out in full so Tailwind's source scan generates every class. */
const SAGE_SCALE = [
  { name: 'sage-50', className: 'bg-sage-50' },
  { name: 'sage-100', className: 'bg-sage-100' },
  { name: 'sage-200', className: 'bg-sage-200' },
  { name: 'sage-300', className: 'bg-sage-300' },
  { name: 'sage-400', className: 'bg-sage-400' },
  { name: 'sage-500', className: 'bg-sage-500' },
  { name: 'sage-600', className: 'bg-sage-600' },
  { name: 'sage-700', className: 'bg-sage-700' },
  { name: 'sage-800', className: 'bg-sage-800' },
  { name: 'sage-900', className: 'bg-sage-900' },
] as const;

const SEMANTIC = [
  { name: 'Background', className: 'bg-background text-foreground border border-border', use: 'Main background' },
  { name: 'Card', className: 'bg-card text-card-foreground border border-border', use: 'Card backgrounds' },
  { name: 'Primary', className: 'bg-primary text-primary-foreground', use: 'Primary actions' },
  { name: 'Secondary', className: 'bg-secondary text-secondary-foreground', use: 'Secondary elements' },
  { name: 'Muted', className: 'bg-muted text-muted-foreground', use: 'Subdued content' },
  { name: 'Accent', className: 'bg-accent text-accent-foreground', use: 'Accent highlights' },
  { name: 'Destructive', className: 'bg-destructive text-destructive-foreground', use: 'Error states' },
] as const;

export function ColorsSection() {
  return (
    <DemoSection title="Colors" intro="Semantic tokens from app/globals.css; no component hardcodes a color.">
      <DemoBlock title="Sage scale (brand)" icon={Palette}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SAGE_SCALE.map((swatch) => (
            <div key={swatch.name} className="space-y-1 text-center">
              <div className={cn('h-14 w-full rounded-md border border-border', swatch.className)} />
              <p className="font-mono text-xs">{swatch.name}</p>
            </div>
          ))}
        </div>
      </DemoBlock>

      <DemoBlock title="Semantic tokens" icon={SwatchBook}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {SEMANTIC.map((token) => (
            <div key={token.name} className="min-w-0 space-y-1">
              <div className={cn('rounded-md p-4', token.className)}>
                <div className="font-semibold">{token.name}</div>
                <div className="text-sm opacity-90">{token.use}</div>
              </div>
              <Code>{token.className}</Code>
            </div>
          ))}
        </div>
      </DemoBlock>

      <DemoBlock title="Tone scale" icon={Pipette}>
        <DemoEntry
          name="TONE_TEXT, TONE_SURFACE, TONE_BORDER, TONE_FILL"
          description={<>The one tone scale for results, alerts, tiles and progress (<Code>lib/design-system/tone.ts</Code>), each class with its dark-mode pair.</>}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {TONES.map((tone) => (
              <div key={tone} className={cn('flex items-center gap-3 rounded-lg border p-3', TONE_BORDER[tone], TONE_SURFACE[tone])}>
                <span className={cn('h-8 w-2 shrink-0 rounded-full', TONE_FILL[tone])} aria-hidden="true" />
                <span className={cn('font-mono text-sm font-medium', TONE_TEXT[tone])}>{tone}</span>
              </div>
            ))}
          </div>
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}

export default ColorsSection;
