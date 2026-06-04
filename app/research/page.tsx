import Link from "next/link";
import { queryAllOpportunityHistory } from "@/lib/data/historyStore";
import {
  buildOpportunityResearch,
  type OpportunityLifecycle,
  type OpportunityResearchResult
} from "@/lib/research/opportunityValidation";

export const dynamic = "force-dynamic";

const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_LIMIT = 12;

export default async function ResearchPage({
  searchParams
}: {
  searchParams: Promise<{ window?: string; limit?: string }>;
}) {
  const params = await searchParams;
  const windowHours = parseWindowHours(params.window);
  const limit = parsePositiveInt(params.limit) ?? DEFAULT_LIMIT;
  const now = Date.now();
  const rows = await queryAllOpportunityHistory({
    from: now - windowHours * 60 * 60_000,
    to: now,
    limit: 5000
  });
  const research = buildOpportunityResearch(rows, { now, windowHours, limit });

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Opportunity Validation Engine</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Research</h1>
            <p className="mt-1 text-sm text-slate-400">Read-only historical validation for funding opportunities. No trading, no API keys.</p>
          </div>
          <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/dashboard">
            Back to dashboard
          </Link>
        </header>

        <section className="flex flex-col gap-3 border-y border-slate-800 bg-slate-950/40 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded border border-slate-700 bg-slate-950 p-1">
            {[1, 4, 8, 24].map((hours) => (
              <Link
                className={`h-8 px-3 py-1.5 text-sm ${windowHours === hours ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400 hover:text-slate-100"}`}
                href={`/research?window=${hours}h&limit=${limit}`}
                key={hours}
              >
                {hours}h
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{rows.length} snapshots</span>
            <span>Window {research.windowHours}h</span>
            <span>Updated {new Date(research.generatedAt).toLocaleTimeString()}</span>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <ResearchTable rows={research.topStable} title="Top Stable Opportunities" />
          <ResearchTable rows={research.topDecayed} title="Top Decayed Opportunities" />
          <ResearchTable rows={research.longestSurvival} title="Longest Survival Opportunities" />
        </section>
      </div>
    </main>
  );
}

function ResearchTable({ rows, title }: { rows: OpportunityResearchResult["topStable"]; title: string }) {
  return (
    <section className="rounded border border-slate-800 bg-panel">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-xs text-slate-500">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <Header>Symbol</Header>
              <Header>Quality</Header>
              <Header>Survival</Header>
              <Header>Latest</Header>
              <Header>Decay</Header>
              <Header>Spread Δ</Header>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={row.id}>
                <Cell>
                  <div className="font-medium text-slate-100">{row.symbol}</div>
                  <div className="max-w-[180px] truncate text-[11px] text-slate-500" title={row.label}>
                    {row.label}
                  </div>
                </Cell>
                <Cell>
                  <Score value={row.qualityScore} />
                </Cell>
                <Cell>{formatHours(row.survivalHours)}</Cell>
                <Cell>{formatPercent(row.latestAnnualized)}</Cell>
                <Cell>
                  <SignedPercent value={row.annualizedDecay} />
                </Cell>
                <Cell>
                  <SignedPercent value={row.priceSpreadChange} />
                </Cell>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                  No research rows yet. Let the dashboard collect more opportunity snapshots.
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

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-3 py-2 text-slate-200">{children}</td>;
}

function Score({ value }: { value: number }) {
  const color = value >= 75 ? "text-emerald-300" : value >= 50 ? "text-orange-300" : "text-rose-300";
  return <span className={`font-semibold ${color}`}>{value}</span>;
}

function SignedPercent({ value }: { value: number }) {
  const color = value <= 0 ? "text-emerald-300" : "text-rose-300";
  return <span className={color}>{formatPercent(value)}</span>;
}

function formatPercent(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatHours(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function parseWindowHours(value?: string): 1 | 4 | 8 | 24 {
  if (value === "1" || value === "1h") return 1;
  if (value === "4" || value === "4h") return 4;
  if (value === "8" || value === "8h") return 8;
  return DEFAULT_WINDOW_HOURS;
}

function parsePositiveInt(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}
