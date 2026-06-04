"use client";

import { Pause, Play, Save, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ExchangeName } from "@/lib/exchanges/types";
import type { Strategy, StrategyStatus, StrategyType } from "@/lib/strategies/types";

type ApiResponse<T> = {
  status: number;
  data?: T;
  error?: string;
};

type StrategyFormState = {
  id?: string;
  name: string;
  strategyType: StrategyType;
  symbol: string;
  spotExchange: ExchangeName;
  perpExchange: ExchangeName;
  minFundingRate: number;
  minAnnualized: number;
  maxLeverage: number;
  longExchange: ExchangeName;
  shortExchange: ExchangeName;
  minFundingSpread: number;
  minAnnualizedSpread: number;
  status: StrategyStatus;
  notes: string;
};

const EXCHANGES: ExchangeName[] = ["Binance", "OKX", "Bybit"];
const STATUS_ACTIONS: Array<{ label: string; status: StrategyStatus; icon: typeof Play }> = [
  { label: "Start", status: "running", icon: Play },
  { label: "Pause", status: "paused", icon: Pause },
  { label: "Stop", status: "stopped", icon: Square }
];

const EMPTY_FORM: StrategyFormState = {
  name: "",
  strategyType: "SpotPerp",
  symbol: "BTC/USDT",
  spotExchange: "Binance",
  perpExchange: "Bybit",
  minFundingRate: 0.0001,
  minAnnualized: 30,
  maxLeverage: 2,
  longExchange: "Binance",
  shortExchange: "Bybit",
  minFundingSpread: 0.0002,
  minAnnualizedSpread: 25,
  status: "draft",
  notes: ""
};

export function StrategyManager() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [form, setForm] = useState<StrategyFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const editing = Boolean(form.id);
  const sortedStrategies = useMemo(
    () => strategies.slice().sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name)),
    [strategies]
  );

  useEffect(() => {
    void loadStrategies();
  }, []);

  async function loadStrategies() {
    setLoading(true);
    const response = await fetch("/api/strategies").then((res) => res.json() as Promise<ApiResponse<Strategy[]>>);
    setStrategies(response.data ?? []);
    setError(response.error ?? null);
    setLoading(false);
  }

  async function saveStrategy() {
    setError(null);
    const payload = buildPayload(form);
    const response = await fetch(form.id ? `/api/strategies/${encodeURIComponent(form.id)}` : "/api/strategies", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: form.id ? "PATCH" : "POST"
    }).then((res) => res.json() as Promise<ApiResponse<Strategy>>);

    if (response.error) {
      setError(response.error);
      return;
    }

    setForm(EMPTY_FORM);
    await loadStrategies();
  }

  async function patchStatus(strategy: Strategy, status: StrategyStatus) {
    await fetch(`/api/strategies/${encodeURIComponent(strategy.id)}`, {
      body: JSON.stringify({ status }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH"
    });
    await loadStrategies();
  }

  async function deleteStrategy(strategy: Strategy) {
    await fetch(`/api/strategies/${encodeURIComponent(strategy.id)}`, { method: "DELETE" });
    if (form.id === strategy.id) {
      setForm(EMPTY_FORM);
    }
    await loadStrategies();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="rounded border border-slate-800 bg-panel">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold text-white">{editing ? "Edit Strategy" : "Create Strategy"}</h2>
          {editing && (
            <button className="text-xs text-cyan-300 hover:text-cyan-100" onClick={() => setForm(EMPTY_FORM)} type="button">
              New
            </button>
          )}
        </div>
        <div className="space-y-3 p-4">
          {error && <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>}
          <TextInput label="Strategy Name" onChange={(name) => setForm((prev) => ({ ...prev, name }))} value={form.name} />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput
              label="Type"
              onChange={(strategyType) => setForm((prev) => ({ ...prev, strategyType: strategyType as StrategyType }))}
              options={["SpotPerp", "CrossExchange"]}
              value={form.strategyType}
            />
            <SelectInput
              label="Status"
              onChange={(status) => setForm((prev) => ({ ...prev, status: status as StrategyStatus }))}
              options={["draft", "running", "paused", "stopped"]}
              value={form.status}
            />
          </div>
          <TextInput label="Symbol" onChange={(symbol) => setForm((prev) => ({ ...prev, symbol }))} value={form.symbol} />

          {form.strategyType === "SpotPerp" ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectInput label="Spot Exchange" onChange={(spotExchange) => setForm((prev) => ({ ...prev, spotExchange: spotExchange as ExchangeName }))} options={EXCHANGES} value={form.spotExchange} />
                <SelectInput label="Perp Exchange" onChange={(perpExchange) => setForm((prev) => ({ ...prev, perpExchange: perpExchange as ExchangeName }))} options={EXCHANGES} value={form.perpExchange} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <NumberInput label="Min Funding" onChange={(minFundingRate) => setForm((prev) => ({ ...prev, minFundingRate }))} step="0.0001" value={form.minFundingRate} />
                <NumberInput label="Min Annualized" onChange={(minAnnualized) => setForm((prev) => ({ ...prev, minAnnualized }))} step="1" value={form.minAnnualized} />
                <NumberInput label="Max Leverage" onChange={(maxLeverage) => setForm((prev) => ({ ...prev, maxLeverage }))} step="0.5" value={form.maxLeverage} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectInput label="Long Exchange" onChange={(longExchange) => setForm((prev) => ({ ...prev, longExchange: longExchange as ExchangeName }))} options={EXCHANGES} value={form.longExchange} />
                <SelectInput label="Short Exchange" onChange={(shortExchange) => setForm((prev) => ({ ...prev, shortExchange: shortExchange as ExchangeName }))} options={EXCHANGES} value={form.shortExchange} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberInput label="Min Funding Spread" onChange={(minFundingSpread) => setForm((prev) => ({ ...prev, minFundingSpread }))} step="0.0001" value={form.minFundingSpread} />
                <NumberInput label="Min Annualized Spread" onChange={(minAnnualizedSpread) => setForm((prev) => ({ ...prev, minAnnualizedSpread }))} step="1" value={form.minAnnualizedSpread} />
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">Notes</span>
            <textarea
              className="min-h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              value={form.notes}
            />
          </label>

          <button
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-cyan-400/50 bg-cyan-400/10 px-3 text-sm text-cyan-100 hover:bg-cyan-400/20"
            onClick={() => void saveStrategy()}
            type="button"
          >
            <Save className="h-4 w-4" />
            {editing ? "Save Changes" : "Create Strategy"}
          </button>
        </div>
      </section>

      <section className="rounded border border-slate-800 bg-panel">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold text-white">Strategy List</h2>
          <span className="text-xs text-slate-500">{loading ? "Loading" : `${strategies.length} strategies`}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <Header>Name</Header>
                <Header>Type</Header>
                <Header>Symbol</Header>
                <Header>Exchange Pair</Header>
                <Header>Status</Header>
                <Header>Created</Header>
                <Header>Updated</Header>
                <Header>Actions</Header>
              </tr>
            </thead>
            <tbody>
              {sortedStrategies.map((strategy) => (
                <tr className="border-b border-slate-800/70 hover:bg-slate-800/40" key={strategy.id}>
                  <Cell strong>
                    <button className="text-left text-cyan-300 hover:text-cyan-100" onClick={() => setForm(toForm(strategy))} type="button">
                      {strategy.name}
                    </button>
                  </Cell>
                  <Cell>{strategy.strategyType}</Cell>
                  <Cell>{strategy.symbol}</Cell>
                  <Cell>{strategy.exchangePair}</Cell>
                  <Cell className={getStatusClass(strategy.status)}>{strategy.status}</Cell>
                  <Cell>{new Date(strategy.createdAt).toLocaleString()}</Cell>
                  <Cell>{new Date(strategy.updatedAt).toLocaleString()}</Cell>
                  <Cell>
                    <div className="flex items-center gap-1">
                      {STATUS_ACTIONS.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-700 text-slate-300 hover:border-cyan-400 hover:text-cyan-100"
                            key={action.status}
                            onClick={() => void patchStatus(strategy, action.status)}
                            title={action.label}
                            type="button"
                          >
                            <Icon className="h-4 w-4" />
                          </button>
                        );
                      })}
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
                        onClick={() => void deleteStrategy(strategy)}
                        title="Delete"
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Cell>
                </tr>
              ))}
              {sortedStrategies.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={8}>
                    No strategies yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function buildPayload(form: StrategyFormState) {
  if (form.strategyType === "SpotPerp") {
    return {
      name: form.name,
      strategyType: "SpotPerp",
      symbol: form.symbol,
      spotExchange: form.spotExchange,
      perpExchange: form.perpExchange,
      minFundingRate: form.minFundingRate,
      minAnnualized: form.minAnnualized,
      maxLeverage: form.maxLeverage,
      status: form.status,
      notes: form.notes
    };
  }

  return {
    name: form.name,
    strategyType: "CrossExchange",
    symbol: form.symbol,
    longExchange: form.longExchange,
    shortExchange: form.shortExchange,
    minFundingSpread: form.minFundingSpread,
    minAnnualizedSpread: form.minAnnualizedSpread,
    status: form.status,
    notes: form.notes
  };
}

function toForm(strategy: Strategy): StrategyFormState {
  if (strategy.strategyType === "SpotPerp") {
    return {
      ...EMPTY_FORM,
      id: strategy.id,
      name: strategy.name,
      strategyType: "SpotPerp",
      symbol: strategy.symbol,
      spotExchange: strategy.spotExchange,
      perpExchange: strategy.perpExchange,
      minFundingRate: strategy.minFundingRate,
      minAnnualized: strategy.minAnnualized,
      maxLeverage: strategy.maxLeverage,
      status: strategy.status,
      notes: strategy.notes ?? ""
    };
  }

  return {
    ...EMPTY_FORM,
    id: strategy.id,
    name: strategy.name,
    strategyType: "CrossExchange",
    symbol: strategy.symbol,
    longExchange: strategy.longExchange,
    shortExchange: strategy.shortExchange,
    minFundingSpread: strategy.minFundingSpread,
    minAnnualizedSpread: strategy.minAnnualizedSpread,
    status: strategy.status,
    notes: strategy.notes ?? ""
  };
}

function TextInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function NumberInput({
  label,
  onChange,
  step,
  value
}: {
  label: string;
  onChange: (value: number) => void;
  step: string;
  value: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

function SelectInput({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <select
        className="h-10 w-full rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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

function getStatusClass(status: StrategyStatus): string {
  if (status === "running") return "text-emerald-300";
  if (status === "paused") return "text-amber-300";
  if (status === "stopped") return "text-rose-300";
  return "text-slate-300";
}
