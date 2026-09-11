import type {QimenChart} from './qimen-engine';
import {explainQimenPalace} from './qimen-reading';

export function QimenPanel({chart,selectedId,onSelect}:{chart:QimenChart;selectedId:number;onSelect:(id:number)=>void}){
  const detail=explainQimenPalace(chart,selectedId);
  const palaceName=(id:number)=>chart.palaces.find(p=>p.id===id)!.name;
  return <div className="qimen-panel">
    <header className="qimen-heading"><div><span>出生奇门 · 时家转盘</span><h3>{chart.yang?'阳遁':'阴遁'}{chart.ju}局 <small>{chart.term} · {chart.yuan}</small></h3><p>真太阳时 {chart.date} {chart.time} · {chart.pillars.join(' / ')}</p></div><div className="qimen-chiefs"><span>值符 <b>{chart.chiefStar}</b> · {palaceName(chart.chiefStarPalace)}</span><span>值使 <b>{chart.chiefDoor}</b> · {palaceName(chart.chiefDoorPalace)}</span></div></header>
    <div className="qimen-workspace">
      <div><p className="qimen-orientation">上南下北 · 左东右西 · 点击宫位查看</p>
        <div className="qimen-grid" aria-label="奇门九宫">
          {chart.palaces.map(p=><button type="button" key={p.id} className={`qimen-palace ${selectedId===p.id?'selected':''} ${p.id===5?'qimen-center':''}`} aria-pressed={selectedId===p.id} aria-controls="qimen-detail" onClick={()=>onSelect(p.id)}>
            <span className="qimen-palace-head"><b>{p.name}</b><small>{p.direction} · {p.element}</small></span>
            {p.id===5?<><strong>中宫寄坤</strong><span>地盘 {p.earthStem}</span><small>天禽随天芮<br/>现寄{palaceName(chart.guestPalace)}</small></>:<><span className="qimen-deity">{p.deity}{p.id===chart.chiefStarPalace?' · 值符星':''}</span><strong>{p.star}{p.guestStar&&<small> + 禽</small>}</strong><span className="qimen-door">{p.door}{p.id===chart.chiefDoorPalace&&<small> · 值使</small>}</span><span className="qimen-stems"><span>天 {p.heavenStem}</span><span>地 {p.earthStem}</span></span>{p.guestStem&&<small>寄干 {p.guestStem}</small>}</>}
          </button>)}
        </div>
      </div>
      <article className="qimen-detail" id="qimen-detail" aria-live="polite" aria-atomic="true">
        <span>宫位解析</span><h3>{detail.title}</h3><p className="qimen-summary">{detail.summary}</p>
        <h4>本盘依据</h4><ul>{detail.evidence.map(e=><li key={e}>{e}</li>)}</ul>
        <h4>门宫关系</h4><p>{detail.relation}</p>
        <h4>如何用来反思</h4><p>{detail.advice}</p>
        <details key={selectedId}><summary>查看宫位、门星神的含义</summary><dl>{detail.terms.map(t=><div key={t.label}><dt>{t.label}</dt><dd>{t.text}</dd></div>)}</dl></details>
      </article>
    </div>
    <section className="qimen-notes" id="reading"><h3>这张出生局怎么看</h3><p>先看值符、值使，再点击各宫核对门、星、神与天盘、地盘的组合。九宫是方位与结构，不直接等同于紫微的命宫、夫妻宫或财帛宫。</p><details><summary>排盘口径与解读范围</summary><p>{chart.method}。当前节气从北京时间 {chart.termAt} 起；出生标准时 {chart.standardDate} {chart.standardTime}。以真太阳时的日柱推甲己符头：{chart.fuTou}，定{chart.yuan}。奇门采用23点子初换日，与八字的晚子时口径可能不同。</p><p>天禽与中宫干寄坤，随天芮转动；八神用白虎、玄武这一组名称。首版支持1900—2100年，沿用页面城市经度近似校时，未额外校正历史夏令时。与其他软件核对时，应先统一这些设置。</p><p>当前提供符号释义、门宫生克和可见组合解释；尚未覆盖完整十干克应、旺衰、空亡、击刑、入墓、应期及多流派断局。出生局不能替代事件起局，也不据此确定疾病、灾祸或人生结局。</p></details></section>
  </div>;
}
