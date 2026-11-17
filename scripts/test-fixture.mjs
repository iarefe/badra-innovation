import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);const {build}=createRequire(require.resolve('wrangler/package.json'))('esbuild');
export const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
// The event has a real closing date. Existing onboarding, voting and editing scenarios run during
// its submission window regardless of CI date; explicit boundary tests can move the two clocks.
const wallNow=Date.now.bind(Date),origin=wallNow(),eventNow=Date.parse('2026-11-04T12:00:00+03:00');
Date.now=()=>eventNow+wallNow()-origin;
sql.function('unixepoch',when=>{if(when!=='now')throw Error('Unexpected SQL test clock');return Math.floor(Date.now()/1000)});

for(const p of readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync('drizzle/'+p,'utf8'));
// Legacy scenarios explicitly start with both participation controls open.
sql.exec("INSERT OR IGNORE INTO workshop_settings(id,title,count,open,joining_open,engagement_controls_initialized,finalized,revision) VALUES(1,'هاكاثون الاختبار',3,1,1,1,0,0)");
export const digest=s=>createHash('sha256').update(s).digest('hex');
export const env=globalThis.CHALLENGE_TEST_ENV={MANAGER_PHONES:'+966599999901,+966599999902,+966599999903',WORKSHOP_ADMIN_EMAILS:'manager@test.local',DB:{prepare(query){let args=[];const stmt={bind(...values){args=values;return stmt},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)||null},async run(){const s=sql.prepare(query);if(/\bRETURNING\b/i.test(query)){const results=s.all(...args);return {results,meta:{changes:results.length}}}const r=s.run(...args);return {meta:{changes:Number(r.changes)}}}};return stmt},async batch(statements){sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}}};
export async function load(path){const b=await build({entryPoints:[path],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'test',namespace:'env'}));b.onLoad({filter:/.*/,namespace:'env'},()=>({contents:'export const env=globalThis.CHALLENGE_TEST_ENV;'}));}}]});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));}
export function seedNetwork(){sql.prepare('INSERT OR REPLACE INTO participation_settings(id,networks,revision) VALUES(1,?,0)').run(JSON.stringify(['203.0.113.0/24','2001:db8::/48']));}
export const phoneFor=number=>'+96650'+String(number).padStart(7,'0');
export function seedEmployee(number){const id=randomUUID(),secret=digest('session:'+number);sql.prepare('INSERT INTO employees(id,number,name,email,department,phone,active,created_at) VALUES(?,?,?,?,?,?,1,?)').run(id,number,'موظف الاختبار '+number,number+'@test.local','إدارة الاختبار',phoneFor(number),Date.now());sql.prepare('UPDATE employees SET roles=? WHERE id=?').run(JSON.stringify(['innovator']),id);sql.prepare('INSERT INTO employee_sessions(digest,employee_id,expires_at) VALUES(?,?,?)').run(digest(secret),id,Date.now()+3600000);return {id,secret,number,phone:phoneFor(number)};}
let managerSession;
export function req(user,body,method='POST',options={}){if(user==='manager'){if(!managerSession){managerSession=seedEmployee('manager');sql.prepare('UPDATE employees SET phone=? WHERE id=?').run('+966599999901',managerSession.id);}user=managerSession;}return new Request('https://site.test/api',{method:body?method:'GET',headers:{'Content-Type':'application/json',origin:options.origin||'https://site.test','cf-connecting-ip':options.ip??'203.0.113.5',...(user==='manager'?{'oai-authenticated-user-id':'manager','oai-authenticated-user-email':'manager@test.local'}:{}),...(user?.secret?{cookie:'__Host-badra-employee='+user.secret}:{}),...options.headers},...(body?{body:JSON.stringify(body)}:{})});}
