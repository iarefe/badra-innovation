import {programSpokenDates} from '@/lib/hackathon-event';
import type {Metadata} from 'next';
import EventTabIcon from './components/event-tab-icon';
import './ux-foundation.css';
import './globals.css';
import './event-brand.css';
import './challenge-detail.css';
import './hackathon-home.css';
import './challenge-assistant.css';
import './admin-dashboard.css';
import './published-results.css';
import './participation-colors.css';
import './challenge-category.css';
import './challenge-revision.css';
export const metadata:Metadata={
 title:'هاكاثون الابتكار الرقمي | الجهة المنظمة',
 description:'من التحدي إلى الحل. هاكاثون الابتكار الرقمي لموظفي الجهة المنظمة، '+programSpokenDates+'.',
 icons:{icon:{url:'/placeholder.svg',type:'image/svg+xml',sizes:'any'}},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}<EventTabIcon/></body></html>}
