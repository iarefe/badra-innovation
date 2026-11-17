import {env} from 'cloudflare:workers';

const base='https://api.authentica.sa/api/v2';
const apiKey=()=>String((env as any).BATHRA_OTP||'').trim();
export const otpConfigured=()=>!!apiKey();
type Operation='send'|'verify'|'balance';
const reasons={
 missing_key:'أضف مفتاح Authentica في المتغير السري BATHRA_OTP.',
 unauthorized:'رفضت Authentica المفتاح. تحقق من قيمة BATHRA_OTP وصلاحيته.',
 forbidden:'رفضت Authentica صلاحية الطلب. راجع صلاحيات المفتاح وتفعيل الحساب وقناة الإرسال.',
 rate_limited:'وصلت خدمة Authentica إلى حد الطلبات. انتظر قليلًا ثم حاول مجددًا.',
 insufficient_balance:'أفادت Authentica بعدم كفاية الرصيد. اشحن رصيد حساب الخدمة ثم أعد المحاولة.',
 invalid_phone:'رفضت Authentica رقم الجوال. تحقق من الرقم ومفتاح الدولة.',
 invalid_channel:'رفضت Authentica قناة الإرسال. تحقق من تفعيل SMS أو واتساب في حساب الخدمة.',
 invalid_template:'رفضت Authentica قالب الرسالة. تحقق من إعداد القالب الافتراضي في حساب الخدمة.',
 invalid_sender:'رفضت Authentica إعداد المرسل. تحقق من تفعيل المرسل في حساب الخدمة.',
 request_rejected:'رفضت Authentica بيانات الطلب. راجع إعدادات القناة والمرسل والقالب في حساب الخدمة.',
 upstream_error:'تعذّرت العملية لدى Authentica. أعد المحاولة لاحقًا أو راجع حالة الخدمة.',
 connection_failed:'تعذّر الاتصال بخدمة Authentica. حاول لاحقًا.',
 unexpected_redirect:'أعادت Authentica توجيه الطلب إلى عنوان آخر. أُوقف الطلب لحماية بيانات التحقق؛ راجع عنوان الخدمة.',
 timeout:'انتهت مهلة الاتصال بخدمة Authentica. حاول لاحقًا.',
 invalid_response:'تعذّر قراءة استجابة صالحة من Authentica. حاول لاحقًا.',
 delivery_not_confirmed:'لم تؤكد Authentica إرسال الرمز. راجع إعدادات قناة الإرسال ورصيد الحساب.',
 internal_error:'تعذّر تجهيز طلب التحقق. راجع سجل التطبيق.'
};
type Reason=keyof typeof reasons;
export class OtpProviderError extends Error {
 constructor(readonly reason:Reason,readonly reference:string){super(`${reasons[reason]} رقم المتابعة: ${reference}`);}
}
// Only fixed categories and HTTP status are logged. Never log provider bodies,
// exceptions, request headers, phone numbers, codes, or credentials.
function failure(reason:Reason,operation:Operation,status:number|null=null){
 const reference=crypto.randomUUID();
 console.error(JSON.stringify({event:'authentica_failure',reference,operation,reason,httpStatus:status}));
 return new OtpProviderError(reason,reference);
}
export function otpFailureMessage(error:unknown,operation:'send'|'verify'){
 const e=error instanceof OtpProviderError?error:failure('internal_error',operation);
 const message=e.reason==='invalid_phone'?'تحقق من رقم الجوال ومفتاح الدولة ثم حاول مجددًا.':
 e.reason==='rate_limited'?'طلبات كثيرة لدى خدمة التحقق. انتظر قليلًا ثم حاول مجددًا.':
 ['missing_key','unauthorized','forbidden','invalid_channel','invalid_template','invalid_sender','request_rejected','insufficient_balance'].includes(e.reason)?'خدمة التحقق تحتاج مراجعة من مدير النظام. أرسل له رقم المتابعة أدناه.':
 'تعذّر الاتصال بخدمة التحقق أو إكمال الطلب الآن. حاول لاحقًا، وإن تكرر الخطأ أرسل رقم المتابعة لمدير النظام.';
 return `${message} رقم المتابعة: ${e.reference}`;
}
// Read known error fields only to classify the failure; never return their text.
function bodyReason(data:any):Reason|null{
 const messages=[data?.message,data?.error,Array.isArray(data?.errors)?data.errors.map((e:any)=>e?.message).join(' '):null].filter(x=>typeof x==='string').join(' ').toLowerCase();
 if(/insufficient (?:balance|credit|funds)|(?:balance|credit) (?:is )?(?:insufficient|not enough)|not enough (?:balance|credit)|رصيد غير كاف|الرصيد غير كاف/.test(messages))return 'insufficient_balance';
 const fields=data?.errors;
 if(fields&&typeof fields==='object'&&!Array.isArray(fields)){
  if(Object.hasOwn(fields,'phone'))return 'invalid_phone';
  if(Object.hasOwn(fields,'method'))return 'invalid_channel';
  if(Object.hasOwn(fields,'template_id'))return 'invalid_template';
  if(Object.hasOwn(fields,'sender_name'))return 'invalid_sender';
 }
 return null;
}
async function request(path:string,operation:Operation,body?:Record<string,string>){
 const key=apiKey();
 if(!key)throw failure('missing_key',operation);
 let response:Response;
 // Workers rejects redirect:'error' before sending any request. Use manual
 // mode and reject redirects explicitly so credentials never follow Location.
 try{response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{'X-Authorization':key,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});}
 catch(e){throw failure(e instanceof Error&&['TimeoutError','AbortError'].includes(e.name)?'timeout':'connection_failed',operation);}
 if(response.status>=300&&response.status<400)throw failure('unexpected_redirect',operation,response.status);
 if(response.status===401)throw failure('unauthorized',operation,response.status);
 if(response.status===403)throw failure('forbidden',operation,response.status);
 if(response.status===429)throw failure('rate_limited',operation,response.status);
 let data:any;
 try{data=await response.json();}catch{throw failure(response.ok?'invalid_response':'upstream_error',operation,response.status);}
 if(!response.ok)throw failure(bodyReason(data)||(response.status>=400&&response.status<500?'request_rejected':'upstream_error'),operation,response.status);
 return {data,status:response.status};
}
export async function sendOtp(phone:string,otp:string,method:'sms'|'whatsapp'){
 const {data,status}=await request('/send-otp','send',{method,phone,otp});
 if(data?.success!==true)throw failure(bodyReason(data)||'delivery_not_confirmed','send',status);
}
export async function verifyOtp(phone:string,otp:string){
 const {data,status}=await request('/verify-otp','verify',{phone,otp});
 if(typeof data?.status!=='boolean')throw failure(bodyReason(data)||'invalid_response','verify',status);
 return data.status===true;
}
export async function checkOtpConnection(){
 const {data,status}=await request('/balance','balance');
 if(data?.success!==true||typeof data?.data?.balance!=='number'||!Number.isFinite(data.data.balance))throw failure('invalid_response','balance',status);
 return data.data.balance>0?'نجح الاتصال بـ Authentica والتحقق من المفتاح. يلزم اختبار وصول رمز إلى جوالك للتأكد من قناة الإرسال.':'نجح الاتصال بـ Authentica، لكن الرصيد غير كافٍ. اشحن الحساب ثم اختبر وصول الرمز.';
}
