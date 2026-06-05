import { PageShell } from "@/components/PageShell";
import { RiskRuleManager } from "./RiskRuleManager";

export const dynamic = "force-dynamic";

export default function RiskRulesPage() {
  return (
    <PageShell
      activeHref="/risk-rules"
      description="只读风险规则配置中心，不连接交易所，不执行真实策略动作。"
      eyebrow="风险规则中心"
      refreshHref="/risk-rules"
      title="风险规则"
    >
      <RiskRuleManager />
    </PageShell>
  );
}
