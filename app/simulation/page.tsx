import Link from "next/link";
import { SimulationRunButton } from "./SimulationRunButton";
import { getSimulationAccount, getSimulationHistory } from "@/lib/simulation/simService";
import type { SimAccountSnapshot } from "@/lib/simulation/simAccount";

export const dynamic = "force-dynamic";

const WINDOW_OPTIONS = ["1h", "24h", "7d", "30d"];

export default async function SimulationPage({
  searchParams
}: {
  searchParams: Promise<{ window?: string; symbol?: string; exchange?: string }>;
}) {
  const params = await searchParams;
  const [account, history] = await Promise.all([getSimulationAccount(), getSimulationHistory(500)]);
  const filteredHistory = filterHistory(history.slice().reverse(), params);

  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Paper Trading Simulation</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">Execution Simulation Engine</h1>
            <p className="mt-1 text-sm text-slate-400">Read-only simulation. No API keys, no real orders, no real positions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/alpha">
              Alpha
            </Link>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/notifications">
              Notifications
            </Link>
            <Link className="text-sm text-cyan-300 hover:text-cyan-100" href="/dashboard">
              Dashboard
            </Link>
            <SimulationRunButton />
          </div>
        </header>

        <section className="flex flex-col gap-3 border-y border-slate-800 bg-slate-950/40 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex w-fit rounded border border-slate-700 bg-slate-950 p-1">
            {WINDOW_OPTIONS.map((item) => (
              <Link
                className={`h-8 px-3 py-1.5 text-sm ${(params.window ?? "24h") === item ? "bg-emerald-400/20 text-emerald-100" : "text-slate-400 hover:text-slate-100"}`}
                href={buildSimulationHref({ ...params, window: item })}
                key={item}
              >
                {item}
              </Link>
            ))}
          </div>
          <form action="/simulation" className="flex flex-wrap items-end gap-3">
            <input name="window" type="hidden" value={params.window ?? "24h"} />
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Symbol</span>
              <input
                className="h-10 w-32 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                defaultValue={params.symbol ?? ""}
                name="symbol"
                placeholder="BTC"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-slate-500">Exchange</span>
              <input
                className="h-10 w-32 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                defaultValue={params.exchange ?? ""}
                name="exchange"
                placeholder="Bybit"
              />
            </label>
            <button className="h-10 rounded border border-cyan-400/50 bg-cyan-400/10 px-3 text-sm text-cyan-100 hover:bg-cyan-400/20" type="submit">
              Apply
            </button>
          </form>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span>{history.length} snapshots</span>
            <span>{account.positions.length} open positions</span>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Stat label="Current Balance" value={formatUsd(account.currentBalance)} tone="text-emerald-300" />
          <Stat label="Equity" value={formatUsd(account.equity)} tone="text-cyan-300" />
          <Stat label="Funding PnL" value={formatUsd(account.fundingPnL)} tone={account.fundingPnL >= 0 ? "text-emerald-300" : "text-rose-300"} />
          <Stat label="Price PnL" value={formatUsd(account.pricePnL)} tone={account.pricePnL >= 0 ? "text-emerald-300" : "text-rose-300"} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <LineChart title="Account Balance" snapshots={filteredHistory} metric="equity" />
          <LineChart title="Funding PnL" snapshots={filteredHistory} metric="fundingPnL" />
          <LineChart title="Price PnL" snapshots={filteredHistory} metric="pricePnL" />
          <LineChart title="Open Position Value" snapshots={filteredHistory} metric="positionValue" />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <PositionsTable snapshot={account} />
          <TradeHistoryTable snapshot={account} />
        </section>

        <AlphaPnlTable snapshots={filteredHistory} />
      </div>
    </main>
  );
}

function LineChart({
  title,
  snapshots,
  metric
}: {
  title: string;
  snapshots: SimAccountSnapshot[];
  metric: "equity" | "fundingPnL" | "pricePnL" | "positionValue";
}) {
  return (
    <section className="rounded border border-slate-800 bg-panel">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className="text-xs text-slate-500">{snapshots.length} points</span>
      </div>
      <div className="p-4">
        {snapshots.length > 0 ? <Sparkline values={snapshots.map((snapshot) => snapshot[metric])} /> : <p className="py-12 text-center text-sm text-slate-500">Run simulation to collect snapshots.</p>}
      </div>
    </section>
  );
}

function PositionsTable({ snapshot }: { snapshot: SimAccountSnapshot }) {
  return (
    <section className="rounded border border-slate-800 bg-panel">
      <TableTitle title="Open Positions" value={`${snapshot.positions.length} positions`} />
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <Header>Symbol</Header>
              <Header>Exchange</Header>
              <Header>Type</Header>
              <Header>Qty</Header>
              <Header>Entry</Header>
              <Header>Alpha</Header>
            </tr>
          </thead>
          <tbody>
            {snapshot.positions.map((position) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={`${position.exchange}:${position.symbol}:${position.type}`}>
                <Cell strong>{position.symbol}</Cell>
                <Cell>{position.exchange}</Cell>
                <Cell>{position.type}</Cell>
                <Cell>{position.quantity.toFixed(4)}</Cell>
                <Cell>{formatUsd(position.entryPrice)}</Cell>
                <Cell>{position.alphaScore}</Cell>
              </tr>
            ))}
            {snapshot.positions.length === 0 && <EmptyRow colSpan={6} label="No simulated open positions." />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TradeHistoryTable({ snapshot }: { snapshot: SimAccountSnapshot }) {
  const trades = snapshot.tradeHistory.slice().reverse().slice(0, 20);
  return (
    <section className="rounded border border-slate-800 bg-panel">
      <TableTitle title="Trade History" value={`${snapshot.tradeHistory.length} closed trades`} />
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <Header>Symbol</Header>
              <Header>Exchange</Header>
              <Header>Total PnL</Header>
              <Header>Funding</Header>
              <Header>Price</Header>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={`${trade.exitTime}:${trade.exchange}:${trade.symbol}`}>
                <Cell strong>{trade.symbol}</Cell>
                <Cell>{trade.exchange}</Cell>
                <Cell className={trade.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatUsd(trade.pnl)}</Cell>
                <Cell>{formatUsd(trade.fundingPnL)}</Cell>
                <Cell>{formatUsd(trade.pricePnL)}</Cell>
              </tr>
            ))}
            {trades.length === 0 && <EmptyRow colSpan={5} label="No closed simulated trades yet." />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlphaPnlTable({ snapshots }: { snapshots: SimAccountSnapshot[] }) {
  const rows = snapshots.flatMap((snapshot) =>
    snapshot.positions.map((position) => ({
      timestamp: snapshot.timestamp,
      symbol: position.symbol,
      alphaScore: position.alphaScore,
      totalPnL: snapshot.totalPnL,
      fundingPnL: snapshot.fundingPnL,
      pricePnL: snapshot.pricePnL
    }))
  );

  return (
    <section className="rounded border border-slate-800 bg-panel">
      <TableTitle title="Alpha Score vs Simulated PnL" value={`${rows.length} rows`} />
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <Header>Time</Header>
              <Header>Symbol</Header>
              <Header>Alpha Score</Header>
              <Header>Total PnL</Header>
              <Header>Funding PnL</Header>
              <Header>Price PnL</Header>
            </tr>
          </thead>
          <tbody>
            {rows.slice(-50).map((row) => (
              <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={`${row.timestamp}:${row.symbol}`}>
                <Cell>{new Date(row.timestamp).toLocaleString()}</Cell>
                <Cell strong>{row.symbol}</Cell>
                <Cell>{row.alphaScore}</Cell>
                <Cell>{formatUsd(row.totalPnL)}</Cell>
                <Cell>{formatUsd(row.fundingPnL)}</Cell>
                <Cell>{formatUsd(row.pricePnL)}</Cell>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} label="No Alpha/PnL comparison rows yet." />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const width = 520;
  const height = 160;
  const padding = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const yRange = Math.max(max - min, 1);
  const xRange = Math.max(values.length - 1, 1);
  const path = values
    .map((value, index) => {
      const x = padding + (index / xRange) * (width - padding * 2);
      const y = height - padding - ((value - min) / yRange) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg className="h-40 w-full" preserveAspectRatio="none" viewBox={`0 0 ${width} ${height}`} role="img">
      <line stroke="#334155" x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} />
      <path d={path} fill="none" stroke="#34d399" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
    </svg>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone: string }) {
  return (
    <div className="rounded border border-slate-800 bg-panel px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function TableTitle({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <span className="text-xs text-slate-500">{value}</span>
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

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="px-3 py-8 text-center text-slate-500" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

function filterHistory(snapshots: SimAccountSnapshot[], params: { symbol?: string; exchange?: string }) {
  const symbol = params.symbol?.trim().toUpperCase();
  const exchange = params.exchange?.trim().toLowerCase();
  if (!symbol && !exchange) return snapshots;

  return snapshots.filter((snapshot) =>
    snapshot.positions.some((position) => {
      const symbolMatches = symbol ? position.symbol.includes(symbol) || position.symbol.startsWith(`${symbol}/`) : true;
      const exchangeMatches = exchange ? position.exchange.toLowerCase() === exchange : true;
      return symbolMatches && exchangeMatches;
    })
  );
}

function buildSimulationHref(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  if (params.window) searchParams.set("window", params.window);
  if (params.symbol) searchParams.set("symbol", params.symbol);
  if (params.exchange) searchParams.set("exchange", params.exchange);
  const query = searchParams.toString();
  return query ? `/simulation?${query}` : "/simulation";
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}
