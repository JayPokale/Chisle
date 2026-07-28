# Releasing

Chisle publishes to npm via **trusted publishing (OIDC)** — no `NPM_TOKEN`
secret stored anywhere. A `v*` tag triggers `.github/workflows/publish.yml`,
which tests, publishes with provenance, and cuts a GitHub Release.

## One-time setup (maintainer)

1. Create the npm package name `chisle` (first manual `npm publish` from a
   logged-in machine, or reserve it).
2. On npmjs.com → the package → Settings → **Trusted Publishers**, add this repo
   and the `publish.yml` workflow. This is what lets CI publish without a token.
3. Ensure the GitHub repo exists at `JayPokale/Chisle` and `main` is pushed
   (the `npx`/`curl` one-liners resolve against it).

## Cutting a release

```bash
# 1. bump the version (keep tag == package.json version)
npm version patch   # or minor / major — updates package.json + makes a commit

# 2. update CHANGELOG.md under the new version heading

# 3. push the tag
git push && git push --tags
```

The tag push fires `publish.yml`:

- `test` job — runs the suite, rule-sync check, chart-sync check
- `publish` job — verifies `tag == package.json version`, then `npm publish` (OIDC + provenance)
- `release` job — creates the GitHub Release with generated notes

## Verifying

```bash
npm view chisle version          # the new version is live
npx chisle@latest --help         # the bin resolves
```

## If publish fails

- **Version mismatch** — the tag (`v1.2.3`) must equal `package.json` `version`
  (`1.2.3`). Fix and re-tag.
- **OIDC auth denied** — the Trusted Publisher entry on npm doesn't match the repo
  + workflow filename. Re-check step 2 above.
- **Name taken** — pick a scoped name (`@jaypokale/chisle`) in `package.json` and
  update the install one-liners.
