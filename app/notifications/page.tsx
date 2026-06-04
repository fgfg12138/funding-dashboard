import Link from "next/link";
import { NotificationEvaluateButton } from "./NotificationEvaluateButton";
import { queryNotificationEvents } from "@/lib/notifications/notificationStore";
import type { NotificationEvent, NotificationEventType, NotificationSeverity } from "@/lib/notifications/notificationRules";

export const dynamic = "force-dynamic";

const SEVERITIES: Array<"all" | NotificationSeverity> = ["all", "info", "success", "warning"];
const EVENT_TYPES: Array<"all" | NotificationEventType> = [
  "all",
  "Alpha Signal",
  "Stable Alpha Signal",
  "Risky Alpha Warning",
  "Funding Heat Warning"
];

export default async function NotificationsPage({
  searchParams
}: {
  searchParams: Promise<{ severity?: string; eventType?: string }>;
}) {
  const params = await searchParams;
  const severity = parseSeverity(params.severity);
  const eventType = parseEventType(params.eventType);
  const events = (await queryNotificationEvents({ limit: 500 }))
    .filter((event) => severity === "all" || event.severity === severity)
    .filter((event) => eventType === "all" || event.eventType === eventType);

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Notification Engine</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Research Notifications</h1>
            <p className="mt-1 text-sm text-slate-400">Read-only in-app signal log. No API keys, no execution, no trading.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/alpha">
              Alpha
            </Link>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/heatmap">
              Heatmap
            </Link>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/simulation">
              Simulation
            </Link>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/strategies">
              Strategies
            </Link>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/risk-rules">
              Risk Rules
            </Link>
            <NotificationEvaluateButton />
          </div>
        </header>

        <section className="flex flex-col gap-3 border-y border-slate-800 bg-slate-950/40 py-4 lg:flex-row lg:items-center lg:justify-between">
          <form action="/notifications" className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Severity</span>
              <select
                className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                defaultValue={severity}
                name="severity"
              >
                {SEVERITIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Event type</span>
              <select
                className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                defaultValue={eventType}
                name="eventType"
              >
                {EVENT_TYPES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <button className="h-10 rounded border border-cyan-400/50 bg-cyan-400/10 px-3 text-sm text-cyan-100 hover:bg-cyan-400/20" type="submit">
              Apply
            </button>
          </form>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{events.length} notifications</span>
            <span>Channel: in-app</span>
          </div>
        </section>

        <NotificationTable events={events} />
      </div>
    </main>
  );
}

function NotificationTable({ events }: { events: NotificationEvent[] }) {
  return (
    <section className="rounded border border-slate-800 bg-panel">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Recent Notifications</h2>
        <span className="text-xs text-slate-500">JSONL local store</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <Header>Time</Header>
              <Header>Severity</Header>
              <Header>Event Type</Header>
              <Header>Title</Header>
              <Header>Message</Header>
              <Header>Symbol</Header>
              <Header>Source</Header>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={event.id}>
                <Cell>{new Date(event.createdAt).toLocaleString()}</Cell>
                <Cell className={getSeverityClass(event.severity)}>{event.severity}</Cell>
                <Cell>{event.eventType}</Cell>
                <Cell strong>{event.title}</Cell>
                <Cell className="min-w-96 whitespace-normal text-slate-300">{event.message}</Cell>
                <Cell>{event.symbol}</Cell>
                <Cell>{event.source}</Cell>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={7}>
                  No notifications yet. Run Evaluate to scan current research history.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Header({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap border-b border-slate-800 px-3 py-2 font-medium">{children}</th>;
}

function Cell({
  children,
  className = "",
  strong = false
}: {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
}) {
  return <td className={`whitespace-nowrap px-3 py-2 ${strong ? "font-medium text-white" : "text-slate-200"} ${className}`}>{children}</td>;
}

function getSeverityClass(severity: NotificationSeverity): string {
  if (severity === "success") return "text-emerald-300";
  if (severity === "warning") return "text-amber-300";
  return "text-cyan-300";
}

function parseSeverity(value?: string): "all" | NotificationSeverity {
  if (value === "info" || value === "success" || value === "warning") {
    return value;
  }

  return "all";
}

function parseEventType(value?: string): "all" | NotificationEventType {
  if (
    value === "Alpha Signal" ||
    value === "Stable Alpha Signal" ||
    value === "Risky Alpha Warning" ||
    value === "Funding Heat Warning"
  ) {
    return value;
  }

  return "all";
}
