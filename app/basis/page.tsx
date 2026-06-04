"use client";

import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { BasisOpportunity } from "@/lib/basis/types";
import type { ExchangeName } from "@/lib/exchanges/types";

type BasisApiResponse = {
  data: BasisOpportunity[];
  errors?: string[];
  updatedAt: number;
};

const EXCHANGES: Array<"all" | ExchangeName> = ["all", "Binance", "OKX", "Bybit"];

export default function BasisPage() {
  const [rows, setRows] = useState<BasisOpportunity[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [exchange, setExchange] = useState<"all" | ExchangeName>("all");
  const [minAnnualized, setMinAnnualized] = useState(0);
  const [minVolume, setMinVolume] = useState(1_000_000);
  const [maxAbsBasis, setMaxAbsBasis] = useState(2);
  const [recommendedOnly, setRecommendedOnly] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/basis/opportunities", { cache: "no-store" });
      const payload = (await response.json()) as BasisApiResponse;
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

  const filteredRows = useMemo(() => {
    const query = search.trim().toUpperCase();

    return rows
      .filter((row) => (query ? row.symbol.includes(query) || row.base.includes(query) : true))
      .filter((row) => (exchange === "all" ? true : row.spotExchange === exchange || row.perpExchange === exchange))
      .filter((row) => row.annualizedFundingRate >= minAnnualized)
      .filter((row) => (row.volume24h ?? 0) >= minVolume)
      .filter((row) => Math.abs(row.basisPercent) <= maxAbsBasis)
      .filter((row) => (recommendedOnly ? isRecommended(row) : true))
      .sort((a, b) => b.score - a.score || b.estimatedCarryAnnualized - a.estimatedCarryAnnualized);
  }, [exchange, maxAbsBasis, minAnnualized, minVolume, recommendedOnly, rows, search]);

  const stats = useMemo(() => buildStats(rows), [rows]);

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Basis / Short Spread Board</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Basis</h1>
            <p className="mt-1 text-sm text-slate-400">
              买现货 + 空永续的只读基差看板。只调用公开行情，不接 API Key，不下单。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link className="text-cyan-300 hover:text-cyan-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/alpha">
              Alpha
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/adl-monitor">
              ADL Monitor
            </Link>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 border border-cyan-400/50 bg-cyan-400/10 px-4 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
              disabled={loading}
              onClick={() => void loadData()}
              title="刷新公开行情"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="机会数量" value={stats.count.toLocaleString()} />
          <StatCard label="最高年化资金费率" value={`${formatPercent(stats.maxAnnualized)}%`} tone="green" />
          <StatCard label="最高 Estimated Carry" value={`${formatPercent(stats.maxCarry)}%`} tone="cyan" />
          <StatCard label="价差超过 1%" value={stats.wideBasisCount.toLocaleString()} tone="orange" />
          <StatCard label="推荐机会" value={stats.recommendedCount.toLocaleString()} tone="yellow" />
        </section>

        <section className="border border-slate-800 bg-slate-950/40 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_150px_170px_170px_150px_180px]">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-slate-400">搜索币种</span>
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
            <SelectFilter label="交易所" value={exchange} onChange={(value) => setExchange(value as "all" | ExchangeName)}>
              {EXCHANGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </SelectFilter>
            <NumberFilter label="最低年化资金费率" step={1} value={minAnnualized} onChange={setMinAnnualized} />
            <NumberFilter label="最低24h成交量" step={1000000} value={minVolume} onChange={setMinVolume} />
            <NumberFilter label="最大绝对基差" step={0.1} value={maxAbsBasis} onChange={setMaxAbsBasis} />
            <label className="flex h-full items-end gap-2 text-sm text-slate-200">
              <input
                checked={recommendedOnly}
                className="mb-3 h-4 w-4 accent-cyan-400"
                type="checkbox"
                onChange={(event) => setRecommendedOnly(event.target.checked)}
              />
              <span className="pb-2">只看推荐机会</span>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
            <span>Rows: {filteredRows.length}</span>
            <span>Updated: {formatTime(updatedAt)}</span>
            <span>Read Only / No Trading / No API Key</span>
          </div>
          {errors.length > 0 ? <p className="mt-3 text-xs text-amber-300">{errors.join(" | ")}</p> : null}
        </section>

        <section className="overflow-x-auto border border-slate-800">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <Th align="right">Score</Th>
                <Th>Risk</Th>
                <Th>币种</Th>
                <Th>交易所</Th>
                <Th align="right">Spot Price</Th>
                <Th align="right">Perp Price</Th>
                <Th align="right">Basis %</Th>
                <Th align="right">Funding</Th>
                <Th align="right">Annualized</Th>
                <Th align="right">Estimated Carry</Th>
                <Th align="right">Volume 24h</Th>
                <Th align="right">Open Interest</Th>
                <Th>Next Funding</Th>
                <Th>Reason</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950/30">
              {filteredRows.map((row) => (
                <tr key={`${row.spotExchange}:${row.symbol}`} className="hover:bg-slate-900/70">
                  <Td align="right">
                    <span className={`font-semibold ${scoreClass(row.score)}`}>{row.score}</span>
                  </Td>
                  <Td>
                    <RiskTags tags={row.riskTags} />
                  </Td>
                  <Td>{row.symbol}</Td>
                  <Td>{row.spotExchange}</Td>
                  <Td align="right">{formatUsd(row.spotPrice)}</Td>
                  <Td align="right">{formatUsd(row.perpPrice)}</Td>
                  <Td align="right">
                    <span className={Math.abs(row.basisPercent) >= 1 ? "text-orange-300" : "text-slate-200"}>
                      {formatPercent(row.basisPercent)}%
                    </span>
                  </Td>
                  <Td align="right">{(row.fundingRate * 100).toFixed(4)}%</Td>
                  <Td align="right">
                    <span className={row.annualizedFundingRate >= 90 ? "text-orange-300" : "text-emerald-300"}>
                      {formatPercent(row.annualizedFundingRate)}%
                    </span>
                  </Td>
                  <Td align="right">
                    <span className={row.estimatedCarryAnnualized > 0 ? "text-cyan-300" : "text-red-300"}>
                      {formatPercent(row.estimatedCarryAnnualized)}%
                    </span>
                  </Td>
                  <Td align="right">{formatCompactUsd(row.volume24h)}</Td>
                  <Td align="right">{formatCompactUsd(row.openInterestUsd)}</Td>
                  <Td>{formatTime(row.nextFundingTime)}</Td>
                  <Td>
                    <span className="line-clamp-2 max-w-[360px] text-slate-400" title={row.opportunityReason}>
                      {row.opportunityReason}
                    </span>
                  </Td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={14}>
                    没有符合条件的同交易所正资金费率基差机会。
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

function buildStats(rows: BasisOpportunity[]) {
  return {
    count: rows.length,
    maxAnnualized: Math.max(0, ...rows.map((row) => row.annualizedFundingRate)),
    maxCarry: Math.max(0, ...rows.map((row) => row.estimatedCarryAnnualized)),
    wideBasisCount: rows.filter((row) => Math.abs(row.basisPercent) > 1).length,
    recommendedCount: rows.filter(isRecommended).length
  };
}

function isRecommended(row: BasisOpportunity) {
  return row.score >= 60 && (row.volume24h ?? 0) >= 1_000_000 && Math.abs(row.basisPercent) <= 1 && row.estimatedCarryAnnualized > 0;
}

function SelectFilter({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="space-y-1 text-sm">
      <span className="text-xs text-slate-400">{label}</span>
      <select
        className="h-10 w-full border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
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
  if (tags.length === 0) {
    return <span className="text-slate-500">-</span>;
  }

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

function scoreClass(score: number) {
  if (score >= 75) return "text-emerald-300";
  if (score >= 60) return "text-cyan-300";
  if (score >= 40) return "text-yellow-200";
  return "text-slate-400";
}

function formatPercent(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value >= 100 ? 2 : 6 })}`;
}

function formatCompactUsd(value: number | undefined) {
  if (!value) return "-";
  return Intl.NumberFormat(undefined, { currency: "USD", maximumFractionDigits: 1, notation: "compact", style: "currency" }).format(value);
}

function formatTime(value: number | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
