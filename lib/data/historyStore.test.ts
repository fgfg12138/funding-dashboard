import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  queryFundingHistory,
  queryOpportunityHistory,
  saveHistorySnapshot
} from "./historyStore";
import type { FundingMarket, SpotMarket } from "../exchanges/types";

let tempDir: string;
let fundingHistoryPath: string;
let opportunityHistoryPath: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "funding-history-"));
  fundingHistoryPath = join(tempDir, "funding.jsonl");
  opportunityHistoryPath = join(tempDir, "opportunities.jsonl");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

function fundingMarket(
  exchange: FundingMarket["exchange"],
  fundingRate: number,
  markPrice: number,
  timestampOffset = 0
): FundingMarket {
  return {
    exchange,
    rawSymbol: `${exchange}-BTCUSDT`,
    symbol: "BTC/USDT",
    base: "BTC",
    quote: "USDT",
    fundingRate,
    fundingIntervalHours: 8,
    nextFundingTime: 1_800_000_000_000 + timestampOffset,
    markPrice,
    volume24h: 10_000_000,
    openInterestUsd: 20_000_000
  };
}

function spotMarket(exchange: SpotMarket["exchange"]): SpotMarket {
  return {
    exchange,
    symbol: "BTC/USDT",
    base: "BTC",
    quote: "USDT",
    price: 100_000,
    volume24h: 8_000_000
  };
}

describe("historyStore", () => {
  it("writes and queries funding history by symbol", async () => {
    await saveHistorySnapshot({
      fundingMarkets: [
        fundingMarket("Binance", 0.0001, 100_000),
        fundingMarket("Bybit", 0.0002, 100_100)
      ],
      spotMarkets: [],
      timestamp: 1_700_000_000_000,
      fundingHistoryPath,
      opportunityHistoryPath
    });

    const rows = await queryFundingHistory("BTC/USDT", { fundingHistoryPath });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      exchange: "Binance",
      symbol: "BTC/USDT",
      fundingRate: 0.0001,
      markPrice: 100_000,
      timestamp: 1_700_000_000_000
    });
    expect(rows[0].annualizedRate).toBeCloseTo(10.95);
  });

  it("writes and queries derived opportunity history by symbol", async () => {
    await saveHistorySnapshot({
      fundingMarkets: [
        fundingMarket("Binance", 0.0002, 100_300),
        fundingMarket("Bybit", -0.0001, 100_000)
      ],
      spotMarkets: [spotMarket("Binance")],
      timestamp: 1_700_000_000_000,
      fundingHistoryPath,
      opportunityHistoryPath
    });

    const rows = await queryOpportunityHistory("BTC/USDT", { opportunityHistoryPath });

    expect(rows.map((row) => row.type).sort()).toEqual(["cross-exchange", "spot-perp"]);
    expect(rows[0]).toMatchObject({
      symbol: "BTC/USDT",
      timestamp: 1_700_000_000_000
    });
    expect(rows.some((row) => typeof row.priceSpread === "number")).toBe(true);
  });
});
