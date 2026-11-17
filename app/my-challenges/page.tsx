import {permanentRedirect} from 'next/navigation';
import {myChallengesPath} from '@/lib/routes';
export default function Page(){permanentRedirect(myChallengesPath);}
