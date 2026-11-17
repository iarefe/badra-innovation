export type EntryState='entered'|'waiting'|'unknown';
export type EmployeePresence={accountId?:string;prospectId?:string;identityConfirmed?:boolean;name:string;status:EntryState;lastAccessAt:number|null;note:string};
export type EmployeeReach={total:number;entered:number;waiting:number;unknown:number;confirmed:number;accounts?:EmployeePresence[];rows:EmployeePresence[];outside:EmployeePresence[]};
export const entryLabels:Record<EntryState,string>={entered:'دخل المنصة',waiting:'لم يدخل بعد',unknown:'بحاجة إلى تحقق'};
const dt=new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Riyadh'});
export function accessTime(row:EmployeePresence){
 if(row.lastAccessAt!==null)return dt.format(row.lastAccessAt);
 return row.status==='entered'?'دخول سابق موثّق؛ وقته غير محفوظ':row.status==='unknown'?row.note:'—';
}
