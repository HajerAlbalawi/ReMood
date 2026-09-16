# Threat Model

## Project Overview

ReMood (مرشد الكتب الذكي) is an Arabic-language book recommendation application. It fetches real-time weather data for a chosen city and, combined with the user's mood and category preferences, selects book recommendations from a static library of 80+ titles. Recommendations and their history are persisted in PostgreSQL.

The stack is: Node.js 24 / Express 5 API server, React (Vite) frontend, PostgreSQL + Drizzle ORM, TypeScript throughout, built as a pnpm workspace. The deployment is Replit Autoscale with **private** visibility (Replit's infrastructure restricts public internet access).

External service integrations:
- **open-meteo.com** — free weather API (no API key required)
- **Goodreads RSS** — optional read-shelf import (unauthenticated RSS feed, using a public user ID)
- **Replit OIDC** — browser and mobile login/session creation, when those flows are used

## Assets

- **Recommendation history (PostgreSQL)** — city, mood, weather, selected books, AI-generated quote and analysis for each session. It is user-context data even though the current schema does not contain direct PII; unauthorized disclosure or tampering can affect privacy and trust.
- **Database connection string (`DATABASE_URL`)** — grants full read/write access to the PostgreSQL instance; must remain server-side only.
- **OIDC sessions and bearer session IDs** — session rows contain user claims and provider tokens. Possession of a valid `sid` enables the associated authenticated identity.
- **User's Goodreads user ID** — stored in `localStorage`; this is a public Goodreads identifier (not a credential), but leakage could allow third parties to query the user's reading shelf.

## Trust Boundaries

- **Browser → Express API** — all client requests cross this boundary. The API must validate inputs, authenticate the subject, and authorize each sensitive action; the client is untrusted.
- **Express API → PostgreSQL** — Drizzle ORM provides parameterized queries; the risk is ORM misuse, unbounded inserts, and missing owner/tenant predicates.
- **Express API → Replit OIDC** — login, token exchange, refresh, and logout cross this boundary. Redirect URIs, state, nonce, PKCE, issuer, and client identity must remain bound to the intended application.
- **Express API → open-meteo.com** — coordinates are user-supplied and passed to a hardcoded host, limiting SSRF risk; upstream calls still consume server resources.
- **Express API → Goodreads RSS** — user-supplied `userId` is encoded into a hardcoded Goodreads URL; the response is untrusted external content and must not become executable markup.
- **Private deployment boundary** — Replit's infrastructure enforces that only authenticated Replit users with access to this repl can reach the deployed URLs. This is a perimeter control, not a replacement for application-level identity and per-user data isolation.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, and `artifacts/api-server/src/routes/`
- **Authentication**: `routes/auth.ts`, `lib/auth.ts`, `middlewares/authMiddleware.ts`; `middlewares/requiresAuth.ts` exists but must be mounted explicitly.
- **Highest-risk route files**: `routes/recommendations.ts` (database reads/writes), `routes/auth.ts` (OIDC and redirects), `routes/goodreads.ts` (external HTTP and XML parsing), `routes/weather.ts` (external HTTP)
- **DB schema**: `lib/db/src/schema/auth.ts` and `lib/db/src/schema/recommendations.ts`
- **Input validation**: `lib/api-zod/src/generated/api.ts` (generated Zod schemas from `lib/api-spec/openapi.yaml`)
- **Frontend**: `artifacts/book-weather/src/` — React SPA, no server-side rendering; `lib/replit-auth-web/` supplies auth helpers but is not currently used by the SPA.
- **Dev-only / mockup**: `artifacts/mockup-sandbox/` — design sandbox, not reachable in production

## Threat Categories

### Spoofing / Authentication

Browser OIDC uses state, nonce, and PKCE, and sessions use random 32-byte IDs in an HttpOnly, Secure, SameSite cookie or an explicit bearer header. The API still needs to apply authentication to every user-specific route: `authMiddleware` only populates an optional subject, while `requiresAuth` is not globally mounted. Session IDs and provider tokens must never be exposed in browser bundles or logs, and refresh failures must invalidate the session.

### Tampering

Drizzle ORM uses parameterized queries throughout, preventing SQL injection. Recommendation inputs are type-checked, but text lengths and collection sizes need enforceable limits before durable storage. Recommendation records must be attributed to the authenticated subject and clients must not be allowed to choose an owner or tenant. Weather coordinates should remain constrained to valid geographic ranges.

### Information Disclosure

Recommendation list and statistics responses must be scoped to the authenticated user's records (or an explicitly authorized shared workspace). The current recommendation table has no owner key, so it cannot provide object-level isolation. Goodreads XML and all external responses are untrusted and must be rendered as text; React JSX escaping currently prevents stored recommendation content from becoming HTML. Secrets such as `DATABASE_URL`, `OPENAI_API_KEY`, and OIDC tokens must remain server-side.

### Denial of Service

The recommendation, weather, and Goodreads routes are rate-limited by path, but rate limiting does not replace request validation, quotas, or retention. Each recommendation POST writes a durable row, and the text columns currently have no maximum lengths. Continuous requests can therefore grow the database and make list/statistics queries expensive. External calls need bounded response sizes and timeouts; Goodreads has a timeout, while the weather fetch should also be bounded.

### Elevation of Privilege

Every protected read and write must prove the relationship between the authenticated subject and the requested records. Frontend state, private deployment visibility, and an optional session populated by middleware are not sufficient. OIDC callback and logout return paths must be restricted to a strictly local path grammar; slash-like backslash inputs must not be able to become an external redirect.

### Security Misconfiguration

CORS is configured with a specific `ALLOWED_ORIGIN` value (defaulting to `http://localhost:5173`) and credentials enabled, rather than an unconditional wildcard. The deployment is private, but changing that visibility would expose any route that lacks `requiresAuth`. Production should keep debug/dev middleware disabled and continue redacting authorization headers, cookies, and set-cookie headers in logs.
