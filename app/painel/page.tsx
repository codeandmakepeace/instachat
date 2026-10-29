import Link from "next/link";
import { getConfig } from "@/lib/config";
import { listAutomations } from "@/lib/automations";
import { db } from "@/lib/supabase";
import { formatSaoPaulo } from "@/lib/time";
import { toggleAutomationAction, forceDrainAction } from "./actions";

async function queueStats() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const [{ count: pending }, { count: sentHour }, { count: failed }] =
    await Promise.all([
      db.from("queue").select("*", { count: "exact", head: true }).eq("status", "pending"),
      db.from("queue").select("*", { count: "exact", head: true }).eq("status", "sent").gte("updated_at", oneHourAgo),
      db.from("queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
    ]);
  return { pending: pending ?? 0, sentHour: sentHour ?? 0, failed: failed ?? 0 };
}

const MATCH_LABEL: Record<string, string> = {
  contains: "contains",
  exact: "exact match",
  any: "any text",
};

function errorMessage(code: string): string {
  switch (code) {
    case "meta_nao_configurada":
      return "The Meta app is not configured yet. Add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET in Vercel after creating your app in Meta for Developers.";
    case "state_invalido":
      return "Your Instagram login session expired. Click “Connect Instagram” and try again.";
    case "falha_conexao":
      return "Could not connect to Instagram. Please try again.";
    default:
      return `Could not connect (${code}). Click “Connect Instagram” and try again.`;
  }
}

export default async function PainelPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const config = await getConfig();
  const connected = !!config?.access_token && !!config?.ig_user_id;
  const automations = await listAutomations();
  const stats = await queueStats();

  return (
    <div className="space-y-6">
      {sp.connected ? (
        <Banner tone="ok">
          Instagram connected as <b>@{config?.username}</b>. You’re all set! 🎉
        </Banner>
      ) : null}
      {sp.error ? <Banner tone="err">{errorMessage(sp.error)}</Banner> : null}

      {!connected ? (
        <div className="ig-border relative overflow-hidden rounded-2xl p-7">
          <div className="ig-glow pointer-events-none absolute inset-0" />
          <div className="relative">
            <h2 className="font-display text-xl font-bold text-[#262626]">
              Connect your Instagram account
            </h2>
            <p className="mt-1.5 max-w-md text-sm text-[#737373]">
              Connect the professional account you want to automate.
            </p>
            <a href="/api/oauth/start" className="btn-ig mt-5 inline-block rounded-lg px-5 py-2.5 text-sm font-semibold">
              Connect Instagram
            </a>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="In queue" value={stats.pending} />
          <Stat label="Sent (last hour)" value={`${stats.sentHour}/200`} highlight />
          <Stat label="Failed" value={stats.failed} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Automations</h1>
        <div className="flex items-center gap-2">
          {connected ? (
            <form action={forceDrainAction}>
              <button type="submit" className={secondaryBtn}>Process queue now</button>
            </form>
          ) : null}
          <Link href="/painel/nova" className="btn-ig rounded-lg px-4 py-2 text-sm font-semibold">+ New automation</Link>
        </div>
      </div>

      {automations.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[#dbdbdb] bg-white p-10 text-center text-sm text-[#737373]">
          No automations yet. Create your first one with “+ New automation.”
        </p>
      ) : (
        <ul className="space-y-3">
          {automations.map((a) => {
            const triggers = [a.trigger_comment && "comment", a.trigger_story && "story reply", a.trigger_dm && "DM"].filter(Boolean);
            return (
              <li key={a.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{a.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${a.active ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"}`}>
                        {a.active ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-500">Triggers: {triggers.join(", ") || "—"} · Keywords ({MATCH_LABEL[a.match_type]}): {a.keywords.length ? a.keywords.join(", ") : "—"}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">Updated {formatSaoPaulo(a.updated_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={toggleAutomationAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="active" value={a.active ? "false" : "true"} />
                      <button type="submit" className={pillBtn}>{a.active ? "Pause" : "Activate"}</button>
                    </form>
                    <Link href={`/painel/editar/${a.id}`} className={pillBtn}>Edit</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const secondaryBtn = "btn-neutral rounded-lg px-3.5 py-2 text-[13px] font-semibold";
const pillBtn = "btn-neutral rounded-lg px-3.5 py-1.5 text-[13px] font-semibold";

function Stat({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm">
      <div className={`text-2xl font-bold ${highlight ? "text-ig-blue" : "text-neutral-900"}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-neutral-500">{label}</div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  const cls = tone === "ok" ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-800 ring-1 ring-red-200";
  return <div className={`rounded-2xl px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
