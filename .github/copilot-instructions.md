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
