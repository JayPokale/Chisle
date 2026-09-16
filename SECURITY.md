# Security Policy

## Supported versions

Only the latest published release on npm receives security fixes. Chisle is a
zero-dependency tool with no long-term support branches — upgrade rather than
expect a backport.

| Version | Supported |
|---------|-----------|
| latest `3.x` | ✅ |
| older `3.x` | ❌ |
| `2.x` and earlier | ❌ |

## Reporting a vulnerability

**Do not open a public issue for security problems.**

Email **jay.pokale.35@gmail.com** with:

- what the vulnerability is and where (file / function),
- steps to reproduce,
- impact (what an attacker gains).

You'll get an acknowledgement within 72 hours. Fixes for confirmed issues ship in the
next patch release, with credit unless you ask otherwise.

## Why this matters here

Chisle runs hooks or a Pi extension inside your agent process. Pi extensions have full user permissions; review source before installing, and trust project-local `.pi` resources only from repositories you trust. The config layer (`hooks/chisle-config.js`) is symlink-safe by design (`O_NOFOLLOW`, `0600`). If you find path traversal, symlink following, unsafe tool-result mutation, or installer privilege escalation, report it here.
