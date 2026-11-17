import {participantRoles} from '@/lib/participant-roles';

export default function HomeRoleGuide({attrs,teamPhase=false}:{teamPhase?:boolean;attrs:{'data-home-block':string;'data-entered':boolean}}){
 return <section className="bh-wrap bh-area bh-role-guide bh-reveal" id="home-roles" aria-labelledby="bh-role-guide-title" {...attrs}>
  <header><span className="bh-eyebrow">أدوار الفريق</span><h2 id="bh-role-guide-title">{teamPhase?'من يعمل على التحدي؟':'لا تحتاج إلى خبرة برمجية لتشارك'}</h2>
  <p>{teamPhase?'يتكامل عمل الفريق من فهم المشكلة إلى بناء الحل وتقديمه.':'لكل دور مكانه في الفريق، وتختار أدوارك عند التسجيل.'}</p></header>
  <dl>{participantRoles.map((role,index)=><div key={role.id}><dt><span className="bh-role-number" aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{role.label}</dt><dd>{role.description}</dd></div>)}</dl>
 </section>;
}
