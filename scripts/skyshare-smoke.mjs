// No framework/dependencies. psql must be installed; credentials stay in the environment.
import { spawnSync } from 'node:child_process';
const started = performance.now();
const url = process.env.SKYSHARE_STAGING_DATABASE_URL;
if (!url) throw new Error('BLOCKED: set SKYSHARE_STAGING_DATABASE_URL; missing config is not a pass');
const parsed = new URL(url);
const ref = 'lbmadoyajrlzdtxyvkwi';
const direct = parsed.hostname === `db.${ref}.supabase.co`;
const pooler = parsed.hostname.endsWith('.pooler.supabase.com') && decodeURIComponent(parsed.username) === `postgres.${ref}`;
if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || (!direct && !pooler)) throw new Error('Refusing database outside supraintegration-staging');
const result = spawnSync('psql', ['-X', '--set=ON_ERROR_STOP=1', '--file=supabase/tests/skyshare-smoke.sql'], {
  env: { ...process.env, PGDATABASE: url, PGSSLMODE: 'verify-full', PGCONNECT_TIMEOUT: '10' },
  stdio: 'inherit', timeout: 60000,
});
console.log(`Database contract runtime: ${Math.round(performance.now()-started)}ms; browser UI: NOT TESTED`);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
