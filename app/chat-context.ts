export interface ChartContext {
  bazi: string[];
  ziweiSummary: string;
  fortuneSummary: string;
  gender: "女" | "男";
}

export function buildChatContext(input: {
  pillars: string[];
  ziweiSoul?: string;
  ziweiBody?: string;
  selectedPalace: string;
  favorable: string[];
  avoid: string[];
  strength: string;
  fortuneStages: string[];
  gender: "女" | "男";
}): ChartContext {
  const bazi = input.pillars.map((pillar) => pillar.trim()).filter(Boolean).slice(0, 4);
  const ziweiParts = [
    input.ziweiSoul ? `命主星${input.ziweiSoul}` : "",
    input.ziweiBody ? `身主星${input.ziweiBody}` : "",
    input.selectedPalace ? `当前查看${input.selectedPalace}` : "",
  ].filter(Boolean);
  const fortuneSummary = input.fortuneStages.filter(Boolean).slice(0, 3).join("；");

  return {
    bazi,
    ziweiSummary: ziweiParts.join("；") || "紫微资料暂不完整",
    fortuneSummary: `旺衰判断为${input.strength}；喜${input.favorable.join("、") || "待定"}，需节制${input.avoid.join("、") || "待定"}。${fortuneSummary || "大运资料暂不完整"}`,
    gender: input.gender,
  };
}
