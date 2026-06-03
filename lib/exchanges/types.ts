export type ExchangeName = "Binance" | "OKX" | "Bybit";

export type NormalizedSymbol = {
  symbol: string;
  base: string;
  quote: string;
};

export type FundingMarket = {
  exchange: ExchangeName;
  symbol: string;
  base: string;
  quote: string;
  fundingRate: number;
  fundingIntervalHours: number;
  nextFundingTime: number;
  markPrice: number;
  indexPrice?: number;
  volume24h?: number;
  openInterestUsd?: number;
};

export type SpotMarket = {
  exchange: ExchangeName;
  symbol: string;
  base: string;
  quote: string;
  price: number;
  volume24h?: number;
};

export type ExchangeFundingRates = {
  Binance?: FundingMarket;
  OKX?: FundingMarket;
  Bybit?: FundingMarket;
};

export type CrossExchangeOpportunity = {
  symbol: string;
  base: string;
  quote: string;
  markets: ExchangeFundingRates;
  annualizedRates: Partial<Record<ExchangeName, number>>;
  fundingRates: Partial<Record<ExchangeName, number>>;
  fundingIntervalHours: Partial<Record<ExchangeName, number>>;
  annualizedSpread: number;
  direction: string;
  shortExchange: ExchangeName;
  longExchange: ExchangeName;
  priceSpread: number;
  nextFundingTime: number;
  volume24h?: number;
  openInterestUsd?: number;
};

export type SpotPerpOpportunity = {
  symbol: string;
  base: string;
  quote: string;
  spotExchange: ExchangeName;
  perpExchange: ExchangeName;
  fundingRate: number;
  annualized: number;
  spotPrice: number;
  perpPrice: number;
  priceSpread: number;
  volume24h?: number;
  nextFundingTime: number;
};

export type DashboardSummary = {
  totalPairs: number;
  maxAnnualizedSpread: number;
  bestDirection: string;
  spreadAbove10Count: number;
  highestSingleAnnualized: number;
};
