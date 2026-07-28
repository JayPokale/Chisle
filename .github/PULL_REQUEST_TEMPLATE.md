<!-- Small focused PRs beat big rewrites. -->

## What & why

<!-- One or two lines. What changes, and why it needs to. -->

## Checklist

- [ ] `skills/chisle/SKILL.md` is the source of truth — no rule logic duplicated into hooks
- [ ] Regenerated rule copies + chart if behavior changed (`npm run build:rules && npm run build:chart`)
- [ ] Hook changes preserve the flag-file security model (`O_NOFOLLOW`, `0600`)
- [ ] `npm test` passes
- [ ] Added/updated a test for any hook logic change

## Notes

<!-- Anything a reviewer should know: tradeoffs, deliberate simplifications, follow-ups. -->
