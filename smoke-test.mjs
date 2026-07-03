/**
 * Smoke test for everything built so far (Phases 1–4).
 *
 * Prerequisites:
 *   1. DB deployed (schema.sql run on Supabase — includes the demo seed)
 *   2. API running:        cd server && npm start
 *   3. ML service running: cd ml-service && .\.venv\Scripts\python.exe app.py
 *
 * Run:  node smoke-test.mjs
 */
const API = 'http://localhost:4000';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `  →  ${detail}` : ''}`);
  }
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 204 etc. */
  }
  return { status: res.status, json };
}

// ---------- 0. health ----------
console.log('\n[0] Server health');
try {
  const h = await req('GET', '/api/health');
  check('GET /api/health → 200 ok', h.status === 200 && h.json.status === 'ok');
} catch (e) {
  console.error(`\nCannot reach the API at ${API} — is the server running? (cd server && npm start)`);
  process.exit(1);
}

// ---------- 1. auth ----------
console.log('\n[1] Auth');
const demo = await req('POST', '/api/auth/login', {
  body: { email: 'demo@demo.com', password: 'demo1234' },
});
check('login demo user → 200 + token', demo.status === 200 && !!demo.json.token);
const T = demo.json.token;

const badLogin = await req('POST', '/api/auth/login', {
  body: { email: 'demo@demo.com', password: 'wrong-password' },
});
check('login wrong password → 401', badLogin.status === 401);

const badSignup = await req('POST', '/api/auth/signup', {
  body: { name: 'X', email: 'not-an-email', password: 'password123' },
});
check('signup invalid email → 400', badSignup.status === 400);

const dupSignup = await req('POST', '/api/auth/signup', {
  body: { name: 'Demo', email: 'demo@demo.com', password: 'password123' },
});
check('signup duplicate email → 409', dupSignup.status === 409);

const noToken = await req('GET', '/api/tags');
check('protected route without token → 401', noToken.status === 401);

const badToken = await req('GET', '/api/tags', { token: 'tampered.token.here' });
check('protected route with bad token → 401', badToken.status === 401);

// ---------- 2. tags CRUD ----------
console.log('\n[2] Tags');
const tagList = await req('GET', '/api/tags', { token: T });
check('list tags → 200, has 4+ seeded tags', tagList.status === 200 && tagList.json.length >= 4);

const newTag = await req('POST', '/api/tags', {
  token: T,
  body: { name: `Smoke Test ${Date.now()}`, color: '#a855f7' },
});
check('create tag → 201', newTag.status === 201 && !!newTag.json.id);
const tagId = newTag.json.id;

const dupTag = await req('POST', '/api/tags', {
  token: T,
  body: { name: newTag.json.name },
});
check('duplicate tag name → 409', dupTag.status === 409);

const badColor = await req('POST', '/api/tags', {
  token: T,
  body: { name: 'Bad Color', color: 'purple' },
});
check('invalid color → 400', badColor.status === 400);

const updTag = await req('PUT', `/api/tags/${tagId}`, {
  token: T,
  body: { color: '#22c55e' },
});
check('update tag color → 200', updTag.status === 200 && updTag.json.color === '#22c55e');

// ---------- 3. sessions CRUD + filters ----------
console.log('\n[3] Sessions');
const sesList = await req('GET', '/api/sessions', { token: T });
check('list sessions → 200, seeded data present', sesList.status === 200 && sesList.json.length > 50);

const newSes = await req('POST', '/api/sessions', {
  token: T,
  body: { started_at: '2026-07-03T09:00:00', duration_minutes: 50, tag_id: tagId, note: 'smoke' },
});
check('create session → 201', newSes.status === 201 && !!newSes.json.id);
const sesId = newSes.json.id;

const badDur = await req('POST', '/api/sessions', {
  token: T,
  body: { started_at: '2026-07-03T09:00:00', duration_minutes: -5 },
});
check('negative duration → 400', badDur.status === 400);

const zeroDur = await req('POST', '/api/sessions', {
  token: T,
  body: { started_at: '2026-07-03T09:00:00', duration_minutes: 0 },
});
check('zero duration → 400', zeroDur.status === 400);

const futureStart = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
const future = await req('POST', '/api/sessions', {
  token: T,
  body: { started_at: futureStart, duration_minutes: 30 },
});
check('future started_at → 400', future.status === 400);

const filt = await req('GET', `/api/sessions?tag_id=${tagId}`, { token: T });
check('filter by tag_id → only that tag', filt.status === 200 && filt.json.every((s) => s.tag_id === tagId));

const range = await req('GET', '/api/sessions?from=2026-07-01&to=2026-07-04', { token: T });
check('filter by date range → 200, non-empty', range.status === 200 && range.json.length > 0);

const updSes = await req('PUT', `/api/sessions/${sesId}`, {
  token: T,
  body: { duration_minutes: 75, tag_id: null },
});
check('partial update session → 200', updSes.status === 200 && updSes.json.duration_minutes === 75 && updSes.json.tag_id === null);

// ---------- 4. cross-user isolation ----------
console.log('\n[4] Security: cross-user isolation');
const intruder = await req('POST', '/api/auth/signup', {
  body: { name: 'Intruder', email: `intruder${Date.now()}@test.com`, password: 'password123' },
});
const T2 = intruder.json.token;
check('signup second user → 201', intruder.status === 201 && !!T2);

const stealRead = await req('GET', '/api/sessions', { token: T2 });
check("second user sees NONE of demo's sessions", stealRead.status === 200 && stealRead.json.length === 0);

const stealUpdate = await req('PUT', `/api/tags/${tagId}`, { token: T2, body: { name: 'stolen' } });
check("second user can't update demo's tag → 404", stealUpdate.status === 404);

const stealDelete = await req('DELETE', `/api/sessions/${sesId}`, { token: T2 });
check("second user can't delete demo's session → 404", stealDelete.status === 404);

const stealAttach = await req('POST', '/api/sessions', {
  token: T2,
  body: { started_at: '2026-07-03T10:00:00', duration_minutes: 30, tag_id: tagId },
});
check("second user can't attach demo's tag → 400", stealAttach.status === 400);

// ---------- 5. analytics ----------
console.log('\n[5] Analytics');
const weekly = await req('GET', '/api/analytics/weekly', { token: T });
check('weekly → exactly 7 rows, zero days included', weekly.status === 200 && weekly.json.length === 7);
check('weekly dates are plain YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(weekly.json[0]?.date ?? ''));

const tagsA = await req('GET', '/api/analytics/tags', { token: T });
check('tags analytics → has name/color/minutes', tagsA.status === 200 && tagsA.json.every((r) => r.name && r.color && r.minutes >= 0));

const heat = await req('GET', '/api/analytics/heatmap', { token: T });
check('heatmap → rows with date+minutes', heat.status === 200 && heat.json.length > 30 && heat.json.every((r) => r.date && r.minutes > 0));

const streaks = await req('GET', '/api/analytics/streaks', { token: T });
check(
  'streaks → both fields, current ≤ longest',
  streaks.status === 200 &&
    Number.isInteger(streaks.json.current_streak) &&
    Number.isInteger(streaks.json.longest_streak) &&
    streaks.json.current_streak <= streaks.json.longest_streak
);

// ---------- 6. ML insights ----------
console.log('\n[6] ML insights');
const ins = await req('GET', '/api/insights/best-hours', { token: T });
if (ins.json.available) {
  check('best-hours → available, 18 hourly rows', ins.json.hourly?.length === 18);
  check('best-hours → top 3 hours listed', ins.json.best_hours?.length === 3);
} else {
  check('best-hours (Flask down?) → graceful degradation', ins.status === 200 && !!ins.json.reason, JSON.stringify(ins.json));
  console.log('        (start the ML service to test the full prediction path)');
}

const insFresh = await req('GET', '/api/insights/best-hours', { token: T2 });
check('best-hours with <10 sessions → "Not enough data yet"', insFresh.status === 200 && insFresh.json.available === false && insFresh.json.reason === 'Not enough data yet');

// ---------- 7. cleanup ----------
console.log('\n[7] Cleanup (delete what this test created)');
const delSes = await req('DELETE', `/api/sessions/${sesId}`, { token: T });
check('delete test session → 204', delSes.status === 204);
const delTag = await req('DELETE', `/api/tags/${tagId}`, { token: T });
check('delete test tag → 204', delTag.status === 204);

// ---------- summary ----------
console.log(`\n${'='.repeat(40)}`);
console.log(`  ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));
process.exit(failed === 0 ? 0 : 1);
