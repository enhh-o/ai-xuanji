export interface ChartContext {
  analysisSystem: 'bazi'|'ziwei'|'qimen'|'combined';
  qimenSummary: string;
  chartDetails: string;
  annualSummary: string;
  bazi: string[];
  ziweiSummary: string;
  fortuneSummary: string;
  gender: "女" | "男";
}

export function buildChatContext(input: {
  analysisSystem?: 'bazi'|'ziwei'|'qimen';
  qimenSummary?: string;
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

  const result: ChartContext = {
    analysisSystem: input.analysisSystem || 'combined',
    qimenSummary: input.analysisSystem === 'qimen' ? input.qimenSummary || '奇门尚未就绪，不得补造九宫' : '',
    chartDetails: input.chartDetails || "未提供",
    annualSummary: input.annualSummary || "未提供",
    bazi,
    ziweiSummary: input.ziweiReady ? [...ziweiParts, ...(input.palaceSummaries || []).slice(0, 12)].join("；") : "紫微排盘尚未就绪，不得使用示例星曜推断",
    fortuneSummary: `程序初判（待核对）：旺衰${input.strength}；仅按常规扶抑列候选五行${input.favorable.join("、") || "待定"}，制耗方向${input.avoid.join("、") || "待定"}，不是最终喜忌，请复核格局、制化与调候后独立裁决。大运：${fortuneSummary || "大运资料暂不完整"}`,
    gender: input.gender,
  };
  if (input.analysisSystem === 'qimen' || input.analysisSystem === 'ziwei') {
    result.chartDetails='';result.fortuneSummary='';result.annualSummary='';
  }
  if (input.analysisSystem === 'qimen' || input.analysisSystem === 'bazi') result.ziweiSummary='';
  return result;
}
