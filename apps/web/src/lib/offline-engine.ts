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
  syncEnabled: boolean;
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
const localDocument = (): Document => ({
  ...emptyDocument(),
  completeHistory: true,
  balance: 0,
  cache: {
    "/preferences": {
      success: true,
      message: "Device preferences",
      data: { currency: "INR", theme: "dark" },
    },
    "/loans/taken": { success: true, message: "Device loans", data: [] },
    "/loans/given": { success: true, message: "Device loans", data: [] },
  },
});
const dataKey = (account: string, syncEnabled: boolean) =>
  `kharchabaki:${syncEnabled ? "data" : "local"}:v1:${account}`;
function readDocument(saved: string): Document {
  const document = JSON.parse(saved) as Document;
  if (
    !document ||
    document.version !== 1 ||
    !Array.isArray(document.outbox) ||
    !Array.isArray(document.records) ||
    !document.cache ||
    typeof document.cache !== "object" ||
    Array.isArray(document.cache) ||
    typeof document.completeHistory !== "boolean" ||
    (document.balance !== null &&
      (typeof document.balance !== "number" ||
        !Number.isFinite(document.balance)))
  )
    throw new Error("Saved data could not be read. Please retry.");
  return document;
}
function seedLocalDocument(cloud: Document): Document {
  const local = localDocument();
  const projected = project(cloud);
  local.records = clone(projected.records).map((row) => ({
    ...row,
    pending: false,
  }));
  local.balance = (toCents(cloud.balance) + projected.delta) / 100;
  const preferences = cloud.outbox
    .filter((change) => change.path === "/preferences")
    .reduce((value, change) => ({ ...value, ...change.body }), {
      ...asObject(local.cache["/preferences"].data),
      ...asObject(cloud.cache["/preferences"]?.data),
    });
  local.cache["/preferences"] = {
    success: true,
    message: "Device preferences",
    data: preferences,
  };
  for (const key of ["/loans/taken", "/loans/given"])
    if (cloud.cache[key]) local.cache[key] = clone(cloud.cache[key]);
  return local;
}
const sources = new Set(
  "salary pocket-money gift investment bonus part-time freelance business rental interest dividends refund pension sale other invesment bonues".split(
    " ",
  ),
);
const categories = new Set(
  "food travel shopping bills rent phone beauty clothing fuel gifts electronics snacks drinks vegetables fruits repairs health education entertainment groceries transport insurance subscriptions fitness pets childcare donations taxes other".split(
    " ",
  ),
);
function validateAmount(value: unknown, allowZero = false) {
  const amount = Number(value);
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === "" ||
    !Number.isFinite(amount) ||
    amount < (allowZero ? 0 : 0.01) ||
    amount > 999999999999.99 ||
    Math.abs(amount * 100 - Math.round(amount * 100)) > 0.001
  )
    throw new ApiError(
      400,
      `Enter ${allowZero ? "a nonnegative" : "a positive"} amount with up to two decimal places.`,
    );
  return toCents(amount);
}
function validatePreferences(body: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  if (body.currency !== undefined) {
    const currency = String(body.currency);
    if (
      !/^[A-Z]{3}$/.test(currency) ||
      !(
        typeof Intl.supportedValuesOf === "function"
          ? Intl.supportedValuesOf("currency")
          : [
              "INR",
              "USD",
              "GBP",
              "JPY",
              "EUR",
              "CAD",
              "AUD",
              "CNY",
              "CHF",
              "AED",
              "SGD",
              "NZD",
              "KRW",
              "BRL",
              "ZAR",
            ]
      ).includes(currency)
    )
      throw new ApiError(400, "Choose a supported currency.");
    next.currency = currency;
  }
  if (body.theme !== undefined) {
    if (
      !["light", "dark", "ocean", "forest", "sunset", "rose"].includes(
        String(body.theme),
      )
    )
      throw new ApiError(400, "Choose a supported theme.");
    next.theme = body.theme;
  }
  if (!Object.keys(next).length)
    throw new ApiError(400, "Choose a currency or theme.");
  return next;
}
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
  return source === "invesment"
    ? "investment"
    : source === "bonues"
      ? "bonus"
      : source;
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
  const groupTotal = (
    type: "income" | "expense",
    key: "source" | "category",
  ) => {
    const totals = new Map<string, number>();
    selected
      .filter((row) => row.type === type)
      .forEach((row) => {
        const name = row[key] ?? "other";
        totals.set(name, (totals.get(name) ?? 0) + toCents(row.amount));
      });
    return [...totals].map(([name, total]) => ({
      ...(key === "source"
        ? { source: canonicalSource(name) }
        : { category: name }),
      total: (total / 100).toFixed(2),
    }));
  };
  const mergeSources = (values: { source?: string; total: string }[]) => {
    const totals = new Map<string, number>();
    values.forEach(({ source, total }) => {
      const name = canonicalSource(source ?? "other");
      totals.set(name, (totals.get(name) ?? 0) + toCents(total));
    });
    return [...totals].map(([source, total]) => ({
      source,
      total: (total / 100).toFixed(2),
    }));
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
  private generation = 0;
  private listeners = new Set<() => void>();
  private dataListeners = new Set<(path?: string) => void>();
  private unauthorizedListeners = new Set<() => void>();
  private syncDisabledListeners = new Set<() => void>();
  private snapshot: OfflineStatus = {
    ready: false,
    syncEnabled: false,
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
  onDataChange = (listener: (path?: string) => void) => {
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
  onSyncDisabled = (listener: () => void) => {
    this.syncDisabledListeners.add(listener);
    return () => {
      this.syncDisabledListeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  getPending = () => this.document.outbox;
  getAccount = () => this.account;
  getCachedPreferences = (): Record<string, unknown> | null => {
    if (!this.snapshot.ready || !this.document.cache["/preferences"])
      return null;
    return clone(asObject(this.local("/preferences").data));
  };
  private current(account: string | null, generation: number) {
    return this.account === account && this.generation === generation;
  }
  private assertCurrent(account: string | null, generation: number) {
    if (!this.current(account, generation))
      throw new ApiError(
        409,
        "Your account or storage mode changed. Please try again.",
      );
  }
  private async disableSync(account: string, generation: number) {
    if (!this.current(account, generation)) return;
    await this.activate(account, false);
    if (
      this.account === account &&
      this.snapshot.ready &&
      !this.snapshot.syncEnabled
    )
      this.syncDisabledListeners.forEach((listener) => listener());
  }
  private publish(extra: Partial<OfflineStatus> = {}) {
    const next = {
      ...this.snapshot,
      pending: this.document.outbox.length,
      lastSyncedAt: this.document.lastSyncedAt,
      ...extra,
    };
    if (
      (Object.keys(next) as (keyof OfflineStatus)[]).every(
        (key) => next[key] === this.snapshot[key],
      )
    )
      return;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
  private async persist(next: Document) {
    const account = this.account;
    const generation = this.generation;
    const syncEnabled = this.snapshot.syncEnabled;
    if (!account) throw new ApiError(401, "Please sign in to save changes.");
    await this.storage.setItem(
      dataKey(account, syncEnabled),
      JSON.stringify(next),
    );
    if (!this.current(account, generation)) return;
    this.document = next;
    this.publish();
  }
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const account = this.account;
    const generation = this.generation;
    const syncEnabled = this.snapshot.syncEnabled;
    const run = async () => {
      this.assertCurrent(account, generation);
      if (account && this.account === account && this.storage.runExclusive) {
        const saved = await this.storage.getItem(dataKey(account, syncEnabled));
        this.assertCurrent(account, generation);
        if (saved) this.document = readDocument(saved);
      }
      return work();
    };
    const next = this.serial.then(() =>
      this.storage.runExclusive && account
        ? this.storage.runExclusive(
            `write:${syncEnabled ? "cloud" : "local"}:${account}`,
            run,
          )
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
  async activate(account: string, syncEnabled = false) {
    if (
      this.account === account &&
      this.snapshot.ready &&
      this.snapshot.syncEnabled === syncEnabled
    )
      return;
    // Revoke network access before any awaited disk work. In-flight responses belong to the old generation.
    const generation = ++this.generation;
    this.account = account;
    this.flushing = null;
    this.document = syncEnabled ? emptyDocument() : localDocument();
    this.publish({ ready: false, syncEnabled, syncing: false, error: null });
    await this.serial;
    if (!this.current(account, generation)) return;
    const load = async () => {
      this.assertCurrent(account, generation);
      const saved = await this.storage.getItem(dataKey(account, syncEnabled));
      this.assertCurrent(account, generation);
      if (saved !== null) return readDocument(saved);
      if (syncEnabled) return emptyDocument();
      // Migrate only this account's existing device cache once. Its cloud outbox remains untouched.
      const cloud = await this.storage.getItem(dataKey(account, true));
      this.assertCurrent(account, generation);
      const document =
        cloud !== null
          ? seedLocalDocument(readDocument(cloud))
          : localDocument();
      await this.storage.setItem(
        dataKey(account, false),
        JSON.stringify(document),
      );
      this.assertCurrent(account, generation);
      return document;
    };
    let document: Document;
    try {
      document =
        !syncEnabled && this.storage.runExclusive
          ? await this.storage.runExclusive(`write:local:${account}`, load)
          : await load();
    } catch (error) {
      if (!this.current(account, generation)) return;
      throw error;
    }
    if (!this.current(account, generation)) return;
    this.document = document;
    this.publish({
      ready: true,
      error: document.outbox.find((item) => item.error)?.error ?? null,
    });
    this.dataListeners.forEach((listener) => listener());
  }
  deactivate() {
    ++this.generation;
    this.flushing = null;
    this.account = null;
    this.document = emptyDocument();
    this.publish({
      ready: false,
      syncEnabled: false,
      syncing: false,
      error: null,
    });
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
      (url.pathname === "/income" || url.pathname === "/expense") &&
      this.document.completeHistory
    ) {
      const type = url.pathname.slice(1);
      return {
        success: true,
        message: "Saved transactions",
        offline: true,
        data: projected.records
          .filter((row) => row.type === type)
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .map((row) => ({
            ...row,
            ...(type === "income"
              ? { receivedAt: row.occurredAt }
              : { spentAt: row.occurredAt }),
          })),
      };
    }
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
    if (
      /^\/loans\/(taken|given)$/.test(url.pathname) &&
      Array.isArray(saved.data)
    )
      return {
        ...saved,
        offline: true,
        data: saved.data.map((value) => {
          const loan = asObject(value);
          return {
            ...loan,
            status:
              Number(loan.paidAmount) >= Number(loan.totalAmount)
                ? "paid"
                : new Date(String(loan.dueDate)).getTime() < Date.now()
                  ? "overdue"
                  : "active",
          };
        }),
      };
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
    const generation = this.generation;
    if (method !== "GET") return this.write(key, method, init) as Promise<T>;
    if (!this.snapshot.syncEnabled)
      return this.exclusive(async () => this.local(key) as T);
    if (this.document.outbox.length && this.snapshot.online) await this.flush();
    this.assertCurrent(account, generation);
    if (
      this.snapshot.syncEnabled &&
      this.snapshot.online &&
      !this.document.outbox.length
    ) {
      let response: Response;
      try {
        response = await this.transport(key, {
          ...init,
          headers: { ...init.headers, "X-Account-ID": account },
        });
      } catch {
        this.assertCurrent(account, generation);
        this.setOnline(false);
        return this.local(key) as T;
      }
      this.assertCurrent(account, generation);
      if (response.status === 403) {
        await this.disableSync(account, generation);
        throw new ApiError(
          403,
          "Cloud sync requires Premium. Device mode is available.",
        );
      }
      if (response.status === 401) {
        this.unauthorized();
        throw new ApiError(401, "Your session expired. Please sign in again.");
      }
      if (response.status >= 500) {
        this.setOnline(false);
        return this.local(key) as T;
      }
      const result = (await response.json()) as Envelope;
      this.assertCurrent(account, generation);
      if (!response.ok)
        throw new ApiError(
          response.status,
          result.message ?? "Could not load this view.",
        );
      // Do not persist session tokens in the finance cache.
      if (key === "/me") return result as T;
      await this.exclusive(async () => {
        this.assertCurrent(account, generation);
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
      this.assertCurrent(account, generation);
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
    const generation = this.generation;
    if (!this.snapshot.syncEnabled) return this.writeLocal(path, method, init);
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
        this.assertCurrent(account, generation);
        this.setOnline(false);
        throw new ApiError(
          0,
          "This action needs a connection. Please try again when online.",
        );
      });
      this.assertCurrent(account, generation);
      if (response.status === 403) {
        await this.disableSync(account!, generation);
        throw new ApiError(
          403,
          "Cloud sync requires Premium. Device mode is available.",
        );
      }
      if (response.status === 401) {
        this.unauthorized();
        throw new ApiError(401, "Your session expired. Please sign in again.");
      }
      const result = (await response.json()) as Envelope;
      this.assertCurrent(account, generation);
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
      this.assertCurrent(account, generation);
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
    this.assertCurrent(account, generation);
    this.dataListeners.forEach((listener) => listener(path));
    if (this.snapshot.syncEnabled && this.snapshot.online) await this.flush();
    this.assertCurrent(account, generation);
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
  private async writeLocal(
    path: string,
    method: string,
    init: RequestInit,
  ): Promise<Envelope> {
    const account = this.account;
    const generation = this.generation;
    const body = init.body ? asObject(JSON.parse(String(init.body))) : {};
    const createdAt = new Date().toISOString();
    const result = await this.exclusive(async () => {
      this.assertCurrent(account, generation);
      const next = clone(this.document);
      let data: unknown;
      const transaction = /^\/(income|expense)(?:\/([\w-]+))?$/.exec(path);
      const loanCreate = /^\/loans\/(taken|given)$/.exec(path);
      const loanMutation = /^\/loans\/(taken|given)\/([\w-]+)$/.exec(path);
      const loanPayment = /^\/loans\/(taken|given)\/([\w-]+)\/payments$/.exec(
        path,
      );
      if (
        transaction &&
        ((method === "POST" && !transaction[2]) ||
          (["PATCH", "DELETE"].includes(method) && transaction[2]))
      ) {
        const type = transaction[1];
        const id =
          method === "POST" ? String(body.id ?? this.uuid()) : transaction[2];
        const previous = next.records.find(
          (row) => row.id === id && row.type === type,
        );
        if (method !== "POST" && !previous)
          throw new ApiError(404, "Transaction not found on this device.");
        const input: Record<string, unknown> = { ...body, id };
        if (method !== "DELETE") {
          validateAmount(input.amount);
          if (
            !(type === "income" ? sources : categories).has(
              String(type === "income" ? input.source : input.category),
            )
          )
            throw new ApiError(400, "Choose a source or category.");
          if (
            input.description !== undefined &&
            (typeof input.description !== "string" ||
              input.description.length > 1000)
          )
            throw new ApiError(400, "Keep notes under 1000 characters.");
          input.occurredAt ??= previous?.occurredAt ?? createdAt;
          if (!Number.isFinite(new Date(String(input.occurredAt)).getTime()))
            throw new ApiError(400, "Choose a valid date.");
        }
        const applied = apply(next.records, {
          id: this.uuid(),
          path,
          method,
          body: input,
          createdAt,
          attempted: false,
        });
        const balance = toCents(next.balance) + applied.delta;
        if (applied.delta < 0 && balance < 0)
          throw new ApiError(400, "Insufficient balance.");
        next.balance = balance / 100;
        next.records = applied.records.map((row) => ({
          ...row,
          pending: false,
        }));
        data =
          method === "DELETE"
            ? { id }
            : next.records.find((row) => row.id === id && row.type === type);
      } else if (path === "/preferences" && method === "PATCH") {
        data = {
          ...asObject(next.cache[path]?.data),
          ...validatePreferences(body),
        };
        next.cache[path] = {
          success: true,
          message: "Device preferences",
          data,
        };
      } else if (path === "/balance" && method === "POST") {
        next.balance = validateAmount(body.amount, true) / 100;
        data = { balance: next.balance };
      } else if (loanCreate && method === "POST") {
        const kind = loanCreate[1];
        const amount = validateAmount(body.amount);
        const interest = validateAmount(body.interest ?? 0, true);
        const personKey = kind === "taken" ? "borrowedFrom" : "borrowerName";
        const person =
          typeof body[personKey] === "string"
            ? String(body[personKey]).trim()
            : "";
        if (!person || person.length > 100)
          throw new ApiError(
            400,
            "Enter a person or bank name under 100 characters.",
          );
        const dueDate = new Date(String(body.dueDate));
        if (!Number.isFinite(dueDate.getTime()))
          throw new ApiError(400, "Choose a valid due date.");
        const balance =
          toCents(next.balance) + (kind === "taken" ? amount : -amount);
        if (balance < 0) throw new ApiError(400, "Insufficient balance.");
        const loan = {
          id: this.uuid(),
          amount: (amount / 100).toFixed(2),
          totalAmount: (
            Math.round((amount * (10000 + interest)) / 10000) / 100
          ).toFixed(2),
          paidAmount: "0.00",
          interest: (interest / 100).toFixed(2),
          [personKey]: person,
          dueDate: dueDate.toISOString(),
          status: dueDate.getTime() < Date.now() ? "overdue" : "active",
          createdAt,
          payments: [],
        };
        const loans = Array.isArray(next.cache[path]?.data)
          ? (next.cache[path].data as unknown[])
          : [];
        next.cache[path] = {
          success: true,
          message: "Device loans",
          data: [loan, ...loans],
        };
        next.balance = balance / 100;
        data = loan;
      } else if (loanMutation && ["PATCH", "DELETE"].includes(method)) {
        const kind = loanMutation[1];
        const loanId = loanMutation[2];
        const key = `/loans/${kind}`;
        const loans = Array.isArray(next.cache[key]?.data)
          ? (next.cache[key].data as unknown[]).map(asObject)
          : [];
        const index = loans.findIndex((loan) => loan.id === loanId);
        if (index < 0) throw new ApiError(404, "Loan not found on this device.");
        const loan = loans[index];
        if (method === "DELETE") {
          const payments = Array.isArray(loan.payments)
            ? loan.payments.map(asObject)
            : [];
          const paid = payments.reduce(
            (sum, payment) => sum + toCents(payment.amount),
            0,
          );
          const balance =
            toCents(next.balance) +
            (kind === "taken"
              ? -toCents(loan.amount) + paid
              : toCents(loan.amount) - paid);
          if (balance < 0)
            throw new ApiError(400, "Insufficient balance to reverse this loan.");
          loans.splice(index, 1);
          next.balance = balance / 100;
          data = { id: loanId };
        } else {
          const amount = validateAmount(body.amount);
          const interest = validateAmount(body.interest ?? 0, true);
          const personKey = kind === "taken" ? "borrowedFrom" : "borrowerName";
          const person =
            typeof body[personKey] === "string" ? String(body[personKey]).trim() : "";
          if (!person || person.length > 100)
            throw new ApiError(400, "Enter a person or bank name under 100 characters.");
          const dueDate = new Date(String(body.dueDate));
          if (!Number.isFinite(dueDate.getTime()))
            throw new ApiError(400, "Choose a valid due date.");
          const total = Math.round((amount * (10000 + interest)) / 10000);
          const paid = toCents(loan.paidAmount);
          if (total < paid)
            throw new ApiError(400, "Total amount cannot be less than payments already recorded.");
          const balance =
            toCents(next.balance) +
            (kind === "taken"
              ? amount - toCents(loan.amount)
              : toCents(loan.amount) - amount);
          if (balance < 0) throw new ApiError(400, "Insufficient balance.");
          const updated = {
            ...loan,
            amount: (amount / 100).toFixed(2),
            totalAmount: (total / 100).toFixed(2),
            interest: (interest / 100).toFixed(2),
            [personKey]: person,
            dueDate: dueDate.toISOString(),
            status:
              paid === total
                ? "paid"
                : dueDate.getTime() < Date.now()
                  ? "overdue"
                  : "active",
          };
          loans[index] = updated;
          next.balance = balance / 100;
          data = updated;
        }
        next.cache[key] = { success: true, message: "Device loans", data: loans };
      } else if (loanPayment && method === "POST") {
        const kind = loanPayment[1];
        const loanId = loanPayment[2];
        const key = `/loans/${kind}`;
        const loans = Array.isArray(next.cache[key]?.data)
          ? (next.cache[key].data as unknown[]).map(asObject)
          : [];
        const loan = loans.find((row) => row.id === loanId);
        if (!loan) throw new ApiError(404, "Loan not found on this device.");
        const amount = validateAmount(body.amount);
        const paid = toCents(loan.paidAmount) + amount;
        if (loan.status === "paid" || paid > toCents(loan.totalAmount))
          throw new ApiError(400, "Payment exceeds the outstanding amount.");
        const balance =
          toCents(next.balance) + (kind === "given" ? amount : -amount);
        if (balance < 0) throw new ApiError(400, "Insufficient balance.");
        const paidAt = new Date(String(body.paidAt ?? createdAt));
        if (!Number.isFinite(paidAt.getTime()))
          throw new ApiError(400, "Choose a valid payment date.");
        const payment = {
          id: this.uuid(),
          loanId,
          amount: (amount / 100).toFixed(2),
          paidAt: paidAt.toISOString(),
          createdAt,
        };
        loan.paidAmount = (paid / 100).toFixed(2);
        loan.status =
          paid === toCents(loan.totalAmount)
            ? "paid"
            : new Date(String(loan.dueDate)).getTime() < Date.now()
              ? "overdue"
              : "active";
        loan.payments = [
          ...(Array.isArray(loan.payments) ? loan.payments : []),
          payment,
        ];
        next.cache[key] = {
          success: true,
          message: "Device loans",
          data: loans,
        };
        next.balance = balance / 100;
        data = payment;
      } else
        throw new ApiError(404, "This action is not available on this device.");
      await this.persist(next);
      this.assertCurrent(account, generation);
      return {
        success: true,
        message: "Saved on this device",
        data,
        offline: true,
        pending: false,
      };
    });
    this.dataListeners.forEach((listener) => listener(path));
    return result;
  }
  async flush() {
    if (!this.snapshot.syncEnabled || !this.snapshot.ready) return;
    if (this.flushing) return this.flushing;
    if (!this.snapshot.online || !this.account || !this.document.outbox.length)
      return;
    const account = this.account;
    const generation = this.generation;
    const work = async () => {
      try {
        await this.runFlush(account, generation);
      } catch (error) {
        if (this.current(account, generation)) throw error;
      }
    };
    const promise = (
      this.storage.runExclusive
        ? this.storage.runExclusive(`sync:${account}`, work)
        : work()
    ).finally(() => {
      if (this.flushing === promise) this.flushing = null;
      if (this.current(account, generation)) this.publish({ syncing: false });
    });
    this.flushing = promise;
    return this.flushing;
  }
  private async runFlush(account: string, generation: number) {
    if (!this.current(account, generation) || !this.snapshot.syncEnabled)
      return;
    await this.reload();
    if (!this.current(account, generation) || !this.snapshot.syncEnabled)
      return;
    this.publish({ syncing: true, error: null });
    while (
      this.snapshot.syncEnabled &&
      this.snapshot.online &&
      this.current(account, generation) &&
      this.document.outbox.length
    ) {
      const change = clone(this.document.outbox[0]);
      await this.exclusive(async () => {
        if (!this.current(account, generation) || !this.snapshot.syncEnabled)
          return;
        const next = clone(this.document);
        const item = next.outbox.find((row) => row.id === change.id);
        if (!item) return;
        item.attempted = true;
        await this.persist(next);
      });
      if (!this.current(account, generation) || !this.snapshot.syncEnabled)
        return;
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
        if (!this.current(account, generation)) return;
        this.setOnline(false);
        return;
      }
      if (!this.current(account, generation) || !this.snapshot.syncEnabled)
        return;
      if (response.status === 403) {
        await this.disableSync(account, generation);
        return;
      }
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
      if (!this.current(account, generation) || !this.snapshot.syncEnabled)
        return;
      if (
        !response.ok &&
        !(response.status === 404 && change.method === "DELETE")
      ) {
        await this.exclusive(async () => {
          if (!this.current(account, generation) || !this.snapshot.syncEnabled)
            return;
          const next = clone(this.document);
          const item = next.outbox.find((row) => row.id === change.id);
          if (item) item.error = result.message;
          await this.persist(next);
          this.publish({ error: result.message });
        });
        return;
      }
      await this.exclusive(async () => {
        if (!this.current(account, generation) || !this.snapshot.syncEnabled)
          return;
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
      if (this.current(account, generation))
        this.dataListeners.forEach((listener) => listener(change.path));
    }
  }
  async discard(id: string) {
    if (this.snapshot.syncing)
      throw new Error("Wait for the current sync to finish.");
    let path: string | undefined;
    await this.exclusive(async () => {
      const next = clone(this.document);
      const change = next.outbox.find((item) => item.id === id);
      if (!change) return;
      path = change.path;
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
    this.dataListeners.forEach((listener) => listener(path));
  }
}
