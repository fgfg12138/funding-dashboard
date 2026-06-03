import { describe, expect, it } from "vitest";
import { buildSpotPerpOpportunities } from "./fundingService";
import type { FundingMarket, SpotMarket } from "../exchanges/types";

function spot(exchange: SpotMarket["exchange"], volume24h = 10_000_000): SpotMarket {
  return {
    exchange,
    symbol: "BTC/USDT",
    base: "BTC",
    quote: "USDT",
    price: 100_000,
    volume24h
  };
}

function perp(exchange: FundingMarket["exchange"], fundingRate = 0.0002): FundingMarket {
  return {
    exchange,
    rawSymbol: `${exchange}-BTCUSDT`,
    symbol: "BTC/USDT",
    base: "BTC",
    quote: "USDT",
    fundingRate,
    fundingIntervalHours: 8,
    nextFundingTime: Date.now() + 2 * 60 * 60_000,
    markPrice: 100_100,
    volume24h: 12_000_000,
    openInterestUsd: 40_000_000
  };
}

describe("buildSpotPerpOpportunities", () => {
  it("builds only same-exchange spot-perp combinations", () => {
    const opportunities = buildSpotPerpOpportunities(
      [spot("Binance"), spot("OKX", 20_000_000)],
      [perp("Binance"), perp("Bybit"), perp("OKX")]
    );

    expect(opportunities.map((item) => `${item.spotExchange}-${item.perpExchange}`).sort()).toEqual([
      "Binance-Binance",
      "OKX-OKX"
    ]);
  });

  it("excludes non-positive funding opportunities", () => {
    const opportunities = buildSpotPerpOpportunities([spot("Binance")], [perp("Binance", 0)]);

    expect(opportunities).toEqual([]);
  });

  it("includes score, risk tags, and reason on generated opportunities", () => {
    const [opportunity] = buildSpotPerpOpportunities([spot("Binance")], [perp("Binance")]);

    expect(opportunity.score).toBeGreaterThanOrEqual(0);
    expect(opportunity.score).toBeLessThanOrEqual(100);
    expect(opportunity.riskTags).toEqual(expect.any(Array));
    expect(opportunity.opportunityReason).toContain("Binance");
  });
});
