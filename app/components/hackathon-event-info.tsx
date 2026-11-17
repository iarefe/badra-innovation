'use client';
import {rubric} from '@/lib/team-card';
import {Check} from 'lucide-react';
import {type CSSProperties} from 'react';
import {eventProgram,evaluationCriteria,eventPrize,programDayLabel} from '@/lib/hackathon-event';
import HomeTabs from './home-tabs';
import {useHomeCounters} from './use-home-motion';
type Block={'data-home-block':string;'data-entered':boolean};
const pitch=[{label:'التحدي',seconds:30,color:'#23484a'},{label:'استعراض الحل',seconds:90,color:'#c4692f'},{label:'الأثر والتطبيق',seconds:60,color:'#8fb3a9'}];
export function EventProgram({day,switched,selectDay,attrs}:{day:number;switched:boolean;selectDay:(day:number)=>void;attrs:Block}){
 const p=eventProgram[day];
 return <section className="bh-program bh-reveal" data-program-replay={switched} id="home-program" aria-labelledby="home-program-title" tabIndex={-1} {...attrs}>
  <div className="bh-program-head"><div><span className="bh-eyebrow">برنامج الحدث</span><h2 id="home-program-title" data-badra-anchor="home-program">يومان من الفهم إلى العرض</h2></div>
   <HomeTabs name="يوم البرنامج" group="bh-day-tabs" panelId="bh-program-panel" selected={day} choose={selectDay} options={eventProgram.map((d,i)=>({id:'bh-program-tab-'+i,label:<><b>{d.day}</b><span>{programDayLabel(d.dateTime)}</span></>}))}/>
  </div>
  <div className="bh-program-layout" key={p.id} id="bh-program-panel" role="tabpanel" aria-labelledby={'bh-program-tab-'+day}>
   <aside className="bh-day-intro"><span className="bh-day-index" aria-hidden="true">0{day+1}</span><h3>{p.title}</h3><p>{p.description}</p><div className="bh-day-outcome"><h4><Check size={17} aria-hidden="true"/>مخرجات اليوم</h4><p>{p.outcome}</p></div>
    {day===1&&<div className="bh-pitch"><h4>رتّب عرضك في ثلاث دقائق</h4><div className="bh-pitch-bars" aria-hidden="true">{pitch.map((x,i)=><span key={x.label} style={{flex:x.seconds,'--bar-color':x.color,'--delay':(.18+i*.32)+'s'} as CSSProperties}><i/></span>)}</div><dl>{pitch.map(x=><div key={x.label}><dt><i style={{background:x.color}}/>{x.label}</dt><dd>{x.seconds} ثانية</dd></div>)}</dl></div>}
   </aside>
   <ol className="bh-agenda">{p.items.map((item,i)=><li key={item.title} style={{'--delay':i*.09+'s','--line-time':(1.4/(p.items.length-1))+'s','--line-delay':(i*1.4/(p.items.length-1))+'s'} as CSSProperties}><span className="bh-agenda-number" aria-hidden="true">{i+1}</span><div className="bh-agenda-copy"><div><h4>{item.title}</h4><span className="bh-time">{item.time}</span></div><p>{item.description}</p></div></li>)}</ol>
  </div>
 </section>;
}
function Count({n}:{n:number}){return <><span data-home-count={n} aria-hidden="true">{n.toLocaleString('en-US')}</span><span className="sr-only">{n.toLocaleString('en-US')}</span></>}
export function EventEvaluation({attrs,skip,announced=false}:{attrs:Block;skip:boolean;announced?:boolean}){
 const criteria=announced?[...rubric.map(([label,,weight])=>({label,weight,evaluator:'لجنة التقييم'})),evaluationCriteria[6]]:evaluationCriteria;
 const host=useHomeCounters(attrs['data-entered'],skip);
 return <section className="bh-wrap bh-evaluation bh-area bh-reveal" ref={host} id="home-evaluation" aria-labelledby="home-evaluation-title" {...attrs}>
  <div className="bh-section-head"><div><span className="bh-eyebrow">الأثر أولًا</span><h2 id="home-evaluation-title" data-badra-anchor="evaluation">كيف يُقيَّم مشروعك؟</h2><p>تُقيَّم الحلول النهائية في ختام الهاكاثون، بعد بناء النماذج وعرضها.</p></div></div>
  <div className="bh-eval-layout"><div className="bh-rubric"><div className="bh-eval-split">{[[70,'لجنة التقييم'],[30,'الموظفون الحاضرون']].map(([n,label],i)=><div key={n} className={i?'bh-crowd':''}><strong><Count n={Number(n)}/><small>٪</small></strong><span>{label}</span></div>)}</div>
   <div className="bh-weight-split" aria-hidden="true"><div style={{flex:70}}><i/></div><div style={{flex:30}}><i/></div></div>
   <div className="bh-table-title"><h3>معايير التقييم وأوزانها</h3><span>7 معايير · 100%</span></div>
   <table className="bh-criteria"><caption className="sr-only">أوزان معايير تقييم المشروع والجهة المقيّمة</caption><thead className="sr-only"><tr><th>الرقم</th><th>المعيار والجهة المقيّمة</th><th colSpan={2}>الوزن</th></tr></thead><tbody>{criteria.map((c,i)=><tr key={c.label} className={i===6?'bh-crowd':''} style={{'--delay':i*.09+'s'} as CSSProperties}><td className="bh-row-num">{i+1}</td><th scope="row"><b>{c.label}</b><small>{c.evaluator}</small></th><td className="bh-weight-cell"><span aria-hidden="true" className="bh-weight-track"><i style={{width:(c.weight/30*100)+'%'}}/></span></td><td className="bh-percent"><bdi>{c.weight}%</bdi></td></tr>)}</tbody><tfoot><tr><th colSpan={3} scope="row">المجموع</th><td className="bh-percent"><bdi>100%</bdi></td></tr></tfoot></table>
   <p className="bh-outcomes-note">مخرجات المشاركة: بطاقة الابتكار، والنموذج الأولي، والعرض النهائي. ويُقدَّر إسهام كل عضو بحسب دوره في الفريق.</p>
  </div><aside className="bh-eval-side"><div className="bh-prize"><span>إجمالي الجوائز</span><div><strong><Count n={eventPrize}/></strong><b>ريال سعودي</b></div><p>نحتفي بمشاركتك، ونكرّم المشاريع الفائزة.</p></div><div className="bh-voting-note"><h3>لكل مرحلة تصويتها</h3><p>تصويت التحديات في المنصة يحدد ما تعمل عليه الفرق. أما تصويت الحضور في الختام فيدخل في تقييم الحلول النهائية وتحديد الفائزين.</p>{announced&&<a className="bh-link" href="/final-vote">صفحة تصويت الختام ←</a>}</div></aside></div>
 </section>;
}
