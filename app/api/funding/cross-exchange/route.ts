import { NextResponse } from "next/server";
import { getCrossExchangeOpportunities, getFundingSnapshot } from "@/lib/data/fundingService";

export async function GET() {
  const [data, snapshot] = await Promise.all([getCrossExchangeOpportunities(), getFundingSnapshot()]);

  return NextResponse.json({
    data,
    errors: snapshot.errors,
    updatedAt: Date.now()
  });
}
