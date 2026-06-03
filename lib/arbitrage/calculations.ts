import type {
  CrossExchangeOpportunity,
  ExchangeFundingRates,
  ExchangeName,
  FundingMarket,
  SpotMarket,
  SpotPerpOpportunity
} from "../exchanges/types";

const LOW_LIQUIDITY = "\u4f4e\u6d41\u52a8\u6027";
const MISSING_OPEN_INTEREST = "\u6301\u4ed3\u91cf\u7f3a\u5931";
const WIDE_PRICE_SPREAD = "\u4ef7\u5dee\u8fc7\u5927";
const HIGH_FUNDING_RATE = "\u9ad8\u8d39\u7387";
const NEAR_SETTLEMENT = "\u7ed3\u7b97\u4e34\u8fd1";

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

type OpportunityQualityInput = {
  annualizedRate: number;
  volume24h?: number;
  openInterestUsd?: number;
  hasMissingOpenInterest?: boolean;
  priceSpread: number;
  exchangeCount: number;
  nextFundingTime: number;
};

export function calculateOpportunityScore(input: OpportunityQualityInput): number {
  const annualizedScore = clamp(input.annualizedRate / 50) * 35;
  const volumeScore = clamp((input.volume24h ?? 0) / 100_000_000) * 20;
  const openInterestScore = clamp((input.openInterestUsd ?? 0) / 100_000_000) * 20;
  const priceSpreadScore = clamp(1 - Math.abs(input.priceSpread) / 2) * 15;
  const exchangeScore = clamp((input.exchangeCount - 1) / 2) * 10;

  return Math.round(annualizedScore + volumeScore + openInterestScore + priceSpreadScore + exchangeScore);
}

export function getOpportunityRiskTags(input: OpportunityQualityInput): string[] {
  const tags: string[] = [];

  if ((input.volume24h ?? 0) < 1_000_000) {
    tags.push(LOW_LIQUIDITY);
  }
  if (input.hasMissingOpenInterest || !input.openInterestUsd || input.openInterestUsd <= 0) {
    tags.push(MISSING_OPEN_INTEREST);
  }
  if (Math.abs(input.priceSpread) >= 1) {
    tags.push(WIDE_PRICE_SPREAD);
  }
  if (input.annualizedRate > 50) {
    tags.push(HIGH_FUNDING_RATE);
  }
  if (input.nextFundingTime > Date.now() && input.nextFundingTime - Date.now() <= 30 * 60_000) {
    tags.push(NEAR_SETTLEMENT);
  }

  return tags;
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
  const exchangeCount = validMarkets.length;
  const volume24h = sumOptional(validMarkets.map((market) => market.volume24h));
  const openInterestUsd = sumOptional(validMarkets.map((market) => market.openInterestUsd));
  const priceSpread = calculateDirectionalPriceSpread(highest.market.markPrice, lowest.market.markPrice);
  const nextFundingTime = Math.min(...validMarkets.map((market) => market.nextFundingTime).filter(Boolean));
  const qualityInput = {
    annualizedRate: annualizedSpread,
    volume24h,
    openInterestUsd,
    hasMissingOpenInterest: validMarkets.some((market) => !market.openInterestUsd || market.openInterestUsd <= 0),
    priceSpread,
    exchangeCount,
    nextFundingTime
  };

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
    exchangeCount,
    score: calculateOpportunityScore(qualityInput),
    riskTags: getOpportunityRiskTags(qualityInput),
    priceSpread,
    priceSpreadDirection: describeCrossPriceSpread(highest.market.exchange, lowest.market.exchange, priceSpread),
    nextFundingTime,
    volume24h,
    openInterestUsd
  };
}

export function calculateSpotPerpOpportunity(
  spot: SpotMarket,
  perp: FundingMarket
): SpotPerpOpportunity | null {
  if (spot.symbol !== perp.symbol || perp.fundingRate <= 0) {
    return null;
  }

  const priceSpread = spot.price > 0 ? ((perp.markPrice - spot.price) / spot.price) * 100 : 0;
  const volume24h = Math.max(spot.volume24h ?? 0, perp.volume24h ?? 0) || undefined;
  const qualityInput = {
    annualizedRate: calculateAnnualizedRate(perp.fundingRate, perp.fundingIntervalHours),
    volume24h,
    openInterestUsd: perp.openInterestUsd,
    priceSpread,
    exchangeCount: 1,
    nextFundingTime: perp.nextFundingTime
  };

  return {
    symbol: spot.symbol,
    base: spot.base,
    quote: spot.quote,
    spotExchange: spot.exchange,
    perpExchange: perp.exchange,
    exchangeCount: 1,
    score: calculateOpportunityScore(qualityInput),
    riskTags: getOpportunityRiskTags(qualityInput),
    fundingRate: perp.fundingRate,
    annualized: qualityInput.annualizedRate,
    spotPrice: spot.price,
    perpPrice: perp.markPrice,
    priceSpread,
    priceSpreadDirection: describeSpotPerpPriceSpread(perp.exchange, spot.exchange, priceSpread),
    volume24h,
    nextFundingTime: perp.nextFundingTime
  };
}

function describeCrossPriceSpread(shortExchange: ExchangeName, longExchange: ExchangeName, priceSpread: number): string {
  const relation = priceSpread >= 0 ? "above" : "below";
  return `Short ${shortExchange} mark is ${Math.abs(priceSpread).toFixed(2)}% ${relation} long ${longExchange} mark`;
}

function describeSpotPerpPriceSpread(perpExchange: ExchangeName, spotExchange: ExchangeName, priceSpread: number): string {
  const relation = priceSpread >= 0 ? "above" : "below";
  return `${perpExchange} perp is ${Math.abs(priceSpread).toFixed(2)}% ${relation} ${spotExchange} spot`;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function sumOptional(values: Array<number | undefined>): number | undefined {
  const finite = values.filter((value): value is number => Number.isFinite(value));
  if (finite.length === 0) {
    return undefined;
  }

  return finite.reduce((sum, value) => sum + value, 0);
}
