import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {load,sql} from './test-fixture.mjs';
const {ChatSessionRegistry}=await load('lib/client-chat-session.ts');
const {getCompanionSteps}=await load('lib/companion-guidance.ts');
const {placeCompanion}=await load('lib/companion-position.ts');
const {emptyChatDraft}=await load('lib/ai-challenge.ts');
const {exampleChallenges}=await load('lib/challenges.ts');
class MemoryStorage{items=new Map();get length(){return this.items.size}key(i){return [...this.items.keys()][i]??null}getItem(k){return this.items.get(k)??null}setItem(k,v){this.items.set(k,v)}removeItem(k){this.items.delete(k)}}
const storage=new MemoryStorage();let resolve,posts=0,mode='pending';
const io={storage:()=>storage,fetch:async(url,options)=>{assert.equal(url,'/api/chat');if(options?.method!=='POST')return Response.json({available:true});posts++;if(mode==='error')return Response.json({error:'تعذّر الاتصال. حاول مجددًا.'},{status:503});return new Promise(r=>{resolve=r})}};
const registry=new ChatSessionRegistry(io),options={participantKey:'member-a'},session=registry.get(options);
session.initialize();await new Promise(r=>setTimeout(r,0));session.setText('أحتاج إلى تحسين متابعة قرارات الاجتماعات مع الفريق.');
let notifications=0;const unsubscribe=session.subscribe(()=>notifications++);
const sending=session.send();const duplicate=session.send();assert.equal(posts,1);assert.equal(session.getSnapshot().busy,true);
unsubscribe();const expanded=registry.get(options);assert.equal(expanded,session);assert.equal(expanded.getSnapshot().pending,'أحتاج إلى تحسين متابعة قرارات الاجتماعات مع الفريق.');
const discovery={version:1,signals:[{axis:'scene',status:'observed',quote:'متابعة قرارات الاجتماعات'}],asked:['people']};
resolve(Response.json({interview:discovery,message:'من يتأثر بتأخر المتابعة؟',draft:{...emptyChatDraft,title:'تتعثر متابعة قرارات الاجتماعات'},ready:false}));await sending;await duplicate;
assert.equal(expanded.getSnapshot().busy,false);assert.equal(expanded.getSnapshot().messages.length,3);assert.equal(expanded.getSnapshot().text,'');assert.equal(expanded.getSnapshot().replyVersion,1);assert(notifications>0);
assert.equal(JSON.parse(storage.getItem(session.key)).messages.length,3);assert.deepEqual(JSON.parse(storage.getItem(session.key)).interview,discovery);
const resumed=new ChatSessionRegistry(io).get(options);resumed.initialize();assert.deepEqual(resumed.getSnapshot().interview,discovery);resumed.dispose();
expanded.setText('نص لم أرسله بعد');assert.equal(registry.get(options).getSnapshot().text,'نص لم أرسله بعد');
const other=registry.get({participantKey:'member-b'});assert.equal(other.getSnapshot().text,'');assert.equal(other.getSnapshot().messages.length,1);
// The manual review and both presentations use the same draft.
expanded.replaceDraft({...exampleChallenges[0].challenge,title:'عنوان صححه المستخدم أثناء المراجعة'});assert.equal(registry.get(options).getSnapshot().draft.title,'عنوان صححه المستخدم أثناء المراجعة');
mode='error';await expanded.send();assert.equal(expanded.getSnapshot().text,'نص لم أرسله بعد');assert.match(expanded.getSnapshot().error,/تعذّر/);assert.equal(expanded.getSnapshot().busy,false);
// A late reply must never restore information after logout.
mode='pending';const pending=expanded.send();registry.clearActor('member-a');resolve(Response.json({message:'رد متأخر',draft:emptyChatDraft,ready:false}));await pending;
assert.equal(storage.getItem(session.key),null);assert.notEqual(registry.get(options),session);assert.equal(registry.get(options).getSnapshot().messages.length,1);
// Reload restores the text, while a changed completion baseline rejects an old draft.
const a=registry.get(options);a.initialize();a.setText('نص محفوظ قبل إعادة التحميل');registry.dispose();
const restored=new ChatSessionRegistry(io).get(options);restored.initialize();assert.equal(restored.getSnapshot().text,'نص محفوظ قبل إعادة التحميل');restored.dispose();
const viewer={signedIn:true,employee:true,manager:false,email:'',employeeId:'member-a',roles:['innovator']};
const entry={...exampleChallenges[0],id:'fixture',example:false,mine:false,voted:false,interested:false,status:'published'};
const workshop={open:true,finalized:false,title:'اختبار',count:3,selected:[],revision:1};
const context={route:'challenge/fixture',viewer,entries:[entry],workshop,loading:false};
const ids=c=>getCompanionSteps(c).map(s=>s.id);
assert.deepEqual(ids({...context,loading:true}),[]);
assert.deepEqual(ids({...context,route:'admin'}),[]);
assert(ids(context).includes('challenge:vote'));
assert(ids(context).includes('challenge:join'));
assert(!ids({...context,workshop:{...workshop,open:false}}).includes('challenge:vote'));
assert(ids({...context,workshop:{...workshop,open:false}}).includes('challenge:join'));
const done=ids({...context,entries:[{...entry,voted:true,interested:true}]});
assert(!done.includes('challenge:vote'));assert(!done.includes('challenge:join'));
assert.deepEqual(ids({...context,entries:[{...entry,example:true}]}),['challenge:example']);
for(const route of ['challenge/fixture','wall']){const own=ids({...context,route,entries:[{...entry,mine:true},...exampleChallenges]});assert(!own.includes('challenge:vote'));assert(!own.includes('challenge:join'));assert(!own.includes('library:vote'));assert(!own.includes('library:join'));}
const incomplete={...entry,mine:true,challenge:{...entry.challenge,ownership:'',initialSolutionStatus:''}};
assert(ids({...context,route:'mine',entries:[incomplete]}).includes('participate:complete'));
assert(!ids({...context,route:'mine',entries:[incomplete],workshop:{...workshop,finalized:true}}).includes('participate:complete'));
assert(ids({...context,route:'login',viewer:{...viewer,employee:false}}).includes('register:phone'));
const steps=getCompanionSteps({...context,route:'home'});
assert.deepEqual(steps.slice(0,2).map(s=>s.id),['home:welcome','home:roles']);
assert.equal(steps.find(s=>s.id==='home:explore').target,'#bh-challenges-title');
assert.deepEqual(steps.map(s=>s.id),['home:welcome','home:roles','home:journey','home:program','home:evaluation','home:explore','home:vote','home:join','home:faq','home:participate']);
for(const extra of [{entries:[]},{entries:[{...entry,mine:true}]},{entries:exampleChallenges}]){
 const home=ids({...context,route:'home',...extra});assert(!home.includes('home:vote')&&!home.includes('home:join'));
}
assert(!ids({...context,route:'home',workshop:{...workshop,open:false}}).includes('home:vote'));
assert(ids({...context,route:'home',workshop:{...workshop,open:false}}).includes('home:join'));
const writing=getCompanionSteps({...context,route:'new'});
assert.equal(writing.find(s=>s.id==='write:progress').target,'[data-badra-anchor="challenge-progress"]');
assert.equal(writing.find(s=>s.id==='write:input').target,'[data-badra-anchor="challenge-write"]');
const library={...context,route:'wall'};
assert(ids(library).includes('library:vote'));assert(ids(library).includes('library:join'));
assert(!ids({...library,workshop:{...workshop,open:false}}).includes('library:vote'));
assert(ids({...library,workshop:{...workshop,open:false}}).includes('library:join'));
assert(!ids({...library,entries:[{...entry,voted:true,interested:true}]}).includes('library:join'));
assert(!ids({...library,entries:[{...entry,example:true}]}).includes('library:vote'));
// Initial HTML is only a quiet invitation, never a tour, highlight, pointer or live message.
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler/package.json'))('esbuild');
const built=await build({entryPoints:['app/components/badra-companion.tsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/*']});
const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);
for(const route of ['home','wall','challenge/fixture','new']){
 const html=renderToStaticMarkup(createElement(mod.exports.default,{...context,route}));
 assert(html.includes('ابدأ جولة مع بذرة'));assert(!html.includes('badra-guide-message')&&!html.includes('badra-guide-traveller')&&!html.includes('badra-guide-pointer'));
}
assert.equal(renderToStaticMarkup(createElement(mod.exports.default,{...context,route:'admin'})),'');
// The guide cannot cover its target, overflow a narrow viewport, or point offscreen.
for(const width of [320,373,390,760,1280])for(const height of [400,740,900])for(const top of [100,200,height-80]){
 const target={left:width-180,right:width-30,top,bottom:top+44,width:150,height:44};
 const card={width:Math.min(350,width-24),height:180};
 const p=placeCompanion(target,card,{width,height,header:80});if(!p)continue;
 assert(p.left>=12&&p.left+card.width<=width-12);assert(p.top>=80&&p.top+card.height<=height-12);
 assert(p.left+card.width<=target.left||p.left>=target.right||p.top+card.height<=target.top||p.top>=target.bottom);
 assert(p.endX>=0&&p.endX<=width&&p.endY>=0&&p.endY<=height);
 assert(p.mascotLeft>=12&&p.mascotLeft+84<=width-12);assert(p.mascotTop>=80&&p.mascotTop+99<=height-12);
}
assert.equal(placeCompanion({left:12,right:300,top:20,bottom:190,width:288,height:170},{width:296,height:180},{width:320,height:220,header:20}),null);
const obstruction={left:700,top:364,right:1060,bottom:560,width:360,height:196};
const protectedTarget={left:800,top:300,right:980,bottom:344,width:180,height:44};
const alternative=placeCompanion(protectedTarget,{width:350,height:180},{width:1280,height:900,header:80},[obstruction]);
assert(alternative);assert(alternative.top+180<=obstruction.top||alternative.top>=obstruction.bottom||alternative.left+350<=obstruction.left||alternative.left>=obstruction.right);
sql.close();console.log('PASS: saved conversation unchanged; quiet opt-in render; ordered page tour; closed voting; completed actions; examples and owner-only rules; mobile placement without target overlap.');
