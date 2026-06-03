import { describe, expect, it } from "vitest";
import { calculateCrossExchangeFundingSpread } from "../lib/arbitrage/calculations";
import type { FundingMarket } from "../lib/exchanges/types";

const missingOi = "\u6301\u4ed3\u91cf\u7f3a\u5931";
const wideSpread = "\u4ef7\u5dee\u8fc7\u5927";
const nearSettlement = "\u7ed3\u7b97\u4e34\u8fd1";

const market = (
  exchange: FundingMarket["exchange"],
  fundingRate: number,
  markPrice: number,
  extra: Partial<FundingMarket> = {}
): FundingMarket => ({
  exchange,
  rawSymbol: `${exchange}-BTCUSDT`,
  symbol: "BTC/USDT",
  base: "BTC",
  quote: "USDT",
  fundingRate,
  fundingIntervalHours: 8,
  nextFundingTime: Date.now() + 10 * 60_000,
  markPrice,
  volume24h: 2_000_000,
  ...extra
});

describe("calculateCrossExchangeFundingSpread", () => {
  it("adds score, risk tags, exchange count, and price direction", () => {
    const opportunity = calculateCrossExchangeFundingSpread("BTC/USDT", [
      market("Binance", -0.0001, 100_000, { openInterestUsd: 100_000_000 }),
      market("Bybit", 0.0003, 99_000),
      market("OKX", 0.00005, 101_000, { openInterestUsd: 50_000_000 })
    ]);

    expect(opportunity).toMatchObject({
      shortExchange: "Bybit",
      longExchange: "Binance",
      exchangeCount: 3
    });
    expect(opportunity?.priceSpread).toBeCloseTo(-1, 4);
    expect(opportunity?.priceSpreadDirection).toContain("Bybit");
    expect(opportunity?.score).toBeGreaterThanOrEqual(0);
    expect(opportunity?.score).toBeLessThanOrEqual(100);
    expect(opportunity?.riskTags).toEqual(expect.arrayContaining([missingOi, wideSpread, nearSettlement]));
  });
});
