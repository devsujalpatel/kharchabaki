// Platform-independent persistence and synchronization. Keep the web/native copies identical.
export type LocalStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  runExclusive?<T>(key: string, work: () => Promise<T>): Promise<T>;
};
export type Envelope = {
  success: boolean;
  message: string;
  data: unknown;
  offline?: boolean;
  pending?: boolean;
};
export type SavedTransaction = {
  id: string;
  type: "income" | "expense";
  amount: string;
  source: string | null;
  category: string | null;
  description: string | null;
  createdAt: string;
  occurredAt: string;
  pending?: boolean;
};
export type PendingChange = {
  id: string;
  path: string;
  method: string;
  body: Record<string, unknown>;
  createdAt: string;
  attempted: boolean;
  error?: string;
};
type Document = {
  version: 1;
  cache: Record<string, Envelope>;
  records: SavedTransaction[];
  completeHistory: boolean;
  balance: number | null;
  outbox: PendingChange[];
  lastSyncedAt: number | null;
};
export type OfflineStatus = {
  ready: boolean;
  online: boolean;
  syncing: boolean;
  pending: number;
  error: string | null;
  lastSyncedAt: number | null;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const emptyDocument = (): Document => ({
  version: 1,
  cache: {},
  records: [],
  completeHistory: false,
  balance: null,
  outbox: [],
  lastSyncedAt: null,
});
const keyFor = (path: string) => {
  const url = new URL(path.replace(/^\/api\/v1/, ""), "https://local.invalid");
  url.searchParams.sort();
  return url.pathname + (url.search ? url.search : "");
};
const toCents = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const matches = (record: SavedTransaction, params: URLSearchParams) =>
  (!params.get("month") ||
    record.occurredAt.startsWith(params.get("month")!)) &&
  (!params.get("type") ||
    params.get("type") === "all" ||
    record.type === params.get("type")) &&
  (!params.get("category") ||
    params.get("category") === "all" ||
    (record.source ?? record.category) === params.get("category")) &&
  (!params.get("search") ||
    [record.description, record.source, record.category]
      .join(" ")
      .toLowerCase()
      .includes(params.get("search")!.toLowerCase()));
function apply(records: SavedTransaction[], change: PendingChange) {
  const type = change.path.split("/")[1];
  if (type !== "income" && type !== "expense") return { records, delta: 0 };
  const id =
    change.method === "POST"
      ? String(change.body.id)
      : change.path.split("/")[2];
  const previous = records.find((row) => row.id === id && row.type === type);
  let next = previous;
  if (change.method === "DELETE") next = undefined;
  else if (change.method === "POST" && previous)
    return { records, delta: 0 }; // Server already accepted this UUID.
  else
    next = {
      id: id!,
      type,
      amount: Number(change.body.amount ?? previous?.amount).toFixed(2),
      description:
        typeof change.body.description === "string"
          ? change.body.description.trim() || null
          : null,
      source:
        type === "income"
          ? String(change.body.source ?? previous?.source)
          : null,
      category:
        type === "expense"
          ? String(change.body.category ?? previous?.category)
          : null,
      createdAt: previous?.createdAt ?? change.createdAt,
      occurredAt: String(
        change.body.occurredAt ?? previous?.occurredAt ?? change.createdAt,
      ),
      pending: true,
    };
  const delta =
    ((next ? toCents(next.amount) : 0) -
      (previous ? toCents(previous.amount) : 0)) *
    (type === "income" ? 1 : -1);
  return {
    records: [
      ...records.filter((row) => !(row.id === id && row.type === type)),
      ...(next ? [next] : []),
    ],
    delta,
  };
}
function project(document: Document) {
  return document.outbox.reduce(
    (value, change) => {
      const result = apply(value.records, change);
      return { records: result.records, delta: value.delta + result.delta };
    },
    { records: document.records, delta: 0 },
  );
}
function canonicalSource(source: string) {
  return source === "invesment" ? "investment" : source === "bonues" ? "bonus" : source;
}
function summary(month: string, records: SavedTransaction[], balance: number) {
  const [year, index] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const bucket = (date: string) => {
    const selected = records.filter((row) => row.occurredAt.startsWith(date));
    const total = (type: string) =>
      (
        selected
          .filter((row) => row.type === type)
          .reduce((sum, row) => sum + toCents(row.amount), 0) / 100
      ).toFixed(2);
    return { date, income: total("income"), expense: total("expense") };
  };
  const selected = records.filter((row) => row.occurredAt.startsWith(month));
  const groupTotal = (type: "income" | "expense", key: "source" | "category") => {
    const totals = new Map<string, number>();
    selected
      .filter((row) => row.type === type)
      .forEach((row) => {
        const name = row[key] ?? "other";
        totals.set(name, (totals.get(name) ?? 0) + toCents(row.amount));
      });
    return [...totals].map(([name, total]) => ({
      ...(key === "source" ? { source: canonicalSource(name) } : { category: name }),
      total: (total / 100).toFixed(2),
    }));
  };
  const mergeSources = (values: { source?: string; total: string }[]) => {
    const totals = new Map<string, number>();
    values.forEach(({ source, total }) => {
      const name = canonicalSource(source ?? "other");
      totals.set(name, (totals.get(name) ?? 0) + toCents(total));
    });
    return [...totals].map(([source, total]) => ({ source, total: (total / 100).toFixed(2) }));
  };
  return {
    balance: balance.toFixed(2),
    month,
    ...bucket(month),
    expenseCategories: groupTotal("expense", "category"),
    incomeSources: mergeSources(groupTotal("income", "source")),
    daily: Array.from({ length: days }, (_, day) =>
      bucket(`${month}-${String(day + 1).padStart(2, "0")}`),
    ),
    monthly: Array.from({ length: 6 }, (_, offset) =>
      bucket(
        new Date(Date.UTC(year, index - 6 + offset, 1))
          .toISOString()
          .slice(0, 7),
      ),
    ),
  };
}
export class OfflineClient {
  private document = emptyDocument();
  private account: string | null = null;
  private serial: Promise<unknown> = Promise.resolve();
  private flushing: Promise<void> | null = null;
  private listeners = new Set<() => void>();
  private dataListeners = new Set<() => void>();
  private unauthorizedListeners = new Set<() => void>();
  private snapshot: OfflineStatus = {
    ready: false,
    online: true,
    syncing: false,
    pending: 0,
    error: null,
    lastSyncedAt: null,
  };
  constructor(
    private storage: LocalStorageAdapter,
    private transport: (path: string, init?: RequestInit) => Promise<Response>,
    private uuid: () => string,
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  onDataChange = (listener: () => void) => {
    this.dataListeners.add(listener);
    return () => {
      this.dataListeners.delete(listener);
    };
  };
  onUnauthorized = (listener: () => void) => {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  getPending = () => this.document.outbox;
  getAccount = () => this.account;
  private publish(extra: Partial<OfflineStatus> = {}) {
    this.snapshot = {
      ...this.snapshot,
      pending: this.document.outbox.length,
      lastSyncedAt: this.document.lastSyncedAt,
      ...extra,
    };
    this.listeners.forEach((listener) => listener());
  }
  private async persist(next: Document) {
    const account = this.account;
    if (!account) throw new ApiError(401, "Please sign in to save changes.");
    await this.storage.setItem(
      `kharchabaki:data:v1:${account}`,
      JSON.stringify(next),
    );
    if (this.account !== account) return;
    this.document = next;
    this.publish();
  }
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const account = this.account;
    const run = async () => {
      if (account && this.account === account && this.storage.runExclusive) {
        const saved = await this.storage.getItem(
          `kharchabaki:data:v1:${account}`,
        );
        if (saved) this.document = JSON.parse(saved) as Document;
      }
      return work();
    };
    const next = this.serial.then(() =>
      this.storage.runExclusive && account
        ? this.storage.runExclusive(`write:${account}`, run)
        : run(),
    );
    this.serial = next.catch(() => {});
    return next;
  }
  async reload() {
    await this.exclusive(async () => {
      this.publish();
    });
  }
  async activate(account: string) {
    if (this.account === account && this.snapshot.ready) return;
    // Never let an old account's in-flight response update the next account's document.
    await this.flushing;
    await this.serial;
    const saved = await this.storage.getItem(`kharchabaki:data:v1:${account}`);
    const document = saved ? (JSON.parse(saved) as Document) : emptyDocument();
    if (
      document.version !== 1 ||
      !Array.isArray(document.outbox) ||
      !Array.isArray(document.records)
    )
      throw new Error("Saved data could not be read. Please retry.");
    this.account = account;
    this.document = document;
    this.publish({
      ready: true,
      error: document.outbox.find((item) => item.error)?.error ?? null,
    });
  }
  deactivate() {
    this.account = null;
    this.document = emptyDocument();
    this.publish({ ready: false, syncing: false, error: null });
  }
  setOnline(online: boolean) {
    this.publish({ online });
  }
  private unauthorized() {
    this.unauthorizedListeners.forEach((listener) => listener());
  }
  private local(path: string): Envelope {
    const key = keyFor(path);
    const url = new URL(key, "https://local.invalid");
    const saved = this.document.cache[key];
    const projected = project(this.document);
    if (
      url.pathname === "/transactions" &&
      (this.document.completeHistory ||
        saved ||
        this.document.outbox.some(
          (item) => item.path === "/income" || item.path === "/expense",
        ))
    ) {
      return {
        success: true,
        message: "Saved transaction history",
        data: projected.records
          .filter((row) => matches(row, url.searchParams))
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
        offline: true,
      };
    }
    if (
      url.pathname === "/summary" &&
      this.document.completeHistory &&
      this.document.balance !== null
    ) {
      return {
        success: true,
        message: "Saved monthly summary",
        data: summary(
          url.searchParams.get("month") ?? new Date().toISOString().slice(0, 7),
          projected.records,
          (toCents(this.document.balance) + projected.delta) / 100,
        ),
        offline: true,
      };
    }
    if (url.pathname === "/balance" && this.document.balance !== null)
      return {
        success: true,
        message: "Saved balance",
        data: {
          balance: (toCents(this.document.balance) + projected.delta) / 100,
        },
        offline: true,
      };
    if (!saved)
      throw new ApiError(
        0,
        "This view is not saved on this device yet. Connect once to load it.",
      );
    if (url.pathname === "/preferences") {
      const data = this.document.outbox
        .filter((item) => item.path === "/preferences")
        .reduce(
          (value, item) => ({ ...value, ...item.body }),
          asObject(saved.data),
        );
      return { ...saved, data, offline: true };
    }
    // A cached summary can be updated even when only partial history is available.
    if (url.pathname === "/summary") {
      const base = asObject(saved.data);
      const month = String(base.month ?? url.searchParams.get("month"));
      const before = summary(
        month,
        this.document.records,
        Number(base.balance),
      );
      const after = summary(
        month,
        projected.records,
        (toCents(base.balance) + projected.delta) / 100,
      );
      const adjust = (value: unknown, old: unknown, next: unknown) =>
        ((toCents(value) - toCents(old) + toCents(next)) / 100).toFixed(2);
      const changeBuckets = (
        values: unknown,
        old: { date: string; income: string; expense: string }[],
        next: typeof old,
      ) =>
        Array.isArray(values)
          ? values.map((item) => {
              const row = asObject(item);
              const previous = old.find((x) => x.date === row.date);
              const updated = next.find((x) => x.date === row.date);
              return {
                ...row,
                income: adjust(row.income, previous?.income, updated?.income),
                expense: adjust(
                  row.expense,
                  previous?.expense,
                  updated?.expense,
                ),
              };
            })
          : values;
      const changeGroups = (
        values: unknown,
        old: { category?: string; source?: string; total: string }[],
        next: typeof old,
        key: "category" | "source",
      ) => {
        if (!Array.isArray(values)) return values;
        const canonical = (value: unknown) =>
          key === "source" ? canonicalSource(String(value)) : String(value);
        const names = new Set([
          ...values.map((item) => canonical(asObject(item)[key])),
          ...old.map((item) => canonical(item[key])),
          ...next.map((item) => canonical(item[key])),
        ]);
        return Array.from(names, (name) => {
          const baseTotal = values
            .filter((item) => canonical(asObject(item)[key]) === name)
            .reduce((sum, item) => sum + toCents(asObject(item).total), 0);
          const previous = old
            .filter((item) => canonical(item[key]) === name)
            .reduce((sum, item) => sum + toCents(item.total), 0);
          const updated = next
            .filter((item) => canonical(item[key]) === name)
            .reduce((sum, item) => sum + toCents(item.total), 0);
          return {
            [key]: name,
            total: ((baseTotal - previous + updated) / 100).toFixed(2),
          };
        }).filter((item) => Number(item.total) > 0);
      };
      return {
        ...saved,
        offline: true,
        data: {
          ...base,
          balance: after.balance,
          income: adjust(base.income, before.income, after.income),
          expense: adjust(base.expense, before.expense, after.expense),
          daily: changeBuckets(base.daily, before.daily, after.daily),
          monthly: changeBuckets(base.monthly, before.monthly, after.monthly),
          expenseCategories: changeGroups(
            base.expenseCategories,
            before.expenseCategories,
            after.expenseCategories,
            "category",
          ),
          incomeSources: changeGroups(
            base.incomeSources,
            before.incomeSources,
            after.incomeSources,
            "source",
          ),
        },
      };
    }
    return { ...saved, offline: true };
  }
  async request<T = Envelope>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    if (!this.account || !this.snapshot.ready)
      throw new ApiError(401, "Please sign in to continue.");
    const key = keyFor(path);
    const method = (init.method ?? "GET").toUpperCase();
    const account = this.account;
    if (method !== "GET") return this.write(key, method, init) as Promise<T>;
    if (this.document.outbox.length && this.snapshot.online) await this.flush();
    if (this.snapshot.online && !this.document.outbox.length) {
      let response: Response;
      try {
        response = await this.transport(key, {
          ...init,
          headers: { ...init.headers, "X-Account-ID": account },
        });
      } catch {
        this.setOnline(false);
        return this.local(key) as T;
      }
      if (this.account !== account)
        throw new ApiError(401, "Your account changed. Please try again.");
      if (response.status === 401) {
        this.unauthorized();
        throw new ApiError(401, "Your session expired. Please sign in again.");
      }
      if (response.status >= 500) {
        this.setOnline(false);
        return this.local(key) as T;
      }
      const result = (await response.json()) as Envelope;
      if (!response.ok)
        throw new ApiError(
          response.status,
          result.message ?? "Could not load this view.",
        );
      // Do not persist session tokens in the finance cache.
      if (key === "/me") return result as T;
      await this.exclusive(async () => {
        if (this.account !== account) return;
        const next = clone(this.document);
        next.cache[key] = result;
        if (
          key.split("?")[0] === "/transactions" &&
          Array.isArray(result.data)
        ) {
          const rows = result.data as SavedTransaction[];
          const complete = key === "/transactions";
          next.records = complete
            ? rows
            : [
                ...next.records.filter(
                  (row) =>
                    !rows.some(
                      (item) => row.id === item.id && row.type === item.type,
                    ),
                ),
                ...rows,
              ];
          if (complete) next.completeHistory = true;
        }
        if (key.startsWith("/summary") || key === "/balance")
          next.balance = Number(asObject(result.data).balance);
        next.lastSyncedAt = Date.now();
        await this.persist(next);
      });
      return result as T;
    }
    return this.local(key) as T;
  }
  private async write(
    path: string,
    method: string,
    init: RequestInit,
  ): Promise<Envelope> {
    const account = this.account;
    const supported =
      (method === "POST" && /^\/(income|expense)$/.test(path)) ||
      (["PATCH", "DELETE"].includes(method) &&
        /^\/(income|expense)\/[\w-]+$/.test(path)) ||
      (method === "PATCH" && path === "/preferences");
    if (!supported) {
      if (!this.snapshot.online || this.document.outbox.length)
        throw new ApiError(
          0,
          "Connect and finish syncing before changing balances or loans.",
        );
      const response = await this.transport(path, {
        ...init,
        headers: { ...init.headers, "X-Account-ID": this.account! },
      }).catch(() => {
        this.setOnline(false);
        throw new ApiError(
          0,
          "This action needs a connection. Please try again when online.",
        );
      });
      if (response.status === 401) {
        this.unauthorized();
        throw new ApiError(401, "Your session expired. Please sign in again.");
      }
      const result = (await response.json()) as Envelope;
      if (!response.ok) throw new ApiError(response.status, result.message);
      return result;
    }
    const body = init.body ? asObject(JSON.parse(String(init.body))) : {};
    if (method !== "DELETE" && path !== "/preferences") {
      const amount = Number(body.amount);
      if (
        !Number.isFinite(amount) ||
        amount < 0.01 ||
        amount > 999999999999.99 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001
      )
        throw new ApiError(
          400,
          "Enter a positive amount with up to two decimal places.",
        );
      if (!body.source && !body.category)
        throw new ApiError(400, "Choose a source or category.");
    }
    if (method === "POST") {
      body.id ??= this.uuid();
      body.occurredAt ??= new Date().toISOString();
    }
    const change: PendingChange = {
      id: this.uuid(),
      path,
      method,
      body,
      createdAt: new Date().toISOString(),
      attempted: false,
    };
    let cancelled = false;
    await this.exclusive(async () => {
      if (this.account !== account)
        throw new ApiError(401, "Your account changed. Please try again.");
      const next = clone(this.document);
      const targetId = path.split("/")[2];
      const pendingCreate = next.outbox.find(
        (item) =>
          item.method === "POST" &&
          item.path === `/${path.split("/")[1]}` &&
          item.body.id === targetId &&
          (!item.attempted || item.error),
      );
      const pendingEdit = [...next.outbox]
        .reverse()
        .find(
          (item) =>
            item.method === "PATCH" &&
            item.path === path &&
            (!item.attempted || item.error),
        );
      const pendingTarget = pendingCreate ?? pendingEdit;
      if (pendingTarget && !this.snapshot.syncing) {
        if (method === "DELETE" && pendingTarget.method === "POST") {
          next.outbox = next.outbox.filter(
            (item) => item.id !== pendingTarget.id && item.path !== path,
          );
          cancelled = true;
        } else {
          pendingTarget.body =
            method === "DELETE" ? {} : { ...pendingTarget.body, ...body };
          if (method === "DELETE") pendingTarget.method = "DELETE";
          pendingTarget.error = undefined;
          pendingTarget.attempted = false;
          if (pendingCreate)
            next.outbox = next.outbox.filter(
              (item) => item.id === pendingTarget.id || item.path !== path,
            );
        }
      } else {
        if (
          targetId &&
          !project(next).records.some(
            (row) => row.id === targetId && row.type === path.split("/")[1],
          )
        )
          throw new ApiError(
            0,
            "Load this transaction online before changing it offline.",
          );
        next.outbox.push(change);
      }
      const value = project(next);
      const previous = project(this.document);
      if (
        path.startsWith("/expense") &&
        next.balance !== null &&
        value.delta < previous.delta &&
        toCents(next.balance) + value.delta < 0
      )
        throw new ApiError(400, "Insufficient balance.");
      await this.persist(next);
      this.publish({
        error: next.outbox.find((item) => item.error)?.error ?? null,
      });
    });
    this.dataListeners.forEach((listener) => listener());
    if (this.snapshot.online) await this.flush();
    const queued = this.document.outbox.length > 0;
    return {
      success: true,
      pending: queued,
      offline: queued || !this.snapshot.online,
      message: cancelled
        ? "Local entry removed"
        : queued
          ? "Saved on this device. Will sync when connected."
          : "Saved successfully",
      data:
        path === "/preferences"
          ? this.local(path).data
          : { id: body.id ?? path.split("/")[2], ...body },
    };
  }
  async flush() {
    if (this.flushing) return this.flushing;
    if (!this.snapshot.online || !this.account || !this.document.outbox.length)
      return;
    const account = this.account;
    const work = () => this.runFlush(account);
    this.flushing = (
      this.storage.runExclusive
        ? this.storage.runExclusive(`sync:${account}`, work)
        : work()
    ).finally(() => {
      this.flushing = null;
      this.publish({ syncing: false });
    });
    return this.flushing;
  }
  private async runFlush(account: string) {
    await this.reload();
    this.publish({ syncing: true, error: null });
    while (
      this.snapshot.online &&
      this.account === account &&
      this.document.outbox.length
    ) {
      const change = clone(this.document.outbox[0]);
      await this.exclusive(async () => {
        if (this.account !== account) return;
        const next = clone(this.document);
        next.outbox[0].attempted = true;
        await this.persist(next);
      });
      let response: Response;
      try {
        response = await this.transport(change.path, {
          method: change.method,
          headers: {
            "Content-Type": "application/json",
            "X-Account-ID": account,
          },
          body:
            change.method === "DELETE"
              ? undefined
              : JSON.stringify(change.body),
        });
      } catch {
        this.setOnline(false);
        return;
      }
      if (this.account !== account) return;
      if (response.status === 401) {
        this.unauthorized();
        return;
      }
      if (response.status >= 500) {
        this.setOnline(false);
        return;
      }
      const result = (await response
        .json()
        .catch(() => ({ message: "Could not sync this change." }))) as Envelope;
      if (
        !response.ok &&
        !(response.status === 404 && change.method === "DELETE")
      ) {
        await this.exclusive(async () => {
          if (this.account !== account) return;
          const next = clone(this.document);
          const item = next.outbox.find((row) => row.id === change.id);
          if (item) item.error = result.message;
          await this.persist(next);
          this.publish({ error: result.message });
        });
        return;
      }
      await this.exclusive(async () => {
        if (this.account !== account) return;
        const next = clone(this.document);
        // Commit the same optimistic change into the saved base before removing it from the queue.
        const applied = apply(next.records, change);
        for (const [key, cached] of Object.entries(next.cache)) {
          if (key.startsWith("/summary")) {
            const temp = this.document;
            this.document = { ...next, outbox: [change] };
            next.cache[key] = this.local(key);
            this.document = temp;
          }
          if (key === "/preferences" && change.path === key)
            next.cache[key] = {
              ...cached,
              data: {
                ...asObject(cached.data),
                ...change.body,
                ...asObject(result.data),
              },
            };
        }
        if (next.balance !== null)
          next.balance = (toCents(next.balance) + applied.delta) / 100;
        next.records = applied.records.map((row) => ({
          ...row,
          pending: false,
        }));
        next.outbox = next.outbox.filter((row) => row.id !== change.id);
        next.lastSyncedAt = Date.now();
        await this.persist(next);
      });
      this.dataListeners.forEach((listener) => listener());
    }
  }
  async discard(id: string) {
    if (this.snapshot.syncing)
      throw new Error("Wait for the current sync to finish.");
    await this.exclusive(async () => {
      const next = clone(this.document);
      const change = next.outbox.find((item) => item.id === id);
      if (!change) return;
      if (change.attempted && !change.error)
        throw new Error(
          "This change may already be on the server. Reconnect to confirm it before discarding.",
        );
      const recordId = change.body.id;
      next.outbox = next.outbox.filter(
        (item) =>
          item.id !== id &&
          !(change.method === "POST" && item.path.endsWith(`/${recordId}`)),
      );
      await this.persist(next);
      this.publish({
        error: next.outbox.find((item) => item.error)?.error ?? null,
      });
    });
    this.dataListeners.forEach((listener) => listener());
  }
}
