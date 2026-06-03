import type { FundingMarket, SpotMarket } from "./types";
import { fetchJson, mapLimit } from "./http";
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

type BinanceOpenInterest = {
  symbol: string;
  openInterest: string;
};

const FUTURES_BASE = "https://fapi.binance.com";
const SPOT_BASE = "https://api.binance.com";

export async function fetchBinanceFundingMarkets(): Promise<FundingMarket[]> {
  const [premium, tickers] = await Promise.all([
    fetchJson<BinancePremium[]>(`${FUTURES_BASE}/fapi/v1/premiumIndex`),
    fetchJson<BinanceTicker[]>(`${FUTURES_BASE}/fapi/v1/ticker/24hr`)
  ]);
  const volumeBySymbol = new Map(tickers.map((ticker) => [ticker.symbol, Number(ticker.quoteVolume)]));
  const usdtPremium = premium.filter((item) => item.symbol.endsWith("USDT"));
  const markPriceBySymbol = new Map(usdtPremium.map((item) => [item.symbol, Number(item.markPrice)]));
  const openInterestBySymbol = await fetchBinanceOpenInterestUsd(Array.from(markPriceBySymbol.entries()));

  return usdtPremium
    .map((item) => {
      const normalized = normalizeSymbol(item.symbol);
      return {
        exchange: "Binance" as const,
        rawSymbol: item.symbol,
        symbol: normalized.symbol,
        base: normalized.base,
        quote: normalized.quote,
        fundingRate: Number(item.lastFundingRate),
        fundingIntervalHours: 8,
        nextFundingTime: item.nextFundingTime,
        markPrice: Number(item.markPrice),
        indexPrice: Number(item.indexPrice),
        volume24h: volumeBySymbol.get(item.symbol),
        openInterestUsd: openInterestBySymbol.get(item.symbol)
      };
    })
    .filter((market) => market.quote === "USDT" && Number.isFinite(market.markPrice));
}

async function fetchBinanceOpenInterestUsd(symbolPrices: Array<[string, number]>): Promise<Map<string, number>> {
  const rows = await mapLimit(symbolPrices, 12, async ([symbol, markPrice]) => {
    try {
      const data = await fetchJson<BinanceOpenInterest>(
        `${FUTURES_BASE}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`,
        5_000
      );
      const openInterestUsd = Number(data.openInterest) * markPrice;

      return Number.isFinite(openInterestUsd) ? [symbol, openInterestUsd] as const : null;
    } catch {
      return null;
    }
  });

  return new Map(rows.filter((row): row is readonly [string, number] => Boolean(row)));
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
