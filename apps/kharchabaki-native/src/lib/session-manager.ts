import { ApiError, asObject, type LocalStorageAdapter, type OfflineClient } from "./offline-engine";
export type AppSession = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    isPremium: boolean;
  };
  session: { id: string; expiresAt: string };
  localOnly?: boolean;
};
export type SessionState = {
  data: AppSession | null;
  isPending: boolean;
  isVerifying: boolean;
  reason: "expired" | null;
  error: string | null;
};
const SESSION_KEY = "kharchabaki:session:v1";
const DEVICE_ACCOUNT = "local:device";
function valid(session: AppSession | null) {
  return (
    !!session?.user.id &&
    (session.localOnly === true || new Date(session.session.expiresAt).getTime() > Date.now())
  );
}
function sanitize(value: unknown, allowLocal = false): AppSession | null {
  const session = asObject(value);
  const user = asObject(session.user);
  const details = asObject(session.session);
  if (typeof user.id !== "string" || !details.expiresAt) return null;
  const localOnly =
    allowLocal &&
    session.localOnly === true &&
    user.id === DEVICE_ACCOUNT &&
    details.id === "device-only";
  return {
    user: {
      id: user.id,
      name: String(user.name ?? ""),
      email: String(user.email ?? ""),
      image: typeof user.image === "string" ? user.image : null,
      isPremium: !localOnly && user.isPremium === true,
    },
    session: {
      id: String(details.id ?? ""),
      expiresAt: String(details.expiresAt),
    },
    ...(localOnly ? { localOnly: true } : {}),
  };
}
export class SessionManager {
  private snapshot: SessionState = {
    data: null,
    isPending: true,
    isVerifying: true,
    reason: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private accountListeners = new Set<() => void>();
  private refreshPromise: Promise<void> | null = null;
  private started = false;
  private generation = 0;
  private restoring: Promise<void> | null = null;
  private transitions: Promise<unknown> = Promise.resolve();
  constructor(
    private storage: LocalStorageAdapter,
    private client: OfflineClient,
    private transport: (path: string, init?: RequestInit) => Promise<Response>
  ) {
    client.onSyncDisabled(() => {
      void this.revokePremium().catch(() => {});
    });
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  onAccountChange = (listener: () => void) => {
    this.accountListeners.add(listener);
    return () => {
      this.accountListeners.delete(listener);
    };
  };
  private prepareAccount(session: AppSession | null) {
    const previous = this.snapshot.data;
    if (
      previous?.user.id !== session?.user.id ||
      previous?.user.isPremium !== session?.user.isPremium ||
      previous?.localOnly !== session?.localOnly
    )
      this.accountListeners.forEach((listener) => listener());
  }
  getSnapshot = () => this.snapshot;
  private publish(value: Partial<SessionState>) {
    const next = { ...this.snapshot, ...value };
    if (
      next.isPending === this.snapshot.isPending &&
      next.isVerifying === this.snapshot.isVerifying &&
      next.reason === this.snapshot.reason &&
      next.error === this.snapshot.error &&
      JSON.stringify(next.data) === JSON.stringify(this.snapshot.data)
    )
      return;
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
  private transition<T>(work: () => Promise<T>): Promise<T> {
    const result = this.transitions.then(work);
    this.transitions = result.catch(() => {});
    return result;
  }
  async bootstrap() {
    if (this.started) return;
    this.started = true;
    this.restoring = this.restore();
    await this.restoring;
    await this.refresh();
  }
  private async restore() {
    const generation = this.generation;
    try {
      const saved = await this.storage.getItem(SESSION_KEY);
      if (generation !== this.generation) return;
      const session = saved ? sanitize(JSON.parse(saved), true) : null;
      if (valid(session)) {
        await this.transition(async () => {
          if (generation !== this.generation) return;
          await this.client.activate(
            session!.user.id,
            session!.user.isPremium && !session!.localOnly
          );
          if (generation !== this.generation) return;
          this.prepareAccount(session);
          this.publish({
            data: session,
            isPending: false,
            reason: null,
            error: null,
          });
        });
      } else if (session) await this.expire();
      else this.publish({ isPending: false });
    } catch (error) {
      if (generation !== this.generation) return;
      this.publish({
        isPending: false,
        error: error instanceof Error ? error.message : "Could not open saved data. Please retry.",
      });
    }
  }
  private async revokePremium() {
    const previous = this.snapshot.data;
    if (!previous?.user.isPremium || previous.localOnly) return;
    const generation = ++this.generation;
    const session: AppSession = {
      ...previous,
      user: { ...previous.user, isPremium: false },
    };
    this.prepareAccount(session);
    this.publish({ data: session, isVerifying: false });
    await this.transition(async () => {
      if (generation !== this.generation) return;
      await this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    });
  }
  async startOffline() {
    ++this.generation;
    await this.restoring;
    const generation = this.generation;
    const session: AppSession = {
      localOnly: true,
      user: {
        id: DEVICE_ACCOUNT,
        name: "On this device",
        email: "",
        image: null,
        isPremium: false,
      },
      session: { id: "device-only", expiresAt: "9999-12-31T23:59:59.999Z" },
    };
    await this.transition(async () => {
      if (generation !== this.generation) return;
      await this.storage.setItem(SESSION_KEY, JSON.stringify(session));
      if (generation !== this.generation) return;
      await this.client.activate(DEVICE_ACCOUNT, false);
      if (generation !== this.generation) return;
      this.prepareAccount(session);
      this.publish({
        data: session,
        isPending: false,
        isVerifying: false,
        reason: null,
        error: null,
      });
    });
  }
  async refresh(force = false): Promise<void> {
    await this.restoring;
    if (this.snapshot.data?.localOnly) {
      this.publish({ isVerifying: false });
      return;
    }
    if (this.refreshPromise)
      return force ? this.refreshPromise.then(() => this.refresh()) : this.refreshPromise;
    this.refreshPromise = this.verify().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }
  private async verify() {
    const generation = this.generation;
    if (this.snapshot.data?.localOnly) {
      this.publish({ isVerifying: false });
      return;
    }
    if (!this.client.getSnapshot().online) {
      this.checkExpiry();
      this.publish({ isPending: false, isVerifying: false });
      return;
    }
    if (!this.snapshot.data) this.publish({ isVerifying: true });
    try {
      const response = await this.transport("/me");
      if (generation !== this.generation) return;
      if (response.status === 401) {
        await this.expire();
        return;
      }
      if (!response.ok)
        throw new ApiError(response.status, "Connection unavailable. Using saved data.");
      const json = await response.json();
      if (generation !== this.generation) return;
      const session = sanitize(asObject(asObject(json).data).session);
      if (!valid(session)) {
        await this.expire();
        return;
      }
      await this.transition(async () => {
        if (generation !== this.generation) return;
        await this.storage.setItem(SESSION_KEY, JSON.stringify(session));
        if (generation !== this.generation) return;
        await this.client.activate(session!.user.id, session!.user.isPremium);
        if (generation !== this.generation) return;
        this.prepareAccount(session);
        this.publish({
          data: session,
          isPending: false,
          reason: null,
          error: null,
        });
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.client.setOnline(false);
      this.checkExpiry();
      this.publish({
        isPending: false,
        error: this.snapshot.data
          ? null
          : error instanceof Error
            ? error.message
            : "Connect to sign in.",
      });
    } finally {
      if (generation === this.generation) this.publish({ isVerifying: false });
    }
  }
  checkExpiry() {
    if (this.snapshot.data && !valid(this.snapshot.data)) void this.expire();
  }
  async expire(reason: "expired" | null = "expired") {
    const generation = ++this.generation;
    this.client.deactivate();
    this.prepareAccount(null);
    this.publish({ data: null, isPending: false, isVerifying: false, reason });
    await this.transition(async () => {
      if (generation === this.generation) {
        this.client.deactivate();
        await this.storage.removeItem(SESSION_KEY);
      }
    });
  }
}
