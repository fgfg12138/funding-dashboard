import { NextResponse } from "next/server";
import { getFundingSnapshot, getSpotPerpOpportunities } from "@/lib/data/fundingService";

export async function GET() {
  const [data, snapshot] = await Promise.all([getSpotPerpOpportunities(), getFundingSnapshot()]);

  return NextResponse.json({
    data,
    errors: snapshot.errors,
    updatedAt: Date.now(),
    stale: false
  });
}
