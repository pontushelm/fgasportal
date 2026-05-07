# Cookie and Browser Storage Audit

Date: 2026-05-07

Scope: Codebase audit only. No runtime cookie values or secret values were inspected or printed.

## Summary

FgasPortal currently uses one first-party authentication cookie and one first-party localStorage key for theme preference.

No code-level use of Google Analytics, GA4, Google Tag Manager, Vercel Analytics, Vercel Speed Insights, PostHog, Plausible, Hotjar, Sentry, tracking pixels, embedded tracking scripts, `document.cookie`, `sessionStorage`, or `indexedDB` was found.

Recommendation: **No cookie banner needed yet**, based on the current implementation. A short cookie/privacy policy is still recommended before launch, especially because the app uses an authentication cookie, localStorage for theme preference, Resend for transactional email, and Vercel Blob for user-uploaded documents.

This is a practical product assessment, not legal advice.

## Cookies

| Name | Where set/read | Purpose | Category | Party | Required for core functionality | Consent before setting? |
| --- | --- | --- | --- | --- | --- | --- |
| `auth-token` | Set in `app/api/auth/login/route.ts`; reset in `app/api/auth/logout/route.ts`; replaced in `app/api/auth/switch-company/route.ts`; replaced in `app/api/company/transfer-ownership/route.ts`; read in `lib/auth.ts` via `request.cookies.get(AUTH_COOKIE_NAME)` | JWT session cookie containing authenticated user, active company, role, and membership context. Also supports company switching and ownership transfer session refresh. | Strictly necessary | First-party | Yes. Required for login, tenant boundary, authorization, and company context. | No prior consent normally needed for strictly necessary auth/security cookies. Disclose in cookie/privacy policy. |

### `auth-token` details

- `httpOnly: true`
- `secure: process.env.NODE_ENV === "production"`
- `sameSite: "lax"`
- `path: "/"`
- `maxAge: 60 * 60 * 24 * 7` (7 days)
- Value is a JWT generated server-side. Do not expose it to frontend JavaScript.

## Browser Storage

| Name | Where used | Purpose | Category | Party | Required for core functionality | Consent before setting? |
| --- | --- | --- | --- | --- | --- | --- |
| `fgasportal-theme` | `components/theme/theme-provider.tsx` via `window.localStorage.getItem` and `window.localStorage.setItem` | Stores the user's light/dark theme preference locally for immediate UI rendering. The preference is also fetched/saved through `/api/auth/me` and `/api/user/theme`. | Preference | First-party | No. Improves UX but is not required for login/security/core compliance functionality. | Usually can be treated as low-risk preference storage. Consider disclosure; a consent banner is typically not necessary if this is only a user-requested preference. |

No `sessionStorage` usage was found.

No `indexedDB` usage was found.

No generic storage helper abstraction was found beyond the theme provider.

## Third-Party Tracking Assessment

| Service / pattern checked | Finding | Cookie/tracking implication |
| --- | --- | --- |
| Vercel Analytics / Speed Insights | No `@vercel/analytics`, `@vercel/speed-insights`, `<Analytics />`, or `<SpeedInsights />` usage found. | No analytics cookies or client telemetry from these packages found. |
| Google Analytics / GA4 / GTM | No `gtag`, `gtm`, `GoogleAnalytics`, or tag manager script usage found. | No GA/GTM tracking found. |
| PostHog | No package/import/script usage found. | No PostHog tracking found. |
| Plausible | No script/package usage found. | No Plausible tracking found. |
| Hotjar | No script/package usage found. | No Hotjar tracking found. |
| Sentry | No package/import/config usage found. | No Sentry browser telemetry found. |
| Resend | Server-side only in `lib/email.ts`; sends plain-text transactional emails. | No frontend cookies found. Transactional email provider should be disclosed in privacy/subprocessor documentation. |
| Embedded scripts / pixels / iframes | No relevant tracking scripts, pixels, or embeds found in app code. | No marketing/tracking storage found. |
| `next/font/google` | Used in `app/layout.tsx` for Geist fonts. | Next font optimization self-hosts font assets in the app build; no browser cookie usage found in app code. |
| Vercel Blob | Used server-side for uploaded documents and scrap certificates. Public blob URLs may be opened by users. | No tracking cookies found in app code. Disclose as document/file storage processor if used in production. |

## Search Coverage

Searched for:

- `cookies()`
- `document.cookie`
- `NextResponse.cookies`
- `response.cookies`
- `set-cookie`
- cookie libraries and cookie references
- `localStorage`
- `sessionStorage`
- `indexedDB`
- storage helper references
- analytics/tracking packages and script patterns
- Resend, Vercel Blob, Next font usage

## Practical Recommendation

**No cookie banner needed yet** for the current codebase, because the only cookie found is a strictly necessary first-party authentication/session cookie, and the only browser storage found is first-party theme preference storage.

For a Swedish/EU B2B SaaS launch, prepare a concise cookie/privacy notice that explains:

- `auth-token` is used for login, security, company context, and authorization.
- `fgasportal-theme` is used to remember the user's theme preference.
- Resend is used for transactional emails.
- Vercel/Neon/Vercel Blob or equivalent hosting/storage subprocessors are used if applicable in production.

## Suggested Next Steps Before Launch

1. Add a short cookie section to the privacy policy or cookie policy.
2. Re-run this audit before adding analytics, support chat, heatmaps, A/B testing, marketing pixels, or embedded third-party widgets.
3. If analytics or marketing scripts are added later, introduce consent handling before those scripts run for EU/Swedish users.
4. Confirm production Vercel settings do not enable separate analytics products outside the codebase.
5. Confirm email settings in Resend if open/click tracking is enabled outside this repository; the current code sends plain-text email only.
