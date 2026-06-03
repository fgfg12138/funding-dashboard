import type { FundingMarket, SpotMarket } from "./types";
import { fetchJson } from "./http";
import { normalizeSymbol } from "../markets/normalize";

type BinancePremium = {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
};

type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  quoteVolume: string;
};

const FUTURES_BASE = "https://fapi.binance.com";
const SPOT_BASE = "https://api.binance.com";

export async function fetchBinanceFundingMarkets(): Promise<FundingMarket[]> {
  const [premium, tickers] = await Promise.all([
    fetchJson<BinancePremium[]>(`${FUTURES_BASE}/fapi/v1/premiumIndex`),
    fetchJson<BinanceTicker[]>(`${FUTURES_BASE}/fapi/v1/ticker/24hr`)
  ]);
  const volumeBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, Number(ticker.quoteVolume)]));

  return premium
    .filter((item) => item.symbol.endsWith("USDT"))
    .map((item) => {
      const normalized = normalizeSymbol(item.symbol);
      return {
        exchange: "Binance" as const,
        symbol: normalized.symbol,
        base: normalized.base,
        quote: normalized.quote,
        fundingRate: Number(item.lastFundingRate),
        fundingIntervalHours: 8,
        nextFundingTime: item.nextFundingTime,
        markPrice: Number(item.markPrice),
        indexPrice: Number(item.indexPrice),
        volume24h: volumeBySymbol.get(item.symbol)
      };
    })
    .filter((market) => market.quote === "USDT" && Number.isFinite(market.markPrice));
}

export async function fetchBinanceSpotMarkets(): Promise<SpotMarket[]> {
  const tickers = await fetchJson<BinanceTicker[]>(`${SPOT_BASE}/api/v3/ticker/24hr`);

  return tickers
    .filter((ticker) => ticker.symbol.endsWith("USDT"))
    .map((ticker) => {
      const normalized = normalizeSymbol(ticker.symbol);
      return {
        exchange: "Binance" as const,
        symbol: normalized.symbol,
        base: normalized.base,
        quote: normalized.quote,
        price: Number(ticker.lastPrice),
        volume24h: Number(ticker.quoteVolume)
      };
    })
    .filter((market) => market.quote === "USDT" && Number.isFinite(market.price));
}
