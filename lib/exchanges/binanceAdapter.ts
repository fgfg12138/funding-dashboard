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
const OPEN_INTEREST_CACHE_TTL_MS = 4 * 60_000;
const openInterestCache = new Map<string, { expiresAt: number; openInterest: number }>();

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
  const now = Date.now();
  const missingSymbols = symbolPrices.filter(([symbol]) => {
    const cached = openInterestCache.get(symbol);
    return !cached || cached.expiresAt <= now;
  });

  await mapLimit(missingSymbols, 12, async ([symbol]) => {
    try {
      const data = await fetchJson<BinanceOpenInterest>(
        `${FUTURES_BASE}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`,
        5_000
      );
      const openInterest = Number(data.openInterest);

      if (Number.isFinite(openInterest)) {
        openInterestCache.set(symbol, {
          expiresAt: now + OPEN_INTEREST_CACHE_TTL_MS,
          openInterest
        });
      }
    } catch {
      // Keep funding data usable when Binance open interest is unavailable.
    }
  });

  return new Map(
    symbolPrices
      .map(([symbol, markPrice]) => {
        const cached = openInterestCache.get(symbol);
        const openInterestUsd = cached ? cached.openInterest * markPrice : undefined;

        return Number.isFinite(openInterestUsd) ? [symbol, openInterestUsd as number] as const : null;
      })
      .filter((row): row is readonly [string, number] => Boolean(row))
  );
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
