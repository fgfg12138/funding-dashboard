import type {
  CrossExchangeOpportunity,
  ExchangeFundingRates,
  ExchangeName,
  FundingMarket,
  SpotMarket,
  SpotPerpOpportunity
} from "../exchanges/types";

export function calculateAnnualizedRate(fundingRate: number, fundingIntervalHours: number): number {
  if (!Number.isFinite(fundingRate) || !Number.isFinite(fundingIntervalHours) || fundingIntervalHours <= 0) {
    return 0;
  }

  return fundingRate * (24 / fundingIntervalHours) * 365 * 100;
}

export function calculateDirectionalPriceSpread(shortPrice: number, longPrice: number): number {
  if (!Number.isFinite(shortPrice) || !Number.isFinite(longPrice) || longPrice <= 0) {
    return 0;
  }

  return ((shortPrice - longPrice) / longPrice) * 100;
}

export function calculateCrossExchangeFundingSpread(
  symbol: string,
  markets: FundingMarket[]
): CrossExchangeOpportunity | null {
  const validMarkets = markets.filter((market) => market.symbol === symbol && Number.isFinite(market.fundingRate));

  if (validMarkets.length < 2) {
    return null;
  }

  const ranked = validMarkets
    .map((market) => ({
      market,
      annualized: calculateAnnualizedRate(market.fundingRate, market.fundingIntervalHours)
    }))
    .sort((a, b) => b.annualized - a.annualized);

  const highest = ranked[0];
  const lowest = ranked[ranked.length - 1];
  const annualizedSpread = highest.annualized - lowest.annualized;
  const marketsByExchange = validMarkets.reduce<ExchangeFundingRates>((acc, market) => {
    acc[market.exchange] = market;
    return acc;
  }, {});
  const annualizedRates = validMarkets.reduce<Partial<Record<ExchangeName, number>>>((acc, market) => {
    acc[market.exchange] = calculateAnnualizedRate(market.fundingRate, market.fundingIntervalHours);
    return acc;
  }, {});
  const fundingRates = validMarkets.reduce<Partial<Record<ExchangeName, number>>>((acc, market) => {
    acc[market.exchange] = market.fundingRate;
    return acc;
  }, {});
  const fundingIntervalHours = validMarkets.reduce<Partial<Record<ExchangeName, number>>>((acc, market) => {
    acc[market.exchange] = market.fundingIntervalHours;
    return acc;
  }, {});

  return {
    symbol,
    base: highest.market.base,
    quote: highest.market.quote,
    markets: marketsByExchange,
    annualizedRates,
    fundingRates,
    fundingIntervalHours,
    annualizedSpread,
    direction: `\u7a7a ${highest.market.exchange} / \u591a ${lowest.market.exchange}`,
    shortExchange: highest.market.exchange,
    longExchange: lowest.market.exchange,
    priceSpread: calculateDirectionalPriceSpread(highest.market.markPrice, lowest.market.markPrice),
    nextFundingTime: Math.min(...validMarkets.map((market) => market.nextFundingTime).filter(Boolean)),
    volume24h: sumOptional(validMarkets.map((market) => market.volume24h)),
    openInterestUsd: sumOptional(validMarkets.map((market) => market.openInterestUsd))
  };
}

export function calculateSpotPerpOpportunity(
  spot: SpotMarket,
  perp: FundingMarket
): SpotPerpOpportunity | null {
  if (spot.symbol !== perp.symbol || perp.fundingRate <= 0) {
    return null;
  }

  return {
    symbol: spot.symbol,
    base: spot.base,
    quote: spot.quote,
    spotExchange: spot.exchange,
    perpExchange: perp.exchange,
    fundingRate: perp.fundingRate,
    annualized: calculateAnnualizedRate(perp.fundingRate, perp.fundingIntervalHours),
    spotPrice: spot.price,
    perpPrice: perp.markPrice,
    priceSpread: spot.price > 0 ? ((perp.markPrice - spot.price) / spot.price) * 100 : 0,
    volume24h: Math.max(spot.volume24h ?? 0, perp.volume24h ?? 0) || undefined,
    nextFundingTime: perp.nextFundingTime
  };
}

function sumOptional(values: Array<number | undefined>): number | undefined {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (finite.length === 0) {
    return undefined;
  }

  return finite.reduce((sum, value) => sum + value, 0);
}
