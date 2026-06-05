import Link from "next/link";
import { TopNav } from "@/components/TopNav";
import { queryAllFundingHistory, queryAllOpportunityHistory } from "@/lib/data/historyStore";
import { buildAlphaDiscovery, type AlphaOpportunity, type AlphaType } from "@/lib/research/alphaScore";
import { buildFundingFactorResearch } from "@/lib/research/fundingFactors";

export const dynamic = "force-dynamic";

const WINDOW_OPTIONS = [
  { label: "1h", value: "1h", hours: 1 },
  { label: "24h", value: "24h", hours: 24 },
  { label: "7d", value: "7d", hours: 168 },
  { label: "30d", value: "30d", hours: 720 }
];

const TYPE_OPTIONS: Array<"all" | AlphaType> = ["all", "Stable Alpha", "Emerging Alpha", "Momentum Alpha", "Risky Alpha"];

type AlphaPageParams = {
  window?: string;
  type?: string;
  minAlphaScore?: string;
  limit?: string;
};

export default async function AlphaPage({
  searchParams
}: {
  searchParams: Promise<AlphaPageParams>;
}) {
  const params = await searchParams;
  const windowHours = parseWindowHours(params.window);
  const limit = parseNumberParam(params.limit) ?? 20;
  const type = parseAlphaType(params.type);
  const minAlphaScore = parseNumberParam(params.minAlphaScore);
  const now = Date.now();
  const from = now - windowHours * 60 * 60_000;
  const [opportunityRows, fundingRows] = await Promise.all([
    queryAllOpportunityHistory({ from, to: now, limit: 5000 }),
    queryAllFundingHistory({ from, to: now, limit: 5000 })
  ]);
  const factors = buildFundingFactorResearch({ opportunityRows, fundingRows, now, windowHours });
  const discovery = buildAlphaDiscovery({
    samples: factors.samples,
    limit,
    filters: {
      type,
      minAlphaScore
    }
  });

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Alpha Discovery Engine</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Funding Alpha Discovery</h1>
            <p className="mt-1 text-sm text-slate-400">只读 opportunity discovery from funding and opportunity history.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link className="text-cyan-300 hover:text-cyan-100" href="/factors">
              Factors
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/notifications">
              Notifications
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/simulation">
              Simulation
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/strategies">
              Strategies
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/risk-rules">
              Risk Rules
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/adl-monitor">
              ADL Monitor
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/basis">
              Basis
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/opportunities">
              Opportunities
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/dashboard">
              Dashboard
            </Link>
          </div>
        </header>
        <TopNav activeHref="/alpha" />

        <section className="flex flex-col gap-3 border-y border-slate-800 bg-slate-950/40 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {WINDOW_OPTIONS.map((item) => (
              <Link
                className={`h-8 rounded border px-3 py-1.5 text-sm ${
                  windowHours === item.hours
                    ? "border-amber-400/50 bg-amber-400/15 text-amber-100"
                    : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-100"
                }`}
                href={buildHref({ ...params, window: item.value })}
                key={item.value}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((item) => (
              <Link
                className={`h-8 rounded border px-3 py-1.5 text-sm ${
                  type === item
                    ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-100"
                    : "border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-100"
                }`}
                href={buildHref({ ...params, type: item })}
                key={item}
              >
                {item === "all" ? "All" : item}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{factors.samples.length} samples</span>
            <span>{opportunityRows.length} opportunity snapshots</span>
            <span>{fundingRows.length} funding snapshots</span>
            <span>更新时间 {new Date(factors.generatedAt).toLocaleTimeString()}</span>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Stat label="Top Alpha Score" value={formatNumber(discovery.topAlpha[0]?.alphaScore)} tone="text-amber-300" />
          <Stat label="A+/A Count" value={countStrongAlpha(discovery.topAlpha)} tone="text-emerald-300" />
          <Stat label="Stable Count" value={discovery.topStableAlpha.length} tone="text-cyan-300" />
          <Stat label="Risky Count" value={discovery.topRiskyAlpha.length} tone="text-rose-300" />
        </section>

        <AlphaTable rows={discovery.topAlpha} title="Top Alpha Opportunities" />
        <section className="grid gap-4 2xl:grid-cols-2">
          <AlphaTable rows={discovery.topStableAlpha} title="Top Stable Alpha" />
          <AlphaTable rows={discovery.topEmergingAlpha} title="Top Emerging Alpha" />
          <AlphaTable rows={discovery.topMomentumAlpha} title="Top Momentum Alpha" />
          <AlphaTable rows={discovery.topRiskyAlpha} title="Top Risky Alpha" />
        </section>
      </div>
    </main>
  );
}

function AlphaTable({ rows, title }: { rows: AlphaOpportunity[]; title: string }) {
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
              <Header>Type</Header>
              <Header>Pair</Header>
              <Header>Score</Header>
              <Header>Grade</Header>
              <Header>Latest</Header>
              <Header>Avg</Header>
              <Header>Positive</Header>
              <Header>Survival</Header>
              <Header>Decay</Header>
              <Header>Volatility</Header>
              <Header>Quality</Header>
              <Header>Reason</Header>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={`${title}:${row.id}`}>
                <Cell strong>
                  <Link className="text-cyan-300 hover:text-cyan-100" href={`/alpha/${encodeURIComponent(row.id)}`}>
                    {row.symbol}
                  </Link>
                </Cell>
                <Cell>{row.alphaType}</Cell>
                <Cell>{row.exchangePair}</Cell>
                <Cell className={getScoreClass(row.alphaScore)}>{row.alphaScore}</Cell>
                <Cell className={getGradeClass(row.alphaGrade)}>{row.alphaGrade}</Cell>
                <Cell>{formatPercent(row.latestAnnualized)}</Cell>
                <Cell>{formatPercent(row.avgAnnualized)}</Cell>
                <Cell>{formatRatio(row.positiveFundingRatio)}</Cell>
                <Cell>{row.survivalHours.toFixed(1)}h</Cell>
                <Cell className={row.annualizedDecay > 30 ? "text-rose-300" : "text-emerald-300"}>{formatPercent(row.annualizedDecay)}</Cell>
                <Cell className={row.fundingVolatility > 60 ? "text-rose-300" : "text-slate-200"}>{formatPercent(row.fundingVolatility)}</Cell>
                <Cell>{row.qualityScore.toFixed(0)}</Cell>
                <Cell className="min-w-72 whitespace-normal text-slate-300">{row.alphaReason}</Cell>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={13}>
                  暂无符合筛选条件的 Alpha 机会。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="rounded border border-slate-800 bg-panel px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
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

function buildHref(params: AlphaPageParams): string {
  const searchParams = new URLSearchParams();
  if (params.window) searchParams.set("window", params.window);
  if (params.type && params.type !== "all") searchParams.set("type", params.type);
  if (params.minAlphaScore) searchParams.set("minAlphaScore", params.minAlphaScore);
  if (params.limit) searchParams.set("limit", params.limit);
  const query = searchParams.toString();
  return query ? `/alpha?${query}` : "/alpha";
}

function countStrongAlpha(rows: AlphaOpportunity[]): number {
  return rows.filter((row) => row.alphaGrade === "A+" || row.alphaGrade === "A").length;
}

function getScoreClass(score: number): string {
  if (score >= 85) return "text-amber-300";
  if (score >= 75) return "text-emerald-300";
  if (score >= 60) return "text-cyan-300";
  return "text-slate-300";
}

function getGradeClass(grade: AlphaOpportunity["alphaGrade"]): string {
  if (grade === "A+") return "text-amber-300";
  if (grade === "A") return "text-emerald-300";
  if (grade === "B") return "text-cyan-300";
  if (grade === "C") return "text-slate-300";
  return "text-rose-300";
}

function formatNumber(value: number | undefined) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(0);
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatRatio(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${(value * 100).toFixed(0)}%`;
}

function parseAlphaType(value?: string): "all" | AlphaType {
  if (value === "Stable Alpha" || value === "Emerging Alpha" || value === "Momentum Alpha" || value === "Risky Alpha") {
    return value;
  }

  return "all";
}

function parseWindowHours(value?: string): number {
  if (value === "1" || value === "1h") return 1;
  if (value === "7d" || value === "168") return 168;
  if (value === "30d" || value === "720") return 720;
  return 24;
}

function parseNumberParam(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
