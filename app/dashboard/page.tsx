"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import { RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CrossExchangeOpportunity,
  DashboardSummary,
  ExchangeName,
  SpotPerpOpportunity
} from "@/lib/exchanges/types";

type ApiResponse<T> = {
  data: T;
  errors?: string[];
  updatedAt: number;
};

const EXCHANGES: ExchangeName[] = ["Binance", "OKX", "Bybit"];

function encodeHistorySymbol(symbol: string) {
  return encodeURIComponent(symbol.replace("/", "_"));
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [crossRows, setCrossRows] = useState<CrossExchangeOpportunity[]>([]);
  const [spotRows, setSpotRows] = useState<SpotPerpOpportunity[]>([]);
  const [search, setSearch] = useState("");
  const [minVolume, setMinVolume] = useState(1_000_000);
  const [minExchangeCount, setMinExchangeCount] = useState(2);
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [enabledExchanges, setEnabledExchanges] = useState<Record<ExchangeName, boolean>>({
    Binance: true,
    OKX: true,
    Bybit: true
  });
  const [sortMode, setSortMode] = useState("spread");
  const [errors, setErrors] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [summaryRes, crossRes, spotRes] = await Promise.all([
      fetch("/api/summary").then((res) => res.json() as Promise<ApiResponse<DashboardSummary>>),
      fetch("/api/funding/cross-exchange").then((res) => res.json() as Promise<ApiResponse<CrossExchangeOpportunity[]>>),
      fetch("/api/funding/spot-perp").then((res) => res.json() as Promise<ApiResponse<SpotPerpOpportunity[]>>)
    ]);

    setSummary(summaryRes.data);
    setCrossRows(crossRes.data);
    setSpotRows(spotRes.data);
    setUpdatedAt(Math.max(summaryRes.updatedAt, crossRes.updatedAt, spotRes.updatedAt));
    setErrors([...new Set([...(summaryRes.errors ?? []), ...(crossRes.errors ?? []), ...(spotRes.errors ?? [])])]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const filteredCrossRows = useMemo(() => {
    const query = search.trim().toUpperCase();
    return crossRows
      .filter((row) => (query ? row.symbol.includes(query) || row.base.includes(query) : true))
      .filter((row) => (row.volume24h ?? 0) >= minVolume)
      .filter((row) => Object.values(row.markets).filter(Boolean).length >= minExchangeCount)
      .filter((row) => Object.keys(row.markets).some((exchange) => enabledExchanges[exchange as ExchangeName]))
      .filter((row) => (recommendedOnly ? isRecommendedOpportunity(row) : true))
      .sort((a, b) => {
        if (sortMode === "score") return b.score - a.score;
        if (sortMode === "volume") return (b.volume24h ?? 0) - (a.volume24h ?? 0);
        if (sortMode === "single") {
          return Math.max(...Object.values(b.annualizedRates).map(Number)) - Math.max(...Object.values(a.annualizedRates).map(Number));
        }
        return b.annualizedSpread - a.annualizedSpread;
      });
  }, [crossRows, enabledExchanges, minExchangeCount, minVolume, recommendedOnly, search, sortMode]);

  const filteredSpotRows = useMemo(() => {
    const query = search.trim().toUpperCase();
    return spotRows
      .filter((row) => (query ? row.symbol.includes(query) || row.base.includes(query) : true))
      .filter((row) => (row.volume24h ?? 0) >= minVolume)
      .filter((row) => enabledExchanges[row.spotExchange] && enabledExchanges[row.perpExchange])
      .filter((row) => (recommendedOnly ? isRecommendedOpportunity(row) : true))
      .sort((a, b) => {
        if (sortMode === "score") return b.score - a.score;
        if (sortMode === "volume") return (b.volume24h ?? 0) - (a.volume24h ?? 0);
        return b.annualized - a.annualized;
      });
  }, [enabledExchanges, minVolume, recommendedOnly, search, sortMode, spotRows]);

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Funding Rate Arbitrage</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-normal text-white">资金费率套利看板</h1>
            <p className="mt-1 text-sm text-slate-400">只读公开行情数据，不接 API Key，不做交易执行。</p>
          </div>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-cyan-400/50 bg-cyan-400/10 px-4 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60"
            disabled={loading}
            onClick={() => void loadData()}
            title="刷新公开行情"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </header>

        <SummaryCards summary={summary} />

        <section className="border-y border-slate-800 bg-slate-950/40 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_160px_260px_180px_180px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-10 w-full rounded border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                placeholder="搜索币种，如 BTC"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-400"
              value={minVolume}
              onChange={(event) => setMinVolume(Number(event.target.value))}
            >
              <option value={0}>全部成交量</option>
              <option value={1_000_000}>$1M+</option>
              <option value={5_000_000}>$5M+</option>
              <option value={10_000_000}>$10M+</option>
            </select>
            <select
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-400"
              value={minExchangeCount}
              onChange={(event) => setMinExchangeCount(Number(event.target.value))}
            >
              <option value={2}>2+ 交易所</option>
              <option value={3}>3 交易所</option>
            </select>
            <div className="flex h-10 items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3">
              {EXCHANGES.map((exchange) => (
                <label key={exchange} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={enabledExchanges[exchange]}
                    onChange={(event) => setEnabledExchanges((current) => ({ ...current, [exchange]: event.target.checked }))}
                  />
                  {exchange}
                </label>
              ))}
            </div>
            <select
              className="h-10 rounded border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-400"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
            >
              <option value="score">Score</option>
              <option value="spread">年化价差</option>
              <option value="single">单所年化</option>
              <option value="volume">24h 成交量</option>
            </select>
            <label className="flex h-10 items-center gap-2 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={recommendedOnly}
                onChange={(event) => setRecommendedOnly(event.target.checked)}
              />
              只看推荐机会
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>跨所 {filteredCrossRows.length} 条</span>
            <span>现货+合约 {filteredSpotRows.length} 条</span>
            <span>更新时间 {updatedAt ? new Date(updatedAt).toLocaleTimeString() : "-"}</span>
            {errors.length > 0 && <span className="text-amber-300">部分交易所接口异常，已降级展示可用数据</span>}
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle title="跨交易所合约费率差套利" subtitle="空高正费率一边，多低费率或负费率一边" />
          <CrossExchangeTable rows={filteredCrossRows} />
        </section>

        <section className="space-y-3">
          <SectionTitle title="现货 + 永续合约资金费率套利" subtitle="买现货 + 开空正资金费率永续，仅展示数据" />
          <SpotPerpTable rows={filteredSpotRows} />
        </section>
      </div>
    </main>
  );
}

function SummaryCards({ summary }: { summary: DashboardSummary | null }) {
  const cards = [
    ["交易对总数", summary?.totalPairs.toLocaleString() ?? "-"],
    ["最大年化价差", formatPercent(summary?.maxAnnualizedSpread)],
    ["最佳套利方向", summary?.bestDirection ?? "-"],
    ["年化价差 > 10%", summary?.spreadAbove10Count.toLocaleString() ?? "-"],
    ["最高单所年化", formatPercent(summary?.highestSingleAnnualized)]
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded border border-slate-800 bg-panel p-4">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-2 min-h-8 text-xl font-semibold text-white">{value}</div>
        </div>
      ))}
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function CrossExchangeTable({ rows }: { rows: CrossExchangeOpportunity[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<CrossExchangeOpportunity>[]>(
    () => [
      { accessorKey: "score", header: "Score", cell: ({ getValue }) => <ScoreCell value={getValue<number>()} /> },
      { accessorKey: "riskTags", header: "Risk", cell: ({ getValue }) => <RiskTags tags={getValue<string[]>()} /> },
      { accessorKey: "opportunityReason", header: "Reason", cell: ({ getValue }) => <ReasonCell reason={getValue<string>()} /> },
      { accessorKey: "symbol", header: "币种" },
      { id: "history", header: "历史", cell: ({ row }) => <HistoryLink symbol={row.original.symbol} /> },
      { accessorKey: "exchangeCount", header: "Exchanges" },
      { header: "Binance", cell: ({ row }) => <RateCell rate={row.original.fundingRates.Binance} annualized={row.original.annualizedRates.Binance} hours={row.original.fundingIntervalHours.Binance} /> },
      { header: "OKX", cell: ({ row }) => <RateCell rate={row.original.fundingRates.OKX} annualized={row.original.annualizedRates.OKX} hours={row.original.fundingIntervalHours.OKX} /> },
      { header: "Bybit", cell: ({ row }) => <RateCell rate={row.original.fundingRates.Bybit} annualized={row.original.annualizedRates.Bybit} hours={row.original.fundingIntervalHours.Bybit} /> },
      { accessorKey: "annualizedSpread", header: "年化价差", cell: ({ getValue }) => <ColoredPercent value={getValue<number>()} hot /> },
      { accessorKey: "direction", header: "方向" },
      { accessorKey: "priceSpread", header: "价格价差", cell: ({ getValue }) => formatPercent(getValue<number>()) },
      { accessorKey: "priceSpreadDirection", header: "Price direction" },
      { accessorKey: "nextFundingTime", header: "下次收取", cell: ({ getValue }) => formatTime(getValue<number>()) },
      { accessorKey: "nextFundingTime", header: "倒计时", cell: ({ getValue }) => formatCountdown(getValue<number>()) },
      { accessorKey: "volume24h", header: "24h 成交量", cell: ({ getValue }) => formatUsd(getValue<number>()) },
      { accessorKey: "openInterestUsd", header: "持仓量", cell: ({ getValue }) => formatUsd(getValue<number>()) }
    ],
    []
  );

  return <DataTable columns={columns} data={rows} sorting={sorting} onSortingChange={setSorting} />;
}

function SpotPerpTable({ rows }: { rows: SpotPerpOpportunity[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo<ColumnDef<SpotPerpOpportunity>[]>(
    () => [
      { accessorKey: "score", header: "Score", cell: ({ getValue }) => <ScoreCell value={getValue<number>()} /> },
      { accessorKey: "riskTags", header: "Risk", cell: ({ getValue }) => <RiskTags tags={getValue<string[]>()} /> },
      { accessorKey: "opportunityReason", header: "Reason", cell: ({ getValue }) => <ReasonCell reason={getValue<string>()} /> },
      { accessorKey: "symbol", header: "币种" },
      { id: "history", header: "历史", cell: ({ row }) => <HistoryLink symbol={row.original.symbol} /> },
      { accessorKey: "exchangeCount", header: "Exchanges" },
      { accessorKey: "spotExchange", header: "现货交易所" },
      { accessorKey: "perpExchange", header: "合约交易所" },
      { accessorKey: "fundingRate", header: "Funding", cell: ({ getValue }) => <ColoredPercent value={getValue<number>() * 100} /> },
      { accessorKey: "annualized", header: "年化", cell: ({ getValue }) => <ColoredPercent value={getValue<number>()} hot /> },
      { accessorKey: "spotPrice", header: "现货价格", cell: ({ getValue }) => formatPrice(getValue<number>()) },
      { accessorKey: "perpPrice", header: "合约价格", cell: ({ getValue }) => formatPrice(getValue<number>()) },
      { accessorKey: "priceSpread", header: "价差", cell: ({ getValue }) => formatPercent(getValue<number>()) },
      { accessorKey: "priceSpreadDirection", header: "Price direction" },
      { accessorKey: "volume24h", header: "24h 成交量", cell: ({ getValue }) => formatUsd(getValue<number>()) }
    ],
    []
  );

  return <DataTable columns={columns} data={rows} sorting={sorting} onSortingChange={setSorting} />;
}

function DataTable<T>({
  columns,
  data,
  sorting,
  onSortingChange
}: {
  columns: ColumnDef<T>[];
  data: T[];
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
}) {
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <div className="overflow-x-auto rounded border border-slate-800 bg-panel">
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-slate-950 text-slate-400">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} className="whitespace-nowrap border-b border-slate-800 px-3 py-2 font-medium">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.slice(0, 80).map((row) => (
            <tr key={row.id} className="border-b border-slate-800/70 hover:bg-slate-800/40">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-3 py-2 text-slate-200">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td className="px-3 py-8 text-center text-slate-500" colSpan={columns.length}>
                暂无符合筛选条件的数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RateCell({ rate, annualized, hours }: { rate?: number; annualized?: number; hours?: number }) {
  if (rate === undefined || annualized === undefined) {
    return <span className="text-slate-600">-</span>;
  }

  return (
    <div className="leading-5">
      <ColoredPercent value={rate * 100} />
      <div className="text-slate-500">{formatPercent(annualized)} / {hours ?? 8}h</div>
    </div>
  );
}

function ScoreCell({ value }: { value?: number }) {
  if (value === undefined || !Number.isFinite(value)) {
    return <span className="text-slate-600">-</span>;
  }

  const color = value >= 75 ? "text-emerald-300" : value >= 45 ? "text-orange-300" : "text-rose-300";
  return <span className={`font-semibold ${color}`}>{value}</span>;
}

function RiskTags({ tags }: { tags?: string[] }) {
  if (!tags || tags.length === 0) {
    return <span className="text-slate-600">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded border border-amber-300/40 bg-amber-300/10 px-1.5 py-0.5 text-[11px] text-amber-200">
          {tag}
        </span>
      ))}
    </div>
  );
}

function ReasonCell({ reason }: { reason?: string }) {
  if (!reason) {
    return <span className="text-slate-600">-</span>;
  }

  return (
    <span className="block max-w-[320px] truncate text-[11px] leading-5 text-slate-400" title={reason}>
      {reason}
    </span>
  );
}

function HistoryLink({ symbol }: { symbol: string }) {
  return (
    <Link
      className="rounded border border-cyan-400/40 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-400/10"
      href={`/history/${encodeHistorySymbol(symbol)}`}
    >
      查看历史
    </Link>
  );
}

function isRecommendedOpportunity(row: Pick<CrossExchangeOpportunity | SpotPerpOpportunity, "score" | "volume24h" | "priceSpread">) {
  return row.score >= 60 && (row.volume24h ?? 0) >= 1_000_000 && Math.abs(row.priceSpread) <= 1;
}

function ColoredPercent({ value, hot = false }: { value?: number; hot?: boolean }) {
  if (value === undefined || !Number.isFinite(value)) {
    return <span className="text-slate-600">-</span>;
  }

  const color = hot && value >= 25 ? "text-orange-300" : value >= 0 ? "text-emerald-300" : "text-rose-300";
  return <span className={color}>{formatPercent(value)}</span>;
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

function formatTime(value?: number) {
  if (!value || !Number.isFinite(value)) return "-";
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatCountdown(value?: number) {
  if (!value || !Number.isFinite(value)) return "-";
  const diff = Math.max(0, value - Date.now());
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
