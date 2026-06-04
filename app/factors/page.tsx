import Link from "next/link";
import { queryAllFundingHistory, queryAllOpportunityHistory } from "@/lib/data/historyStore";
import {
  buildFundingFactorResearch,
  type FundingFactorBucket,
  type FundingFactorResearchResult
} from "@/lib/research/fundingFactors";

export const dynamic = "force-dynamic";

const WINDOW_OPTIONS = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 }
];

export default async function FactorsPage({
  searchParams
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const params = await searchParams;
  const windowHours = parseWindowHours(params.window);
  const now = Date.now();
  const from = now - windowHours * 60 * 60_000;
  const [opportunityRows, fundingRows] = await Promise.all([
    queryAllOpportunityHistory({ from, to: now, limit: 5000 }),
    queryAllFundingHistory({ from, to: now, limit: 5000 })
  ]);
  const research = buildFundingFactorResearch({ opportunityRows, fundingRows, now, windowHours });
  const allBuckets = Object.values(research.bucketsByFactor).flat();

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Funding Factor Research</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Funding Factor Research</h1>
            <p className="mt-1 text-sm text-slate-400">Read-only quartile analysis. No trading, no model fitting, no API keys.</p>
          </div>
          <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/dashboard">
            Back to dashboard
          </Link>
        </header>

        <section className="flex flex-col gap-3 border-y border-slate-800 bg-slate-950/40 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded border border-slate-700 bg-slate-950 p-1">
            {WINDOW_OPTIONS.map((item) => (
              <Link
                className={`h-8 px-3 py-1.5 text-sm ${windowHours === item.hours ? "bg-cyan-400/20 text-cyan-100" : "text-slate-400 hover:text-slate-100"}`}
                href={`/factors?window=${item.label}`}
                key={item.label}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{research.samples.length} factor samples</span>
            <span>{opportunityRows.length} opportunity snapshots</span>
            <span>{fundingRows.length} funding snapshots</span>
            <span>Updated {new Date(research.generatedAt).toLocaleTimeString()}</span>
          </div>
        </section>

        <FactorSummaryTable research={research} />

        <section className="grid gap-4 xl:grid-cols-3">
          <BucketTable buckets={allBuckets} metric="avgSurvivalHours" title="Survival by Factor Bucket" />
          <BucketTable buckets={allBuckets} metric="avgAnnualizedDecay" title="Decay by Factor Bucket" />
          <BucketTable buckets={allBuckets} metric="avgQualityScore" title="Quality by Factor Bucket" />
        </section>
      </div>
    </main>
  );
}

function FactorSummaryTable({ research }: { research: FundingFactorResearchResult }) {
  return (
    <section className="rounded border border-slate-800 bg-panel">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-base font-semibold text-white">Factor Summary Table</h2>
        <span className="text-xs text-slate-500">{research.factorSummaries.length} factors</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <Header>Factor</Header>
              <Header>Samples</Header>
              <Header>Min</Header>
              <Header>Avg</Header>
              <Header>Max</Header>
              <Header>Best survival</Header>
              <Header>Lowest decay</Header>
              <Header>Best quality</Header>
            </tr>
          </thead>
          <tbody>
            {research.factorSummaries.map((row) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={row.factor}>
                <Cell>{row.factor}</Cell>
                <Cell>{row.sampleCount}</Cell>
                <Cell>{formatNumber(row.minValue)}</Cell>
                <Cell>{formatNumber(row.avgValue)}</Cell>
                <Cell>{formatNumber(row.maxValue)}</Cell>
                <Cell>{row.bestSurvivalBucket ?? "-"}</Cell>
                <Cell>{row.lowestDecayBucket ?? "-"}</Cell>
                <Cell>{row.bestQualityBucket ?? "-"}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BucketTable({
  buckets,
  metric,
  title
}: {
  buckets: FundingFactorBucket[];
  metric: "avgSurvivalHours" | "avgAnnualizedDecay" | "avgQualityScore";
  title: string;
}) {
  return (
    <section className="rounded border border-slate-800 bg-panel">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-xs text-slate-500">{buckets.length} buckets</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <Header>Factor</Header>
              <Header>Bucket</Header>
              <Header>Range</Header>
              <Header>Samples</Header>
              <Header>Value</Header>
            </tr>
          </thead>
          <tbody>
            {buckets.map((row) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={`${title}:${row.factor}:${row.bucket}`}>
                <Cell>{row.factor}</Cell>
                <Cell>{row.bucket}</Cell>
                <Cell>{formatNumber(row.minValue)} - {formatNumber(row.maxValue)}</Cell>
                <Cell>{row.sampleCount}</Cell>
                <Cell>{formatMetric(row[metric], metric)}</Cell>
              </tr>
            ))}
            {buckets.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                  No factor buckets yet. Let the dashboard collect more history.
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

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "-";
  if (Math.abs(value) >= 1_000_000) return value.toExponential(2);
  return value.toFixed(2);
}

function formatMetric(value: number, metric: "avgSurvivalHours" | "avgAnnualizedDecay" | "avgQualityScore") {
  if (metric === "avgSurvivalHours") return `${value.toFixed(2)}h`;
  if (metric === "avgAnnualizedDecay") return `${value.toFixed(2)}%`;
  return value.toFixed(0);
}

function parseWindowHours(value?: string): number {
  if (value === "1" || value === "1h") return 1;
  if (value === "7d" || value === "168") return 168;
  if (value === "30d" || value === "720") return 720;
  return 24;
}
