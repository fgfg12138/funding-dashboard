import type { FundingMarket, SpotMarket } from "./types";
import { fetchJson, mapLimit } from "./http";
import { normalizeSymbol } from "../markets/normalize";

type OkxResponse<T> = {
  code: string;
  msg: string;
  data: T[];
};

type OkxTicker = {
  instId: string;
  last: string;
  volCcy24h?: string;
  vol24h?: string;
};

type OkxFunding = {
  instId: string;
  fundingRate: string;
  fundingTime: string;
  nextFundingTime?: string;
};

const BASE = "https://www.okx.com";
const MAX_OKX_FUNDING_LOOKUPS = 120;

export async function fetchOkxFundingMarkets(): Promise<FundingMarket[]> {
  const tickers = await fetchOkx<OkxTicker>(`${BASE}/api/v5/market/tickers?instType=SWAP`);
  const usdtSwaps = tickers
    .filter((ticker) => ticker.instId.endsWith("-USDT-SWAP"))
    .slice(0, MAX_OKX_FUNDING_LOOKUPS);
  const fundingRows = await mapLimit(usdtSwaps, 10, async (ticker) => {
    const funding = await fetchOkx<OkxFunding>(
      `${BASE}/api/v5/public/funding-rate?instId=${encodeURIComponent(ticker.instId)}`,
      8_000
    );
    return {
      ticker,
      funding: funding[0]
    };
  });

  return fundingRows
    .filter((row) => row.funding)
    .map(({ ticker, funding }) => {
      const normalized = normalizeSymbol(ticker.instId);
      const markPrice = Number(ticker.last);
      const volume24h = Number(ticker.volCcy24h ?? 0) || Number(ticker.vol24h) * markPrice;

      return {
        exchange: "OKX" as const,
        symbol: normalized.symbol,
        base: normalized.base,
        quote: normalized.quote,
        fundingRate: Number(funding.fundingRate),
        fundingIntervalHours: 8,
        nextFundingTime: Number(funding.nextFundingTime ?? funding.fundingTime),
        markPrice,
        volume24h
      };
    })
    .filter((market) => market.quote === "USDT" && Number.isFinite(market.markPrice));
}

export async function fetchOkxSpotMarkets(): Promise<SpotMarket[]> {
  const tickers = await fetchOkx<OkxTicker>(`${BASE}/api/v5/market/tickers?instType=SPOT`);

  return tickers
    .filter((ticker) => ticker.instId.endsWith("-USDT"))
    .map((ticker) => {
      const normalized = normalizeSymbol(ticker.instId);
      const price = Number(ticker.last);
      const volume24h = Number(ticker.volCcy24h ?? 0) || Number(ticker.vol24h) * price;

      return {
        exchange: "OKX" as const,
        symbol: normalized.symbol,
        base: normalized.base,
        quote: normalized.quote,
        price,
        volume24h
      };
    })
    .filter((market) => market.quote === "USDT" && Number.isFinite(market.price));
}

async function fetchOkx<T>(url: string, timeoutMs = 10_000): Promise<T[]> {
  const data = await fetchJson<OkxResponse<T>>(url, timeoutMs);
  if (data.code !== "0") {
    throw new Error(`OKX error: ${data.msg}`);
  }

  return data.data;
}
