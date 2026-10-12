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
  await f.client.activate('account-a');
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
  await restored.activate('account-a');
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
  await f.client.activate('account-b');
  assert.equal(f.client.getSnapshot().pending, 0);
  await assert.rejects(f.client.request('/transactions'));
  await f.client.activate('account-a');
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
  await second.activate('account-a');
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
  await f.client.activate('account-a');
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
