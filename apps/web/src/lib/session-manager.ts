import {
  ApiError,
  asObject,
  type LocalStorageAdapter,
  type OfflineClient,
} from "./offline-engine";
export type AppSession = {
  user: { id: string; name: string; email: string; image?: string | null };
  session: { id: string; expiresAt: string };
};
export type SessionState = {
  data: AppSession | null;
  isPending: boolean;
  reason: "expired" | null;
  error: string | null;
};
const SESSION_KEY = "kharchabaki:session:v1";
function valid(session: AppSession | null) {
  return (
    !!session?.user.id &&
    new Date(session.session.expiresAt).getTime() > Date.now()
  );
}
function sanitize(value: unknown): AppSession | null {
  const session = asObject(value);
  const user = asObject(session.user);
  const details = asObject(session.session);
  if (typeof user.id !== "string" || !details.expiresAt) return null;
  return {
    user: {
      id: user.id,
      name: String(user.name ?? ""),
      email: String(user.email ?? ""),
      image: typeof user.image === "string" ? user.image : null,
    },
    session: {
      id: String(details.id ?? ""),
      expiresAt: String(details.expiresAt),
    },
  };
}
export class SessionManager {
  private snapshot: SessionState = {
    data: null,
    isPending: true,
    reason: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private accountListeners = new Set<() => void>();
  private refreshPromise: Promise<void> | null = null;
  private started = false;
  private generation = 0;
  private restoring: Promise<void> | null = null;
  constructor(
    private storage: LocalStorageAdapter,
    private client: OfflineClient,
    private transport: (path: string, init?: RequestInit) => Promise<Response>,
  ) {}
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
    if (this.snapshot.data?.user.id !== session?.user.id)
      this.accountListeners.forEach((listener) => listener());
  }
  getSnapshot = () => this.snapshot;
  private publish(value: Partial<SessionState>) {
    this.snapshot = { ...this.snapshot, ...value };
    this.listeners.forEach((listener) => listener());
  }
  async bootstrap() {
    if (this.started) return;
    this.started = true;
    this.restoring = this.restore();
    await this.restoring;
    await this.refresh();
  }
  private async restore() {
    try {
      const saved = await this.storage.getItem(SESSION_KEY);
      const session = saved ? sanitize(JSON.parse(saved)) : null;
      if (valid(session)) {
        await this.client.activate(session!.user.id);
        this.prepareAccount(session);
        this.publish({ data: session, isPending: false });
      } else if (session) await this.expire();
    } catch (error) {
      this.publish({
        isPending: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not open saved data. Please retry.",
      });
    }
  }
  async refresh(force = false): Promise<void> {
    await this.restoring;
    if (this.refreshPromise)
      return force
        ? this.refreshPromise.then(() => this.refresh())
        : this.refreshPromise;
    this.refreshPromise = this.verify().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }
  private async verify() {
    const generation = this.generation;
    if (!this.client.getSnapshot().online) {
      this.checkExpiry();
      this.publish({ isPending: false });
      return;
    }
    try {
      const response = await this.transport("/me");
      if (generation !== this.generation) return;
      if (response.status === 401) {
        await this.expire();
        return;
      }
      if (!response.ok)
        throw new ApiError(
          response.status,
          "Connection unavailable. Using saved data.",
        );
      const json = await response.json();
      const session = sanitize(asObject(asObject(json).data).session);
      if (!valid(session)) {
        await this.expire();
        return;
      }
      if (generation !== this.generation) return;
      await this.storage.setItem(SESSION_KEY, JSON.stringify(session));
      await this.client.activate(session!.user.id);
      this.prepareAccount(session);
      this.publish({
        data: session,
        isPending: false,
        reason: null,
        error: null,
      });
    } catch (error) {
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
    }
  }
  checkExpiry() {
    if (this.snapshot.data && !valid(this.snapshot.data)) void this.expire();
  }
  async expire(reason: "expired" | null = "expired") {
    this.generation++;
    this.client.deactivate();
    this.prepareAccount(null);
    this.publish({ data: null, isPending: false, reason });
    await this.storage.removeItem(SESSION_KEY);
  }
}
