import type { FundingMarket, SpotMarket } from "./types";
import { fetchBinanceFundingMarkets, fetchBinanceSpotMarkets } from "./binanceAdapter";
import { fetchBybitFundingMarkets, fetchBybitSpotMarkets } from "./bybitAdapter";
import { fetchOkxFundingMarkets, fetchOkxSpotMarkets } from "./okxAdapter";

type ExchangeResult<T> = {
  data: T[];
  error?: string;
};

export async function fetchAllFundingMarkets(): Promise<ExchangeResult<FundingMarket>> {
  const results = await Promise.allSettled([
    fetchBinanceFundingMarkets(),
    fetchOkxFundingMarkets(),
    fetchBybitFundingMarkets()
  ]);

  return mergeResults(results);
}

export async function fetchAllSpotMarkets(): Promise<ExchangeResult<SpotMarket>> {
  const results = await Promise.allSettled([fetchBinanceSpotMarkets(), fetchOkxSpotMarkets(), fetchBybitSpotMarkets()]);

  return mergeResults(results);
}

function mergeResults<T>(results: PromiseSettledResult<T[]>[]): ExchangeResult<T> {
  const data = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  const errors = results
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

  return {
    data,
    error: errors.length ? errors.join("; ") : undefined
  };
}
