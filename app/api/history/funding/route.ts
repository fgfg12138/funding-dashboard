import { NextRequest, NextResponse } from "next/server";
import { queryFundingHistory } from "@/lib/data/historyStore";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json(
      {
        data: [],
        error: "symbol is required",
        updatedAt: Date.now()
      },
      { status: 400 }
    );
  }

  const data = await queryFundingHistory(symbol);
  return NextResponse.json({
    data,
    updatedAt: Date.now()
  });
}
