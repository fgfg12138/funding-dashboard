"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FundingHistoryRecord, OpportunityHistoryRecord } from "@/lib/data/historyStore";

type ApiResponse<T> = {
  data: T;
  error?: string;
  updatedAt: number;
};

type ChartPoint = {
  timestamp: number;
  value: number;
};

type ChartSeries = {
  name: string;
  color: string;
  points: ChartPoint[];
};

const SERIES_COLORS = ["#22d3ee", "#34d399", "#fb923c", "#f472b6", "#a78bfa", "#facc15"];

export default function HistoryClient({ symbol }: { symbol: string }) {
  const [fundingRows, setFundingRows] = useState<FundingHistoryRecord[]>([]);
  const [opportunityRows, setOpportunityRows] = useState<OpportunityHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);
      try {
        const encoded = encodeURIComponent(symbol);
        const [fundingRes, opportunityRes] = await Promise.all([
          fetch(`/api/history/funding?symbol=${encoded}`).then((res) => res.json() as Promise<ApiResponse<FundingHistoryRecord[]>>),
          fetch(`/api/history/opportunities?symbol=${encoded}`).then((res) => res.json() as Promise<ApiResponse<OpportunityHistoryRecord[]>>)
        ]);

        if (!cancelled) {
          if (fundingRes.error || opportunityRes.error) {
            setError(fundingRes.error ?? opportunityRes.error ?? "Failed to load history");
          }
          setFundingRows(fundingRes.data);
          setOpportunityRows(opportunityRes.data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load history");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const fundingRateSeries = useMemo(
    () => buildFundingSeries(fundingRows, "fundingRate", 100),
    [fundingRows]
  );
  const annualizedSeries = useMemo(
    () => buildFundingSeries(fundingRows, "annualizedRate", 1),
    [fundingRows]
  );
  const priceSpreadSeries = useMemo(() => buildOpportunityPriceSpreadSeries(opportunityRows), [opportunityRows]);
  const latestFundingRows = useMemo(() => getLatestFundingByExchange(fundingRows), [fundingRows]);

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/dashboard">
              Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">{symbol} History</h1>
            <p className="mt-1 text-sm text-slate-400">Read-only funding and opportunity trend history from local snapshots.</p>
          </div>
          <div className="text-sm text-slate-400">
            {loading ? "Loading..." : `${fundingRows.length} funding rows / ${opportunityRows.length} opportunity rows`}
          </div>
        </header>

        {error && (
          <div className="rounded border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {error}
          </div>
        )}

        <section className="grid gap-4 xl:grid-cols-2">
          <LineChart title="Funding Rate History" series={fundingRateSeries} suffix="%" />
          <LineChart title="Annualized Rate History" series={annualizedSeries} suffix="%" />
          <LineChart title="Directional Price Spread History" series={priceSpreadSeries} suffix="%" />
          <LatestExchangeTable rows={latestFundingRows} />
        </section>
      </div>
    </main>
  );
}

function buildFundingSeries(
  rows: FundingHistoryRecord[],
  key: "fundingRate" | "annualizedRate",
  scale: number
): ChartSeries[] {
  const grouped = new Map<string, ChartPoint[]>();

  for (const row of rows) {
    const value = row[key] * scale;
    if (!Number.isFinite(value)) {
      continue;
    }

    const points = grouped.get(row.exchange) ?? [];
    points.push({ timestamp: row.timestamp, value });
    grouped.set(row.exchange, points);
  }

  return Array.from(grouped.entries()).map(([name, points], index) => ({
    name,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: points.sort((a, b) => a.timestamp - b.timestamp)
  }));
}

function buildOpportunityPriceSpreadSeries(rows: OpportunityHistoryRecord[]): ChartSeries[] {
  const grouped = new Map<string, ChartPoint[]>();

  for (const row of rows) {
    if (!Number.isFinite(row.priceSpread)) {
      continue;
    }

    const name =
      row.type === "cross-exchange"
        ? row.direction ?? "Cross exchange"
        : `${row.spotExchange ?? "-"} spot + ${row.perpExchange ?? "-"} perp`;
    const points = grouped.get(name) ?? [];
    points.push({ timestamp: row.timestamp, value: row.priceSpread });
    grouped.set(name, points);
  }

  return Array.from(grouped.entries()).map(([name, points], index) => ({
    name,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    points: points.sort((a, b) => a.timestamp - b.timestamp)
  }));
}

function getLatestFundingByExchange(rows: FundingHistoryRecord[]): FundingHistoryRecord[] {
  const latest = new Map<string, FundingHistoryRecord>();

  for (const row of rows) {
    const existing = latest.get(row.exchange);
    if (!existing || row.timestamp > existing.timestamp) {
      latest.set(row.exchange, row);
    }
  }

  return Array.from(latest.values()).sort((a, b) => a.exchange.localeCompare(b.exchange));
}

function LineChart({ title, series, suffix }: { title: string; series: ChartSeries[]; suffix: string }) {
  const points = series.flatMap((item) => item.points);
  const hasData = points.length > 0;
  const minTime = hasData ? Math.min(...points.map((point) => point.timestamp)) : 0;
  const maxTime = hasData ? Math.max(...points.map((point) => point.timestamp)) : 1;
  const minValue = hasData ? Math.min(...points.map((point) => point.value)) : 0;
  const maxValue = hasData ? Math.max(...points.map((point) => point.value)) : 1;
  const timeRange = Math.max(1, maxTime - minTime);
  const valueRange = Math.max(1, maxValue - minValue);
  const width = 720;
  const height = 260;
  const padding = 34;

  return (
    <section className="rounded border border-slate-800 bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-xs text-slate-500">{hasData ? `${points.length} points` : "No history yet"}</span>
      </div>
      <div className="h-[280px] overflow-hidden">
        <svg className="h-full w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
          <rect fill="#020617" height={height} rx="4" width={width} x="0" y="0" />
          {[0, 1, 2, 3].map((step) => {
            const y = padding + ((height - padding * 2) * step) / 3;
            return <line key={step} stroke="#1e293b" strokeWidth="1" x1={padding} x2={width - padding} y1={y} y2={y} />;
          })}
          {hasData ? (
            series.map((item) => (
              <polyline
                key={item.name}
                fill="none"
                points={item.points
                  .map((point) => {
                    const x = padding + ((point.timestamp - minTime) / timeRange) * (width - padding * 2);
                    const y = height - padding - ((point.value - minValue) / valueRange) * (height - padding * 2);
                    return `${x.toFixed(2)},${y.toFixed(2)}`;
                  })
                  .join(" ")}
                stroke={item.color}
                strokeLinejoin="round"
                strokeWidth="2"
              />
            ))
          ) : (
            <text fill="#64748b" fontSize="14" textAnchor="middle" x={width / 2} y={height / 2}>
              No saved snapshots for this symbol yet
            </text>
          )}
          {hasData && (
            <>
              <text fill="#94a3b8" fontSize="11" x={padding} y={22}>
                {formatChartValue(maxValue, suffix)}
              </text>
              <text fill="#94a3b8" fontSize="11" x={padding} y={height - 12}>
                {formatChartValue(minValue, suffix)}
              </text>
            </>
          )}
        </svg>
      </div>
      {series.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
          {series.map((item) => (
            <span key={item.name} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function LatestExchangeTable({ rows }: { rows: FundingHistoryRecord[] }) {
  return (
    <section className="rounded border border-slate-800 bg-panel p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Latest Exchange Comparison</h2>
        <span className="text-xs text-slate-500">{rows.length} exchanges</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="text-slate-400">
            <tr>
              <th className="border-b border-slate-800 px-3 py-2 font-medium">Exchange</th>
              <th className="border-b border-slate-800 px-3 py-2 font-medium">Funding</th>
              <th className="border-b border-slate-800 px-3 py-2 font-medium">Annualized</th>
              <th className="border-b border-slate-800 px-3 py-2 font-medium">Mark</th>
              <th className="border-b border-slate-800 px-3 py-2 font-medium">Volume</th>
              <th className="border-b border-slate-800 px-3 py-2 font-medium">Open Interest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.exchange} className="border-b border-slate-800/70">
                <td className="px-3 py-2 text-slate-200">{row.exchange}</td>
                <td className="px-3 py-2 text-slate-200">{formatPercent(row.fundingRate * 100)}</td>
                <td className="px-3 py-2 text-slate-200">{formatPercent(row.annualizedRate)}</td>
                <td className="px-3 py-2 text-slate-200">{formatPrice(row.markPrice)}</td>
                <td className="px-3 py-2 text-slate-200">{formatUsd(row.volume24h)}</td>
                <td className="px-3 py-2 text-slate-200">{formatUsd(row.openInterestUsd)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="px-3 py-8 text-center text-slate-500" colSpan={6}>
                  No saved funding rows for this symbol yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatChartValue(value: number, suffix: string) {
  return `${value.toFixed(2)}${suffix}`;
}

function formatPercent(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatUsd(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPrice(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "-";
  if (value >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
