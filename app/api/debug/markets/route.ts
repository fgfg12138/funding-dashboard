import { NextResponse } from "next/server";
import { getDebugMarketRows, getFundingSnapshot } from "@/lib/data/fundingService";

export async function GET() {
  const [data, snapshot] = await Promise.all([getDebugMarketRows(), getFundingSnapshot()]);

  return NextResponse.json({
    data,
    errors: snapshot.errors,
    updatedAt: Date.now(),
    stale: false
  });
}
