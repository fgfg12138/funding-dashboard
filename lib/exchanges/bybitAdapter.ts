import type { FundingMarket, SpotMarket } from "./types";
import { fetchJson } from "./http";
import { normalizeSymbol } from "../markets/normalize";

type BybitResponse<T> = {
  retCode: number;
  retMsg: string;
  result: {
    list: T[];
  };
};

type BybitLinearTicker = {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  fundingRate: string;
  nextFundingTime: string;
  fundingIntervalHour?: string;
  turnover24h?: string;
  openInterestValue?: string;
};

type BybitSpotTicker = {
  symbol: string;
  lastPrice: string;
  turnover24h?: string;
};

const BASE = "https://api.bybit.com";

export async function fetchBybitFundingMarkets(): Promise<FundingMarket[]> {
  const data = await fetchJson<BybitResponse<BybitLinearTicker>>(`${BASE}/v5/market/tickers?category=linear`);
  assertBybit(data);

  return data.result.list
    .filter((item) => item.symbol.endsWith("USDT"))
    .map((item) => {
      const normalized = normalizeSymbol(item.symbol);
      return {
        exchange: "Bybit" as const,
        rawSymbol: item.symbol,
        symbol: normalized.symbol,
        base: normalized.base,
        quote: normalized.quote,
        fundingRate: Number(item.fundingRate),
        fundingIntervalHours: Number(item.fundingIntervalHour ?? 8),
        nextFundingTime: Number(item.nextFundingTime),
        markPrice: Number(item.markPrice),
        indexPrice: Number(item.indexPrice),
        volume24h: Number(item.turnover24h),
        openInterestUsd: Number(item.openInterestValue)
      };
    })
    .filter((market) => market.quote === "USDT" && Number.isFinite(market.markPrice));
}

export async function fetchBybitSpotMarkets(): Promise<SpotMarket[]> {
  const data = await fetchJson<BybitResponse<BybitSpotTicker>>(`${BASE}/v5/market/tickers?category=spot`);
  assertBybit(data);

  return data.result.list
    .filter((item) => item.symbol.endsWith("USDT"))
    .map((item) => {
      const normalized = normalizeSymbol(item.symbol);
      return {
        exchange: "Bybit" as const,
        symbol: normalized.symbol,
        base: normalized.base,
        quote: normalized.quote,
        price: Number(item.lastPrice),
        volume24h: Number(item.turnover24h)
      };
    })
    .filter((market) => market.quote === "USDT" && Number.isFinite(market.price));
}

function assertBybit<T>(data: BybitResponse<T>) {
  if (data.retCode !== 0) {
    throw new Error(`Bybit error: ${data.retMsg}`);
  }
}
