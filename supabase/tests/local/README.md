# Local migration behaviour harness

```bash
supabase/tests/local/run.sh
```

Creates a throwaway PostgreSQL 16 cluster, applies a minimal Supabase-equivalent
shim, applies every migration in `supabase/migrations` in order, re-applies the
idempotent ones to prove they are re-runnable, seeds fixtures, runs the assertion
matrix, and destroys the cluster. It needs no credentials and touches no hosted
project.

## What it proves

- Every migration applies cleanly, in order, from an empty database.
- `202607280002` and `202607290003` are genuinely re-runnable.
- Triggers, check constraints and derived values behave correctly: the agent-message
  role restriction, the deliverable completion gate, the authority hierarchy, scope
  version immutability, agent record defaults, and publication approval.
- RLS policies produce the intended result for a given request role and JWT subject,
  including cross-tenant denial and the anon/suspended paths.

## What it does **not** prove

Read this before treating a green run as assurance.

It does not replace `../rls.test.mjs`. The auth layer here is a shim: `auth.uid()`
and `auth.jwt()` read a session GUC this harness sets by hand, roles are assumed with
`SET LOCAL ROLE`, and **no JWT is ever signed or verified**. It exercises no PostgREST
request handling, no Supabase Auth, no sign-in, no session cookie refresh, and none of
the grants the Supabase platform applies outside our own migrations.

A green run here, plus a green `npm test` in a bare checkout, still means the
authorization model has never been verified end to end against a real project. Only
the signed-in matrix does that, and only when staging credentials are configured.

## Files

| File | Purpose |
|---|---|
| `run.sh` | Entry point. Creates the cluster, applies everything, tears down. |
| `shim.sql` | The Supabase pieces our migrations depend on: the `anon` / `authenticated` / `service_role` / `authenticator` roles, `auth.users`, and Supabase's own `auth.uid()` and `auth.jwt()` definitions. |
| `seed.sql` | Fixtures: three organizations, seven users, and a scope truth layer for Client A and Client B. |
| `assertions.sh` | The matrix. Each case runs in its own transaction and rolls back. |

## Adding a case

`assertions.sh` exposes one helper:

```bash
t "<label>" <ALLOW|DENY> <postgres-role> <jwt-claims-json|NONE> "<sql>"
```

`ALLOW` means the transaction completes; `DENY` means it raises. Remember that RLS
filters a client's `UPDATE` to **zero rows** rather than raising, so a write that must
be blocked should assert the affected row count with `get diagnostics`, not expect an
exception. Several existing cases do exactly that.
