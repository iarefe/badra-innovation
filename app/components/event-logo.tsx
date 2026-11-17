import type {LogoPlacement} from '@/lib/event-logo';
export function EventWordmark(){return <span className="brand-product"><strong>هاكاثون</strong><small>الابتكار الرقمي</small></span>;}
export default function EventLogo(_props:{placement:LogoPlacement;paused?:boolean}){return <EventWordmark/>;}
