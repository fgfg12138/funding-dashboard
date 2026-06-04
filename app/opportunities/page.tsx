"use client";

import { RefreshCw, Search } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppShell,
  DataTableShell,
  ExchangeBadge,
  FilterPanel,
  ReadOnlyPill,
  RiskBadge,
  ScoreBadge,
  StatCard,
  TypeBadge
} from "@/components/ui/dashboard";
import type { ExchangeName } from "@/lib/exchanges/types";
import type { UnifiedOpportunity, UnifiedOpportunityFilters, UnifiedOpportunitySortBy, UnifiedOpportunityType } from "@/lib/opportunities/types";
import { filterUnifiedOpportunities, isHighRiskUnifiedOpportunity, isRecommendedUnifiedOpportunity } from "@/lib/opportunities/unifiedOpportunities";

type SourceSnapshotMeta = {
  fundingMarketCount: number;
  spotMarketCount: number;
  crossCount: number;
  spotPerpCount: number;
  basisCount: number;
  unifiedCount: number;
  errors: string[];
};

type OpportunitiesApiResponse = {
  data: UnifiedOpportunity[];
  errors?: string[];
  updatedAt: number;
  meta?: SourceSnapshotMeta;
};

type QuickMode = "all" | UnifiedOpportunityType | "recommended" | "highRisk";

const TYPES: Array<"all" | UnifiedOpportunityType> = ["all", "CrossExchange", "SpotPerp", "Basis"];
const EXCHANGES: Array<"all" | ExchangeName> = ["all", "Binance", "OKX", "Bybit"];
const QUICK_MODES: Array<{ label: string; value: QuickMode }> = [
  { label: "All", value: "all" },
  { label: "Cross Exchange", value: "CrossExchange" },
  { label: "Spot/Perp", value: "SpotPerp" },
  { label: "Basis", value: "Basis" },
  { label: "Recommended", value: "recommended" },
  { label: "High Risk", value: "highRisk" }
];
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
  const [meta, setMeta] = useState<SourceSnapshotMeta | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickMode, setQuickMode] = useState<QuickMode>("all");
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
      setMeta(payload.meta ?? null);
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
    opportunityType: quickMode === "CrossExchange" || quickMode === "SpotPerp" || quickMode === "Basis" ? quickMode : opportunityType,
    exchange,
    minScore,
    minAnnualized,
    minVolume24h,
    recommendedOnly: recommendedOnly || quickMode === "recommended",
    hideHighRisk,
    sortBy
  };

  const filteredRows = useMemo(() => {
    const baseRows = filterUnifiedOpportunities(rows, filters);
    return quickMode === "highRisk" ? baseRows.filter(isHighRiskUnifiedOpportunity) : baseRows;
  }, [
    exchange,
    hideHighRisk,
    minAnnualized,
    minScore,
    minVolume24h,
    opportunityType,
    quickMode,
    recommendedOnly,
    rows,
    search,
    sortBy
  ]);
  const stats = useMemo(() => buildStats(rows), [rows]);

  return (
    <AppShell
      activeHref="/opportunities"
      actions={
        <>
          <div className="border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-400">
            Updated <span className="text-slate-100">{formatTime(updatedAt)}</span>
          </div>
          <button
            className="inline-flex h-9 items-center justify-center gap-2 border border-cyan-400/50 bg-cyan-400/10 px-3 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
            disabled={loading}
            onClick={() => void loadData()}
            title="Refresh public market data"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <ReadOnlyPill />
        </>
      }
      eyebrow="V1 Main Board"
      subtitle="Read-only multi-exchange funding and basis opportunity board"
      title="Funding Arbitrage OS"
    >
      <section className="grid gap-2 md:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Total Opportunities" value={stats.total.toLocaleString()} />
        <StatCard label="Recommended" value={stats.recommended.toLocaleString()} tone="cyan" />
        <StatCard label="Highest Score" value={stats.highestScore.toLocaleString()} tone="green" />
        <StatCard label="Highest Annualized" value={`${formatPercent(stats.highestAnnualized)}%`} tone="yellow" />
        <StatCard label="High Risk" value={stats.highRisk.toLocaleString()} tone="orange" />
        <StatCard label="Funding Markets" value={(meta?.fundingMarketCount ?? 0).toLocaleString()} />
        <StatCard label="Spot Markets" value={(meta?.spotMarketCount ?? 0).toLocaleString()} />
      </section>

      <section className="flex gap-1 overflow-x-auto border-y border-slate-800 bg-slate-950/40 px-2 py-2">
        {QUICK_MODES.map((mode) => (
          <button
            className={`whitespace-nowrap border px-3 py-1.5 text-xs ${
              quickMode === mode.value
                ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100"
                : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-100"
            }`}
            key={mode.value}
            onClick={() => setQuickMode(mode.value)}
            type="button"
          >
            {mode.label}
          </button>
        ))}
      </section>

      <FilterPanel
        footer={
          <>
            <span>Rows: {filteredRows.length.toLocaleString()}</span>
            <span>Cross: {meta?.crossCount?.toLocaleString() ?? "-"}</span>
            <span>Spot/Perp: {meta?.spotPerpCount?.toLocaleString() ?? "-"}</span>
            <span>Basis: {meta?.basisCount?.toLocaleString() ?? "-"}</span>
            <span>Unified: {meta?.unifiedCount?.toLocaleString() ?? "-"}</span>
            <span>Read Only / No API Key / No Trading / No Execution</span>
          </>
        }
      >
        <label className="space-y-1 text-sm">
          <span className="text-xs text-slate-400">Symbol Search</span>
          <span className="flex h-9 items-center gap-2 border border-slate-700 bg-slate-950 px-3">
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
        <NumberFilter label="Min Volume" step={1000000} value={minVolume24h} onChange={setMinVolume24h} />
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
            <span>Recommended Only</span>
          </label>
          <label className="flex items-center gap-2">
            <input checked={hideHighRisk} className="h-4 w-4 accent-cyan-400" type="checkbox" onChange={(event) => setHideHighRisk(event.target.checked)} />
            <span>Hide High Risk</span>
          </label>
        </div>
      </FilterPanel>

      {errors.length > 0 ? <p className="border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{errors.join(" | ")}</p> : null}

      <DataTableShell>
        <table className="min-w-[1680px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-800">
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
          <tbody className="divide-y divide-slate-800">
            {filteredRows.map((row) => (
              <tr className="bg-slate-950/20 hover:bg-slate-900/70" key={row.id}>
                <Td align="right">
                  <ScoreBadge score={row.score} />
                </Td>
                <Td>
                  <TypeBadge label={row.opportunityType} />
                </Td>
                <Td>
                  <RiskTags tags={row.riskTags} />
                </Td>
                <Td>
                  <div className="font-semibold text-slate-100">{row.symbol}</div>
                  <div className="text-xs text-slate-500">
                    {row.base}/{row.quote}
                  </div>
                </Td>
                <Td>
                  <span className="line-clamp-2 max-w-[240px] text-slate-300">{row.direction}</span>
                </Td>
                <Td>
                  <ExchangePair row={row} />
                </Td>
                <Td align="right">
                  <span className={row.annualizedRate >= 90 ? "text-orange-300" : "text-emerald-300"}>{formatPercent(row.annualizedRate)}%</span>
                </Td>
                <Td align="right">
                  <span className={Math.abs(row.basisPercent ?? row.spreadPercent ?? 0) >= 1 ? "text-orange-300" : "text-slate-200"}>{formatSpreadBasis(row)}</span>
                </Td>
                <Td align="right">{row.estimatedCarryAnnualized === undefined ? "-" : `${formatPercent(row.estimatedCarryAnnualized)}%`}</Td>
                <Td align="right">{formatCompactUsd(row.volume24h)}</Td>
                <Td align="right">{formatCompactUsd(row.openInterestUsd)}</Td>
                <Td>{formatTime(row.nextFundingTime ?? null)}</Td>
                <Td>
                  <span className="line-clamp-2 max-w-[420px] text-slate-400" title={row.opportunityReason}>
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
      </DataTableShell>
    </AppShell>
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
      <select className="h-9 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100" value={value} onChange={(event) => onChange(event.target.value)}>
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
        className="h-9 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        min={0}
        step={step}
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function RiskTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-slate-500">-</span>;

  return (
    <div className="flex max-w-[260px] flex-wrap gap-1">
      {tags.map((tag) => (
        <RiskBadge key={tag} label={tag} />
      ))}
    </div>
  );
}

function ExchangePair({ row }: { row: UnifiedOpportunity }) {
  return (
    <div className="flex flex-wrap gap-1">
      <ExchangeBadge label={row.primaryExchange} />
      {row.secondaryExchange ? <ExchangeBadge label={row.secondaryExchange} /> : null}
    </div>
  );
}

function Th({ align = "left", children }: { align?: "left" | "right"; children: ReactNode }) {
  return <th className={`whitespace-nowrap px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}

function Td({ align = "left", children }: { align?: "left" | "right"; children: ReactNode }) {
  return <td className={`whitespace-nowrap px-3 py-2 align-top ${align === "right" ? "text-right tabular-nums" : "text-left"}`}>{children}</td>;
}

function formatSpreadBasis(row: UnifiedOpportunity) {
  if (row.basisPercent !== undefined) return `Basis ${formatPercent(row.basisPercent)}%`;
  if (row.spreadPercent !== undefined) return `Spread ${formatPercent(row.spreadPercent)}%`;
  return "-";
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
