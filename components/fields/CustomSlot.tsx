/**
 * Renders a CustomRenderer by id (a custom field's `renderer`, a list's
 * `rowAdornment` or `footer`). A missing id is a schema bug: it renders a
 * visible alert naming the id and the field instead of a silent blank.
 */

import React from 'react';
import { StatusAlert } from '@/components/calculators/shared/StatusAlert';
import type { CustomRendererProps, CustomRenderers } from './types';

export interface CustomSlotProps extends CustomRendererProps {
  rendererId: string | undefined;
  renderers?: CustomRenderers;
}

export function CustomSlot({ rendererId, renderers, ...props }: CustomSlotProps) {
  const Renderer = rendererId ? renderers?.[rendererId] : undefined;
  if (!Renderer) {
    return (
      <StatusAlert tone="negative" appearance="tinted" role="alert" title="Missing field renderer">
        {`No renderer "${rendererId ?? ''}" for the field "${props.spec.path}". Pass it in the renderers prop.`}
      </StatusAlert>
    );
  }
  return <Renderer {...props} />;
}

export default CustomSlot;
