import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  calculateAnnualizedRate,
  calculateCrossExchangeFundingSpread,
  calculateSpotPerpOpportunity
} from "../arbitrage/calculations";
import type { ExchangeName, FundingMarket, SpotMarket } from "../exchanges/types";

const DEFAULT_DATA_DIR = join(process.cwd(), ".data");
const DEFAULT_FUNDING_HISTORY_PATH = join(DEFAULT_DATA_DIR, "funding-history.jsonl");
const DEFAULT_OPPORTUNITY_HISTORY_PATH = join(DEFAULT_DATA_DIR, "opportunity-history.jsonl");

export type FundingHistoryRecord = {
  exchange: ExchangeName;
  symbol: string;
  fundingRate: number;
  annualizedRate: number;
  markPrice: number;
  volume24h?: number;
  openInterestUsd?: number;
  nextFundingTime: number;
  timestamp: number;
};

export type OpportunityHistoryRecord = {
  type: "cross-exchange" | "spot-perp";
  symbol: string;
  timestamp: number;
  annualizedRate?: number;
  annualizedSpread?: number;
  priceSpread: number;
  score: number;
  direction?: string;
  shortExchange?: ExchangeName;
  longExchange?: ExchangeName;
  spotExchange?: ExchangeName;
  perpExchange?: ExchangeName;
  exchangeCount: number;
  volume24h?: number;
  openInterestUsd?: number;
};

export type HistoryStoreOptions = {
  fundingHistoryPath?: string;
  opportunityHistoryPath?: string;
};

export type SaveHistorySnapshotInput = HistoryStoreOptions & {
  fundingMarkets: FundingMarket[];
  spotMarkets: SpotMarket[];
  timestamp?: number;
};

export async function saveHistorySnapshot(input: SaveHistorySnapshotInput): Promise<void> {
  const timestamp = input.timestamp ?? Date.now();
  const fundingRows = input.fundingMarkets.map((market) => toFundingHistoryRecord(market, timestamp));
  const opportunityRows = buildOpportunityHistoryRecords(input.spotMarkets, input.fundingMarkets, timestamp);

  await Promise.all([
    appendJsonLines(input.fundingHistoryPath ?? DEFAULT_FUNDING_HISTORY_PATH, fundingRows),
    appendJsonLines(input.opportunityHistoryPath ?? DEFAULT_OPPORTUNITY_HISTORY_PATH, opportunityRows)
  ]);
}

export async function queryFundingHistory(
  symbol: string,
  options: Pick<HistoryStoreOptions, "fundingHistoryPath"> = {}
): Promise<FundingHistoryRecord[]> {
  const rows = await readJsonLines<FundingHistoryRecord>(options.fundingHistoryPath ?? DEFAULT_FUNDING_HISTORY_PATH);
  return rows.filter((row) => row.symbol === symbol).sort(sortByTimestampThenExchange);
}

export async function queryOpportunityHistory(
  symbol: string,
  options: Pick<HistoryStoreOptions, "opportunityHistoryPath"> = {}
): Promise<OpportunityHistoryRecord[]> {
  const rows = await readJsonLines<OpportunityHistoryRecord>(
    options.opportunityHistoryPath ?? DEFAULT_OPPORTUNITY_HISTORY_PATH
  );
  return rows.filter((row) => row.symbol === symbol).sort(sortByTimestampThenType);
}

function toFundingHistoryRecord(market: FundingMarket, timestamp: number): FundingHistoryRecord {
  return {
    exchange: market.exchange,
    symbol: market.symbol,
    fundingRate: market.fundingRate,
    annualizedRate: calculateAnnualizedRate(market.fundingRate, market.fundingIntervalHours),
    markPrice: market.markPrice,
    volume24h: market.volume24h,
    openInterestUsd: market.openInterestUsd,
    nextFundingTime: market.nextFundingTime,
    timestamp
  };
}

function buildOpportunityHistoryRecords(
  spots: SpotMarket[],
  perps: FundingMarket[],
  timestamp: number
): OpportunityHistoryRecord[] {
  return [
    ...buildCrossOpportunityHistory(perps, timestamp),
    ...buildSpotPerpOpportunityHistory(spots, perps, timestamp)
  ];
}

function buildCrossOpportunityHistory(markets: FundingMarket[], timestamp: number): OpportunityHistoryRecord[] {
  const grouped = groupBy(markets, (market) => market.symbol);

  return Array.from(grouped.entries())
    .map(([symbol, rows]) => calculateCrossExchangeFundingSpread(symbol, rows))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((opportunity) => ({
      type: "cross-exchange" as const,
      symbol: opportunity.symbol,
      timestamp,
      annualizedSpread: opportunity.annualizedSpread,
      priceSpread: opportunity.priceSpread,
      score: opportunity.score,
      direction: opportunity.direction,
      shortExchange: opportunity.shortExchange,
      longExchange: opportunity.longExchange,
      exchangeCount: opportunity.exchangeCount,
      volume24h: opportunity.volume24h,
      openInterestUsd: opportunity.openInterestUsd
    }));
}

function buildSpotPerpOpportunityHistory(
  spots: SpotMarket[],
  perps: FundingMarket[],
  timestamp: number
): OpportunityHistoryRecord[] {
  const spotsByExchangeSymbol = new Map<string, SpotMarket>();
  for (const spot of spots) {
    const key = `${spot.exchange}:${spot.symbol}`;
    const existing = spotsByExchangeSymbol.get(key);
    if (!existing || (spot.volume24h ?? 0) > (existing.volume24h ?? 0)) {
      spotsByExchangeSymbol.set(key, spot);
    }
  }

  return perps
    .map((perp) => {
      const spot = spotsByExchangeSymbol.get(`${perp.exchange}:${perp.symbol}`);
      return spot ? calculateSpotPerpOpportunity(spot, perp) : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((opportunity) => ({
      type: "spot-perp" as const,
      symbol: opportunity.symbol,
      timestamp,
      annualizedRate: opportunity.annualized,
      priceSpread: opportunity.priceSpread,
      score: opportunity.score,
      spotExchange: opportunity.spotExchange,
      perpExchange: opportunity.perpExchange,
      exchangeCount: opportunity.exchangeCount,
      volume24h: opportunity.volume24h
    }));
}

async function appendJsonLines<T>(path: string, rows: T[]): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

async function readJsonLines<T>(path: string): Promise<T[]> {
  let content = "";
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJsonLine)
    .filter((row): row is T => Boolean(row));
}

function parseJsonLine<T>(line: string): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
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

function sortByTimestampThenExchange(a: FundingHistoryRecord, b: FundingHistoryRecord): number {
  return a.timestamp - b.timestamp || a.exchange.localeCompare(b.exchange);
}

function sortByTimestampThenType(a: OpportunityHistoryRecord, b: OpportunityHistoryRecord): number {
  return a.timestamp - b.timestamp || a.type.localeCompare(b.type);
}
