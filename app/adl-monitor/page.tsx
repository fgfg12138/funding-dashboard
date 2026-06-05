import { PageShell } from "@/components/PageShell";
import { AdlMonitorClient } from "./AdlMonitorClient";

export const dynamic = "force-dynamic";

export default function AdlMonitorPage() {
  return (
    <PageShell
      activeHref="/adl-monitor"
      description="模拟 ADL 监控与配置管理，只展示 mock 数据，不读取真实账户仓位，不执行减仓。"
      eyebrow="ADL监控中心"
      refreshHref="/adl-monitor"
      title="ADL监控"
    >
      <AdlMonitorClient />
    </PageShell>
  );
}
