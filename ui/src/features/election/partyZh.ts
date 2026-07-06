// Chinese labels for the coalitions/parties in the Johor race, keyed by the
// feed's numeric party id (see constants/parties.ts). Used as a fallback when a
// candidate can't be matched by name in hotspotNames.ts, and for the scoreboard
// tally bar labels (which key off the winning candidate's coalition id).

export const PARTY_ZH: Record<number, string> = {
  1: "国阵", // BN
  42: "希盟", // PH
  55: "国盟", // PN
  9: "独立", // BEBAS
  65: "MUDA",
  21: "社会主义党", // PSM
  89: "同心党", // KDM
  69: "民族党", // PBM
  57: "斗士党", // PEJUANG
  // Component parties (in case the feed reports these instead of the coalition):
  43: "巫统", // UMNO
  44: "马华", // MCA
  45: "国大党", // MIC
  12: "公正党", // PKR
  3: "行动党", // DAP
  23: "诚信党", // AMANAH
  2: "伊党", // PAS
  34: "土团党", // PPBM/BERSATU
  47: "民政党", // GERAKAN
};

export function partyZh(partyId: number | null | undefined): string | null {
  if (partyId == null) return null;
  return PARTY_ZH[partyId] ?? null;
}
