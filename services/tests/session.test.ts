import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OfflineClient,
  type LocalStorageAdapter,
  type Envelope,
} from '../../apps/web/src/lib/offline-engine.ts';
import { SessionManager } from '../../apps/web/src/lib/session-manager.ts';
class Storage implements LocalStorageAdapter {
  values = new Map<string, string>();
  async getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  async removeItem(key: string) {
    this.values.delete(key);
  }
}
const response = (session: unknown) =>
  new Response(JSON.stringify({ success: true, data: { session } }));
const signedIn = (isPremium = false) => ({
  user: {
    id: 'signed-in-user',
    name: 'Person',
    email: 'person@example.com',
    isPremium,
  },
  session: {
    id: 'session',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  },
});
function setup(
  storage = new Storage(),
  transport: (
    path: string,
    init?: RequestInit,
  ) => Promise<Response> = async () => {
    throw new Error('No network allowed');
  },
) {
  let id = 0;
  const client = new OfflineClient(storage, transport, () => `id-${++id}`);
  const manager = new SessionManager(storage, client, transport);
  return { storage, client, manager };
}
const post = (body: unknown) => ({
  method: 'POST',
  body: JSON.stringify(body),
});
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));
test('guest mode opens without authentication, restores offline, and preserves its isolated data', async () => {
  let calls = 0;
  const storage = new Storage();
  const transport = async () => {
    calls++;
    throw new Error('No network allowed');
  };
  const first = setup(storage, transport);
  await first.manager.startOffline();
  await first.manager.bootstrap();
  assert.equal(first.manager.getSnapshot().data?.localOnly, true);
  assert.equal(first.manager.getSnapshot().data?.user.isPremium, false);
  await first.client.request('/income', post({ amount: 80, source: 'salary' }));
  await first.manager.refresh(true);
  first.manager.checkExpiry();
  assert.equal(calls, 0);
  const reopened = setup(storage, transport);
  await reopened.manager.bootstrap();
  assert.equal(reopened.manager.getSnapshot().data?.localOnly, true);
  assert.equal(
    (await reopened.client.request<Envelope>('/transactions')).data instanceof
      Array,
    true,
  );
  assert.equal(
    (await reopened.client.request<Envelope>('/balance')).data &&
      (
        (await reopened.client.request<Envelope>('/balance')).data as {
          balance: number;
        }
      ).balance,
    80,
  );
  assert.equal(calls, 0);
  await reopened.manager.expire(null);
  assert.equal(reopened.manager.getSnapshot().data, null);
  await reopened.client.activate('different-account', false);
  assert.deepEqual(
    (await reopened.client.request<Envelope>('/transactions')).data,
    [],
  );
  await reopened.manager.startOffline();
  assert.equal(
    (
      (await reopened.client.request<Envelope>('/transactions'))
        .data as unknown[]
    ).length,
    1,
  );
});
test('login screen becomes ready while a slow session verification is still pending', async () => {
  let finish!: (value: Response) => void;
  const f = setup(
    new Storage(),
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const boot = f.manager.bootstrap();
  await nextTick();
  assert.equal(f.manager.getSnapshot().isPending, false);
  assert.equal(f.manager.getSnapshot().isVerifying, true);
  assert.equal(f.manager.getSnapshot().data, null);
  finish(response(signedIn()));
  await boot;
  assert.equal(f.manager.getSnapshot().data?.user.isPremium, false);
  assert.equal(f.manager.getSnapshot().isVerifying, false);
  assert.equal(f.client.getSnapshot().syncEnabled, false);
});
test('a delayed authenticated response cannot replace guest mode', async () => {
  let finish!: (value: Response) => void;
  const f = setup(
    new Storage(),
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const refresh = f.manager.refresh();
  await nextTick();
  await f.manager.startOffline();
  finish(response(signedIn(true)));
  await refresh;
  assert.equal(f.manager.getSnapshot().data?.localOnly, true);
  assert.equal(f.client.getAccount(), 'local:device');
  assert.equal(f.client.getSnapshot().syncEnabled, false);
  assert.equal(
    JSON.parse(f.storage.values.get('kharchabaki:session:v1')!).localOnly,
    true,
  );
});
test('premium entitlement updates change the active mode before exposing a new session', async () => {
  let premium = true;
  const f = setup(new Storage(), async () => response(signedIn(premium)));
  await f.manager.bootstrap();
  assert.equal(f.client.getSnapshot().syncEnabled, true);
  const modes: boolean[] = [];
  f.manager.onAccountChange(() =>
    modes.push(f.client.getSnapshot().syncEnabled),
  );
  premium = false;
  await f.manager.refresh();
  assert.equal(f.manager.getSnapshot().data?.user.isPremium, false);
  assert.equal(f.client.getSnapshot().syncEnabled, false);
  assert.deepEqual(modes, [false]);
});
test('unknown or non-boolean entitlement values never enable syncing', async () => {
  const details = signedIn();
  for (const value of [undefined, 'true', 1, false]) {
    const f = setup(new Storage(), async () =>
      response({ ...details, user: { ...details.user, isPremium: value } }),
    );
    await f.manager.bootstrap();
    assert.equal(f.manager.getSnapshot().data?.user.isPremium, false);
    assert.equal(f.client.getSnapshot().syncEnabled, false);
  }
});
test('untrusted server payloads cannot invent a guest session', async () => {
  const f = setup(new Storage(), async () =>
    response({ ...signedIn(false), localOnly: true }),
  );
  await f.manager.bootstrap();
  assert.equal(f.manager.getSnapshot().data?.localOnly, undefined);
  assert.equal(f.manager.getSnapshot().data?.user.id, 'signed-in-user');
});

test('a server403 revokes and persists cached entitlement while retaining the signed-in identity', async () => {
  const f = setup(new Storage(), async (path) =>
    path === '/me'
      ? response(signedIn(true))
      : new Response(JSON.stringify({ message: 'Premium required' }), {
          status: 403,
        }),
  );
  await f.manager.bootstrap();
  await assert.rejects(() => f.client.request('/transactions'), /Premium/);
  await nextTick();
  assert.equal(f.manager.getSnapshot().data?.user.isPremium, false);
  assert.equal(f.manager.getSnapshot().data?.user.id, 'signed-in-user');
  assert.equal(
    JSON.parse(f.storage.values.get('kharchabaki:session:v1')!).user.isPremium,
    false,
  );
  const reopened = setup(f.storage);
  reopened.client.setOnline(false);
  await reopened.manager.bootstrap();
  assert.equal(reopened.client.getSnapshot().syncEnabled, false);
});
test('an unchanged session refresh does not rerender session consumers', async () => {
  const details = signedIn(false);
  const f = setup(new Storage(), async () => response(details));
  await f.manager.bootstrap();
  let renders = 0;
  f.manager.subscribe(() => renders++);
  await f.manager.refresh();
  assert.equal(renders, 0);
});

test('device preferences support native runtimes without Intl.supportedValuesOf', async () => {
  const f = setup();
  await f.manager.startOffline();
  const original = Object.getOwnPropertyDescriptor(Intl, 'supportedValuesOf');
  Object.defineProperty(Intl, 'supportedValuesOf', {
    value: undefined,
    configurable: true,
  });
  try {
    await f.client.request('/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ currency: 'GBP', theme: 'forest' }),
    });
    assert.equal(f.client.getCachedPreferences()?.currency, 'GBP');
    await assert.rejects(
      () =>
        f.client.request('/preferences', {
          method: 'PATCH',
          body: JSON.stringify({ currency: 'XXX' }),
        }),
      /supported currency/,
    );
  } finally {
    if (original) Object.defineProperty(Intl, 'supportedValuesOf', original);
    else Reflect.deleteProperty(Intl, 'supportedValuesOf');
  }
});
