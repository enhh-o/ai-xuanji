import type {LocalReport} from './analysis';
import {nodeText} from './analysis/facts';
const status={supported:'条件支持',candidate:'仍需辨别',rejected:'本轮不成立',absent:'未见'};
export function LocalReview({report,ziweiFacts={}}:{report:LocalReport;ziweiFacts?:Record<string,string[]>}){
  const evidence=(ids:string[])=>[...new Set(ids)].map(id=>report.facts.nodes.find(n=>n.id===id)).filter(Boolean).map(n=>nodeText(n!)).join('；');
  return <article className="full-review-card local-review">
    <h3>全盘复核与综合解读</h3>
    <p>{report.natal.base} · {report.natal.strength}。{report.useful.summary}</p>
    <small>本地规则解读，不调用 AI。紫微仍在命盘宫位中单独查看。</small>
    <details><summary>查看综合解读与具体依据</summary>
      <div className="local-domain-grid">{report.domains.map(d=><section key={d.key}><small>{d.label}</small><h4>{d.headline}</h4><p>{d.summary}</p><p><b>建议：</b>{d.advice}</p><details><summary>本盘依据与岁运观察</summary><ul>{d.evidence.map((s,i)=><li key={i}>{s}</li>)}</ul><p>{d.period}</p><p>{d.caveat}</p>{ziweiFacts[d.key]?.length ? <p>紫微盘面补充（不冒充岁运四化）：{ziweiFacts[d.key].join('；')}</p> : null}</details></section>)}</div>
      <details><summary>格局与制化配合</summary><p>{report.pattern.status}。{report.pattern.summary}</p>{[...report.pattern.mechanisms,...report.pattern.diseases,...report.special].filter(x=>x.status!=='absent').map(x=><section key={x.id}><h4>{x.name} · {status[x.status]}</h4><p>{x.summary}</p><p>{evidence(x.evidence)}</p>{x.against.length>0&&<p>限制条件：{x.against.join('；')}</p>}</section>)}</details>
      <details><summary>六个角度核对取用</summary>{report.useful.dimensions.map(d=><section key={d.id}><h4>{d.name} · {d.elements.join('、')||'不单独指定五行'}</h4><p>{d.summary}</p><p>{evidence(d.evidence)}</p>{d.against.length>0&&<p>限制：{d.against.join('；')}</p>}</section>)}{report.useful.conflicts.map(c=><p key={c}>{c}</p>)}</details>
      <details><summary>调候参考</summary><p>{report.climate.summary}</p><p>{report.climate.note}</p>{report.climate.entries.map(e=><p key={e.stem}>{e.stem}（{e.element}）：{e.presence}；{e.reason}</p>)}</details>
      <details><summary>流年与交运分段</summary>{report.timing.map(s=><section key={s.startsAt}><h4>{s.year} · {s.pillar} · {s.fortune? s.fortune+'运':'未起运或超出大运资料'}</h4><small>{s.startsAt} 至 {s.endsAt} 前</small><p>{s.summary}</p><details><summary>本段新增关系</summary><ul>{s.evidence.map((e,i)=><li key={i}>{e}</li>)}</ul></details></section>)}</details>
      <details><summary>解读范围与限制</summary><ul>{report.limits.map(s=><li key={s}>{s}</li>)}</ul></details>
    </details>
  </article>;
}
