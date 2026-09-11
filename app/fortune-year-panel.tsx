import {useState} from 'react';
import type {LocalReport} from './analysis';
import {fortuneYears,yearLabels} from './fortune-years';
function PowerConditions({power}:{power:LocalReport['fortunes'][number]['influences'][number]}){
 return <div className="power-conditions"><div className="power-badges"><span><small>力量条件</small><b>{power.level}</b></span><span><small>月令</small><b>{power.season}</b></span><span><small>根气位置</small><b>{power.roots.length}处 · {power.roots.filter(r=>r.depth===0).length}处本气</b></span></div><small>根气处数是位置记录，不按数量相加评分；力量为定性分级。</small><details><summary>查看力量依据与限制</summary><ul>{power.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul><p>{power.caveat}</p></details></div>;
}
export function FortuneYearPanel({report,fortune}:{report:LocalReport;fortune:{pillar:string;startsAt:string;endsAt:string}}){
 const [selected,setSelected]=useState<number|null>(null);
 const years=fortuneYears(report.timing,fortune);
 const current=years.find(y=>y.year===selected);
 const transition=report.transitions.find(t=>t.at===fortune.startsAt);
 const reviewed=report.fortunes.find(f=>f.startsAt===fortune.startsAt);
 return <section className="fortune-year-panel">
  <div className="fortune-overview"><span className="overview-symbol" aria-hidden="true">↗</span><div><h4>这步大运的整体变化</h4><p>{transition?transition.changed?'与上一运相比，'+(transition.directionChanged?'支持与制约方向有变化':transition.mechanismsChanged?'原有配合条件有变化':'对原局的作用位置或关系有变化')+'。':'与上一运相比，暂未识别到明确的阶段差异。':'这是第一步大运，以本命盘为比较起点。'}{reviewed?'本运取用方向：'+reviewed.mode+'。':''}</p><details><summary>查看比较依据</summary><ul>{(transition?.evidence||[reviewed?.reason||'暂无比较依据']).map((e,i)=><li key={i}>{e}</li>)}</ul></details></div></div>
  {reviewed?.influences.map(power=><div key={power.pillar}><h4>{power.stem}{power.god} · 本运力量条件</h4><PowerConditions power={power} /></div>)}
  <div className="year-window-heading"><h4>这步运里值得留意的年份</h4><small>已检查本运全部流年 · 点击年份查看</small></div>
  {years.length?<div className="year-window-track">{years.map(y=><button type="button" key={y.year} className={'year-window-card'+(selected===y.year?' selected':'')} aria-expanded={selected===y.year} aria-controls="fortune-year-detail" onClick={()=>setSelected(selected===y.year?null:y.year)}><strong>{y.year}</strong><span>{y.pillar}年</span><div>{y.labels.map(label=><span className={'year-topic '+(label==='事业'?'career':label==='感情'?'relationship':'overall')} key={label}>{label==='事业'?'▣ ':label==='感情'?'♡ ':'◇ '}{label}</span>)}</div></button>)}</div>:<p className="year-window-empty">本运暂未筛出依据较明确的变化年份，不强行标注。</p>}
  {current&&<div id="fortune-year-detail" className="year-window-detail"><h4>{current.year} · {current.labels.join(' / ')}</h4>{current.windows.map((w,i)=><div className="year-impact" key={i}><div className="impact-title"><b>{w.impact.title}</b><span>{w.impact.tone}</span></div><PowerConditions power={w.impact.power} /><h5>可能对应什么</h5><ul className="impact-scenarios">{w.impact.scenarios.map((scenario,j)=><li key={j}>{scenario}</li>)}</ul><p className="impact-observe"><b>具体观察：</b>{w.impact.observe}</p><small>{w.startsAt.slice(0,10)} 至 {w.endsAt.slice(0,10)} 前 · 以立春与实际交运时刻分段</small><details><summary>为什么这样判断</summary><p>{w.reason}</p><ul>{w.impact.basis.map((e,j)=><li key={j}>{e}</li>)}</ul><p>{w.impact.caveat}</p></details></div>)}</div>}
  <small className="year-window-note">标记表示岁运作用值得留意，不代表事件必然发生，也不代表未标记年份没有变化。</small>
 </section>;
}
