import { Lunar, Solar } from "lunar-javascript";

export type EngineFortune = {
  pillar: string;
  startYear: number;
  endYear: number;
  startAge: number;
  endAge: number;
};

export type EngineBazi = {
  pillars: [string, string, string, string];
  lunarText: string;
  hiddenStems: [string, string, string, string];
  tenGods: [string, string, "日主", string];
  empty: { year: string; day: string };
  changSheng: string;
  start: { years: number; months: number; days: number; hours: number; solar: string };
  fortunes: EngineFortune[];
  direction: "顺排" | "逆排";
};

function dateParts(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute };
}

function lunarText(lunar: any) {
  return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
}

export function solarFromLunarDate(year: number, month: number, day: number, isLeapMonth: boolean) {
  const lunar = Lunar.fromYmd(year, isLeapMonth ? -month : month, day);
  const solar = lunar.getSolar();
  return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`;
}

/**
 * 流年以立春换年。取当年 7 月 1 日可稳定落在该节气年内，避免把公历元旦误当流年分界。
 */
export function calculateAnnualPillar(year: number) {
  const solar = Solar.fromYmdHms(year, 7, 1, 12, 0, 0);
  const eightChar = solar.getLunar().getEightChar();
  eightChar.setSect(2);
  return eightChar.getYear();
}

/**
 * 与跃渊 Skill 的 bazi_engine.py 保持同一套 6tail 历法口径：
 * 使用校正后的本地真太阳时、节气精确四柱，且起运采用 sect=2 分钟级换算。
 */
export function calculateBazi(date: string, time: string, gender: "男" | "女"): EngineBazi {
  const { year, month, day, hour, minute } = dateParts(date, time);
  const solar = Solar.fromYmdHms(year, month, day, hour, minute, 0);
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(2);
  const yun = eightChar.getYun(gender === "男" ? 1 : 0, 2);
  const startSolar = yun.getStartSolar();
  const pillars = [eightChar.getYear(), eightChar.getMonth(), eightChar.getDay(), eightChar.getTime()] as [string, string, string, string];
  const fortunes = yun.getDaYun().filter((item: any) => item.getGanZhi()).map((item: any) => ({
    pillar: item.getGanZhi(),
    startYear: item.getStartYear(),
    endYear: item.getEndYear(),
    startAge: item.getStartAge(),
    endAge: item.getEndAge(),
  }));
  const yearStem = pillars[0][0];
  const yangYear = "甲丙戊庚壬".includes(yearStem);
  const forward = (yangYear && gender === "男") || (!yangYear && gender === "女");

  return {
    pillars,
    lunarText: lunarText(lunar),
    hiddenStems: [eightChar.getYearHideGan(), eightChar.getMonthHideGan(), eightChar.getDayHideGan(), eightChar.getTimeHideGan()].map((stems: string[] | string) => Array.isArray(stems) ? stems.join("") : stems) as [string, string, string, string],
    tenGods: [eightChar.getYearShiShenGan(), eightChar.getMonthShiShenGan(), "日主", eightChar.getTimeShiShenGan()],
    empty: { year: eightChar.getYearXunKong(), day: eightChar.getDayXunKong() },
    changSheng: eightChar.getMonthDiShi(),
    start: {
      years: yun.getStartYear(),
      months: yun.getStartMonth(),
      days: yun.getStartDay(),
      hours: yun.getStartHour(),
      solar: startSolar.toYmdHms(),
    },
    fortunes,
    direction: forward ? "顺排" : "逆排",
  };
}
