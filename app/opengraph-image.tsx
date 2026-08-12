import { ImageResponse } from 'next/og';

// Hex values are used here intentionally: ImageResponse renders outside the
// Tailwind pipeline, so semantic tokens are unavailable. Colors mirror the
// sage brand scale defined in app/globals.css (sage-50 #f6f7f6, sage-300
// #9fb09f, sage-500 #5e8b4e) plus the dark ink ground #20261d.
export const alt = 'BufoIndex — personal-finance calculators that show their work';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#20261d',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div
            style={{
              width: '96px',
              height: '8px',
              backgroundColor: '#5e8b4e',
            }}
          />
          <div
            style={{
              fontSize: '112px',
              fontWeight: 700,
              color: '#f6f7f6',
              letterSpacing: '-0.02em',
            }}
          >
            BufoIndex
          </div>
          <div
            style={{
              fontSize: '40px',
              color: '#9fb09f',
            }}
          >
            Personal-finance calculators that show their work
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
