import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  OfflineClient,
  ApiError,
  type LocalStorageAdapter,
  type SavedTransaction,
  type Envelope,
} from '../../apps/web/src/lib/offline-engine.ts';
import { SessionManager } from '../../apps/web/src/lib/session-manager.ts';
class MemoryStorage implements LocalStorageAdapter {
  data = new Map<string, string>();
  fail = false;
  locks = new Map<string, Promise<unknown>>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    if (this.fail) throw new Error('Disk is full');
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
  runExclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const result = (this.locks.get(key) ?? Promise.resolve()).then(work);
    this.locks.set(
      key,
      result.catch(() => {}),
    );
    return result;
  }
}
const json = (data: unknown, status = 200) =>
  new Response(
    JSON.stringify({
      success: status < 400,
      message:
        status === 401
          ? 'Unauthorized'
          : status === 400
            ? 'Insufficient balance'
            : 'OK',
      data,
    }),
    { status },
  );
function fixture(storage = new MemoryStorage()) {
  let count = 0,
    balance = 500;
  const records: SavedTransaction[] = [];
  let online = true,
    unauthorized = false,
    lostResponse = false,
    rejectWrites = false;
  const writes: {
    method: string;
    body: Record<string, unknown>;
    account: string | null;
  }[] = [];
  const transport = async (path: string, init: RequestInit = {}) => {
    if (!online) throw new TypeError('Network request failed');
    if (unauthorized) return json(null, 401);
    const method = init.method ?? 'GET';
    if (method === 'GET') {
      if (path.startsWith('/transactions')) return json([...records]);
      if (path === '/preferences')
        return json({ currency: 'INR', theme: 'dark' });
      if (path === '/balance') return json({ balance });
      if (path.startsWith('/summary'))
        return json({
          balance: balance.toFixed(2),
          month: '2026-10',
          income: '0.00',
          expense: '0.00',
          daily: [],
          monthly: [],
        });
      return json([]);
    }
    const body = init.body ? JSON.parse(String(init.body)) : {};
    writes.push({
      method,
      body,
      account: new Headers(init.headers).get('X-Account-ID'),
    });
    if (rejectWrites) return json(null, 400);
    const type = path.split('/')[1] as 'income' | 'expense';
    const id = method === 'POST' ? body.id : path.split('/')[2];
    const previous = records.find((row) => row.id === id);
    if (path === '/preferences') return json(body);
    if (method === 'POST' && !previous) {
      records.push({
        id,
        type,
        amount: Number(body.amount).toFixed(2),
        source: body.source ?? null,
        category: body.category ?? null,
        description: body.description ?? null,
        occurredAt: body.occurredAt,
        createdAt: new Date().toISOString(),
      });
      balance += (type === 'income' ? 1 : -1) * Number(body.amount);
    } else if (method === 'PATCH' && previous) {
      balance +=
        (type === 'income' ? 1 : -1) *
        (Number(body.amount) - Number(previous.amount));
      Object.assign(previous, body, { amount: Number(body.amount).toFixed(2) });
    } else if (method === 'DELETE') {
      if (!previous) return json({ id }, 404);
      balance -= (type === 'income' ? 1 : -1) * Number(previous.amount);
      records.splice(records.indexOf(previous), 1);
    }
    if (lostResponse) {
      lostResponse = false;
      throw new TypeError('Response lost after commit');
    }
    return json(records.find((row) => row.id === id) ?? { id });
  };
  const uuid = () =>
    `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`;
  const client = new OfflineClient(storage, transport, uuid);
  return {
    storage,
    client,
    transport,
    records,
    writes,
    uuid,
    balance: () => balance,
    network(value: boolean) {
      online = value;
      client.setOnline(value);
    },
    expire() {
      unauthorized = true;
    },
    loseResponse() {
      lostResponse = true;
    },
    reject(value: boolean) {
      rejectWrites = value;
    },
  };
}
async function prime(f: ReturnType<typeof fixture>) {
  await f.client.activate('account-a', true);
  for (const path of ['/transactions', '/summary', '/balance', '/preferences'])
    await f.client.request(path);
}
const income = (amount: number) => ({
  method: 'POST',
  body: JSON.stringify({
    amount,
    source: 'salary',
    occurredAt: '2026-10-13T00:00:00.000Z',
  }),
});
const expense = (amount: number) => ({
  method: 'POST',
  body: JSON.stringify({
    amount,
    category: 'food',
    occurredAt: '2026-10-13T00:00:00.000Z',
  }),
});
const rows = async (client: OfflineClient, path = '/transactions') =>
  (await client.request<Envelope>(path)).data as SavedTransaction[];
const data = async (client: OfflineClient, path: string) =>
  (await client.request<Envelope>(path)).data as Record<string, unknown>;
for (const file of ['offline-engine.ts', 'session-manager.ts'])
  test(`web and native use identical ${file} behavior`, () => {
    const normalize = (source: string) => {
      function visit(node: ts.Node): unknown {
        if (ts.isParenthesizedExpression(node)) return visit(node.expression);
        const children: unknown[] = [];
        ts.forEachChild(node, (child) => {
          children.push(visit(child));
        });
        return [
          node.kind,
          ts.isIdentifier(node) || ts.isLiteralExpression(node)
            ? node.text
            : null,
          children,
        ];
      }
      return JSON.stringify(
        visit(
          ts.createSourceFile(
            'source.ts',
            source,
            ts.ScriptTarget.Latest,
            true,
          ),
        ),
      );
    };
    assert.equal(
      normalize(
        readFileSync(
          new URL(`../../apps/web/src/lib/${file}`, import.meta.url),
          'utf8',
        ),
      ),
      normalize(
        readFileSync(
          new URL(
            `../../apps/kharchabaki-native/src/lib/${file}`,
            import.meta.url,
          ),
          'utf8',
        ),
      ),
    );
  });
test('offline writes survive restart and update history, totals, and balance', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  assert.equal(
    (await f.client.request<Envelope>('/income', income(25.15))).pending,
    true,
  );
  await f.client.request('/expense', expense(10.1));
  const restored = new OfflineClient(f.storage, f.transport, f.uuid);
  restored.setOnline(false);
  await restored.activate('account-a', true);
  assert.equal(
    (await rows(restored, '/transactions?month=2026-10&type=income')).length,
    1,
  );
  assert.equal((await rows(restored))[0].pending, true);
  const summary = await data(restored, '/summary?month=2026-10');
  assert.equal(summary.income, '25.15');
  assert.equal(summary.expense, '10.10');
  assert.equal(summary.balance, '515.05');
  assert.equal(restored.getSnapshot().pending, 2);
  assert.equal(f.writes.length, 0);
});
test('offline create/edit coalesces and deleting an unsent creation cancels it', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/expense', expense(10));
  const id = (await rows(f.client))[0].id;
  await f.client.request(`/expense/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      amount: 15,
      category: 'groceries',
      occurredAt: '2026-09-30T00:00:00.000Z',
    }),
  });
  assert.equal(f.client.getSnapshot().pending, 1);
  assert.equal((await rows(f.client, '/transactions?month=2026-10')).length, 0);
  assert.equal(
    (await rows(f.client, '/transactions?month=2026-09'))[0].amount,
    '15.00',
  );
  await f.client.request(`/expense/${id}`, { method: 'DELETE' });
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.equal((await data(f.client, '/balance')).balance, 500);
});
test('reconnection replays in order with client UUIDs and the expected account', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/income', income(100));
  await f.client.request('/expense', expense(20));
  f.network(true);
  await f.client.flush();
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.equal(f.balance(), 580);
  assert.equal(f.records.length, 2);
  assert.ok(
    f.writes.every(
      (row) => row.account === 'account-a' && typeof row.body.id === 'string',
    ),
  );
  f.network(false);
  assert.equal(
    (await data(f.client, '/summary?month=2026-10')).balance,
    '580.00',
  );
});
test('a lost response retries the same UUID without double counting', async () => {
  const f = fixture();
  await prime(f);
  f.loseResponse();
  await f.client.request('/income', income(50));
  assert.equal(f.balance(), 550);
  assert.equal(f.client.getSnapshot().pending, 1);
  f.network(true);
  await f.client.flush();
  assert.equal(f.balance(), 550);
  assert.equal(f.records.length, 1);
  assert.equal(f.writes[0].body.id, f.writes[1].body.id);
  f.network(false);
  assert.equal((await data(f.client, '/balance')).balance, 550);
});
test('editing an uncertain creation queues a patch after the original', async () => {
  const f = fixture();
  await prime(f);
  f.loseResponse();
  await f.client.request('/income', income(50));
  const id = String(f.client.getPending()[0].body.id);
  await f.client.request(`/income/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: 30, source: 'salary' }),
  });
  assert.equal(f.client.getSnapshot().pending, 2);
  f.network(true);
  await f.client.flush();
  assert.equal(f.balance(), 530);
  assert.equal(f.records[0].amount, '30.00');
});
test('server rejections stay visible and can be corrected or discarded', async () => {
  const f = fixture();
  await prime(f);
  f.reject(true);
  await f.client.request('/expense', expense(10));
  assert.equal(f.client.getSnapshot().pending, 1);
  assert.equal(f.client.getSnapshot().error, 'Insufficient balance');
  const id = String(f.client.getPending()[0].body.id);
  f.network(false);
  await f.client.request(`/expense/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: 5, category: 'food' }),
  });
  assert.equal(f.client.getPending()[0].error, undefined);
  assert.equal(f.client.getPending()[0].body.amount, 5);
  await f.client.discard(f.client.getPending()[0].id);
  assert.equal(f.client.getSnapshot().pending, 0);
});
test('401 responses trigger login instead of falling back to cached data', async () => {
  const f = fixture();
  await prime(f);
  let expired = false;
  f.client.onUnauthorized(() => {
    expired = true;
  });
  f.expire();
  await assert.rejects(
    f.client.request('/balance'),
    (error) => error instanceof ApiError && error.status === 401,
  );
  assert.equal(expired, true);
});
test('accounts have separate saved histories and queues', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/income', income(50));
  f.client.deactivate();
  await f.client.activate('account-b', true);
  assert.equal(f.client.getSnapshot().pending, 0);
  await assert.rejects(f.client.request('/transactions'));
  await f.client.activate('account-a', true);
  assert.equal(f.client.getSnapshot().pending, 1);
});
test('failed persistence never reports a write as saved', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  f.storage.fail = true;
  await assert.rejects(f.client.request('/income', income(5)), /Disk is full/);
  assert.equal(f.client.getSnapshot().pending, 0);
});
test('balance validation works offline and loans require a connection', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await assert.rejects(
    f.client.request('/expense', expense(500.01)),
    /Insufficient balance/,
  );
  await assert.rejects(
    f.client.request('/loans/taken', { method: 'POST', body: '{}' }),
    /Connect/,
  );
  assert.equal(f.client.getSnapshot().pending, 0);
});
test('preferences remain available offline and update immediately', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  const result = await f.client.request<Envelope>('/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ currency: 'USD', theme: 'ocean' }),
  });
  assert.deepEqual(result.data, { currency: 'USD', theme: 'ocean' });
  assert.deepEqual(await data(f.client, '/preferences'), result.data);
});
test("two tabs cannot overwrite each other's queue or concurrently replay it", async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  const second = new OfflineClient(
    f.storage,
    f.transport,
    () => '00000000-0000-4000-8000-999999999999',
  );
  second.setOnline(false);
  await second.activate('account-a', true);
  await Promise.all([
    f.client.request('/income', income(50)),
    second.request('/expense', expense(10)),
  ]);
  await f.client.reload();
  assert.equal(f.client.getSnapshot().pending, 2);
  f.network(true);
  second.setOnline(true);
  await Promise.all([f.client.flush(), second.flush()]);
  assert.equal(f.balance(), 540);
  assert.equal(f.records.length, 2);
});
const sessionData = (expiresAt: string) => ({
  user: { id: 'account-a', name: 'Test Person', email: 'test@example.com' },
  session: { id: 'session-1', expiresAt },
});
test('a valid saved session opens offline; an expired one opens login', async () => {
  const f = fixture();
  f.network(false);
  await f.storage.setItem(
    'kharchabaki:session:v1',
    JSON.stringify(sessionData(new Date(Date.now() + 60_000).toISOString())),
  );
  const session = new SessionManager(f.storage, f.client, f.transport);
  await session.bootstrap();
  assert.equal(session.getSnapshot().data?.user.id, 'account-a');
  assert.equal(session.getSnapshot().isPending, false);
  const other = fixture();
  other.network(false);
  await other.storage.setItem(
    'kharchabaki:session:v1',
    JSON.stringify(sessionData('2020-01-01T00:00:00.000Z')),
  );
  const expired = new SessionManager(
    other.storage,
    other.client,
    other.transport,
  );
  await expired.bootstrap();
  assert.equal(expired.getSnapshot().data, null);
  assert.equal(expired.getSnapshot().reason, 'expired');
});
test('session expiry retains unsynced work for the same account', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/income', income(10));
  const session = new SessionManager(f.storage, f.client, f.transport);
  await session.expire();
  assert.equal(session.getSnapshot().data, null);
  await f.client.activate('account-a', true);
  assert.equal(f.client.getSnapshot().pending, 1);
});
test('session snapshots omit authentication tokens', async () => {
  const f = fixture();
  const details = sessionData(new Date(Date.now() + 60_000).toISOString());
  const session = new SessionManager(f.storage, f.client, async () =>
    json({
      session: {
        ...details,
        session: { ...details.session, token: 'secret-token' },
      },
    }),
  );
  await session.bootstrap();
  assert.equal(session.getSnapshot().data?.user.id, 'account-a');
  assert.ok(
    !f.storage.data.get('kharchabaki:session:v1')?.includes('secret-token'),
  );
});

test('repeated offline edits of an existing transaction collapse into the latest change', async () => {
  const f = fixture();
  await prime(f);
  await f.client.request('/expense', expense(20));
  const id = (await rows(f.client))[0].id;
  f.network(false);
  await f.client.request(`/expense/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: 15, category: 'food' }),
  });
  await f.client.request(`/expense/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: 10, category: 'food' }),
  });
  assert.equal(f.client.getSnapshot().pending, 1);
  assert.equal((await data(f.client, '/balance')).balance, 490);
  await f.client.request(`/expense/${id}`, { method: 'DELETE' });
  assert.equal(f.client.getSnapshot().pending, 1);
  assert.equal(f.client.getPending()[0].method, 'DELETE');
  assert.equal((await data(f.client, '/balance')).balance, 500);
  f.network(true);
  await f.client.flush();
  assert.equal(f.balance(), 500);
  assert.equal(f.records.length, 0);
});
test('a verification response arriving after expiry cannot reopen the expired session', async () => {
  const f = fixture();
  let complete: (response: Response) => void;
  const response = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  const session = new SessionManager(f.storage, f.client, () => response);
  const request = session.refresh();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await session.expire();
  complete!(
    json({ session: sessionData(new Date(Date.now() + 60_000).toISOString()) }),
  );
  await request;
  assert.equal(session.getSnapshot().data, null);
  assert.equal(session.getSnapshot().reason, 'expired');
});

test('account cache resets happen before the restored session becomes visible', async () => {
  const f = fixture();
  const details = sessionData(new Date(Date.now() + 60_000).toISOString());
  await f.storage.setItem('kharchabaki:session:v1', JSON.stringify(details));
  const manager = new SessionManager(f.storage, f.client, async () =>
    json({ session: details }),
  );
  const previous: (string | null)[] = [];
  manager.onAccountChange(() =>
    previous.push(manager.getSnapshot().data?.user.id ?? null),
  );
  await manager.bootstrap();
  assert.deepEqual(previous, [null]);
  await manager.expire();
  assert.deepEqual(previous, [null, 'account-a']);
});

function deviceFixture(storage = new MemoryStorage()) {
  let count = 0;
  const calls: string[] = [];
  const client = new OfflineClient(
    storage,
    async (path) => {
      calls.push(path);
      throw new Error('Device mode must not use the network');
    },
    () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}`,
  );
  return { client, storage, calls };
}
test('activation defaults to a complete device workspace and never sends online reads', async () => {
  const f = deviceFixture();
  await f.client.activate('local:device');
  assert.equal(f.client.getSnapshot().syncEnabled, false);
  assert.equal(f.client.getSnapshot().ready, true);
  assert.deepEqual(f.client.getCachedPreferences(), {
    currency: 'INR',
    theme: 'dark',
  });
  assert.deepEqual(await rows(f.client), []);
  assert.deepEqual(await data(f.client, '/balance'), { balance: 0 });
  assert.deepEqual(await data(f.client, '/preferences'), {
    currency: 'INR',
    theme: 'dark',
  });
  for (const path of ['/income', '/expense', '/loans/taken', '/loans/given'])
    assert.deepEqual((await f.client.request<Envelope>(path)).data, []);
  const summary = await data(f.client, '/summary?month=2026-02');
  assert.equal(summary.balance, '0.00');
  assert.equal(summary.income, '0.00');
  assert.equal(summary.expense, '0.00');
  assert.equal((summary.daily as unknown[]).length, 28);
  assert.equal((summary.monthly as unknown[]).length, 6);
  await f.client.flush();
  assert.deepEqual(f.calls, []);
});
test('device transactions, edits, dates, preferences and opening balance survive restart without an outbox', async () => {
  const f = deviceFixture();
  await f.client.activate('account-free');
  await f.client.request('/balance', {
    method: 'POST',
    body: JSON.stringify({ amount: 100 }),
  });
  const saved = await f.client.request<Envelope>('/income', income(25.15));
  assert.equal(saved.pending, false);
  const id = String((saved.data as SavedTransaction).id);
  await f.client.request('/expense', expense(10.1));
  await f.client.request(`/income/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      amount: 30.15,
      source: 'freelance',
      description: 'A long project',
      occurredAt: '2026-09-30T00:00:00.000Z',
    }),
  });
  await f.client.request('/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ currency: 'JPY', theme: 'forest' }),
  });
  assert.deepEqual(f.client.getCachedPreferences(), {
    currency: 'JPY',
    theme: 'forest',
  });
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.deepEqual(f.client.getPending(), []);
  const restored = deviceFixture(f.storage);
  restored.client.setOnline(false);
  await restored.client.activate('account-free');
  const previous = await rows(
    restored.client,
    '/transactions?month=2026-09&type=income&category=freelance&search=project',
  );
  assert.equal(previous.length, 1);
  assert.equal(previous[0].pending, false);
  const october = await data(restored.client, '/summary?month=2026-10');
  assert.equal(october.income, '0.00');
  assert.equal(october.expense, '10.10');
  assert.equal(october.balance, '120.05');
  assert.equal(
    (await data(restored.client, '/summary?month=2026-09')).income,
    '30.15',
  );
  await restored.client.request(`/income/${id}`, { method: 'DELETE' });
  assert.equal((await data(restored.client, '/balance')).balance, 89.9);
  assert.deepEqual(await data(restored.client, '/preferences'), {
    currency: 'JPY',
    theme: 'forest',
  });
  assert.deepEqual([...f.calls, ...restored.calls], []);
});
test('offline document version 1 migrates without losing saved records', async () => {
  const storage = new MemoryStorage();
  storage.data.set('kharchabaki:local:v1:legacy', JSON.stringify({ version: 1, cache: {}, records: [], completeHistory: true, balance: 12, outbox: [], lastSyncedAt: null }));
  const f = deviceFixture(storage);
  await f.client.activate('legacy');
  assert.equal((await data(f.client, '/balance')).balance, 12);
  const saved = JSON.parse(storage.data.get('kharchabaki:local:v1:legacy')!);
  assert.equal(saved.version, 2);
  assert.deepEqual(saved.budgets, {});
});

test('device mode persists budgets, custom labels, and recurring schedules', async () => {
  const f = deviceFixture();
  await f.client.activate('local:features');
  await f.client.request('/budgets', { method: 'POST', body: JSON.stringify({ month: '2026-10', category: 'pet-care', amount: 50, alertThreshold: 80 }) });
  await f.client.request('/finance-labels', { method: 'POST', body: JSON.stringify({ kind: 'expense', key: 'pet-care', name: 'Pet care' }) });
  await f.client.request('/recurring', { method: 'POST', body: JSON.stringify({ type: 'expense', amount: 15, category: 'pet-care', schedule: 'monthly', startAt: '2099-01-01T00:00:00.000Z' }) });
  assert.equal(((await data(f.client, '/budgets?month=2026-10')) as unknown[]).length, 1);
  assert.equal(((await data(f.client, '/finance-labels')) as unknown as unknown[]).length, 1);
  assert.equal(((await data(f.client, '/recurring')) as unknown as unknown[]).length, 1);
  const restored = deviceFixture(f.storage);
  await restored.client.activate('local:features');
  assert.equal(((await data(restored.client, '/finance-labels')) as unknown as unknown[]).length, 1);
  assert.equal(((await data(restored.client, '/recurring')) as unknown as unknown[]).length, 1);
});

test('local recurring schedules generate due transactions only once', async () => {
  const f = deviceFixture();
  await f.client.activate('local:recurrence');
  await f.client.request('/balance', { method: 'POST', body: JSON.stringify({ amount: 100 }) });
  await f.client.request('/recurring', { method: 'POST', body: JSON.stringify({ type: 'expense', amount: 15, category: 'rent', schedule: 'monthly', startAt: '2020-01-31T00:00:00.000Z' }) });
  await f.client.request('/recurring');
  const schedules = (await data(f.client, '/recurring')) as Record<string, unknown>[];
  assert.equal(new Date(String(schedules[0]?.nextRunAt)).getUTCDate(), 31);
  const before = await rows(f.client);
  assert.ok(before.length > 1);
  const after = await rows(f.client, '/transactions');
  assert.equal(after.length, before.length);
  assert.ok((await data(f.client, '/balance')).balance < 100);
});

test('device archive export and restore round-trip without session data', async () => {
  const f = deviceFixture();
  await f.client.activate('local:archive');
  await f.client.request('/balance', { method: 'POST', body: JSON.stringify({ amount: 100 }) });
  await f.client.request('/loans/given', { method: 'POST', body: JSON.stringify({ amount: '20', borrowerName: 'Alex', phoneNumber: '+15551234567', dueDate: '2099-01-01' }) });
  const archive = f.client.exportFinanceArchive();
  assert.equal((archive.loans.given as Record<string, unknown>[])[0]?.phoneNumber, '+15551234567');
  const restored = deviceFixture();
  await restored.client.activate('local:restore');
  await restored.client.restoreFinanceArchive(archive);
  assert.equal((((await data(restored.client, '/loans/given'))[0] as Record<string, unknown>).phoneNumber), '+15551234567');
});

test('device borrowing, lending and interest repayments update balances and persist payment history', async () => {
  const f = deviceFixture();
  await f.client.activate('local:device');
  f.client.setOnline(false);
  const borrowed = await f.client.request<Envelope>('/loans/taken', {
    method: 'POST',
    body: JSON.stringify({
      amount: '100.10',
      interest: '10',
      borrowedFrom: 'Bank',
      dueDate: '2099-01-01',
    }),
  });
  const borrowedLoan = borrowed.data as Record<string, unknown>;
  assert.equal(borrowed.pending, false);
  assert.equal(borrowedLoan.totalAmount, '110.11');
  assert.equal((await data(f.client, '/balance')).balance, 100.1);
  const lent = await f.client.request<Envelope>('/loans/given', {
    method: 'POST',
    body: JSON.stringify({
      amount: '40.00',
      interest: '5',
      borrowerName: 'Alex',
      dueDate: '2020-01-01',
    }),
  });
  const lentLoan = lent.data as Record<string, unknown>;
  assert.equal(lentLoan.totalAmount, '42.00');
  assert.equal(lentLoan.status, 'overdue');
  assert.equal((await data(f.client, '/balance')).balance, 60.1);
  const paymentPath = `/loans/given/${lentLoan.id}/payments`;
  const payment = await f.client.request<Envelope>(paymentPath, {
    method: 'POST',
    body: JSON.stringify({ amount: '42.00' }),
  });
  assert.equal((payment.data as Record<string, unknown>).loanId, lentLoan.id);
  assert.equal((await data(f.client, '/balance')).balance, 102.1);
  await f.client.request(`/loans/taken/${borrowedLoan.id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ amount: '50' }),
  });
  assert.equal((await data(f.client, '/balance')).balance, 52.1);
  const restored = deviceFixture(f.storage);
  await restored.client.activate('local:device');
  const given = (await restored.client.request<Envelope>('/loans/given'))
    .data as Record<string, unknown>[];
  const taken = (await restored.client.request<Envelope>('/loans/taken'))
    .data as Record<string, unknown>[];
  assert.equal(given[0].status, 'paid');
  assert.equal(given[0].paidAmount, '42.00');
  assert.equal((given[0].payments as unknown[]).length, 1);
  assert.equal(taken[0].paidAmount, '50.00');
  assert.equal((taken[0].payments as unknown[]).length, 1);
  assert.equal(restored.client.getSnapshot().pending, 0);
  assert.deepEqual([...f.calls, ...restored.calls], []);
});
test('device loan edits preserve payments and balance, while deletes reverse full loan effects', async () => {
  const f = deviceFixture();
  await f.client.activate('local:device');
  const taken = (
    await f.client.request<Envelope>('/loans/taken', {
      method: 'POST',
      body: JSON.stringify({
        amount: '100',
        interest: '10',
        borrowedFrom: 'Bank',
        dueDate: '2099-01-01',
      }),
    })
  ).data as Record<string, unknown>;
  await f.client.request(`/loans/taken/${taken.id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ amount: '25' }),
  });
  const edited = (
    await f.client.request<Envelope>(`/loans/taken/${taken.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        amount: '120',
        interest: '0',
        borrowedFrom: 'Credit union',
        dueDate: '2099-02-01',
      }),
    })
  ).data as Record<string, unknown>;
  assert.equal(edited.amount, '120.00');
  assert.equal(edited.totalAmount, '120.00');
  assert.equal(edited.paidAmount, '25.00');
  assert.equal((edited.payments as unknown[]).length, 1);
  assert.equal((await data(f.client, '/balance')).balance, 95);
  await assert.rejects(
    f.client.request(`/loans/taken/${taken.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        amount: '20',
        interest: '0',
        borrowedFrom: 'Credit union',
        dueDate: '2099-02-01',
      }),
    }),
    /less than payments already recorded/,
  );
  await f.client.request(`/loans/taken/${taken.id}`, { method: 'DELETE' });
  assert.equal((await data(f.client, '/balance')).balance, 0);
  assert.deepEqual(await data(f.client, '/loans/taken'), []);

  await f.client.request('/balance', {
    method: 'POST',
    body: JSON.stringify({ amount: 200 }),
  });
  const given = (
    await f.client.request<Envelope>('/loans/given', {
      method: 'POST',
      body: JSON.stringify({
        amount: '50',
        interest: '10',
        borrowerName: 'Alex',
        dueDate: '2099-01-01',
      }),
    })
  ).data as Record<string, unknown>;
  await f.client.request(`/loans/given/${given.id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ amount: '20' }),
  });
  await f.client.request(`/loans/given/${given.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      amount: '60',
      interest: '0',
      borrowerName: 'Alex Kim',
      dueDate: '2099-03-01',
    }),
  });
  assert.equal((await data(f.client, '/balance')).balance, 160);
  await f.client.request(`/loans/given/${given.id}`, { method: 'DELETE' });
  assert.equal((await data(f.client, '/balance')).balance, 200);
  assert.deepEqual(await data(f.client, '/loans/given'), []);
});
test('device borrowed loan deletion is blocked when reversing payments would make balance negative', async () => {
  const f = deviceFixture();
  await f.client.activate('local:device');
  const taken = (
    await f.client.request<Envelope>('/loans/taken', {
      method: 'POST',
      body: JSON.stringify({
        amount: '20',
        borrowedFrom: 'Bank',
        dueDate: '2099-01-01',
      }),
    })
  ).data as Record<string, unknown>;
  await f.client.request(`/loans/taken/${taken.id}/payments`, {
    method: 'POST',
    body: JSON.stringify({ amount: '10' }),
  });
  await f.client.request('/expense', {
    method: 'POST',
    body: JSON.stringify({ amount: '5', category: 'food' }),
  });
  await assert.rejects(
    f.client.request(`/loans/taken/${taken.id}`, { method: 'DELETE' }),
    /Insufficient balance to reverse this loan/,
  );
  assert.equal((await data(f.client, '/balance')).balance, 5);
  assert.equal(((await data(f.client, '/loans/taken')) as unknown[]).length, 1);
});
test('device validation rejects invalid money, overspending, overpayment and failed persistence atomically', async () => {
  const f = deviceFixture();
  await f.client.activate('local:device');
  await assert.rejects(
    f.client.request('/expense', expense(1)),
    /Insufficient balance/,
  );
  await assert.rejects(
    f.client.request('/income', {
      method: 'POST',
      body: JSON.stringify({ amount: 1, source: 'unknown' }),
    }),
    /source or category/,
  );
  for (const amount of [-1, 1.001, null, ''])
    await assert.rejects(
      f.client.request('/balance', {
        method: 'POST',
        body: JSON.stringify({ amount }),
      }),
      /amount/,
    );
  await f.client.request('/balance', {
    method: 'POST',
    body: JSON.stringify({ amount: 10 }),
  });
  await assert.rejects(
    f.client.request('/loans/given', {
      method: 'POST',
      body: JSON.stringify({
        amount: '11',
        borrowerName: 'Alex',
        dueDate: '2099-01-01',
      }),
    }),
    /Insufficient balance/,
  );
  const loan = (
    await f.client.request<Envelope>('/loans/taken', {
      method: 'POST',
      body: JSON.stringify({
        amount: '20',
        borrowedFrom: 'Bank',
        dueDate: '2099-01-01',
      }),
    })
  ).data as Record<string, unknown>;
  await assert.rejects(
    f.client.request(`/loans/taken/${loan.id}/payments`, {
      method: 'POST',
      body: JSON.stringify({ amount: '20.01' }),
    }),
    /outstanding amount/,
  );
  await assert.rejects(
    f.client.request('/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ theme: 'unknown' }),
    }),
    /theme/,
  );
  f.storage.fail = true;
  await assert.rejects(f.client.request('/income', income(5)), /Disk is full/);
  assert.deepEqual(await rows(f.client), []);
  assert.equal((await data(f.client, '/balance')).balance, 30);
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.deepEqual(f.calls, []);
});
test('device accounts and premium workspaces stay isolated across entitlement changes', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/income', income(50));
  await f.client.activate('account-a', false);
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.equal((await data(f.client, '/balance')).balance, 550);
  await f.client.request('/income', income(7));
  await f.client.activate('account-b');
  assert.equal((await rows(f.client)).length, 0);
  await f.client.activate('account-a', true);
  assert.equal(f.client.getSnapshot().pending, 1);
  assert.equal((await data(f.client, '/balance')).balance, 550);
  assert.equal((await rows(f.client))[0].amount, '50.00');
  await f.client.activate('account-a');
  assert.equal((await data(f.client, '/balance')).balance, 557);
  assert.equal(
    (await rows(f.client)).find((row) => row.amount === '7.00')?.amount,
    '7.00',
  );
  assert.equal(f.writes.length, 0);
});
test('downgrade stops a running flush without waiting for transport and retains its original queue', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/income', income(50));
  await f.client.request('/expense', expense(20));
  let started!: () => void;
  let complete!: () => void;
  const sending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let calls = 0;
  const client = new OfflineClient(
    f.storage,
    async (path, init) => {
      calls++;
      started();
      await blocked;
      return f.transport(path, init);
    },
    f.uuid,
  );
  await client.activate('account-a', true);
  f.network(true);
  const flushing = client.flush();
  await sending;
  await client.activate('account-a');
  assert.equal(client.getSnapshot().syncEnabled, false);
  assert.equal(client.getSnapshot().syncing, false);
  await client.request('/income', income(7));
  await client.flush();
  assert.equal(calls, 1);
  complete();
  await flushing;
  assert.equal((await data(client, '/balance')).balance, 537);
  assert.equal(client.getSnapshot().lastSyncedAt, null);
  client.setOnline(false);
  await client.activate('account-a', true);
  assert.equal(client.getSnapshot().pending, 2);
  assert.equal((await data(client, '/balance')).balance, 530);
  client.setOnline(true);
  await client.flush();
  assert.equal(f.balance(), 530);
  assert.equal(f.records.length, 2);
  assert.equal(client.getSnapshot().pending, 0);
  await client.activate('account-a');
  assert.equal((await data(client, '/balance')).balance, 537);
});
test('a stale cloud read cannot overwrite the local workspace after downgrade', async () => {
  const f = deviceFixture();
  let started!: () => void;
  let complete!: (response: Response) => void;
  const sending = new Promise<void>((resolve) => {
    started = resolve;
  });
  const delayed = new Promise<Response>((resolve) => {
    complete = resolve;
  });
  const client = new OfflineClient(
    f.storage,
    () => {
      started();
      return delayed;
    },
    () => 'id',
  );
  await client.activate('account-a', true);
  const reading = client.request('/balance');
  await sending;
  await client.activate('account-a');
  await client.request('/balance', {
    method: 'POST',
    body: JSON.stringify({ amount: 12 }),
  });
  complete(json({ balance: 999 }));
  await assert.rejects(reading, /storage mode changed/);
  assert.equal((await data(client, '/balance')).balance, 12);
  assert.equal(f.storage.data.has('kharchabaki:data:v1:account-a'), false);
});
test('a forbidden cloud response disables all further finance sends and preserves queued work', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/income', income(10));
  let calls = 0;
  const client = new OfflineClient(
    f.storage,
    async () => {
      calls++;
      return json(null, 403);
    },
    f.uuid,
  );
  await client.activate('account-a', true);
  await client.flush();
  assert.equal(client.getSnapshot().syncEnabled, false);
  assert.equal(calls, 1);
  await client.request('/income', income(3));
  await client.request('/balance');
  await client.flush();
  assert.equal(calls, 1);
  client.setOnline(false);
  await client.activate('account-a', true);
  assert.equal(client.getSnapshot().pending, 1);
  await client.activate('account-a');
  assert.equal((await data(client, '/balance')).balance, 513);
});
test('concurrent device writes reload the active workspace under a storage lock', async () => {
  const f = deviceFixture();
  const second = new OfflineClient(
    f.storage,
    async () => {
      throw new Error('Network called');
    },
    () => '00000000-0000-4000-8000-999999999999',
  );
  await f.client.activate('local:device');
  await second.activate('local:device');
  await Promise.all([
    f.client.request('/income', income(10)),
    second.request('/income', income(20)),
  ]);
  await f.client.reload();
  assert.equal((await rows(f.client)).length, 2);
  assert.equal((await data(f.client, '/balance')).balance, 30);
  assert.equal(f.client.getSnapshot().pending, 0);
});

test('forbidden sync notifications observe the ready local document and can unsubscribe', async () => {
  const f = fixture();
  await prime(f);
  await f.client.activate('account-a');
  await f.client.request('/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ theme: 'rose', currency: 'GBP' }),
  });
  let calls = 0;
  const client = new OfflineClient(
    f.storage,
    async () => json(null, 403),
    f.uuid,
  );
  await client.activate('account-a', true);
  const unsubscribe = client.onSyncDisabled(() => {
    calls++;
    assert.equal(client.getSnapshot().ready, true);
    assert.equal(client.getSnapshot().syncEnabled, false);
    assert.deepEqual(client.getCachedPreferences(), {
      theme: 'rose',
      currency: 'GBP',
    });
  });
  await assert.rejects(
    client.request('/balance'),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.equal(calls, 1);
  unsubscribe();
  await client.activate('account-a', true);
  await assert.rejects(
    client.request('/balance'),
    (error) => error instanceof ApiError && error.status === 403,
  );
  assert.equal(calls, 1);
});
test('rapid device preference choices persist the final choice and notify only its query family', async () => {
  const f = deviceFixture();
  await f.client.activate('local:device');
  const changed: (string | undefined)[] = [];
  f.client.onDataChange((path) => changed.push(path));
  await Promise.all(
    ['ocean', 'forest', 'rose'].map((theme) =>
      f.client.request('/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ theme }),
      }),
    ),
  );
  assert.deepEqual(f.client.getCachedPreferences(), {
    currency: 'INR',
    theme: 'rose',
  });
  assert.deepEqual(changed, ['/preferences', '/preferences', '/preferences']);
  const restored = deviceFixture(f.storage);
  await restored.client.activate('local:device');
  assert.deepEqual(restored.client.getCachedPreferences(), {
    currency: 'INR',
    theme: 'rose',
  });
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.deepEqual(f.calls, []);
});

test('first device activation copies only that account cached projection once and preserves its cloud outbox', async () => {
  const f = fixture();
  await prime(f);
  f.network(false);
  await f.client.request('/income', income(50));
  await f.client.request('/preferences', {
    method: 'PATCH',
    body: JSON.stringify({ currency: 'USD', theme: 'ocean' }),
  });
  const cloudKey = 'kharchabaki:data:v1:account-a';
  const cloud = JSON.parse(f.storage.data.get(cloudKey)!);
  const cachedLoan = {
    id: 'loan-1',
    amount: '10.00',
    totalAmount: '10.00',
    paidAmount: '0.00',
    interest: '0.00',
    borrowedFrom: 'Bank',
    dueDate: '2099-01-01T00:00:00.000Z',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    payments: [],
  };
  cloud.cache['/loans/taken'] = {
    success: true,
    message: 'Saved loans',
    data: [cachedLoan],
  };
  f.storage.data.set(cloudKey, JSON.stringify(cloud));
  const original = f.storage.data.get(cloudKey);
  await f.client.activate('account-a');
  assert.equal((await data(f.client, '/balance')).balance, 550);
  const copied = await rows(f.client);
  assert.equal(copied.length, 1);
  assert.equal(copied[0].pending, false);
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.deepEqual(f.client.getCachedPreferences(), {
    currency: 'USD',
    theme: 'ocean',
  });
  assert.deepEqual((await f.client.request<Envelope>('/loans/taken')).data, [
    cachedLoan,
  ]);
  assert.equal(f.storage.data.get(cloudKey), original);
  await f.client.request('/income', income(7));
  await f.client.activate('account-b');
  assert.equal((await data(f.client, '/balance')).balance, 0);
  assert.deepEqual(await rows(f.client), []);
  assert.deepEqual(f.client.getCachedPreferences(), {
    currency: 'INR',
    theme: 'dark',
  });
  await f.client.activate('local:device');
  assert.deepEqual(await rows(f.client), []);
  await f.client.activate('account-a', true);
  assert.equal(f.client.getSnapshot().pending, 2);
  assert.equal((await data(f.client, '/balance')).balance, 550);
  await f.client.request('/income', income(30));
  await f.client.activate('account-a');
  assert.equal((await data(f.client, '/balance')).balance, 557);
  assert.equal((await rows(f.client)).length, 2);
  assert.equal(f.client.getSnapshot().pending, 0);
  assert.equal(f.writes.length, 0);
});
test('invalid saved documents fail activation without replacing them or falling back to another mode', async () => {
  const f = deviceFixture();
  const localKey = 'kharchabaki:local:v1:account-a';
  const cloudKey = 'kharchabaki:data:v1:account-a';
  f.storage.data.set(
    cloudKey,
    JSON.stringify({ version: 1, records: [], outbox: [] }),
  );
  await assert.rejects(
    f.client.activate('account-a'),
    /Saved data could not be read/,
  );
  assert.equal(f.storage.data.has(localKey), false);
  f.storage.data.set(localKey, 'null');
  await assert.rejects(
    f.client.activate('account-a'),
    /Saved data could not be read/,
  );
  assert.equal(f.storage.data.get(localKey), 'null');
  assert.deepEqual(f.calls, []);
});
