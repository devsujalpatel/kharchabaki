import { after, before, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { memoryAdapter } from 'better-auth/adapters/memory';

// Run the real auth configuration, handlers, API router, and Drizzle expressions
// against an in-memory transport. No database connection or entitlement writes.
process.env.BETTER_AUTH_SECRET = 'premium-api-test-secret-at-least-32-characters';
process.env.BETTER_AUTH_URL = 'http://localhost:4000';
process.env.FRONTEND_URL_WEB = 'http://localhost:3000';
process.env.FRONTEND_URL_APP = 'kharchabaki://';
process.env.GOOGLE_CLIENT_ID = 'test-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

const memory = { user: [], session: [], account: [], verification: [] };
const dialect = new PgDialect();
let calls = [];
function builder(operation, table, projection) {
  const call = { operation, table, projection };
  calls.push(call);
  const result = {
    from(value) { call.table = value; return this; },
    where(value) { call.where = dialect.sqlToQuery(value); return this; },
    set(value) { call.values = value; return this; },
    returning() { return this; },
    limit() { return this; },
    orderBy() { return this; },
    groupBy() { return this; },
    then(resolve, reject) {
      const row = getTableName(call.table) === 'user'
        ? memory.user.find((account) => account.id === call.where?.params[0])
        : null;
      if (operation === 'update' && row) Object.assign(row, call.values);
      const full = row ? { balance: '100.00', currency: 'INR', theme: 'dark', ...row } : null;
      const data = full ? [projection
        ? Object.fromEntries(Object.keys(projection).map((key) => [key, full[key]]))
        : full] : [];
      return Promise.resolve(data).then(resolve, reject);
    },
  };
  return result;
}
const db = {
  select(projection) { return builder('select', null, projection); },
  update(table) { return builder('update', table); },
  query: {
    takenLoan: { findMany: async () => [] },
    givenLoan: { findMany: async () => [] },
  },
};
mock.module(new URL('../dist/database/client.js', import.meta.url).href, { namedExports: { db } });
mock.module('@better-auth/drizzle-adapter', {
  namedExports: { drizzleAdapter: () => memoryAdapter(memory) },
});

const { auth } = await import('../dist/lib/auth.js');
const { default: app } = await import('../dist/app.js');
const { user } = await import('../dist/database/schema.js');
let server;
let base;
let basic;
let premium;

async function authRequest(path, body, cookie) {
  const response = await auth.handler(new Request(`http://localhost:4000/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  }));
  return { response, body: await response.json() };
}
async function signup(email, extra = {}) {
  const result = await authRequest('sign-up/email', { name: 'Test account', email, password: 'test-password-1234', ...extra });
  assert.equal(result.response.status, 200, JSON.stringify(result.body));
  const cookie = result.response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  assert.ok(cookie.includes('session_token'));
  return { id: result.body.user.id, cookie };
}
async function request(path, { account = basic, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { ...(account ? { Cookie: account.cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { response, body: await response.json() };
}

before(async () => {
  basic = await signup('basic@example.test');
  premium = await signup('premium@example.test');
  memory.user.find((account) => account.id === premium.id).isPremium = true;
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});
beforeEach(() => { calls = []; });

const guarded = [
  ['GET', '/balance'], ['POST', '/balance'],
  ['GET', '/transactions'], ['GET', '/summary'],
  ['GET', '/income'], ['POST', '/income'], ['PATCH', '/income/record'], ['DELETE', '/income/record'],
  ['GET', '/expense'], ['POST', '/expense'], ['PATCH', '/expense/record'], ['DELETE', '/expense/record'],
  ['GET', '/loans/taken'], ['POST', '/loans/taken'], ['PATCH', '/loans/taken/record'], ['DELETE', '/loans/taken/record'], ['POST', '/loans/taken/record/payments'],
  ['GET', '/loans/given'], ['POST', '/loans/given'], ['PATCH', '/loans/given/record'], ['DELETE', '/loans/given/record'], ['POST', '/loans/given/record/payments'],
  ['GET', '/preferences'], ['PATCH', '/preferences'],
];
test('nonpremium accounts receive 403 before every cloud finance and preference read/write', async () => {
  for (const [method, path] of guarded) {
    calls = [];
    const result = await request(path, { method, body: method === 'GET' ? undefined : { amount: 10, isPremium: true } });
    assert.equal(result.response.status, 403, `${method} ${path}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.success, false);
    assert.match(result.body.message, /Premium/);
    assert.equal(calls.length, 1, 'only the entitlement lookup is allowed');
    assert.equal(calls[0].operation, 'select');
    assert.equal(getTableName(calls[0].table), 'user');
    assert.deepEqual(calls[0].where.params, [basic.id]);
  }
});

test('premium accounts can fetch their cloud data and update balance using the authenticated identity', async () => {
  for (const path of ['/balance', '/transactions', '/summary', '/income', '/expense', '/loans/taken', '/loans/given', '/preferences']) {
    const result = await request(path, { account: premium, headers: { 'X-Account-ID': premium.id } });
    assert.equal(result.response.status, 200, `${path}: ${JSON.stringify(result.body)}`);
    assert.equal(result.body.success, true);
  }
  calls = [];
  const saved = await request('/balance', { account: premium, method: 'POST', body: { amount: 25, userId: basic.id } });
  assert.equal(saved.response.status, 200);
  const write = calls.find((call) => call.operation === 'update');
  assert.deepEqual(write.where.params, [premium.id]);
  assert.equal(memory.user.find((account) => account.id === premium.id).balance, '25.00');
  assert.equal(memory.user.find((account) => account.id === basic.id).balance, undefined);
});

test('/me returns current entitlement for either account and health remains public', async () => {
  for (const [account, isPremium] of [[basic, false], [premium, true]]) {
    const result = await request('/me', { account, headers: { 'X-Account-ID': account.id } });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.data.session.user.id, account.id);
    assert.equal(result.body.data.session.user.isPremium, isPremium);
  }
  assert.equal((await request('/health', { account: null })).response.status, 200);
});

test('missing sessions and mismatched account headers never reach premium or financial data', async () => {
  assert.equal((await request('/balance', { account: null })).response.status, 401);
  assert.equal(calls.length, 0);
  for (const path of ['/balance', '/me']) {
    const result = await request(path, { account: basic, headers: { 'X-Account-ID': premium.id, 'X-Is-Premium': 'true' } });
    assert.equal(result.response.status, 401);
  }
  assert.equal(calls.length, 0);
  const spoofed = await request('/balance', { headers: { 'X-Is-Premium': 'true', 'X-Account-ID': basic.id } });
  assert.equal(spoofed.response.status, 403);
});

test('entitlement revocation is checked against the database even with a cached premium session', async () => {
  const row = memory.user.find((account) => account.id === premium.id);
  const cached = await auth.api.getSession({ headers: new Headers({ Cookie: premium.cookie }) });
  assert.equal(cached.user.isPremium, true);
  row.isPremium = false;
  const original = mock.method(auth.api, 'getSession', async () => cached);
  try {
    const denied = await request('/balance', { account: premium });
    assert.equal(denied.response.status, 403);
    assert.deepEqual(calls[0].where.params, [premium.id]);
    const current = await request('/me', { account: premium });
    assert.equal(current.body.data.session.user.isPremium, false);
  } finally {
    original.mock.restore();
    row.isPremium = true;
  }
});

test('a stale basic session observes a server-side upgrade without trusting client input', async () => {
  const cached = await auth.api.getSession({ headers: new Headers({ Cookie: basic.cookie }) });
  assert.equal(cached.user.isPremium, false);
  const row = memory.user.find((account) => account.id === basic.id);
  row.isPremium = true;
  const original = mock.method(auth.api, 'getSession', async () => cached);
  try {
    assert.equal((await request('/balance')).response.status, 200);
    assert.equal((await request('/me')).body.data.session.user.isPremium, true);
  } finally {
    original.mock.restore();
    row.isPremium = false;
  }
});

test('a cached session for a removed account fails closed before accessing financial data', async () => {
  const cached = await auth.api.getSession({ headers: new Headers({ Cookie: premium.cookie }) });
  const index = memory.user.findIndex((account) => account.id === premium.id);
  const [row] = memory.user.splice(index, 1);
  const original = mock.method(auth.api, 'getSession', async () => cached);
  try {
    const result = await request('/balance', { account: premium });
    assert.equal(result.response.status, 401);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].where.params, [premium.id]);
  } finally {
    original.mock.restore();
    memory.user.splice(index, 0, row);
  }
});

test('client signup and profile updates cannot enable premium; database defaults are false', async () => {
  const signupAttempt = await signup('forged@example.test', { isPremium: true });
  const row = memory.user.find((account) => account.id === signupAttempt.id);
  assert.equal(row.isPremium, false);
  const update = await authRequest('update-user', { name: 'Renamed account', isPremium: true }, signupAttempt.cookie);
  assert.equal(update.response.status, 400, JSON.stringify(update.body));
  assert.equal(row.isPremium, false);
  const normalUpdate = await authRequest('update-user', { name: 'Renamed account' }, signupAttempt.cookie);
  assert.equal(normalUpdate.response.status, 200);
  assert.equal(row.isPremium, false);
  assert.equal(user.isPremium.name, 'is_premium');
  assert.equal(user.isPremium.default, false);
  assert.equal(user.isPremium.notNull, true);
});

test('preference updates strip entitlement and other account IDs from client payloads', async () => {
  const result = await request('/preferences', { account: premium, method: 'PATCH', body: { theme: 'ocean', isPremium: true, userId: basic.id } });
  assert.equal(result.response.status, 200);
  const write = calls.find((call) => call.operation === 'update');
  assert.deepEqual(write.values, { theme: 'ocean' });
  assert.deepEqual(write.where.params, [premium.id]);
  assert.equal(memory.user.find((account) => account.id === basic.id).isPremium, false);
});
