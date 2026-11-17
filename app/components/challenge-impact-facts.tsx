import {challengeImpactFacts,type Challenge} from '@/lib/challenges';
export default function ChallengeImpactFacts({challenge}:{challenge:Challenge}){
 return <dl className="challenge-impact-facts" aria-label="سياق الأثر">{challengeImpactFacts(challenge).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'غير محدد'}</dd></div>)}</dl>;
}
