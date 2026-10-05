import { db } from "./db";
import { PROVIDERS, type Provider } from "./constants";
import { getConnection } from "./meta";
import { getSettings } from "./settings";
import { queueStats } from "./jobs";
import { TOKEN_STATUS_KEY, type TokenStatus } from "./meta-events";

export type ProviderHealth = {
  provider: Provider;
  total: number;
  active: number;
  rateLimited: number;
  disabled: number;
  lastError: string | null;
};

/** Snapshot of everything the dashboard needs to show how well the OS is wired to the outside world. */
export async function connectivityStatus() {
  const [conn, settings, keys, lastMessage, lastComment, lastEnquiry, queue, approvals, tokenRow] = await Promise.all([
    getConnection(),
    getSettings(),
    db.apiKey.findMany({ select: { provider: true, status: true, lastError: true, lastUsedAt: true } }),
    db.message.findFirst({ where: { direction: "IN" }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
    db.comment.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.enquiry.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    queueStats(),
    db.agentAction.count({ where: { status: "PENDING" } }),
    db.setting.findUnique({ where: { key: TOKEN_STATUS_KEY } }),
  ]);
  let token: TokenStatus | null = null;
  try {
    token = tokenRow ? (JSON.parse(tokenRow.value) as TokenStatus) : null;
  } catch {}

  const providers: ProviderHealth[] = PROVIDERS.map((provider) => {
    const mine = keys.filter((k) => k.provider === provider);
    const erroring = mine
      .filter((k) => k.lastError)
      .sort((a, b) => (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0))[0];
    return {
      provider,
      total: mine.length,
      active: mine.filter((k) => k.status === "ACTIVE").length,
      rateLimited: mine.filter((k) => k.status === "RATE_LIMITED").length,
      disabled: mine.filter((k) => k.status === "DISABLED").length,
      lastError: erroring?.lastError ?? null,
    };
  });

  const lastEvent = [lastMessage?.sentAt, lastComment?.createdAt, lastEnquiry?.createdAt]
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    demoMode: settings.demoMode,
    meta: {
      webhookVerified: conn.connected,
      hasCredentials: !!conn.appId && !!conn.pageId && (!!conn.accessTokenEnc || providers.find((p) => p.provider === "META")!.active > 0),
      hasSecret: !!conn.appSecretEnc,
      lastSyncAt: conn.lastSyncAt?.toISOString() ?? null,
      lastEventAt: lastEvent?.toISOString() ?? null,
      token: token && { ...token, daysLeft: token.expiresAt ? Math.floor((new Date(token.expiresAt).getTime() - Date.now()) / 86400_000) : null },
    },
    agent: { enabled: settings.agentEnabled, approvals },
    jobs: { workerAlive: queue.workerAlive, pending: queue.pending, failed: queue.failed },
    providers,
  };
}

export type Connectivity = Awaited<ReturnType<typeof connectivityStatus>>;
