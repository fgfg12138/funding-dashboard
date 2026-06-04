import Link from "next/link";
import { AdlMonitorClient } from "./AdlMonitorClient";

export const dynamic = "force-dynamic";

export default function AdlMonitorPage() {
  return (
    <main className="min-h-screen bg-surface px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px] space-y-5">
        <header className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-red-300">ADL Monitor Center</p>
            <h1 className="mt-2 text-2xl font-semibold text-white">ADL Monitor</h1>
            <p className="mt-1 text-sm text-slate-400">
              模拟 ADL 监控与配置管理。只读研究页面，不读取真实账户仓位，不执行减仓。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="text-cyan-300 hover:text-cyan-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/strategies">
              Strategies
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/risk-rules">
              Risk Rules
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/notifications">
              Notifications
            </Link>
            <Link className="text-cyan-300 hover:text-cyan-100" href="/basis">
              Basis
            </Link>
          </div>
        </header>

        <AdlMonitorClient />
      </div>
    </main>
  );
}
