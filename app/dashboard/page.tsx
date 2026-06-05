"use client";

import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { RiskBadge, ScoreBadge, StatCard } from "@/components/ui/dashboard";
import { DASHBOARD_MODULES, getDashboardModuleConfig, parseDashboardModule, type DashboardModule } from "@/lib/dashboard/dashboardModule";
import { applySort, parseSortState, sortIndicator, toggleSortState, type SortOrder } from "@/lib/tableSort/tableSort";
import type {
  CrossExchangeOpportunity,
  DashboardSummary,
  ExchangeName,
  SpotPerpOpportunity
} from "@/lib/exchanges/types";

type ApiResponse<T> = {
  data: T;
  errors?: string[];
  stale?: boolean;
  updatedAt: number;
};

const EXCHANGES: ExchangeName[] = ["Binance", "OKX", "Bybit"];
type DashboardSortKey = "score" | "annualized" | "volume" | "priceSpread" | "openInterest";
const DASHBOARD_SORTS: DashboardSortKey[] = ["score", "annualized", "volume", "priceSpread", "openInterest"];

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<DashboardModule>("spot-perp");
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
  const [sortBy, setSortBy] = useState<DashboardSortKey>("annualized");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [errors, setErrors] = useState<string[]>([]);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const requestInFlight = useRef(false);

  useEffect(() => {
    const syncModuleFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveModule(parseDashboardModule(params.get("module")));
      const parsed = parseSortState<DashboardSortKey>({
        allowedSorts: DASHBOARD_SORTS,
        defaultOrder: "desc",
        defaultSort: "annualized",
        order: params.get("order"),
        sort: params.get("sort")
      });
      setSortBy(parsed.sort);
      setSortOrder(parsed.order);
    };

    syncModuleFromUrl();
    window.addEventListener("popstate", syncModuleFromUrl);
    return () => window.removeEventListener("popstate", syncModuleFromUrl);
  }, []);

  const loadData = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setLoading(true);
    try {
      const [summaryRes, crossRes, spotRes] = await Promise.all([
        fetch("/api/summary").then((res) => res.json() as Promise<ApiResponse<DashboardSummary>>),
        fetch("/api/funding/cross-exchange").then((res) => res.json() as Promise<ApiResponse<CrossExchangeOpportunity[]>>),
        fetch("/api/funding/spot-perp").then((res) => res.json() as Promise<ApiResponse<SpotPerpOpportunity[]>>)
      ]);

      setSummary(summaryRes.data);
      setCrossRows(crossRes.data ?? []);
      setSpotRows(spotRes.data ?? []);
      setUpdatedAt(Math.max(summaryRes.updatedAt, crossRes.updatedAt, spotRes.updatedAt));
      setStale(Boolean(summaryRes.stale || crossRes.stale || spotRes.stale));
      setErrors([...new Set([...(summaryRes.errors ?? []), ...(crossRes.errors ?? []), ...(spotRes.errors ?? [])])]);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "数据加载失败，请稍后重试。"]);
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
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
      .filter((row) => (recommendedOnly ? isRecommendedOpportunity(row) : true));
  }, [crossRows, enabledExchanges, minExchangeCount, minVolume, recommendedOnly, search]);

  const filteredSpotRows = useMemo(() => {
    const query = search.trim().toUpperCase();
    return spotRows
      .filter((row) => (query ? row.symbol.includes(query) || row.base.includes(query) : true))
      .filter((row) => (row.volume24h ?? 0) >= minVolume)
      .filter((row) => enabledExchanges[row.spotExchange] && enabledExchanges[row.perpExchange])
      .filter((row) => (recommendedOnly ? isRecommendedOpportunity(row) : true))
  }, [enabledExchanges, minVolume, recommendedOnly, search, spotRows]);

  const sortedCrossRows = useMemo(() => applySort(filteredCrossRows, { sort: sortBy, order: sortOrder }, {
    annualized: (row) => row.annualizedSpread,
    openInterest: (row) => row.openInterestUsd,
    priceSpread: (row) => Math.abs(row.priceSpread),
    score: (row) => row.score,
    volume: (row) => row.volume24h
  }), [filteredCrossRows, sortBy, sortOrder]);

  const sortedSpotRows = useMemo(() => applySort(filteredSpotRows, { sort: sortBy, order: sortOrder }, {
    annualized: (row) => row.annualized,
    openInterest: () => undefined,
    priceSpread: (row) => Math.abs(row.priceSpread),
    score: (row) => row.score,
    volume: (row) => row.volume24h
  }), [filteredSpotRows, sortBy, sortOrder]);

  const activeModuleConfig = getDashboardModuleConfig(activeModule);

  const handleModuleChange = useCallback((module: DashboardModule) => {
    setActiveModule(module);
    const params = new URLSearchParams(window.location.search);
    params.set("module", module);
    params.set("sort", sortBy);
    params.set("order", sortOrder);
    window.history.pushState(null, "", `/dashboard?${params.toString()}`);
  }, [sortBy, sortOrder]);

  const updateSort = useCallback((nextSort: DashboardSortKey) => {
    const next = toggleSortState({ sort: sortBy, order: sortOrder }, nextSort);
    const params = new URLSearchParams(window.location.search);
    params.set("module", activeModule);
    params.set("sort", next.sort);
    params.set("order", next.order);
    window.history.pushState(null, "", `/dashboard?${params.toString()}`);
    setSortBy(next.sort);
    setSortOrder(next.order);
  }, [activeModule, sortBy, sortOrder]);

  return (
    <PageShell
      activeHref="/dashboard"
      description="只读取 Binance / OKX / Bybit 公开行情，展示资金费率、年化、价差、成交量和持仓量。"
      eyebrow="Funding Rate Arbitrage"
      loading={loading}
      onRefresh={() => void loadData()}
      title="资金费率看板"
      updatedAt={updatedAt}
    >
      <div className="space-y-3">
        <SummaryCards summary={summary} />

        <section className="border border-slate-800 bg-slate-950/40 p-3">
          <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_160px_140px_250px_150px_170px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-9 w-full border border-slate-700 bg-slate-950 pl-9 pr-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                placeholder="搜索币种，如 BTC"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select className="h-9 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-400" value={minVolume} onChange={(event) => setMinVolume(Number(event.target.value))}>
              <option value={0}>全部成交量</option>
              <option value={1_000_000}>$1M+</option>
              <option value={5_000_000}>$5M+</option>
              <option value={10_000_000}>$10M+</option>
            </select>
            <select className="h-9 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-400" value={minExchangeCount} onChange={(event) => setMinExchangeCount(Number(event.target.value))}>
              <option value={2}>2+ 交易所</option>
              <option value={3}>3 交易所</option>
            </select>
            <div className="flex h-9 items-center gap-2 border border-slate-700 bg-slate-950 px-3">
              {EXCHANGES.map((exchange) => (
                <label key={exchange} className="flex items-center gap-1.5 text-xs text-slate-300">
                  <input
                    checked={enabledExchanges[exchange]}
                    type="checkbox"
                    onChange={(event) => setEnabledExchanges((current) => ({ ...current, [exchange]: event.target.checked }))}
                  />
                  {exchange}
                </label>
              ))}
            </div>
            <select className="h-9 border border-slate-700 bg-slate-950 px-3 text-sm outline-none focus:border-cyan-400" value={sortBy} onChange={(event) => updateSort(event.target.value as DashboardSortKey)}>
              <option value="score">评分</option>
              <option value="annualized">年化</option>
              <option value="priceSpread">价差</option>
              <option value="volume">24h 成交量</option>
              <option value="openInterest">持仓量</option>
            </select>
            <label className="flex h-9 items-center gap-2 border border-slate-700 bg-slate-950 px-3 text-sm text-slate-300">
              <input checked={recommendedOnly} type="checkbox" onChange={(event) => setRecommendedOnly(event.target.checked)} />
              只看推荐机会
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>跨所 {filteredCrossRows.length} 条</span>
            <span>现货 + 永续 {filteredSpotRows.length} 条</span>
            {errors.length > 0 && <span className="text-amber-300">部分交易所接口异常，已降级展示可用数据</span>}
          </div>
        </section>

        {(errors.length > 0 || stale) && (
          <section className="border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            {errors.length > 0 ? "部分交易所数据获取失败，当前展示可用数据。" : null}
            {stale ? " 当前为缓存数据。" : null}
          </section>
        )}

        <section className="flex flex-wrap items-center justify-between gap-2 border border-slate-800 bg-slate-950/40 p-2">
          <div className="flex gap-1">
            {DASHBOARD_MODULES.map((module) => (
              <button
                className={`h-9 border px-3 text-sm ${
                  activeModule === module.table
                    ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-100"
                    : "border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700 hover:text-slate-100"
                }`}
                key={module.table}
                onClick={() => handleModuleChange(module.table)}
                type="button"
              >
                {module.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-slate-500">当前模块：{activeModuleConfig.label}</span>
        </section>

        <section className="space-y-2">
          <SectionTitle title={activeModuleConfig.title} subtitle={activeModuleConfig.subtitle} />
          {activeModule === "cross" ? (
            <CrossExchangeTable loading={loading} onSort={updateSort} rows={sortedCrossRows} sortState={{ sort: sortBy, order: sortOrder }} />
          ) : (
            <SpotPerpTable loading={loading} onSort={updateSort} rows={sortedSpotRows} sortState={{ sort: sortBy, order: sortOrder }} />
          )}
        </section>
      </div>
    </PageShell>
  );
}

function SummaryCards({ summary }: { summary: DashboardSummary | null }) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="交易对总数" value={summary?.totalPairs.toLocaleString() ?? "-"} />
      <StatCard label="最大年化价差" value={formatPercent(summary?.maxAnnualizedSpread)} tone="cyan" />
      <StatCard label="最佳套利方向" value={summary?.bestDirection ?? "-"} tone="green" />
      <StatCard label="年化价差 > 10%" value={summary?.spreadAbove10Count.toLocaleString() ?? "-"} tone="yellow" />
      <StatCard label="最高单所年化" value={formatPercent(summary?.highestSingleAnnualized)} tone="orange" />
    </section>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function CrossExchangeTable({
  loading,
  onSort,
  rows,
  sortState
}: {
  loading: boolean;
  onSort: (sort: DashboardSortKey) => void;
  rows: CrossExchangeOpportunity[];
  sortState: { sort: DashboardSortKey; order: SortOrder };
}) {
  return (
    <TableShell>
      <table className="min-w-[1740px] border-collapse text-left text-xs">
        <TableHead
          headers={[
            ["评分", "right", "score"],
            ["风险", "left"],
            ["原因", "left"],
            ["币种", "left"],
            ["历史", "left"],
            ["交易所数量", "right"],
            ["Binance", "right"],
            ["OKX", "right"],
            ["Bybit", "right"],
            ["年化价差", "right", "annualized"],
            ["方向", "left"],
            ["价格价差", "right", "priceSpread"],
            ["价差方向说明", "left"],
            ["下次资金费率", "left"],
            ["倒计时", "left"],
            ["24h成交量", "right", "volume"],
            ["持仓量", "right", "openInterest"]
          ]}
          onSort={onSort}
          sortState={sortState}
        />
        <tbody className="divide-y divide-slate-800">
          {loading && rows.length === 0 ? <EmptyRow colSpan={17} label="数据加载中..." /> : null}
          {rows.map((row) => (
            <tr className="hover:bg-slate-900/70" key={`${row.symbol}:${row.shortExchange}:${row.longExchange}`}>
              <Td align="right"><ScoreBadge score={row.score} /></Td>
              <Td><RiskTags tags={row.riskTags} /></Td>
              <Td><Reason value={row.opportunityReason} /></Td>
              <Td><strong>{row.symbol}</strong></Td>
              <Td><HistoryLink symbol={row.symbol} /></Td>
              <Td align="right">{row.exchangeCount}</Td>
              <Td align="right"><RateCell annualized={row.annualizedRates.Binance} hours={row.fundingIntervalHours.Binance} rate={row.fundingRates.Binance} /></Td>
              <Td align="right"><RateCell annualized={row.annualizedRates.OKX} hours={row.fundingIntervalHours.OKX} rate={row.fundingRates.OKX} /></Td>
              <Td align="right"><RateCell annualized={row.annualizedRates.Bybit} hours={row.fundingIntervalHours.Bybit} rate={row.fundingRates.Bybit} /></Td>
              <Td align="right"><ColoredPercent hot value={row.annualizedSpread} /></Td>
              <Td>{row.direction}</Td>
              <Td align="right">{formatPercent(row.priceSpread)}</Td>
              <Td><Reason value={row.priceSpreadDirection} /></Td>
              <Td>{formatTime(row.nextFundingTime)}</Td>
              <Td>{formatCountdown(row.nextFundingTime)}</Td>
              <Td align="right">{formatUsd(row.volume24h)}</Td>
              <Td align="right">{formatUsd(row.openInterestUsd)}</Td>
            </tr>
          ))}
          {!loading && rows.length === 0 ? <EmptyRow colSpan={17} label="暂无符合条件的跨所费率差机会。" /> : null}
        </tbody>
      </table>
    </TableShell>
  );
}

function SpotPerpTable({
  loading,
  onSort,
  rows,
  sortState
}: {
  loading: boolean;
  onSort: (sort: DashboardSortKey) => void;
  rows: SpotPerpOpportunity[];
  sortState: { sort: DashboardSortKey; order: SortOrder };
}) {
  return (
    <TableShell>
      <table className="min-w-[1420px] border-collapse text-left text-xs">
        <TableHead
          headers={[
            ["评分", "right", "score"],
            ["风险", "left"],
            ["原因", "left"],
            ["币种", "left"],
            ["历史", "left"],
            ["交易所数量", "right"],
            ["现货交易所", "left"],
            ["合约交易所", "left"],
            ["Funding", "right"],
            ["年化", "right", "annualized"],
            ["现货价格", "right"],
            ["合约价格", "right"],
            ["价差", "right", "priceSpread"],
            ["价差方向说明", "left"],
            ["24h成交量", "right", "volume"]
          ]}
          onSort={onSort}
          sortState={sortState}
        />
        <tbody className="divide-y divide-slate-800">
          {loading && rows.length === 0 ? <EmptyRow colSpan={15} label="数据加载中..." /> : null}
          {rows.map((row) => (
            <tr className="hover:bg-slate-900/70" key={`${row.symbol}:${row.spotExchange}:${row.perpExchange}`}>
              <Td align="right"><ScoreBadge score={row.score} /></Td>
              <Td><RiskTags tags={row.riskTags} /></Td>
              <Td><Reason value={row.opportunityReason} /></Td>
              <Td><strong>{row.symbol}</strong></Td>
              <Td><HistoryLink symbol={row.symbol} /></Td>
              <Td align="right">{row.exchangeCount}</Td>
              <Td>{row.spotExchange}</Td>
              <Td>{row.perpExchange}</Td>
              <Td align="right"><ColoredPercent value={row.fundingRate * 100} /></Td>
              <Td align="right"><ColoredPercent hot value={row.annualized} /></Td>
              <Td align="right">{formatPrice(row.spotPrice)}</Td>
              <Td align="right">{formatPrice(row.perpPrice)}</Td>
              <Td align="right">{formatPercent(row.priceSpread)}</Td>
              <Td><Reason value={row.priceSpreadDirection} /></Td>
              <Td align="right">{formatUsd(row.volume24h)}</Td>
            </tr>
          ))}
          {!loading && rows.length === 0 ? <EmptyRow colSpan={15} label="暂无符合条件的现货 + 永续机会。" /> : null}
        </tbody>
      </table>
    </TableShell>
  );
}

function TableShell({ children }: { children: ReactNode }) {
  return <div className="max-h-[560px] overflow-auto border border-slate-800 bg-panel">{children}</div>;
}

function TableHead({
  headers,
  onSort,
  sortState
}: {
  headers: Array<[string, "left" | "right", DashboardSortKey?]>;
  onSort: (sort: DashboardSortKey) => void;
  sortState: { sort: DashboardSortKey; order: SortOrder };
}) {
  return (
    <thead className="sticky top-0 z-10 bg-slate-950 text-slate-400">
      <tr>
        {headers.map(([label, align, sort]) => (
          <th className={`whitespace-nowrap px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`} key={label}>
            {sort ? (
              <button className="text-inherit hover:text-cyan-200" onClick={() => onSort(sort)} type="button">
                {label}{sortIndicator(sortState, sort)}
              </button>
            ) : label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Td({ align = "left", children }: { align?: "left" | "right"; children: ReactNode }) {
  return <td className={`px-3 py-2 align-top tabular-nums ${align === "right" ? "text-right" : "text-left"}`}>{children}</td>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={colSpan}>{label}</td>
    </tr>
  );
}

function RiskTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-slate-500">-</span>;
  return (
    <div className="flex max-w-[240px] flex-wrap gap-1">
      {tags.slice(0, 3).map((tag) => <RiskBadge key={tag} label={tag} />)}
    </div>
  );
}

function Reason({ value }: { value: string }) {
  return <span className="line-clamp-2 max-w-[320px] text-slate-400" title={value}>{value}</span>;
}

function RateCell({ annualized, hours, rate }: { annualized?: number; hours?: number; rate?: number }) {
  if (rate === undefined || annualized === undefined) return <span className="text-slate-600">-</span>;
  return (
    <div className="space-y-0.5">
      <ColoredPercent value={rate * 100} />
      <div className="text-emerald-300">{formatPercent(annualized)}</div>
      <div className="text-[11px] text-slate-500">{hours ?? "-"}h</div>
    </div>
  );
}

function ColoredPercent({ hot = false, value }: { hot?: boolean; value: number }) {
  const color = value > 0 ? (hot && value > 30 ? "text-orange-300" : "text-emerald-300") : value < 0 ? "text-red-300" : "text-slate-300";
  return <span className={color}>{formatPercent(value)}</span>;
}

function HistoryLink({ symbol }: { symbol: string }) {
  return (
    <a className="text-cyan-300 hover:text-cyan-100" href={`/history/${encodeURIComponent(symbol.replace("/", "_"))}`}>
      查看历史
    </a>
  );
}

function isRecommendedOpportunity(row: { score: number; volume24h?: number; priceSpread?: number; riskTags: string[] }) {
  return row.score >= 60 && (row.volume24h ?? 0) >= 1_000_000 && Math.abs(row.priceSpread ?? 0) <= 1 && !row.riskTags.includes("低流动性");
}

function formatPercent(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "-";
  return `${value.toFixed(2)}%`;
}

function formatUsd(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "-";
  return Intl.NumberFormat("en-US", { currency: "USD", maximumFractionDigits: 1, notation: "compact", style: "currency" }).format(value);
}

function formatPrice(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "-";
  return value >= 100 ? value.toFixed(2) : value.toPrecision(6);
}

function formatTime(value?: number) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function formatCountdown(value?: number) {
  if (!value) return "-";
  const diff = value - Date.now();
  if (diff <= 0) return "已到期";
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
