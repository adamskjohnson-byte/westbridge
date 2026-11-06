## Motion rules
- Animate only transform and opacity. No layout-shifting animations.
- Every animation is disabled or reduced under prefers-reduced-motion.
- Scroll reveals, count-ups and the scroll-to-top button reuse the shared primitives in src/components/motion/ and src/hooks/. Don't write one-off IntersectionObserver code.
- Hover effects (lift, tilt) only on devices with a fine pointer (@media (hover: hover) and (pointer: fine)).
- Colours come from theme tokens, never new hex values in components.

## i18n rules (applies once i18n lands)
- All user-visible text goes through t() from react-i18next. This includes aria-labels, alt text, toasts, form errors and page titles.
- Use CSS logical properties (ms-/me-/ps-/pe-/start-/end-, text-start) instead of left/right so RTL languages work.
- Brand names ("Westbridge National Bank") are never translated. Money amounts stay in USD.

## Phase 6 rules
- Cards: never store or return a full card number or CVV, even fake ones. Only last4 and expiry exist. A frozen or cancelled card declines every purchase.
- Notifications store a stable TYPE plus PARAMS (amounts in cents, masked numbers, ids), never English sentences. The frontend builds the text with t(). Params must never contain secrets, tokens or full account numbers.
- Security notifications (password changed, card issued or cancelled, session revoked) always create an email and an in-app notification and can't be switched off. Activity emails respect the user's preferences. Emails stay English-only for now.
- Sensitive settings changes (password) require the current password and are audited. Changing a password signs out every other session.
- Preferences (language, theme) are saved on the server; after login the server's values win over the local ones; while logged out the local ones apply.
- Insights exclude transfers between the user's own accounts. Insight sentences are built in the frontend from numbers via t(); the API returns numbers only.
- Same dashboard rules as before: i18n, RTL, <Money>/<Ltr>, theme tokens, reduced motion, no colour-only status.
