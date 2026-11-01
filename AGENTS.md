# Westbridge National Bank

## Project

This is a simulated bank for learning. Use fake money only. Never handle real financial data.

## Stack

- `client/`: React, Vite, strict TypeScript, Tailwind CSS, shadcn/ui, React Router, TanStack Query, React Hook Form, Zod, and Vitest.
- `server/`: API-only Laravel with MySQL. Authentication may be added later with Sanctum. Email is sent with Resend.
- Hosting: client on Cloudflare Pages; API on Spaceship.

## Brand

- Brand name: Westbridge National Bank. Style: Classic.
- Primary: burgundy `#6B1D2A`.
- Accent: bronze `#C08A6B`.
- Surface: cream `#F8F1E7`.
- Neutral: stone `#D9CFC3`.
- Text: ink `#2A2327`.
- Font: Manrope.
- Never use bronze for text on light backgrounds because of insufficient contrast. Bronze is for borders, icons, and decoration, or large text on burgundy.

## Implementation Rules

- Design mobile-first and support responsive layouts from 360px wide. Prevent horizontal page scrolling.
- Use semantic HTML, labelled inputs, visible focus rings, and WCAG AA contrast. Respect `prefers-reduced-motion`.
- Define and use design tokens through CSS variables or the Tailwind theme. Do not put hard-coded hex colors in components.
- Keep marketing copy and static data in `client/src/content/`, not in components.
- Represent money as integer cents in the backend and API. Format it only at the UI edge; never use floating-point values for money.
- Do not use real regulator logos or claims, including FDIC or Equal Housing. Do not use real addresses, phone numbers, or people. Use clearly fictional data.
- Every page footer must display exactly: “Demo only. Westbridge National Bank is not a real bank. No real money is held.”
- Never commit secrets. Use `.env` and keep `.env.example` up to date.
- Prefer small, focused components with typed props. Do not use `any`.
- Add short comments for non-obvious logic. Prefer clarity over cleverness.