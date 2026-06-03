import {
  calculateAnnualizedRate,
  calculateCrossExchangeFundingSpread,
  calculateSpotPerpOpportunity
} from "../arbitrage/calculations";
import { fetchAllFundingMarkets, fetchAllSpotMarkets } from "../exchanges";
import type {
  CrossExchangeOpportunity,
  DashboardSummary,
  FundingMarket,
  SpotMarket,
  SpotPerpOpportunity
} from "../exchanges/types";
import { getCached } from "./cache";

const CACHE_TTL_MS = 45_000;

export async function getFundingSnapshot() {
  return getCached("funding-snapshot", CACHE_TTL_MS, async () => {
    const [funding, spot] = await Promise.all([fetchAllFundingMarkets(), fetchAllSpotMarkets()]);
    return {
      fundingMarkets: funding.data,
      spotMarkets: spot.data,
      errors: [funding.error, spot.error].filter(Boolean)
    };
  });
}

export async function getCrossExchangeOpportunities(): Promise<CrossExchangeOpportunity[]> {
  const snapshot = await getFundingSnapshot();
  return buildCrossExchangeOpportunities(snapshot.fundingMarkets);
}

export async function getSpotPerpOpportunities(): Promise<SpotPerpOpportunity[]> {
  const snapshot = await getFundingSnapshot();
  return buildSpotPerpOpportunities(snapshot.spotMarkets, snapshot.fundingMarkets);
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const snapshot = await getFundingSnapshot();
  const cross = buildCrossExchangeOpportunities(snapshot.fundingMarkets);
  const singleAnnualized = snapshot.fundingMarkets.map((market) =>
    calculateAnnualizedRate(market.fundingRate, market.fundingIntervalHours)
  );
  const best = cross[0];

  return {
    totalPairs: new Set(snapshot.fundingMarkets.map((market) => market.symbol)).size,
    maxAnnualizedSpread: best?.annualizedSpread ?? 0,
    bestDirection: best?.direction ?? "-",
    spreadAbove10Count: cross.filter((item) => item.annualizedSpread > 10).length,
    highestSingleAnnualized: Math.max(0, ...singleAnnualized)
  };
}

export function buildCrossExchangeOpportunities(markets: FundingMarket[]): CrossExchangeOpportunity[] {
  const grouped = groupBy(markets, (market) => market.symbol);

  return Array.from(grouped.entries())
    .map(([symbol, rows]) => calculateCrossExchangeFundingSpread(symbol, rows))
    .filter((item): item is CrossExchangeOpportunity => Boolean(item))
    .sort((a, b) => b.annualizedSpread - a.annualizedSpread);
}

export function buildSpotPerpOpportunities(spots: SpotMarket[], perps: FundingMarket[]): SpotPerpOpportunity[] {
  const spotBySymbol = new Map<string, SpotMarket>();
  for (const spot of spots) {
    const existing = spotBySymbol.get(spot.symbol);
    if (!existing || (spot.volume24h ?? 0) > (existing.volume24h ?? 0)) {
      spotBySymbol.set(spot.symbol, spot);
    }
  }

  return perps
    .map((perp) => {
      const spot = spotBySymbol.get(perp.symbol);
      return spot ? calculateSpotPerpOpportunity(spot, perp) : null;
    })
    .filter((item): item is SpotPerpOpportunity => Boolean(item))
    .sort((a, b) => b.annualized - a.annualized);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    const bucket = grouped.get(key) ?? [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  return grouped;
}
