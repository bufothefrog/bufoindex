# BufoIndex production audit: ranked assessment

Question from the owner: "are there optimizations we can make for production?"

Short answer: yes. Three items should land before a public launch (one critical framework advisory, one unused internet-facing endpoint, and a CI audit gate that cannot pass as written). After that, eight changes, mostly small, address every measured user-facing problem. The biggest are: lazy-load the charts (118 KiB gzip off the two heaviest calculators), stop the retirement charts re-animating on every keystroke, debounce the leverage simulation, and delete a 300 ms artificial delay in the paycheck allocator. The landing page is already in good shape (Lighthouse mobile 97, desktop 100).

## Scope and sources

- Build audited: Next 16.3.0 (Turbopack) build `rlT1xLw3ktzvTxwxONCWP`, built from commit `0e8f421`. HEAD has since moved to `f857f82`, which only adds `docs/rebuild-plan.md` (+1,193 lines, no app code). See Caveats.
- Five analyzer reports are synthesized here. Each claim cites its source:
  - (bundle) build output and chunk attribution
  - (runtime) Playwright on a throttled phone profile: 4x CPU, 150 ms RTT, 200,000 B/s down, 390x844, median of 3 fresh-context runs
  - (lh) Lighthouse 13.5 mobile (simulated 4x CPU, 1.6 Mbps, 150 ms RTT) and desktop, plus axe and an Event Timing INP proxy
  - (config) rendering modes, headers, next.config, npm audit, stores
  - (code) Node microbenchmarks and a browser harness built from the real components (rolldown, production React)
- Labels: [M] measured, [E] estimate, [I] inference. "KiB" means 1024 bytes (the bundle analyzer's "KB"). The lh and runtime reports quote transfer sizes in KB, so the same chunk reads as 118.0 KiB in one and 120.8 to 121.3 KB in another. That is the same file, not a disagreement.
- A few load-bearing references were re-checked against the repo by the synthesizer, read-only: `package.json:52,74`, lockfile `next` 16.3.0 / `sharp` 0.35.3, `next.config.js:1-9`, `lib/store/calculatorStore.ts:155-156`, `LeverageComparison.tsx:33-37`, `ResultsSection.tsx:17-18`, `retirement.ts:12-13`, `app/start/page.tsx:22-25`, `app/globals.css:4,119,144`, absence of `isAnimationActive` in the retirement charts, and the build log route table.

## 1. The ten numbers that matter

| # | Measure | Value | Source |
|---|---|---|---|
| 1 | Landing `/` first-load JS | 184.6 KiB gzip (199.5 KiB with CSS); floor for any page is 150.7 KiB gzip JS | (bundle) [M] |
| 2 | Heaviest production routes, first-load JS | retirement 334.9 KiB gzip, leverage 331.2 KiB gzip (/demo is 356.6 but unlinked); the Recharts chunk alone is 118.0 KiB gzip | (bundle) [M] |
| 3 | Landing on the throttled phone | FCP = LCP 964 ms, TBT 231 ms, CTA hydrated at 2,095 ms | (runtime) [M] |
| 4 | Retirement results on the throttled phone | cold deep link: LCP 3,612 ms, TBT 1,135 ms, max task 767 ms; guided Finish -> numbers 2,014 ms, then a 751 to 825 ms chart task | (runtime) [M] |
| 5 | Lighthouse mobile performance | / 97, /tools 97, /start 97, retirement 93 (89 to 90 in 5 more runs), leverage 80, overview 95, methodology 92; a11y 95 on all four calculators; Best Practices 100 everywhere; desktop / 100 | (lh) [M] |
| 6 | Leverage keystroke cost | one 102 to 198 ms long task per digit (4x phone); a 4-key burst runs 4 simulations, 549 ms of long tasks; slowest interaction 184 ms (20 y) and 528 ms (60 y) at 4x desktop | (runtime), (code) [M] |
| 7 | Dashboard (/overview) main-thread stall | 328 ms hydration-render task at 4x (79 ms simulation + 74 ms number formatting), cold TBT 461 ms | (runtime) [M]; (code) 294 to 317 ms |
| 8 | Paycheck "Calculate" interaction | 376 to 392 ms at 1x and 552 to 648 ms at 4x; 80 to 96 ms at 1x once the 300 ms artificial delay is removed | (lh) [M] |
| 9 | Dynamic routes | 1 of 18 route entries (`/start`, f); its function trace is 235 files / 34.75 MB including 29.19 MB of sharp; every other page is prerendered | (config), build log [M] |
| 10 | Security advisories | `next` 16.3.0 is in a critical range (fixed in 16.3.8); production dependency tree: 3 advisories (1 critical, 2 high); full tree: 17 | (config) [M] |

## 2. Must do before launch

### M1. Upgrade `next` to 16.3.8 or later and commit the regenerated lockfile
- **Why:**
  - [M] (config) `npm audit` puts `next` 16.3.0 in the critical range 16.0.0 to 16.3.7. Among the advisories:
    - GHSA-cjq9-62q9-8jv4: Image Optimization SSRF (high, <16.3.8)
    - GHSA-2xp9-vwfh-vxw4: AVIF RCE (<16.3.3)
    - GHSA-4jqv and GHSA-mcj8: SSG/ISR cache poisoning, relevant in principle to the 21 prerendered pages
    - GHSA-vcvr-r3jv-pc5j: next/og. Low practical exposure, because the OG image is static.
  - [M] The production tree has 3 advisories: next, sharp 0.35.3 and source-map-js 1.2.1.
  - [M] Lockfile drift: `node_modules` has sharp 0.35.5 and undici 8.11.2, but `package-lock.json` pins 0.35.3 and 8.10.0. CI (`npm ci`, `.github/workflows/test.yml:101`) and Vercel install from the lockfile, so the build that gets deployed is not the one audited locally.
- **Where:** `package.json:52` (`"next": "^16.2.4"`), `package.json:74` (`"eslint-config-next": "^16.2.6"`), `package-lock.json`.
- **Effort:** small.
- **Effect:** clears the critical advisory and both high production advisories, and removes the lockfile drift [M, per the fixed ranges]. Risk is low: these are patch releases in the same minor. Run CI and the Playwright smoke afterwards, then rebuild, because chunk hashes and sizes will shift.

### M2. Turn off the unused image optimizer: `images: { unoptimized: true }`
- **Why:**
  - [M] (config) The app has no `next/image` import and no `public/` directory, yet `/_next/image` is live. `.next/images-manifest.json` shows `unoptimized: false`, `localPatterns: [{pathname:'**'}]` and `formats: ['image/webp']`.
  - Two of the advisories in M1 target exactly this endpoint.
- **Where:** `next.config.js:1-9`.
- **Effort:** small.
- **Effect:** self-hosted, the handler returns 404 (`next/dist/server/next-server.js:198-200`) [M]. On Vercel the optimizer route should not be provisioned [I]. No risk, since nothing uses `next/image`.

### M3. Make the CI audit gate passable and meaningful (owner decision)
- **Why:**
  - [M] (config) `npm audit --audit-level=high` (`test.yml:103-104`) fails today, and it will keep failing after M1. `braces` (through `@next/eslint-plugin-next`) is flagged at range `*` with no patched version, and the only "fix" offered for the eslint chain is a semver-major downgrade to `eslint-config-next@14.2.35`.
  - `docs/rebuild-plan.md:21` lists this same audit as a gate every refactor slice must pass, so as written every slice will be red.
  - A gate that is always red stops warning about new production advisories.
- **Where:** `.github/workflows/test.yml:103-104`.
- **Effort:** small.
- **Effect:** use `npm audit --omit=dev --audit-level=high`, which audits the production tree (clean after M1 [I, from the advisory ranges]), or keep the full audit with an allowlist for the dev-only chain. CLAUDE.md asks for discussion before changing gates, so the owner decides which.

## 3. High impact (measured user-facing wins), ranked

### H1. Lazy-load the charts and mount them near the viewport
- **Why:**
  - [M] (bundle) The Recharts chunk `3spasciyk8uka.js` is 424.2 KiB raw / 118.0 KiB gzip, the largest chunk in the app. It is on the critical path of retirement and leverage, and Lighthouse rates 77 to 78% of it unused on load (lh).
  - [M] (runtime) It is 85% of the JS fetched between Finish and numbers in the retirement flow (121.3 of 146.9 KB).
  - [M] (runtime) Its render is the biggest single task on the site:
    - 751 to 825 ms right after the numbers appear in the guided flow
    - 696 to 969 ms on a cold deep link
    - 538 to 675 ms on a leverage load
    - 384 to 671 ms when switching to the Results tab
  - [M] (runtime) On a 390x844 phone the retirement charts start at y = 1,375 and 1,903 px, below the fold.
  - [M, upper bound] (lh) With the chunk blocked, retirement goes from perf 89 to 98, LCP 3,402 to 2,319 ms and TBT 168 to 89 ms. Blocking also broke hydration, so the real gain will be smaller.
- **Where:**
  - `app/tools/retirement-calculator/components/ResultsSection.tsx:17-18` (used at :161 and :175)
  - `app/tools/leverage-comparison/components/LeverageResults.tsx:13` (used at :184)
  - Use `next/dynamic(..., { ssr: false, loading: <fixed-height placeholder> })`, plus an IntersectionObserver mount with about one viewport of margin. The charts are already client-only: the prerendered HTML has 0 `recharts-wrapper` nodes, and ResultsSection returns early without results at :48 (bundle).
- **Effort:** small to medium.
- **Effect:**
  - [E] (bundle) First-load JS: retirement 334.9 -> ~217 KiB gzip (-35%), leverage 331.2 -> ~213 KiB gzip (-36%).
  - [E] (runtime) Finish -> numbers ~2.0 s -> ~1.2 to 1.4 s. Cold retirement TBT 1,135 -> ~350 ms; leverage 1,124 -> ~550 ms.
  - It also removes ~118 KiB from the /tools viewport prefetch (lh).
  - The leverage chart starts at 797 px, inside the first viewport, so on that page the gain comes from loading the chunk off the critical path, not from deferring the mount [I].
  - Risk is low. Reserve the height (`h-96` for retirement, the existing height for leverage) to avoid layout shift.
  - The viewport mount also stops the Recharts `width(0)` warning, which fires twice per keystroke on the hidden mobile Inputs tab in the harness (code).

### H2. Retirement charts: turn off animation and stop re-rendering them on every keystroke
- **Why:**
  - [M] (code, harness) With animation off, main-thread time per results update falls from 397 to 65 ms at 1x and from 1,630 to 249 ms at 4x. Over a real typing session it falls from 1,026 to 318 ms (1x) and from 3,967 to 1,978 ms (4x).
  - Verified: neither `MonteCarloChart` nor `SavingsRateChart` sets `isAnimationActive`, so both use Recharts' default JS animation (about 1.5 s per data change). `DcaPathChart` already sets it to false (:153, 163, 172, 181).
  - `SavingsRateChart` memoizes its data on the whole `inputs` object (:134), and `ResultsSection` subscribes to live inputs (:42-43). So every keystroke rebuilds the chart data and restarts the animation.
  - Even with animation off, the slowest desktop keystroke is 440 to 528 ms at 4x, and Recharts is 61% of keystroke JS (code).
- **Where:**
  - `MonteCarloChart.tsx:180,192` and `SavingsRateChart.tsx:187,197`: add `isAnimationActive={false}`.
  - `SavingsRateChart.tsx:134`: memoize on the five fields it actually reads.
  - `ResultsSection.tsx:42-43`: render from the inputs snapshot that produced the results. This also fixes stale results being shown next to new inputs.
  - `RetirementCalculator.tsx:13-21`: replace the whole-store subscription with `useShallow` or individual selectors.
- **Effort:** small for the flags and memo deps; medium for the inputs snapshot.
- **Effect:** measured in the harness as above. The harness uses the same component code but a different bundler, so the absolute numbers will differ in the Turbopack build while the relative gain should hold [I]. Risk is low: only the tween is lost.

### H3. Leverage calculator: debounce the simulation and memoize the chart
- **Why:**
  - [M] (runtime, 4x phone) Every digit costs one 102 to 198 ms long task. A 4-key burst runs 4 simulations (549 ms of long tasks, TBT 349 ms). The keystroke task is almost all calculation: 118 ms simulation, 42 ms random numbers and 11 ms GC out of 179 ms.
  - [M] (code, 8-key burst, 4x desktop, 20 y) A 250 ms debounce plus `React.memo` on the chart cuts main-thread time from 2,173 to 626 ms, long tasks from 17 to 2, and the slowest interaction from 184 to 56 ms. At 60 y the slowest interaction goes from 528 to 56 ms.
  - `useDeferredValue` (`LeverageComparison.tsx:36`) cannot yield inside a single `useMemo`. The comment at :34-35 ("tens of ms") holds only at 1x on desktop.
- **Where:** `app/tools/leverage-comparison/components/LeverageComparison.tsx:36-37`; `LeverageResults.tsx:184` (memoize `DcaPathChart`).
- **Effort:** small.
- **Effect:**
  - Measured in the harness as above. Results stay identical: same seed, 500 paths.
  - Use a debounce of 250 to 300 ms. The runtime burst had keys 140 to 230 ms apart, so the 150 ms leverage debounce in `docs/rebuild-plan.md:336` would still run a simulation between most keys [I, from the measured key spacing].
  - Optional medium follow-up: move `simulateDcaComparison` to a worker. That takes 147 ms (20 y) and 394 ms (60 y) per run at 4x off the main thread [E, from measured parts] (code).
  - Do not adopt the 100-path preview. It shows noisier numbers, and in the harness it was worse than the debounce: 1,757 vs 626 ms at 4x desktop, 20 y (code).

### H4. Delete the 300 ms artificial delay in the paycheck store
- **Why:**
  - [M] (lh, Event Timing INP proxy) Paycheck "Calculate" takes 376 to 392 ms at 1x and 552 to 648 ms at 4x.
  - Patching only this `setTimeout` to 0 brings it to 80 to 96 ms at 1x and 392 to 408 ms at 4x.
  - Verified at `lib/store/calculatorStore.ts:155-156` ("Add a small delay to show loading state").
- **Where:** `lib/store/calculatorStore.ts:155-156`.
- **Effort:** small (one line).
- **Effect:**
  - About 300 ms off every Calculate [M].
  - The remaining cost at 4x is a 200 to 280 ms results render (lh). Rendering the results in a transition and replacing the whole-store subscriptions (`PaycheckAllocator.tsx:19`, `components/paycheck-allocator/InputSection.tsx:25`) (code) would cut that further.
  - Risk is low; check whether any store test assumes the delay [I].
  - Slice s1 of the rebuild plan already removes this delay (`docs/rebuild-plan.md:336`). Ship it now if s1 is not imminent.

### H5. Pre-warm the retirement worker
- **Why:**
  - [M] (runtime) A cold worker takes 433 to 470 ms from post to reply; a warm one takes 10 to 20 ms.
  - The worker is created 1.4 to 1.7 s after Finish.
  - Startup is three sequential fetches of ~160 to 180 ms each at a 150 ms round trip: `turbopack-worker-2gqdcwp7k90ea.js`, then `turbopack-301px-wcmmsfq.js`, then `256xy7-b8arqy.js`.
- **Where:**
  - `lib/store/retirementStore.ts:55-63` creates the worker lazily (`getRetirementWorker`). Call it from `requestIdleCallback` when `/start/retirement` mounts (`components/guided/Wizard.tsx`, `flow === 'retirement'`) and when the retirement page mounts.
  - Keep the four in-thread fallbacks (:55-58, :62-69, :86-99, :118-126) (config).
- **Effort:** small.
- **Effect:** ~400 ms off Finish -> numbers on the throttled profile, and it stacks with H1 [E] (runtime). Risk is low.

### H6. Server-render the leverage calculator
- **Why:**
  - [M] (lh) Leverage has the lowest Lighthouse performance on the site: 80 [80 to 85], LCP 3.44 s, TBT 447 ms, CLS 0.058, max-potential-FID 410 ms.
  - [M] (config) The prerendered HTML has 131 characters of visible text ("Loading the simulation...") against 1,739 on retirement, even though the page is in the sitemap.
  - The cause is that `<Suspense>` plus `useSearchParams` make the whole calculator client-only (`app/tools/leverage-comparison/page.tsx:27-29`; `LeverageComparison.tsx:22,25-27,32`) (lh).
  - [M] (lh) At 4x CPU without network throttling, leverage LCP is 968 to 1,128 ms against an FCP of 116 to 140 ms. On the other pages LCP equals FCP.
  - [M] (runtime) Cold leverage: LCP 3,060 ms, TBT 1,124 ms.
- **Where:**
  - `app/tools/leverage-comparison/page.tsx:24-30` and `LeverageComparison.tsx:22-37`.
  - Render the default inputs on the server, apply `?c=&y=&b=&l=` after mount, move `defaultMobileTab` into an effect, and keep the simulation out of hydration.
- **Effort:** medium.
- **Effect:** [E] (lh) CLS 0.058 -> ~0, LCP render delay ~270 ms shorter (~850 ms at 4x CPU), performance 80-85 -> ~90. Crawlers also get real HTML (config). Risk is medium: possible hydration mismatch, and shared links briefly show the defaults before the query values. Slice c7 of the rebuild plan removes this Suspense once `useSearchParams` goes (`docs/rebuild-plan.md:961`).

### H7. Lighten the /overview first render
- **Why:**
  - [M] (runtime) A cold /overview with a full profile has TBT 461 ms and a 328 ms hydration-render task at 4x. That task breaks down into:
    - `simulateDcaComparison` (300 paths, LeverageCard): 79 ms
    - `formatCurrency`, which constructs a new `Intl.NumberFormat` on every call (`lib/calculations/core.ts:385`): 74 ms
    - random number generation: 19 ms
    - React: 69 ms
  - A separate 69 to 100 ms `summarizeRetirement` task follows.
  - [M] (code) The synchronous first render is 294 to 317 ms at 4x.
  - `LeverageCard` simulates synchronously in `useMemo` during the first render (`LeverageCard.tsx:31-44`), while `RetirementOddsCard` already defers its work (`:37-49`).
  - [M] Constructing an `Intl.NumberFormat` costs 25.7 to 33 us per call against 0.4 to 0.6 us for a cached one (code, runtime).
- **Where:**
  - `components/dashboard/LeverageCard.tsx:21,31-44`: defer with the same rAF + setTimeout pattern the retirement card uses.
  - `lib/calculations/leverageComparison.ts:190-193,272-296`: an `includePath: false` option that skips the per-month bands the card never shows.
  - `lib/calculations/core.ts:385-402` and `lib/utils/index.ts:24-43`: create the formatters once at module scope.
- **Effort:** small for the defer and the formatter cache; small to medium for the engine option.
- **Effect:**
  - [M] (code) The no-path engine variant takes 115 -> 52 ms in the browser at 4x.
  - [E] (code) First render ~300 -> ~170 ms at 4x.
  - [E] (runtime) Caching formatters takes off ~70 ms more. It also helps elsewhere: ~40 ms off the leverage first render and ~4 ms per leverage keystroke.
  - Risk is very low for the formatters (same output) and low for the defer.
  - Optional medium follow-up: run both dashboard computations in the worker. Measured main-thread cost is 39 / 114 ms (4x, warm / cold), which would drop to ~6 ms, at the price of ~32.7 KB gzip of worker chunks on the first /overview visit (code).
  - The engine option touches `leverageComparison.ts`, which the rebuild plan keeps behaviour-frozen (`docs/rebuild-plan.md:15-18`). An additive option that defaults to today's behaviour needs owner sign-off.

### H8. Render KaTeX on the server for the methodology page
- **Why:**
  - [M] (bundle, lh) The KaTeX chunk `13pgbvyv8v36u.js` is 275.0 KiB raw / 78.9 KiB gzip, and all of it sits on the critical path.
  - `LatexRenderer` renders in `useEffect` (`components/methodology/LatexRenderer.tsx:9,35`) on a fully static page. The prerendered HTML has 0 `class="katex"` nodes, and the final DOM has 4,122 elements.
  - [M] (runtime) TBT 1,145 ms with 11 long tasks.
  - [M] (lh) Perf 92 and TBT 177 ms (simulated). TTI 4.0 s, render-blocking 580 ms, and mainthread-work-breakdown fails at 2.1 s, of which Style & Layout is 745 ms.
- **Where:** `components/methodology/LatexRenderer.tsx:9,27-35` and `app/tools/retirement-calculator/methodology/page.tsx`. Call `katex.renderToString` in a server component, keep the CSS, pass the macros, and keep `trust: false`.
- **Effort:** medium. A cheaper partial fix is small: `await import('katex')` inside the effect.
- **Effect:**
  - [E] (bundle) JS 230.2 -> ~158 KiB gzip. After adding ~7.8 KiB gzip of server-rendered KaTeX HTML, the net is about -55 to -65 KiB gzip.
  - [E] (lh) TBT ~100 ms, TTI ~3 s.
  - The KaTeX fonts (10 files, 160.8 KB) still load.
  - Risk is low to medium: hydration mismatch if the macros differ.

## 4. Worth doing (smaller or operational)

### W1. Make `/start` static
- **Why:**
  - [M] (config, build log) `/start` is the only dynamic route, solely because of `await searchParams` (`app/start/page.tsx:22-25`, verified).
  - It is served `private, no-cache, no-store`, and its function trace is 235 files / 34.75 MB.
  - The landing page links to it 5 times: the main CTA plus four `?next=` links.
  - Local TTFB is 23 ms against 11 ms for static pages (lh).
- **Where:** `app/start/page.tsx:20-25`. Read `useSearchParams` in a small client child inside `<Suspense fallback={<Wizard flow="core" />}>`. The repo already uses this pattern at `app/tools/leverage-comparison/page.tsx:24-30`. Do not use `dynamic = 'force-static'`: it silently drops `?next` (config).
- **Effort:** small (~20 lines).
- **Effect:** [I] the deployment has zero server functions, `/start` is served from the CDN with no cold start, and the landing CTA can prefetch it fully. The only visible change is that the "After this: X." hint (`Wizard.tsx:143`) appears at hydration. Risk is low.

### W2. Baseline security headers, `poweredByHeader: false`, and CSP in Report-Only first
- **Why:**
  - [M] (config, lh) No security headers are set: `vercel.json:1-22` and `next.config.js:1-9` define none, and `routes-manifest.json` has `"headers": []`. Responses carry `X-Powered-By: Next.js`.
  - Facts that shape the CSP (config):
    - Each page has 3 inline scripts, including a per-page RSC flight payload. A hash-only CSP is therefore impossible, and nonces would force dynamic rendering.
    - `style=""` attributes need `style-src 'unsafe-inline'`.
    - The forms plugin needs `img-src data:`.
    - There are no third parties or fetches, and the worker is same-origin.
    - Web Share and the clipboard are used (`RetirementCalculator.tsx:36`, `LeverageComparison.tsx:62`).
- **Where:** an `async headers()` block in `next.config.js`, as drafted in the config report section 2:
  - HSTS without preload, nosniff, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `COOP: same-origin`, and a Permissions-Policy that leaves `web-share` and `clipboard-write` enabled.
  - CSP as Report-Only on previews, then enforced with `'unsafe-inline'` for script and style. Never combine a hash or nonce with `'unsafe-inline'`.
- **Effort:** small for the baseline. Medium for the enforced CSP: run a Playwright `securitypolicyviolation` sweep of all routes first.
- **Effect:** no score change (lh); defense in depth. Risk is low for the baseline and medium for an enforced CSP. The config analyzer rated the baseline headers must-do. I placed them here because the site has no auth, cookies, iframes or third parties, and none of the must-do criteria (advisory, exposed API, phone breakage) applies.

### W3. Keep production errors visible
- **Why:** [M] (config)
  - `compiler.removeConsole` (`next.config.js:4-6`) strips every app console call, including `error` and `warn`. That covers 16 call sites; none of the 5 sampled messages remains in `.next/static/chunks`.
  - `app/error.tsx:11` discards the error, there is no `global-error.tsx`, and there is no instrumentation.
- **Where:**
  - `next.config.js:5`: `removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false`
  - `app/error.tsx`: log the error in an effect
  - add `app/global-error.tsx`
- **Effort:** small.
- **Effect:** calculation, URL-hash and KaTeX failures become diagnosable. The size cost is negligible (bundle). No risk.

### W4. Field measurement (owner decision because of the privacy copy)
- **Why:**
  - [M] (config) There is no real-user monitoring: no `@vercel/*`, no `useReportWebVitals`, no Sentry.
  - [M] (lh section 2) The lab LCP mostly measures how long the initial JS takes to download (a Lantern artifact). The field effect of H1 to H8 can only be confirmed with field data.
  - The copy promises "Nothing uploaded" (`app/page.tsx:27-30`, `app/tools/page.tsx:8`).
- **Where:**
  - `app/layout.tsx`: `<SpeedInsights/>` (~2 KB gzip [E]), and optionally `<Analytics/>`.
  - `beforeSend` must strip `search` and `hash`. The leverage query string `?c=&y=&b=&l=` carries the user's contribution, years, balance and leverage.
  - Update the privacy copy in the same change.
- **Effort:** small to medium.
- **Effect:** real Core Web Vitals per route. Both scripts are same-origin, so the proposed CSP already allows them. The risk is the privacy promise, so this is the owner's call.

### W5. Keep the calculation engines and the formula registry out of the landing and intake routes
- **Why:**
  - [M] (bundle) `/` and every intake page load two engines they don't use, ~22.7 KiB gzip together:
    - the retirement Monte Carlo engine plus the formula registry (`0o63sbmhdrwu3.js`, 44.5 KiB raw / 14.8 KiB gzip)
    - the paycheck engine module (24.2 KiB raw / 7.9 KiB gzip)
  - The import chain is `app/page.tsx:4` -> `ContinueProfileCard` -> `lib/constants/intake.ts:25` and `lib/profile/mappers.ts:8-13` -> `core.ts:7-19`, plus the side-effect import at `retirement.ts:12-13` (verified).
  - The formula array alone costs 8.2 KiB gzip [M] on 15 routes and in the worker. Registering the formulas costs ~9 ms of self time per load at 4x (runtime).
  - Analyzers disagree on the payoff. Lighthouse blocked both engine chunks on `/` and saw LCP 2,580 -> 2,523 ms with perf unchanged at 97. The next funnel step (`/start`) needs `intake.ts` anyway. So this saves bytes and parse time rather than a headline metric, which is why it sits here and not in High impact.
- **Where:**
  - (R2) delete `lib/calculations/retirement.ts:12-13`. `methodology/page.tsx:8` and `test/lib/formulas/registry.test.ts:21` already import the registry themselves.
  - (R3) move `annualizeIncome`, `INCOME_PERIOD_MULTIPLIERS`, `IncomePeriod`, `formatCurrency`, `getDefaultProfile` and `updateLegacyIncomeFields` into small standalone modules and keep re-exports at the old paths (`mappers.ts:8-13`, `intake.ts:25`, `core.ts:44,206,385`).
- **Effort:** small (R2); medium (R3).
- **Effect:** [E] (bundle, together with W6) `/` 184.6 -> ~162 KiB gzip (-12%), `/start/[intent]` 207.0 -> ~176 (-15%). Risk is low to medium; rebuild to confirm the chunks actually move. Edits to `retirement.ts` need owner sign-off under `docs/rebuild-plan.md:15-18`, although slice f1 already changes one import line there (`:630`).

### W6. Trim the intake-route chunks: Radix Slider and `isCoreReady`
- **Why:**
  - [M] (bundle) The Radix Slider module (23.2 KiB raw / 7.9 KiB gzip) ships through `PercentInput.tsx:8` on 8 intake routes plus portfolio and leverage. Only retirement's `InputSection` (`:486-546`) and paycheck's `BenefitsInputCard` actually render sliders.
  - [M] `/start/choose` loads the whole Wizard and all input components (`0hpacy` plus `0q5_26`: 72.1 KiB raw / 23.8 KiB gzip). The only reason is that `LearnChooser.tsx:21` imports `isCoreReady` from `Wizard.tsx:80-84`.
  - code-hotspots guessed "a few KB at most", counting only `0hpacy`. The bundle analyzer measured both chunks, so I use its figure.
  - In the normal funnel, `/start/choose` is reached by client navigation from `/start` (447 ms, 25.1 KB transfer, runtime). Those chunks are already loaded by then, so the saving applies only to direct loads.
- **Where:**
  - `components/ui/inputs/PercentInput.tsx:8,244-259`: split out a `PercentSliderInput`.
  - `components/guided/Wizard.tsx:65-84`: move `isCoreReady` and `coreFinishedAt` into a small module; update `LearnChooser.tsx:21`.
- **Effort:** small.
- **Effect:** -7.9 KiB gzip on those routes [M]. Up to -23.8 KiB gzip on direct `/start/choose` loads [M chunk sizes; I that nothing else pulls the chunks in]. Risk is low.

### W7. Accessibility fixes (contrast tokens, heading order, landmarks)
- **Why:** [M] (lh, axe) A11y scores are 95 on all four calculators, 96 on methodology, 98 on overview and 88 on /demo. The failures:
  - **Light theme contrast:**
    - inactive mobile Results tab, #64748b on #f1f5f9 = 4.34:1 (`CalculatorLayout.tsx:354` on `:215`)
    - selected OptionCard, 4.43:1
    - `TaxInputCard.tsx:51-52`, 3.26:1
    - 30 methodology nodes, down to 1.84:1 (`FormulaCategory.tsx:32-35,106`; `FormulaDisplay.tsx:163`)
  - **Dark theme contrast:** `text-primary` is #45693a on #1a1a1a = 2.76:1 (`PercentageSlider.tsx:53,86`), and 11 methodology nodes are 2.43 to 2.80:1, because dark `--primary` is not redefined (`globals.css:144`).
  - **Heading order** fails on 5 pages, because `components/ui/card.tsx:31` hard-codes `<h3>`.
  - **Missing landmark:** the UtilityBar sits outside any landmark (`app/layout.tsx:48-50`), flagged on 8 of 9 pages.
  - **KaTeX:** 6 serious scrollable-region nodes (`LatexRenderer.tsx:65-73`), and a literal `undefined` class at `LatexRenderer.tsx:99`.
- **Where:**
  - `app/globals.css:119`: change `--muted-foreground` lightness from 46.9% to ~43% (computed 5.01:1 on muted, 5.49:1 on white).
  - Add text-safe status tokens and a dark-mode primary text token in `globals.css`.
  - Add a heading-level prop to `CardTitle` / `BaseCard.tsx:102`.
  - Wrap the UtilityBar in `<header>`.
  - Add `tabIndex={0}` to the KaTeX scroll containers.
- **Effort:** small; small to medium for the status tokens and heading levels.
- **Effect:** [E] (lh) +3 to 5 a11y points on the calculators, methodology 96 -> 100, and the 14 dark-mode contrast failures cleared. Risk is low. Stays within the CLAUDE.md semantic-token rule.

### W8. Size the loading skeletons (CLS)
- **Why:**
  - [M] (lh) CLS is 0.051 on /overview: `OverviewSkeleton.tsx:9-17` shows 4 stacked cards, but the empty state that replaces it is shorter.
  - It is 0.034 to 0.035 on /start, /start/review and `/start?next=*`: `Wizard.tsx:117-126` is ~224 px, shorter than the first screen.
  - All values are under the 0.1 "good" threshold.
  - [M] (runtime) /start, /start/choose and /overview reach LCP only after the persisted store hydrates (2.36 to 2.58 s against an FCP of ~0.9 s).
- **Where:**
  - `components/dashboard/OverviewSkeleton.tsx:9-17` and `components/guided/Wizard.tsx:117-126`.
  - Optional: server-render the first basics screen (runtime). That is medium effort and medium risk, and low priority because the funnel arrives by client navigation.
- **Effort:** small.
- **Effect:** [E] CLS -> ~0, Lighthouse perf +1 to 2. Risk is low.

### W9. A/B test inlined CSS
- **Why:** [M] (runtime) FCP is ~0.9 s on every page. It waits on one render-blocking stylesheet (`3zjtd0jbnxx74.css`, 94.9 KiB raw / 14.9 KiB gzip), which finishes at 737 to 762 ms while the HTML is done at ~197 ms. Lighthouse puts render-blocking at 280 to 350 ms on mobile pages and 580 ms on methodology.
- **Where:** `next.config.js`, `experimental.inlineCss: true`. The flag exists in 16.3.0 and defaults to false (lh, config).
- **Effort:** small, but it needs a rebuild and a preview A/B.
- **Effect:**
  - [E] FCP -280 to -350 ms (lh), or ~900 -> ~450 to 550 ms (runtime).
  - Cost: ~15 KiB gzip more on every HTML response, and no cross-page CSS cache for returning visitors.
  - Risk is medium: it is an experimental flag, and the dark-mode init script must still run before first paint. Do W10 first so less CSS gets inlined.

### W10. CSS hygiene: drop the typography plugin and stop Tailwind scanning docs
- **Why:**
  - [M] (bundle) The `.prose` ruleset adds 13.6 KiB raw / 1.8 KiB gzip of CSS to every route.
  - It exists only because Tailwind's scanner picks up the word "prose" in a comment at `components/paycheck-allocator/QuickActions.tsx:31`. No element uses a `prose` class.
  - Tailwind also scans docs and tests: `bg-blue-500` and `text-gray-600` are the "Wrong" examples in CLAUDE.md. HEAD now adds `docs/rebuild-plan.md`, which will be scanned too [I].
- **Where:**
  - `app/globals.css:4`: remove `@plugin '@tailwindcss/typography'` and drop the dependency. That also removes one dev-advisory path, `postcss-selector-parser` (config).
  - `app/globals.css:1`: add `@source not` for docs and tests.
- **Effort:** small.
- **Effect:** -1.8 KiB gzip of CSS on every route [M]. Very low risk.

### W11. Mark `/demo` noindex
- **Why:** [M] (bundle, config, lh)
  - /demo is the heaviest route: 356.6 KiB gzip JS (371.5 KiB total) and 22.1 KiB gzip of HTML.
  - It scores perf 89 and a11y 88.
  - It is not in the sitemap and nothing links to it, but it has no robots meta tag while `robots.txt` says `Allow: /`.
  - It does not leak code into shared chunks (bundle).
- **Where:** `app/demo/page.tsx:4-8`: add `robots: { index: false, follow: false }`. Gating it behind an environment variable is the owner's call, since CLAUDE.md calls /demo public.
- **Effort:** small.
- **Effect:** keeps the heaviest and least accessible page out of search results. No risk.

### W12. Version the persisted paycheck state
- **Why:**
  - [M] (config) The `paycheck-allocator-storage` store (`calculatorStore.ts:262-270`) has no `version` and no `migrate`.
  - persist does a shallow merge. A future change to the `PaycheckProfile` shape would restore stale nested objects with missing fields for returning users [I: risk of runtime errors].
  - `profileStore.ts:107-111` already does this correctly.
- **Where:** `lib/store/calculatorStore.ts:262-270`: add `version: 1` and a `merge` that deep-merges with `getDefaultProfile()`.
- **Effort:** small to medium.
- **Effect:** returning users survive future shape changes. Risk is low. If the refactor's one-time legacy import (slice s1) lands first, it covers this.

### W13. Leverage engine: compute bands only at the plotted months, and use quickselect
- **Why:**
  - [M] (code) The per-month percentile bands take ~47% of engine time at the defaults: 12.8 ms at 500 paths x 20 y, 37.9 ms at 60 y. The 482 sorts alone take 11.1 ms.
  - Each run allocates 1.93 MB (20 y) or 5.77 MB (60 y).
  - Computing bands only at the months the chart plots, with quickselect instead of a full sort, cuts engine time by 26% (20 y) and 43% (60 y) with exact output [M]. Memory at 60 y drops to ~1 MB [E].
- **Where:**
  - `lib/calculations/leverageComparison.ts:170,272-296`: an option that defaults to today's behaviour; quickselect at :279 and :285.
  - If the default changes, update the tests at `test/lib/calculations/leverageComparison.test.ts:184-187,220,268,289-291,312`.
- **Effort:** medium.
- **Effect:** as measured. Risk is low to medium. Needs owner sign-off under `docs/rebuild-plan.md:15-18`, and matters less once H3 lands.

### W14. Avoid the late Greek font download on the leverage page
- **Why:** [M] (runtime) The leverage page downloads the Inter Greek subset (19.3 KB) at ~3.08 s and then swaps fonts. The only trigger is the "sigma" character at `LeverageResults.tsx:283`.
- **Where:** `app/tools/leverage-comparison/components/LeverageResults.tsx:283`: spell it out, or render it in a non-Inter font.
- **Effort:** small.
- **Effect:** -19.3 KB and one fewer late font swap on leverage [M]. The risk is a small copy change.

### W15. Small production hygiene
- **Recharts devtools.** Recharts 3.10.1 enables its Redux DevTools hook in production (`node_modules/recharts/es6/util/Global.js:3`), so every chart connects to the extension for users who have it installed (config). Set `Global.devToolsEnabled = false` in `lib/chart-theme.ts`, which every chart imports.
- **`agentRules: false`.** Setting this in `next.config.js` stops `next dev` under an AI agent from inserting a block into CLAUDE.md. Dev only (config).
- **Effort:** small. No measured performance effect. No risk.

## 5. Leave alone (the data says these are fine)

1. **Icon and package imports.** lucide-react is tree-shaken (66 unique icons out of 4,050 files), and `lucide-react` and `recharts` are already on Next 16.3's built-in `optimizePackageImports` list (`next/dist/server/config.js:1125,1143`). No next.config change is needed (bundle, config).
2. **What /demo and KaTeX ship.** No demo code or demo-only Recharts parts reach shared chunks, and the KaTeX JS and CSS load only on methodology (bundle). Change only the indexing (W11) and how KaTeX renders (H8).
3. **The retirement worker.** It is its own chunk, referenced only by the retirement route, with four fallbacks and sound stale-result handling (bundle, config, code). The stray `retirementWorker.*.ts` asset (2,093 B) is harmless.
4. **Framework overhead.** The legacy-javascript polyfills (14 KiB), the unused react-dom code (26 to 29 KiB per page), and the `noModule` polyfill chunk (38.6 KiB gzip, never downloaded by modern browsers) are Next built-ins with no config to change (bundle, lh).
5. **The Inter font.** It is self-hosted, only the Latin woff2 (48.4 KB) is preloaded, it uses `display: swap`, and it has a metric-adjusted fallback (config). The runtime analyzer suggested a system font stack for an estimated 100 to 240 ms. That would be a visible typography change for an unmeasured gain; revisit only if field data asks for it.
6. **Unused Tailwind classes.** Only 7 of 661 classes are unused, and demo-only classes cost 68 B gzip. The forms plugin (1.7 KiB gzip) is intentional (bundle).
7. **Zustand.** Devtools are inert in production: all three analyzers agree on that outcome, though they differ on why. Persist writes cost microseconds, localStorage totals 3.3 KB, and the heap stays at 5.5 to 19 MB with no leak (runtime, code, config).
8. **The numerics.** `runMonteCarloSimulation` does no quadratic work, and the seeded RNG with common random numbers and typed arrays is the right design. Paired Box-Muller (<10% faster, but it shifts every seeded figure) and an `imul` LCG (~0.2 ms) are not worth it (code).
9. **Chart data thinning.** `DcaPathChart` thins to 120 points and already has animation off. Quarterly thinning is within noise (code).
10. **Funnel steps.** Basics -> chooser takes 447 ms. Profile -> overview takes 1,001 ms, with no task over 200 ms. The Wizard memo and the sessionStorage marker cost microseconds (runtime, code).
11. **Hidden-but-mounted results** in `CalculatorLayout`. A retirement edit on a phone costs 0 to 16 ms TBT (runtime), and Recharts draws nothing at 0x0 (code).
12. **The /tools prefetch** (~258 to 280 KiB after load). Lighthouse perf is already 97 to 99 and the prefetch makes taps instant; H1 alone removes ~118 KiB of it (lh, runtime).
13. **Experimental flags and the React Compiler.** Turbopack chunk-duplication flags: the overlap within any single route is only 1 to 3 KiB [M], so they affect only navigation between calculators (bundle). `reactCompiler` is unmeasured, medium risk, and the refactor rewrites the inputs anyway (config).
14. **Defaults.** `compress`, source maps off, no `output: 'export'` (it would conflict with the planned server route), and the static OG image (config). The site also has no third parties, server latency is 0 to 10 ms, Best Practices is 100 on every page, SEO is 100 on every indexable page (noindex on /start* and /overview is intentional), and the desktop landing scores 100 in every category (lh).

## 6. Where analyzers disagreed, and what was picked

| Topic | Disagreement | Pick and reason |
|---|---|---|
| Retirement chart animation | runtime: "low confidence it matters" (no long tasks); code: 1,630 -> 249 ms per update at 4x | code. Animation work is spread across many short rAF frames, which TBT does not count but TaskDuration does [I], so both observations are consistent. |
| Engines on the landing page | bundle: -22.7 KiB gzip; runtime: ~80 ms on Fast 3G [E]; lh: LCP -57 ms, perf unchanged | worthDoing (W5), not highImpact. The lab shows no score change, and /start needs the code next anyway. |
| `isCoreReady` saving on /start/choose | bundle: 23.8 KiB gzip [M, both chunks]; code: "a few KB at most" [I, one chunk] | bundle, but it applies only to direct loads (W6). |
| Methodology TBT | runtime 1,145 ms (observed, to load + 5 s); lh 177 ms (simulated, to TTI) | Both are right for their method. Both show the page does far more main-thread work than its content needs; the ranking is unchanged. |
| /start observed LCP | lh: observed LCP = FCP (unthrottled trace); runtime: 2,372 vs 900 ms | runtime. The hydration gate only shows under phone-like throttling. |
| /start static: effort and risk | lh: medium / medium; config: small / low, with a concrete ~20-line diff using an existing repo pattern | config. |
| Baseline security headers | config: must-do | worthDoing (W2). They don't meet the must-do criteria for a site with no auth, cookies, iframes or third parties. Still cheap. |
| System font stack | runtime: consider it; config and lh: leave Inter | leave alone. |
| Leverage debounce length | code: 250 ms (measured); runtime: 250 to 300 ms; rebuild-plan.md:336: 150 ms | 250 to 300 ms. Measured key spacing of 140 to 230 ms means 150 ms would rarely coalesce. |
| 100-path typing preview | runtime: an option; code: measured noisier and slower than the debounce | drop it. |
| Zustand devtools mechanism | config: `import.meta.env.MODE` is inlined as production; bundle and code: `import.meta` has no `env`, so the access throws inside a try | Same outcome (off in production); no action. |
| Recharts chunk size | 118.0 KiB (bundle, gzip -c) vs 120.8 to 121.3 KB (lh, runtime transfer) | Units only; no conflict. |

## 7. Sequencing against docs/rebuild-plan.md (new at HEAD f857f82)

The DRY refactor plan (21 slices) rewrites much of the code these items touch. Suggested order:

- **Before starting the refactor:** M1, M2 and M3 (the plan's CI gates include the audit, `rebuild-plan.md:21`), then W1, W2, W3 and W11. These are independent of the refactor.
- **Already in the plan; ship early only if the plan is weeks away:**
  - **Formatter caching** is part of `lib/format.ts` in slice f1 (`:486`). The f1 change to `retirement.ts`'s import line (`:630`) also takes tailwind-merge out of the worker.
  - **The 300 ms paycheck delay and live recalculation** are in slice s1 (`:336`). Set the leverage debounce to 250 to 300 ms, not 150 ms.
  - **H5 and the H3/H7 workers:** `createWorkerRunner` in s1 (`:340`) is where to add a warm-up call for H5 and to reuse for the leverage and dashboard workers.
  - **H1 and H2:** `ChartFrame` in slice f3 (`:501`) is the natural home for `next/dynamic`, the viewport mount, the sized placeholder and the `isAnimationActive` default.
  - **H6** comes with slice c7 (`:961`), and **H7** with slice d1.
- **Needs owner sign-off under the plan's hard constraints (`:15-18`):** deleting the side-effect import at `retirement.ts:13` (W5), and the additive leverage-engine options (H7 includePath, W13).
- **The one-line fixes** (H4's delay, H2's animation flags, H3's debounce, H7's formatter cache) are cheap enough to ship now and will be absorbed by the refactor.

## 8. Caveats

- **The build is one commit behind HEAD.** All measurements come from the build of `0e8f421`; HEAD `f857f82` adds only `docs/rebuild-plan.md`. The app code is identical, but Tailwind scans docs (bundle), so a rebuild could emit marginally different CSS.
- **Local serving differs from Vercel.** The local server was HTTP/1.1 with gzip and no CDN; Vercel serves HTTP/2 or 3 with Brotli. The runtime report's Brotli estimates run ~16% under gzip (landing JS 158.9 vs 189.5 KB). Absolute times on Vercel should be similar or slightly better [I].
- **Lab LCP is not field LCP.** Lighthouse's mobile LCP (2.2 to 3.4 s) mostly measures time to download the initial JS. Field LCP on text pages is probably close to FCP, except on the pages that render only after hydration: leverage, /overview, /start*, and retirement opened from a hash (lh section 2, runtime).
- **4x CPU throttling is a stand-in for a mid-range phone, not a device measurement.** The throttle did not appear to apply to the dedicated worker (runtime).
- **The code-hotspots browser numbers come from a rolldown harness**, not the Turbopack bundle: same components, different bundler. Treat its absolute numbers as indicative and its before/after deltas as the result.
- **All "after" bundle sizes are sums of measured removals [E].** Turbopack may chunk differently after a change, so rebuild and re-measure.
- **The Lighthouse blocking experiments are upper bounds**: the blocked chunk also broke hydration.
- **Live production headers were not checked** (`bufoindex.com` returned 403 at the sandbox proxy). Whether Vercel adds HSTS by default is unverified.
- **No field data exists.** W4 is how to confirm any of the H-item effects for real users.

---

# Appendix: analyzer measurement tables (ASCII-normalized)

## A. Bundle (bundle analyzer)

Method: gzip sizes come from `gzip -c FILE | wc -c` per file, summed, in KiB. Per-route chunk lists come from the prerendered HTML; for `/start`, from its client-reference manifest plus `rootMainFiles`. The `noModule` polyfill is excluded. Raw totals match `.next/diagnostics/route-bundle-stats.json` byte for byte on all 14 routes listed there.

### A1. First load per route [M]

| Route | JS chunks | CSS files | JS raw KiB | JS gzip KiB | CSS raw/gzip KiB | Total raw KiB | Total gzip KiB | Delta raw vs floor | Delta gzip vs floor | Chunks beyond the /tools floor |
|---|---|---|---|---|---|---|---|---|---|---|
| / | 12 | 1 | 600.6 | 184.6 | 94.9/14.9 | 695.5 | 199.5 | +100.5 | +33.9 | 0psc0_fsyg2hv, 1np7pmhelfcde, 0o63sbmhdrwu3 |
| /start (f, from manifest) | 13 | 1 | 669.4 | 207.0 | 94.9/14.9 | 764.3 | 221.9 | +169.3 | +56.3 | 0hpacyfhrlv7i, 0o63sb, 1np7pm, 0q5_26wp86yw4 |
| /start/choose | 14 | 1 | 673.8 | 208.9 | 94.9/14.9 | 768.7 | 223.8 | +173.7 | +58.3 | 1aqbou0pch-ac + the 4 above |
| /start/[intent] (5 identical SSG paths) | 13 | 1 | 669.4 | 207.0 | 94.9/14.9 | 764.3 | 221.9 | +169.3 | +56.3 | 0hpacy, 0o63sb, 1np7pm, 0q5_26 |
| /start/review | 13 | 1 | 669.4 | 207.0 | 94.9/14.9 | 764.3 | 221.9 | +169.3 | +56.3 | same as /start |
| /overview | 13 | 1 | 680.9 | 208.9 | 94.9/14.9 | 775.9 | 223.9 | +180.9 | +58.3 | 0v44tzp1lz5i4, 15rx_j0-k-afv, 0o63sb, 1np7pm |
| /tools | 9 | 1 | 500.1 | 150.7 | 94.9/14.9 | 595.0 | 165.6 | 0 | 0 | (floor) |
| /tools/paycheck-allocator | 14 | 1 | 750.8 | 226.3 | 94.9/14.9 | 845.7 | 241.2 | +250.7 | +75.6 | 0o63sb, 0dwk2s_u_veus, 0q5_26, 10qg3or56tgh5, 1np7pm |
| /tools/retirement-calculator | 15 | 1 | 1128.5 | 334.9 | 94.9/14.9 | 1223.4 | 349.8 | +628.5 | +184.2 | 03tjjk1bubl_0, 0q5_26, 0o63sb, 1np7pm, 3spasciyk8uka (Recharts), 2bkatxyrli2js |
| /tools/retirement-calculator/methodology | 11 | 2 | 776.7 | 230.2 | 119.6/19.0 | 896.3 | 249.2 | +301.3 | +83.6 | 3omfu3c-d3o27, 13pgbvyv8v36u (KaTeX), 2yxexoduejmrk.css |
| /tools/portfolio-rebalancing-calculator | 13 | 1 | 714.8 | 218.0 | 94.9/14.9 | 809.7 | 232.9 | +214.7 | +67.3 | 0o63sb, 0q5_26, 1np7pm, 0m6dd0bnlsqa5 |
| /tools/leverage-comparison | 14 | 1 | 1114.7 | 331.2 | 94.9/14.9 | 1209.6 | 346.1 | +614.6 | +180.5 | 0o63sb, 2yig2q1a41knd, 0q5_26, 3spasciyk8uka (Recharts), 1np7pm |
| /demo | 15 | 1 | 1216.4 | 356.6 | 94.9/14.9 | 1311.3 | 371.5 | +716.3 | +205.9 | 0o63sb, 0q5_26, 2wfkjgqre4mjb, 3spasciyk8uka, 3fbr4j-sykxnl, 1np7pm |
| /_not-found | 9 | 1 | 500.1 | 150.7 | 94.9/14.9 | 595.0 | 165.6 | 0 | 0 | (floor) |

### A2. Floor composition [M] (raw / gzip KiB)

| Chunk | Contents | Raw | Gzip |
|---|---|---|---|
| 08ttfj81-47mu.js | react-dom client | 223.7 | 70.0 |
| 23bvl7rq49gaq.js | Next app-router runtime | 160.5 | 43.6 |
| 3hyszwd2eq2qg.js | React core | 28.2 | 7.5 |
| turbopack runtime | | 10.6 | 4.2 |
| 310vm2bl3xxpt.js | Next bootstrap | 5.2 | 1.9 |
| 3fntmmi971322.js | Next client components | | 3.6 |
| 1w-rc04tep5ak.js | app/error.tsx | | 0.7 |
| 1g18d5jm0tpqs.js | root layout (ThemeProvider, UtilityBar, Button, Radix Slot, base lucide) | | 7.2 |
| 3tisb0k8w5nae.js | root layout (tailwind-merge, lib/utils/index.ts, IRS and state tax tables) | 37.8 | 12.0 |
| 0cz1d0mv5g_q7.js | polyfills, noModule only (excluded) | 110.0 | 38.6 |

The build emits 32 JS files (2,094,925 B), 2 CSS files (122,469 B) and 1.30 MB of static/media, of which 1.08 MB is KaTeX fonts.

### A3. Big shared chunks [M]

| Chunk | Raw / gzip KiB | Routes | Main contents |
|---|---|---|---|
| 3spasciyk8uka.js | 424.2 / 118.0 | retirement, leverage, /demo | recharts ~265 KB SSR-equiv, decimal.js-light 12.6, @reduxjs/toolkit 10.0, immer 9.0, d3-* , reselect, redux |
| 13pgbvyv8v36u.js | 275.0 / 78.9 | methodology | katex ~254, components/methodology 17.6 |
| 3fbr4j-sykxnl.js | 98.1 / 24.8 | /demo | DemoClient.tsx 46.5, demo-only Recharts parts |
| 1np7pmhelfcde.js | 52.7 / 17.8 | 15 routes incl. / | intake.ts 12.0, paycheck engine module 24.2 raw / 7.9 gzip (measured by removal), zustand middleware 5.1, profile defaults/mappers |
| 0o63sbmhdrwu3.js | 44.5 / 14.8 | 15 routes incl. /, plus worker | formula array 23,349 B raw = 8.2 KiB gzip (measured by removal), retirement.ts 11.8 |
| 0q5_26wp86yw4.js | 40.7 / 13.2 | 13 routes | Radix Slider 23.2 raw / 7.9 gzip (by removal), inputs |
| 3tisb0k8w5nae.js | 37.8 / 12.0 | all | tailwind-merge ~24, lib/utils 6.5/2.5, irs-2026 2.3/0.8 |

### A4. CSS [M]
Global sheet `3zjtd0jbnxx74.css`: 94.9 KiB raw / 14.9 gzip / 12.3 brotli, 903 rules, 661 classes. Breakdown: utilities 53.7, `.prose` 13.3, forms 9.3, `@property` 4.4, theme vars 4.3, preflight 2.4, Inter `@font-face` 1.9. `.prose` costs 13.6 raw / 1.8 gzip on every route. KaTeX CSS `2yxexoduejmrk.css` is 24.7 / 4.1, methodology only.

### A5. HTML and RSC payloads [M] (gzip KiB)

| Route | HTML | RSC |
|---|---|---|
| / | 7.5 | 5.3 |
| methodology | 20.8 | 11.0 |
| /demo | 22.1 | 2.5 |
| each calculator | 4.2 to 9.3 | - |

### A6. Projected after R1 to R7 [E] (sums of measured removals)

| Route | JS gzip now | JS gzip after (est.) | Change |
|---|---|---|---|
| / | 184.6 | ~162 | -12% |
| /start/[intent] | 207.0 | ~176 | -15% |
| /start/choose | 208.9 | ~163 | -22% |
| retirement (initial) | 334.9 | ~209 | -38% |
| leverage | 331.2 | ~198 | -40% |
| methodology | 230.2 | ~158 plus some HTML | -31% |

### A7. Bundle recommendations as reported (R1 to R10)

| # | What | Where | Effect | Effort | Risk |
|---|---|---|---|---|---|
| R1 | next/dynamic charts | ResultsSection.tsx:17-18; LeverageResults.tsx:13 | -118.0 KiB gzip first load [M chunk] | small | low |
| R2 | drop formula side-effect import | retirement.ts:12-13 | -8.2 KiB gzip on 15 routes + worker [M] | small | low |
| R3 | split profile/intake from engines | mappers.ts:8-13; intake.ts:25; core.ts | -14.8 and -7.9 KiB gzip from / and intake [M] | medium | low-medium |
| R4 | split Radix Slider | PercentInput.tsx:8,244-259 | -7.9 KiB gzip [M] | small | low |
| R5 | move isCoreReady | Wizard.tsx:65-84; LearnChooser.tsx:21 | -23.8 KiB gzip on /start/choose [M/I] | small | low |
| R6 | KaTeX renderToString | LatexRenderer.tsx:9,35 | net -55 to -65 KiB gzip [E] | medium | low-medium |
| R7 | remove typography plugin | globals.css:4 | -1.8 KiB gzip CSS all routes [M] | small | very low |
| R8 | @source not docs/tests | globals.css:1 | a few hundred bytes | small | very low |
| R9 | split cn from tax helpers | lib/utils/index.ts | ~-3.5 KiB gzip all routes [E] | medium | low |
| R10 | turbopackChunking | next.config.js | cross-calculator nav only; within-route overlap 1 to 3 KiB [M] | small | medium |

## B. Runtime on the phone profile (runtime analyzer)

Profile: headless Chromium 141, 4x CPU, 150 ms latency, 200,000 B/s down / 93,750 B/s up, 390x844 DPR 2, touch; fresh context per load; median of 3. TBT = sum of (task - 50 ms) from navigation to load + 5 s. "CTA ready" = first moment the primary CTA's DOM node carries React props.

### B1. Cold loads (median of 3) [M]

| page | TTFB | FCP | LCP | TBT | long tasks | max task | tasks >200 ms | CTA ready | HTML KB | JS KB (files) | CSS KB | font KB | RSC prefetch KB | total KB | heap MB | JS brotli KB (est.) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| / | 152 | 964 | 964 | 231 | 2 | 262 | 1 | 2095 | 8.0 | 189.5 (12) | 15.4 | 47.6 | 8.1 | 269.2 | 5.5 | 158.9 |
| /tools | 155 | 916 | 916 | 210 | 1 | 255 | 1 | 1912 | 6.0 | 412.8 (20) | 15.4 | 47.6 | 20.2 | 502.6 | 7.1 | 345.0 |
| /start | 160 | 900 | 2372 | 222 | 3 | 210 | 1 | 2404 | 5.5 | 214.0 (14) | 15.4 | 47.6 | 6.2 | 289.2 | 5.7 | 179.8 |
| /start/choose (core seeded) | 153 | 900 | 2360 | 203 | 3 | 193 | 0 | 2371 | 4.7 | 216.2 (15) | 15.4 | 47.6 | 25.2 | 309.8 | 6.3 | 181.5 |
| /start/retirement (core seeded) | 153 | 884 | 884 | 182 | 3 | 196 | 0 | 2374 | 4.8 | 214.0 (14) | 15.4 | 47.6 | 6.2 | 288.5 | 5.7 | 179.8 |
| /overview (full profile) | 154 | 912 | 2580 | 461 | 5 | 278 | 1 | 2562 | 5.0 | 260.1 (17) | 15.4 | 47.6 | 9.6 | 338.4 | 8.1 | 218.7 |
| /tools/leverage-comparison?c=900&y=20&b=5000&l=2 | 158 | 912 | 3060 | 1124 | 5 | 589 | 3 | 3058 | 4.7 | 338.7 (15) | 15.4 | 66.5 | 6.2 | 432.2 | 11.7 | 282.6 |
| /tools/retirement-calculator#<flow hash> | 154 | 928 | 3612 | 1135 | 7 | 767 | 1 | 2776 | 9.0 | 342.8 (17) | 15.4 | 47.6 | 6.2 | 421.6 | 11.3 | 286.3 |
| /tools/retirement-calculator/methodology | 155 | 956 | 956 | 1145 | 11 | 406 | 1 | n/a | 21.3 | 270.0 (14) | 19.8 | 160.8 (10 files) | 6.2 | 478.8 | 6.9 | 224.4 |

Longest tasks per run: leverage 538 / 589 / 675 ms; retirement deep link 696 / 767 / 969 ms. The overview cards show numbers at 2662 / 2699 / 2707 ms; the retirement deep link shows numbers at 3464 / 3569 / 3580 ms. On every page FCP is 876 to 1152 ms, gated by the stylesheet that finishes at 737 to 762 ms.

### B2. Guided-flow transitions (median of 3) [M]

| step | time (runs) | long tasks | TBT in window | max task | transfer | notes |
|---|---|---|---|---|---|---|
| /start basics: Finish -> chooser rendered | 447 ms (437 / 447 / 508) | 0-1 | 8 | 58-89 | 25.1 KB (22.1 KB = 11 RSC prefetches) | - |
| /start/retirement: Finish -> "x% success rate" | 2014 ms (2239 / 2009 / 2014) | 3 | 177 | 153 (228 in run 1) | 146.9 KB (143.1 JS, 121.3 Recharts) | 751-825 ms long task starts 8-13 ms after the numbers appear |
| /start/profile -> /overview, all cards have numbers | 1001 ms (953 / 1038 / 1001) | 3 | 172 | 125-131 | 65.8 KB (58.5 JS) | none >200 ms |

Retirement window breakdown (run 2): 0 to ~1075 ms RSC + 3 JS chunks load (Recharts downloads from ~166 to 1030 ms); ~1075 ms Recharts evaluates (135 to 228 ms); +1434 to 1693 ms the worker is created and posted to; it replies 433 to 470 ms later; numbers render (87 to 127 ms); then the 751 to 825 ms chart task. Warm worker round trip: 10 to 20 ms.

### B3. Leverage keystrokes ("Monthly contribution", 2.5 s apart) [M]

| keystroke (value) | long tasks | max task median (runs) | results updated after keydown | keydown duration |
|---|---|---|---|---|
| 1 ("1") | 1 | 172 (198 / 144 / 172) | 264 ms | 48 ms |
| 2 ("12") | 1 | 139 (129 / 181 / 139) | 204 ms | 32 ms |
| 5 ("125") | 1 | 150 (102 / 159 / 150) | 211 ms | 32 ms |
| 0 ("1,250") | 1 | 139 (187 / 137 / 139) | 212 ms | 32 ms |

Burst "2400" (keys 140 to 230 ms apart): one long task per key, none coalesced; long-task total 549 ms, TBT 349 ms, max 174 ms; settles 157 ms after the last key. Retirement edit with results hidden: TBT 0, max 50 ms; worker post at 317 to 327 ms (300 ms debounce), reply 13 to 20 ms later. Switching to the Results tab: one 384 to 671 ms task (TBT 334 to 633).

### B4. Where the big tasks go (CPU profiles at 4x) [M]

| task | breakdown |
|---|---|
| Retirement deep link, after numbers, 927 ms | Recharts 645 ms self (text measurement, selector memoization, axis ticks, getBoundingClientRect); React 201; GC 24 |
| Leverage load, 762 ms | Recharts 508; React 185 |
| Leverage initial render, 273 ms | simulateDcaComparison 103; boxMullerRandom 25; formatCurrency (new Intl.NumberFormat per call) 40; React 44 |
| Leverage keystroke, 179 ms | simulation 118 + RNG 42 + GC 11 |
| Overview hydration render, 328 ms | simulateDcaComparison (300 paths) 79; formatCurrency 74; RNG 19; React 69. Separate summarizeRetirement task 69 to 100 |
| First hydration task, every page | 90 to 183 ms Turbopack module instantiation (landing 158 of 241 ms); scales with JS shipped |

### B5. Unthrottled Node timings (median; x4 is an estimate)

| function | median | x4 estimate |
|---|---|---|
| simulateDcaComparison, 500 paths, 20 y | 37.5 ms | ~150 ms |
| same, 250 paths | 17.4 ms | ~70 ms |
| same, 150 paths | 7.9 ms | ~31 ms |
| same, 100 paths | 5.1 ms | ~21 ms |
| overview card simulation (300 paths, 26 y) | 22.4 ms | ~90 ms |
| calculateRetirementAnalysis (5 scenarios) | 12.2 ms | ~49 ms |
| summarizeRetirement | 18.0 ms | ~72 ms |

`new Intl.NumberFormat(...).format()`: 33 us per call vs 0.6 us cached.

### B6. Heap and storage [M]
Heap on cold loads: landing 5.5 MB, /tools 7.1, /start 5.7, chooser 6.3, /start/retirement 5.7, overview 8.1, leverage 11.7, retirement deep link 11.3, methodology 6.9. Along the flow: 8.4 -> 19.0 -> 11.7 -> 15.1 MB, with no sign of a leak.

| key | size |
|---|---|
| bufo-profile | 1,224 B |
| retirement-calculator | 615 B |
| paycheck-allocator-storage | 1,465 B (only after opening the allocator) |

## C. Lighthouse (lh analyzer)

Lighthouse 13.5.0, Chromium 141. Mobile: 412x823 DPR 1.75, simulated RTT 150 ms, 1.6 Mbps, 4x CPU. 3 runs per page, median kept.

### C1. Mobile scores and metrics (median; range in brackets) [M]

| Page | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | TTI |
|---|---|---|---|---|---|---|---|---|---|---|
| / | 97 [94-97] | 100 | 100 | 100 | 0.91 s | 2.55 s [2.55-2.77] | 19 ms [19-165] | 0 | 0.91 s | 2.7 s |
| /tools | 97 [97-99] | 100 | 100 | 100 | 0.97 s | 2.52 s [1.88-2.52] | 94 ms [83-94] | 0 | 0.97 s | 3.6 s [2.6-3.6] |
| /start | 97 [95-97] | 100 | 100 | 63 | 0.92 s | 2.17 s [2.17-2.79] | 150 ms [38-150] | 0.034 | 0.92 s | 3.1 s |
| /tools/retirement-calculator | 93 [83-93]; 89-90 in 5 more runs | 95 | 100 | 100 | 0.91 s | 3.02 s [3.02-3.48 over 8 runs] | 147 ms [115-404] | 0 | 0.91 s | 3.3 s |
| /tools/leverage-comparison | 80 [80-85] | 95 | 100 | 100 | 0.91 s | 3.44 s [3.39-3.44] | 447 ms [297-447] | 0.058 | 0.91 s | 3.9 s |
| /overview (empty) | 95 [95] | 98 | 100 | 63 | 0.92 s | 2.94 s [2.87-2.95] | 52 ms [26-52] | 0.051 | 0.92 s | 3.0 s |
| methodology | 92 [92-93] | 96 | 100 | 100 | 1.37 s | 2.93 s [2.65-2.93] | 177 ms [177-244] | 0 | 1.37 s | 4.0 s |
| / desktop | 100 [100] | 100 | 100 | 100 | 0.26 s | 0.59 s | 0 | 0 | 0.26 s | 0.59 s |

SEO 63 on /start and /overview is the intentional noindex.

### C2. Supplementary pages (one mobile run each) [M]

| Page | Perf | A11y | SEO | LCP | TBT | CLS |
|---|---|---|---|---|---|---|
| /tools/paycheck-allocator | 95 | 95 | 100 | 2.9 s | 50 ms | 0 |
| /tools/portfolio-rebalancing-calculator | 98 | 95 | 100 | 2.3 s | 80 ms | 0 |
| /start/choose (redirects to /start) | 94 | 100 | 63 | - | - | 0.014 |
| /start/retirement (redirects to /start?next=retirement) | 94 | 100 | 63 | - | - | 0.035 |
| /start/review | 94 | 100 | 63 | - | - | 0.034 |
| /demo | 89 | 88 | 100 | 3.6 s | - | - |

### C3. Transfer per page [M]

| Page | Total | Scripts |
|---|---|---|
| / | 267 KiB | 12 requests, 189 KiB |
| /tools | 503 KiB | 20 requests, 413 KiB |
| /start | 289 KiB | 214 KiB |
| retirement | 422 KiB | 16 requests, 343 KiB |
| leverage | 413 KiB | 339 KiB |
| overview | 296 KiB | 216 KiB |
| methodology | 479 KiB | 270 KiB scripts, 161 KiB fonts (10 requests), 2 stylesheets |

### C4. Chunk identification (string grep, gzip -c) [M]

| Chunk | Contents | Raw / gz |
|---|---|---|
| 08ttfj81-47mu.js | react-dom | 229 KB / 71.6 KB |
| 23bvl7rq49gaq.js | Next app router | 164 KB / 44.6 KB |
| 3spasciyk8uka.js | recharts | 434 KB / 120.8 KB |
| 13pgbvyv8v36u.js | katex | - / 80.8 KB |
| 1np7pmhelfcde.js | paycheck engine + zustand | 54 KB / 18.2 KB |
| 0o63sbmhdrwu3.js | retirement engine + formula registry | 46 KB / 15.2 KB |
| 3tisb0k8w5nae.js | tailwind-merge config + IRS constants | 39 KB / 12.3 KB |

### C5. INP proxy (Event Timing, mobile emulation, no network throttle, 2 runs) [M]

| Page | Action | 1x CPU | 4x CPU |
|---|---|---|---|
| retirement | Calculate | 96 ms | 248 ms; then a 640-759 ms long task when the worker result renders |
| leverage | Compare | 48 ms | 120-128 ms; then 464-568 ms long tasks |
| paycheck | Calculate | 376-392 ms | 552-648 ms |
| paycheck, 300 ms setTimeout patched to 0 | Calculate | 80-96 ms | 392-408 ms |
| portfolio | Rebalance | 64 ms | 176-312 ms |

Blocking experiments (upper bounds; blocking also broke hydration): retirement with Recharts blocked, 5 interleaved runs: perf 89 -> 98, LCP 3402 -> 2319 ms, TBT 168 -> 89 ms (medians over all 8 runs per side: about 3.38 -> 2.88 s LCP). Landing with both engine chunks blocked: LCP 2580 -> 2523 ms, perf 97 -> 97.

### C6. HTML sizes [M]

| Page | Raw | gz |
|---|---|---|
| / | 47,458 B | 7,699 B |
| retirement | 52,511 B | 8,688 B |
| methodology | 119,509 B | 21,324 B |
| /demo | 165,672 B | 22,593 B |

## D. Config readiness (config analyzer)

### D1. Production-facing npm audit findings [M]

| Package | Locked version | Severity / range | Notes |
|---|---|---|---|
| next | 16.3.0 | critical, 16.0.0-16.3.7 | fixed in 16.3.8 (published). GHSA-p293 (Windows-hosted RCE, n/a on Vercel), GHSA-2xp9, GHSA-vcvr, GHSA-cjq9 (high), GHSA-4jqv and GHSA-mcj8 (SSG/ISR cache poisoning), GHSA-f87g (low), GHSA-3w37 (n/a), GHSA-39w2 (dev server only) |
| sharp | 0.35.3 (optional dep of next) | high | libheif, librsvg; traced into the /start function |
| source-map-js | 1.2.1 | high | build time only; 0 occurrences in any .nft.json runtime trace |

Totals: full tree 17 (1 critical, 10 high, 6 moderate); `--omit=dev` 3 (1 critical, 2 high). Dev-only: undici 8.10.0, js-yaml 4.3.1, brace-expansion 1.1.18 / 5.0.9, braces / micromatch / fast-glob (range `*`), vitest (moderate), postcss-selector-parser (via @tailwindcss/typography).

### D2. Persisted stores [M]

| Store / key | Persists | Size | Versioning |
|---|---|---|---|
| retirement-calculator (retirementStore.ts:405-431) | inputs, showAdvanced, hasCalculatedOnce, displayMode | ~0.6 KB | version 3, migrate v1 -> v3 |
| paycheck-allocator-storage (calculatorStore.ts:262-270) | profile, showAdvanced, activeSection, displayMode | 1,480 B default | none |
| bufo-profile (profileStore.ts:101-115) | profile | 709 B default | version 1, merge normalizes, migrate is a cast |
| portfolio | not persisted (URL hash) | - | - |

### D3. Retirement worker files [M]

| File | Bytes |
|---|---|
| turbopack-worker-2gqdcwp7k90ea.js (bootstrap) | 818 |
| 256xy7-b8arqy.js (entry, self.onmessage) | 463 |
| 3tisb0k8w5nae.js | 38,692 |
| 0o63sbmhdrwu3.js | 45,609 |
| turbopack-301px-wcmmsfq.js | 10,844 |

Rendering modes: every route except `/start` is prerendered with `revalidate: false`; `/start/[intent]` has 5 SSG paths with `dynamicParams = false`; no middleware; `/start` function trace is 235 files / 34.75 MB (sharp 29.19 MB, @vercel/og 3.22 MB, next 1.3 MB).

## E. Code hotspots (code analyzer)

Machine: Xeon 2.1 GHz, 4 cores, Node 22.22. Node: jiti, 5 warm-up + median of 31, one variant per process. Browser: rolldown harness from the real components, production React and CSS, headless Chromium 1194, CDP 4x throttle.

### E1. Leverage engine, Node median [M]

| Paths x years | Time |
|---|---|
| 500 x 20 (defaults) | 28 to 30 ms (cold first call 40 to 44 ms) |
| 500 x 40 | 60 ms |
| 500 x 60 | 88 to 95 ms |
| 300 x 20 | 17 ms |
| 300 x 40 | 32 to 33 ms |
| 100 x 20 | 5.5 ms |
| 100 x 60 | 14.8 ms |

### E2. Leverage engine in Chromium [M]

| Paths x years | 1x | 4x | 6x |
|---|---|---|---|
| 500 x 20 | 30.7 ms | 146.5 ms | 222 ms |
| 500 x 60 | 89.5 ms | 394 ms | 604 ms |
| 300 x 20 | 15.3 ms | 81.4 ms | |
| 300 x 40 | 29.1 ms | 146.5 ms | |

### E3. Where engine time goes [M]

| Horizon | Path loop (:206-270) | Per-month bands (:272-296) | End stats (:298-299) |
|---|---|---|---|
| 500 x 20 y | 14.0 ms | 12.8 ms | 0.2 ms |
| 500 x 60 y | 44.7 ms | 37.9 ms | 0.2 ms |

### E4. Engine variants, % change (20y/500p, 60y/500p, 20y/300p, 40y/300p) [M]

| Variant | Change |
|---|---|
| Quickselect bands (exact) | -16%, -17%, -13%, -7% |
| Bands only at chart sample months | -20%, -37%, -39%, -28% |
| Both | -26%, -43%, -43%, -36% |
| No medianPath (dashboard card) | -55%, -58%, -52%, -50% |
| Both Box-Muller outputs | -9%, -8%, -11%, -4% (changes the seeded stream) |
| Math.imul LCG | bit-identical, ~0.2 ms per run |

### E5. Leverage per keystroke, main-thread median [M]

| View | 20y 1x | 20y 4x | 60y 1x | 60y 4x |
|---|---|---|---|---|
| Desktop 1280 px | 96.6 ms | 424 ms | 161 ms | 728 ms |
| Phone, Inputs tab (results hidden) | 47 ms | 206 ms | 115 ms | 490 ms |

CPU profile, 5 keystrokes, desktop 1x: simulation ~55% of JS (leverageComparison.ts 126.6 ms + random.ts 61.6 ms + typed-array sort ~39 ms), Recharts stack ~33%, react-dom ~13%.

### E6. Typing burst, 8 keys 120 ms apart [M]

| Case | repo | memo | debounced (250 ms + memo) | preview (100 paths) |
|---|---|---|---|---|
| Desktop 1x 20y, total main thread | 707 ms | 592 ms | 140 ms | 439 ms |
| Desktop 1x 60y, total | 1258 ms | 1058 ms | 184 ms | 546 ms |
| Desktop 1x 60y, long tasks | 8 | 8 | 1 | 1 |
| Desktop 4x 20y, total | 2173 ms | 1772 ms | 626 ms | 1757 ms |
| Desktop 4x 20y, long tasks | 17 (1972 ms) | 9 | 2 (307 ms) | 10 |
| Desktop 4x 20y, slowest interaction | 184 ms | 144 ms | 56 ms | 152 ms |
| Desktop 4x 60y, total | 4600 ms | 4154 ms | 973 ms | 2522 ms |
| Desktop 4x 60y, slowest interaction | 528 ms | 408 ms | 56 ms | 152 ms |
| Phone 4x 20y, total | 1397 ms | 1508 ms | 385 ms | 620 ms |
| Phone 4x 60y, total | 3866 ms | 3256 ms | 786 ms | 1551 ms |
| Phone 4x 60y, slowest interaction | 464 ms | 312 ms | 48 ms | 40 ms |

### E7. Retirement charts with animation off [M, harness]
Main-thread per results update: 397 -> 65 ms (1x), 1630 -> 249 ms (4x). Typing session: 1026 -> 318 ms (1x), 3967 -> 1978 ms (4x). With animation off, the slowest keystroke interaction is still 440 to 528 ms at 4x on desktop; Recharts is 61% of keystroke JS (5 keystrokes at 1x: Recharts ~150 ms, react-dom 49.8, lib/utils formatters 9.1).

### E8. Dashboard [M]

| Function | Node | Chromium 1x first / warm | Chromium 4x first / warm |
|---|---|---|---|
| calculateRetirementAnalysis (default profile) | 8.7 ms (6.6 to 10.7) | | |
| runMonteCarloSimulation (1000 runs) | 1.4 ms | | |
| summarizeRetirement | 10.3 ms (cold 36.8) | 24 / 8.7 ms | 114 / 38.6 ms |
| LeverageCard simulation (300 x 30), current | 26 ms | 31.4 / 29.1 ms | 131.7 / 114.7 ms |
| LeverageCard simulation, no-path variant | | 14.9 ms first | 54.6 / 52.1 ms |

Mounting /overview at 390 px: synchronous first render 69 to 75 ms (1x), 294 to 317 ms (4x); long tasks at 4x [300, 145, 51], [325, 221, 85], [308, 179, 60] ms; main-thread total over 2.5 s 125 to 134 ms (1x), 528 to 678 ms (4x).

### E9. Chart update cost, 12 updates, main-thread median [M]

| | 241 rows | 121 rows | 81 rows | 721 rows |
|---|---|---|---|---|
| 1x, 20y | 23.1 ms | 22.2 ms | 20.8 ms | |
| 4x, 20y | 118.2 ms | 111.5 ms | 86.2 ms | |
| 1x, 60y | | 20.9 ms | | 38.6 ms |
| 4x, 60y | | 124.0 ms (101.9 in a second run) | | 196.1 ms |

`Intl.NumberFormat`: 25.7 us per call, 0.4 us cached.

## F. Raw artifacts

All under `/tmp/claude-0/-home-user-bufoindex/cd6a0e6e-8675-5253-9ea4-38c167116bdd/scratchpad/audit/`:
- `bundle/`: routes.md, routes.json, client-attr.json, ssr-attr.json, analysis scripts
- `runtime/`: summary.json, cold-all.json, flow-run-1..3.json, flow-all.json, typing-all.json, ret-edit-all.json, profiles-attribution.json, worker-requests.json, storage-*.json, scripts, bench/bench.mjs
- `lighthouse/`: *-mobile.report.html/json, landing-desktop, runs/, supp/, exp/, exp2/, axe-themes.json, inp-rate1.json, inp-rate4.json, scripts
- `config/`: npm-audit.json, route_sizes.py, route_sizes.txt, persist_size.mjs
- `code/`: Node benchmarks (*.mjs, *.out), harness/ (entry, builds, scratch component variants, runners, out/*.png)
