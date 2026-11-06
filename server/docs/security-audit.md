# Dependency Security Audit

Audit date: 2026-11-05. Commands were run from `server/` and `client/` with the lockfiles present. No `--force` update was run.

## Composer

Initial `composer audit --no-interaction` reported 7 advisories affecting `symfony/http-foundation`, `symfony/http-kernel`, `symfony/routing`, and `symfony/yaml`; installed Symfony packages were at 7.4.22. A dry run confirmed compatible 7.4.23 patch releases were available. Applied:

```text
symfony/http-foundation 7.4.22 -> 7.4.23
symfony/http-kernel 7.4.22 -> 7.4.23
symfony/routing 7.4.22 -> 7.4.23
symfony/yaml 7.4.22 -> 7.4.23
symfony/deprecation-contracts 3.7.1 -> 3.8.1
symfony/event-dispatcher-contracts 3.7.1 -> 3.8.1
```

Post-update `composer audit` result: **No security vulnerability advisories found.** No Composer advisories remain.

## npm

`npm audit --omit=dev --json`: **0 vulnerabilities** in 109 production dependencies. Full `npm audit --json`: **11 findings** (10 moderate, 1 high) in development dependencies: `minimatch` through ESLint 10 / `typescript-eslint`, plus `sharp` 0.33.5 and its native `libvips` dependencies.

`npm audit fix --dry-run` was used only to inspect proposed changes. npm offered to move ESLint to 9.39.5 and Sharp to 0.35.5, both across major-version boundaries in the declared ranges. No non-forced npm changes were available that clear those advisories within the current dependency constraints. These remain open until the project can review and test the major upgrades; do not use `npm audit fix --force` as a routine remediation.

## Follow-up

Re-run `composer audit` and `npm audit` after dependency changes and before production deployment. Review the project scripts and generated image pipeline when planning a Sharp major upgrade; review the ESLint 9 config/runtime compatibility before changing the ESLint major.