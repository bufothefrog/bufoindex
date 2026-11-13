'use client';

import dynamic from 'next/dynamic';

/**
 * ContinueProfileCard loaded in its own chunk on the client only. The card
 * renders nothing until the saved profile has hydrated, so the server markup
 * is the same either way, and the landing page does not download the profile
 * form and the calculation engines before it becomes interactive.
 */
const LazyContinueProfileCard = dynamic(() => import('./ContinueProfileCard'), { ssr: false });

export default LazyContinueProfileCard;
