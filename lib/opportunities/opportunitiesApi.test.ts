import { describe, expect, it } from "vitest";
import { getUnifiedOpportunitiesResponse } from "./opportunitiesApi";

describe("opportunitiesApi", () => {
  it("returns API envelope with unified opportunities", async () => {
    const response = await getUnifiedOpportunitiesResponse({
      sourceLoader: async () => ({
        cross: [],
        spotPerp: [],
        basis: [
          {
            symbol: "BTC/USDT",
            base: "BTC",
            quote: "USDT",
            spotExchange: "Binance",
            perpExchange: "Binance",
            spotPrice: 100_000,
            perpPrice: 100_300,
            basisPercent: 0.3,
            fundingRate: 0.0003,
            annualizedFundingRate: 32.85,
            estimatedCarryAnnualized: 32.55,
            volume24h: 10_000_000,
            openInterestUsd: 20_000_000,
            nextFundingTime: 12_345,
            score: 70,
            riskTags: [],
            opportunityReason: "Binance 买现货 / 空永续"
          }
        ],
        errors: []
      }),
      now: 999
    });

    expect(response).toMatchObject({
      data: [
        {
          id: "Basis:Binance:Binance:BTC/USDT",
          opportunityType: "Basis",
          symbol: "BTC/USDT"
        }
      ],
      errors: [],
      updatedAt: 999
    });
  });
});
