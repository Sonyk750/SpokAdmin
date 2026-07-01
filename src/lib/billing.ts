export type SpokPlan = "start" | "standard" | "pro";

export interface PlanInfo {
  name: string;
  priceRon: number;
  maxAp: number | null;
  maxAsociatii: number | null;
}

export const SPOK_PLANS: Record<SpokPlan, PlanInfo> = {
  start:    { name: "Start",    priceRon: 0,   maxAp: 20,   maxAsociatii: 1    },
  standard: { name: "Standard", priceRon: 99,  maxAp: 50,   maxAsociatii: null },
  pro:      { name: "Pro",      priceRon: 199, maxAp: 150,  maxAsociatii: null },
};

export function ronToBani(ron: number): number {
  return Math.round(ron * 100);
}
