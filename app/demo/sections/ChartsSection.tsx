'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { LineChart, MousePointer2 } from 'lucide-react';
import { ChartFrame, ChartTooltipCard, useChartTheme } from '@/components/ui/charts';
import { demoMedianPath } from '@/lib/demo/mockChartData';
import { COMPACT } from '@/lib/calculators/leverage/narrative';
import { formatCurrency } from '@/lib/format';
import { Code, DemoBlock, DemoEntry, DemoSection } from './DemoBlock';

function band(low: number, high: number): string {
  return `${formatCurrency(low, COMPACT)} to ${formatCurrency(high, COMPACT)}`;
}

// Loaded the way the leverage comparison loads it (audit H1).
const DcaPathChart = dynamic(() => import('@/app/tools/leverage-comparison/components/DcaPathChart'), { ssr: false });

export function ChartsSection() {
  const points = useMemo(() => demoMedianPath(), []);
  const year10 = points[120];
  const theme = useChartTheme();

  return (
    <DemoSection
      title="Charts"
      intro="Every chart is a Recharts element inside ChartFrame, colored by useChartTheme so it follows light and dark mode."
    >
      <DemoBlock title="ChartFrame" icon={LineChart}>
        <DemoEntry
          name="ChartFrame with a production chart"
          description={<>The leverage comparison&apos;s <Code>DcaPathChart</Code> on fixture data (lib/demo/mockChartData.ts). The frame reserves a fixed height (<Code>compact</Code>: h-72, h-96 from md), mounts the chart near the viewport with <Code>deferUntilVisible</Code>, and puts the caption below as the figure&apos;s name. Series spread <Code>CHART_SERIES_DEFAULTS</Code> (no animation).</>}
        >
          <ChartFrame
            deferUntilVisible
            modeNote="Nominal dollars"
            caption="Lines are the median balance; shaded bands span the 10th to 90th percentile. Fixture data: $500 a month for 20 years."
          >
            <DcaPathChart points={points} leverageRatio={2} />
          </ChartFrame>
        </DemoEntry>
      </DemoBlock>

      <DemoBlock title="ChartTooltipCard" icon={MousePointer2}>
        <DemoEntry name="ChartTooltipCard" description="The hover card every chart's Tooltip content renders: a title, then rows with a series color or a muted line.">
          <ChartTooltipCard
            className="max-w-xs"
            title="Year 10"
            rows={[
              { label: 'Index fund median', value: formatCurrency(year10.indexDca), color: theme.primary },
              { label: '10th to 90th', value: band(year10.indexDcaP10, year10.indexDcaP90), muted: true },
              { label: '2x fund median', value: formatCurrency(year10.leveragedDca), color: theme.warning },
              { label: '10th to 90th', value: band(year10.leveragedDcaP10, year10.leveragedDcaP90), muted: true },
            ]}
          />
        </DemoEntry>
      </DemoBlock>
    </DemoSection>
  );
}

export default ChartsSection;
