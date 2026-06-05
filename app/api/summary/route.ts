import { NextResponse } from "next/server";
import { getDashboardSummary, getFundingSnapshot } from "@/lib/data/fundingService";

export async function GET() {
  const [summary, snapshot] = await Promise.all([getDashboardSummary(), getFundingSnapshot()]);

  return NextResponse.json({
    data: summary,
    errors: snapshot.errors,
    updatedAt: Date.now(),
    stale: false
  });
}
