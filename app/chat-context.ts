export interface ChartContext {
  chartDetails: string;
  annualSummary: string;
  bazi: string[];
  ziweiSummary: string;
  fortuneSummary: string;
  gender: "女" | "男";
}

export function buildChatContext(input: {
  chartDetails?: string;
  annualSummary?: string;
  palaceSummaries?: string[];
  ziweiReady?: boolean;
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
  const fortuneSummary = input.fortuneStages.filter(Boolean).slice(0, 12).join("；");

  return {
    chartDetails: input.chartDetails || "未提供",
    annualSummary: input.annualSummary || "未提供",
    bazi,
    ziweiSummary: input.ziweiReady ? [...ziweiParts, ...(input.palaceSummaries || []).slice(0, 12)].join("；") : "紫微排盘尚未就绪，不得使用示例星曜推断",
    fortuneSummary: `程序初判（待核对）：旺衰${input.strength}；喜${input.favorable.join("、") || "待定"}，慎用${input.avoid.join("、") || "待定"}。大运：${fortuneSummary || "大运资料暂不完整"}`,
    gender: input.gender,
  };
}
