"use client";

import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { UnifiedOpportunity, UnifiedOpportunityFilters, UnifiedOpportunitySortBy, UnifiedOpportunityType } from "@/lib/opportunities/types";
import { filterUnifiedOpportunities, isHighRiskUnifiedOpportunity, isRecommendedUnifiedOpportunity } from "@/lib/opportunities/unifiedOpportunities";
import type { ExchangeName } from "@/lib/exchanges/types";

type OpportunitiesApiResponse = {
  data: UnifiedOpportunity[];
  errors?: string[];
  updatedAt: number;
};

const TYPES: Array<"all" | UnifiedOpportunityType> = ["all", "CrossExchange", "SpotPerp", "Basis"];
const EXCHANGES: Array<"all" | ExchangeName> = ["all", "Binance", "OKX", "Bybit"];
const SORT_OPTIONS: Array<{ label: string; value: UnifiedOpportunitySortBy }> = [
  { label: "Score", value: "score" },
  { label: "Annualized", value: "annualized" },
  { label: "Estimated Carry", value: "estimatedCarry" },
  { label: "Volume", value: "volume" },
  { label: "Next Funding", value: "nextFunding" }
];

export default function OpportunitiesPage() {
  const [rows, setRows] = useState<UnifiedOpportunity[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [opportunityType, setOpportunityType] = useState<"all" | UnifiedOpportunityType>("all");
  const [exchange, setExchange] = useState<"all" | ExchangeName>("all");
  const [minScore, setMinScore] = useState(0);
  const [minAnnualized, setMinAnnualized] = useState(0);
  const [minVolume24h, setMinVolume24h] = useState(1_000_000);
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [hideHighRisk, setHideHighRisk] = useState(false);
  const [sortBy, setSortBy] = useState<UnifiedOpportunitySortBy>("score");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/opportunities", { cache: "no-store" });
      const payload = (await response.json()) as OpportunitiesApiResponse;
      setRows(payload.data ?? []);
      setErrors(payload.errors ?? []);
      setUpdatedAt(payload.updatedAt ?? Date.now());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const filters: UnifiedOpportunityFilters = {
    search,
    opportunityType,
    exchange,
    minScore,
    minAnnualized,
    minVolume24h,
    recommendedOnly,
    hideHighRisk,
    sortBy
  };
  const filteredRows = useMemo(() => filterUnifiedOpportunities(rows, filters), [
    exchange,
    hideHighRisk,
    minAnnualized,
    minScore,
    minVolume24h,
    opportunityType,
    recommendedOnly,
    rows,
    search,
    sortBy
  ]);
  const stats = useMemo(() => buildStats(rows), [rows]);

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Unified Opportunity Board</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Opportunities</h1>
            <p className="mt-1 text-sm text-slate-400">
              Unified read-only view for cross-exchange funding spreads, spot-perp funding, and basis opportunities.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link className="text-cyan-300 hover:text-cyan-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/basis">
              Basis
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/alpha">
              Alpha
            </Link>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 border border-cyan-400/50 bg-cyan-400/10 px-4 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              onClick={() => void loadData()}
              title="Refresh public market data"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total" value={stats.total.toLocaleString()} />
          <StatCard label="Recommended" value={stats.recommended.toLocaleString()} tone="cyan" />
          <StatCard label="Highest Score" value={stats.highestScore.toLocaleString()} tone="green" />
          <StatCard label="Highest Annualized" value={`${formatPercent(stats.highestAnnualized)}%`} tone="yellow" />
          <StatCard label="High Risk" value={stats.highRisk.toLocaleString()} tone="orange" />
        </section>

        <section className="border border-slate-800 bg-slate-950/40 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_150px_130px_160px_170px_160px_150px]">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-slate-400">Search Symbol</span>
              <span className="flex h-10 items-center gap-2 border border-slate-700 bg-slate-950 px-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  placeholder="BTC/USDT"
                  value={search}
                  onChange={(event) => setSearch(event.target.value.toUpperCase())}
                />
              </span>
            </label>
            <SelectFilter label="Type" value={opportunityType} onChange={(value) => setOpportunityType(value as "all" | UnifiedOpportunityType)}>
              {TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectFilter>
            <SelectFilter label="Exchange" value={exchange} onChange={(value) => setExchange(value as "all" | ExchangeName)}>
              {EXCHANGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectFilter>
            <NumberFilter label="Min Score" step={5} value={minScore} onChange={setMinScore} />
            <NumberFilter label="Min Annualized" step={5} value={minAnnualized} onChange={setMinAnnualized} />
            <NumberFilter label="Min Volume 24h" step={1000000} value={minVolume24h} onChange={setMinVolume24h} />
            <SelectFilter label="Sort" value={sortBy} onChange={(value) => setSortBy(value as UnifiedOpportunitySortBy)}>
              {SORT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectFilter>
            <div className="flex flex-col justify-end gap-2 text-sm text-slate-200">
              <label className="flex items-center gap-2">
                <input checked={recommendedOnly} className="h-4 w-4 accent-cyan-400" type="checkbox" onChange={(event) => setRecommendedOnly(event.target.checked)} />
                <span>Only recommended</span>
              </label>
              <label className="flex items-center gap-2">
                <input checked={hideHighRisk} className="h-4 w-4 accent-cyan-400" type="checkbox" onChange={(event) => setHideHighRisk(event.target.checked)} />
                <span>Hide high risk</span>
              </label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Rows: {filteredRows.length}</span>
            <span>Updated: {formatTime(updatedAt)}</span>
            <span>Read Only / No API Key / No Trading / No Simulation Execution</span>
          </div>
          {errors.length > 0 ? <p className="mt-3 text-xs text-amber-300">{errors.join(" | ")}</p> : null}
        </section>

        <section className="overflow-x-auto border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <Th align="right">Score</Th>
                <Th>Type</Th>
                <Th>Risk</Th>
                <Th>Symbol</Th>
                <Th>Direction</Th>
                <Th>Exchanges</Th>
                <Th align="right">Annualized</Th>
                <Th align="right">Spread / Basis</Th>
                <Th align="right">Estimated Carry</Th>
                <Th align="right">Volume 24h</Th>
                <Th align="right">Open Interest</Th>
                <Th>Next Funding</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/30">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/70">
                  <Td align="right">
                    <span className={`font-semibold ${scoreClass(row.score)}`}>{row.score}</span>
                  </Td>
                  <Td>
                    <span className={`border px-2 py-0.5 text-xs ${typeClass(row.opportunityType)}`}>{row.opportunityType}</span>
                  </Td>
                  <Td>
                    <RiskTags tags={row.riskTags} />
                  </Td>
                  <Td>{row.symbol}</Td>
                  <Td>
                    <span className="line-clamp-2 max-w-[220px] text-slate-300">{row.direction}</span>
                  </Td>
                  <Td>{formatExchangePair(row)}</Td>
                  <Td align="right">
                    <span className={row.annualizedRate >= 90 ? "text-orange-300" : "text-emerald-300"}>{formatPercent(row.annualizedRate)}%</span>
                  </Td>
                  <Td align="right">
                    <span className={Math.abs(row.basisPercent ?? row.spreadPercent ?? 0) >= 1 ? "text-orange-300" : "text-slate-200"}>
                      {formatSpreadBasis(row)}
                    </span>
                  </Td>
                  <Td align="right">{row.estimatedCarryAnnualized === undefined ? "-" : `${formatPercent(row.estimatedCarryAnnualized)}%`}</Td>
                  <Td align="right">{formatCompactUsd(row.volume24h)}</Td>
                  <Td align="right">{formatCompactUsd(row.openInterestUsd)}</Td>
                  <Td>{formatTime(row.nextFundingTime ?? null)}</Td>
                  <Td>
                    <span className="line-clamp-2 max-w-[360px] text-slate-400" title={row.opportunityReason}>
                      {row.opportunityReason}
                    </span>
                  </Td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={13}>
                    No opportunities match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function buildStats(rows: UnifiedOpportunity[]) {
  return {
    total: rows.length,
    recommended: rows.filter(isRecommendedUnifiedOpportunity).length,
    highestScore: Math.max(0, ...rows.map((row) => row.score)),
    highestAnnualized: Math.max(0, ...rows.map((row) => row.annualizedRate)),
    highRisk: rows.filter(isHighRiskUnifiedOpportunity).length
  };
}

function SelectFilter({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs text-slate-400">{label}</span>
      <select className="h-10 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function NumberFilter({ label, onChange, step, value }: { label: string; onChange: (value: number) => void; step: number; value: number }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs text-slate-400">{label}</span>
      <input
        className="h-10 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        min={0}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function StatCard({ label, tone = "slate", value }: { label: string; tone?: "slate" | "green" | "cyan" | "orange" | "yellow"; value: string }) {
  const toneClass = {
    slate: "text-slate-100",
    green: "text-emerald-300",
    cyan: "text-cyan-300",
    orange: "text-orange-300",
    yellow: "text-yellow-200"
  }[tone];

  return (
    <div className="border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function RiskTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-slate-500">-</span>;

  return (
    <div className="flex max-w-[240px] flex-wrap gap-1">
      {tags.map((tag) => (
        <span className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-xs text-amber-200" key={tag}>
          {tag}
        </span>
      ))}
    </div>
  );
}

function Th({ align = "left", children }: { align?: "left" | "right"; children: ReactNode }) {
  return <th className={`whitespace-nowrap px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ align = "left", children }: { align?: "left" | "right"; children: ReactNode }) {
  return <td className={`whitespace-nowrap px-4 py-3 ${align === "right" ? "text-right tabular-nums" : "text-left"}`}>{children}</td>;
}

function formatExchangePair(row: UnifiedOpportunity) {
  return row.secondaryExchange ? `${row.primaryExchange} / ${row.secondaryExchange}` : row.primaryExchange;
}

function formatSpreadBasis(row: UnifiedOpportunity) {
  if (row.basisPercent !== undefined) return `Basis ${formatPercent(row.basisPercent)}%`;
  if (row.spreadPercent !== undefined) return `Spread ${formatPercent(row.spreadPercent)}%`;
  return "-";
}

function typeClass(type: UnifiedOpportunityType) {
  if (type === "CrossExchange") return "border-purple-400/50 bg-purple-400/10 text-purple-200";
  if (type === "SpotPerp") return "border-cyan-400/50 bg-cyan-400/10 text-cyan-200";
  return "border-emerald-400/50 bg-emerald-400/10 text-emerald-200";
}

function scoreClass(score: number) {
  if (score >= 75) return "text-emerald-300";
  if (score >= 60) return "text-cyan-300";
  if (score >= 40) return "text-yellow-200";
  return "text-slate-400";
}

function formatPercent(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatCompactUsd(value: number | undefined) {
  if (!value) return "-";
  return Intl.NumberFormat(undefined, { currency: "USD", maximumFractionDigits: 1, notation: "compact", style: "currency" }).format(value);
}

function formatTime(value: number | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
