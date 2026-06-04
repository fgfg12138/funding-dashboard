import { getBasisOpportunitiesResponse } from "../basis/basisApi";
import { getCrossExchangeOpportunities, getFundingSnapshot, getSpotPerpOpportunities } from "../data/fundingService";
import type { BasisOpportunity } from "../basis/types";
import type { CrossExchangeOpportunity, SpotPerpOpportunity } from "../exchanges/types";
import { buildUnifiedOpportunities } from "./unifiedOpportunities";
import type { UnifiedOpportunity } from "./types";

export type UnifiedOpportunitySourcePayload = {
  cross: CrossExchangeOpportunity[];
  spotPerp: SpotPerpOpportunity[];
  basis: BasisOpportunity[];
  errors: string[];
};

export type UnifiedOpportunitiesApiResponse = {
  data: UnifiedOpportunity[];
  errors: string[];
  updatedAt: number;
};

export type UnifiedOpportunitiesApiOptions = {
  sourceLoader?: () => Promise<UnifiedOpportunitySourcePayload>;
  now?: number;
};

export async function getUnifiedOpportunitiesResponse(
  options: UnifiedOpportunitiesApiOptions = {}
): Promise<UnifiedOpportunitiesApiResponse> {
  const now = options.now ?? Date.now();
  const sources = await (options.sourceLoader ?? loadUnifiedOpportunitySources)();

  return {
    data: buildUnifiedOpportunities(sources),
    errors: sources.errors.filter((error): error is string => Boolean(error)),
    updatedAt: now
  };
}

async function loadUnifiedOpportunitySources(): Promise<UnifiedOpportunitySourcePayload> {
  const [cross, spotPerp, basisResponse, snapshot] = await Promise.all([
    getCrossExchangeOpportunities(),
    getSpotPerpOpportunities(),
    getBasisOpportunitiesResponse(),
    getFundingSnapshot()
  ]);

  return {
    cross,
    spotPerp,
    basis: basisResponse.data,
    errors: [...snapshot.errors, ...basisResponse.errors].filter((error): error is string => Boolean(error))
  };
}
