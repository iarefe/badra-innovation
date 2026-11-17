import assert from 'node:assert/strict';
import {load,sql} from './test-fixture.mjs';
const {challengeChatView,assistantDisplay}=await load('lib/challenge-chat-view.ts');
const {emptyChatDraft,missingFields,coreChatKeys,chatFields}=await load('lib/ai-challenge.ts');
const {exampleChallenges}=await load('lib/challenges.ts');
const {ChatSessionRegistry}=await load('lib/client-chat-session.ts');
const get=(d,focus,ready=false,completion=false)=>challengeChatView(d,ready,focus,[],completion);
const originalPercent=d=>{const req=coreChatKeys.filter(k=>k!=='author'),miss=missingFields(d);if(d.ownership==='shared')req.push('coOwners');if(d.initialSolutionStatus==='implemented')req.push('initialSolution');return Math.round(100*req.filter(k=>d[k].trim()&&!miss.includes(k)).length/req.length)};
const base={...exampleChallenges[0].challenge,author:'صاحب التحدي'},fresh={...emptyChatDraft,author:'صاحب التحدي'};
const registry=new ChatSessionRegistry(),opening=registry.get({participantKey:'workspace-check'}).getSnapshot();
assert.equal(get(opening.draft).current,'situation');assert.equal(get(fresh).total,14);
for(const ownership of ['','individual','shared'])for(const trial of ['','none','implemented'])for(const missing of [true,false]){
 const d={...base,ownership,initialSolutionStatus:trial,impact:missing?'':base.impact,coOwners:'فريق التحدي',initialSolution:'حل أولي مجرّب لدى الفريق.',initialSolutionOutcome:'نتيجة أولية بانتظار التحقق.',assumptions:'تفسير غير مؤكّد'};
 const v=get(d,'impact');
 assert.equal(v.percent,originalPercent(d));assert.equal(v.sections.filter(s=>!s.optional).reduce((n,s)=>n+s.total,0),v.total);assert.equal(v.sections.filter(s=>!s.optional).reduce((n,s)=>n+s.done,0),v.completed);
 const fields=v.sections.flatMap(s=>s.keys);
 assert.equal(fields.includes('coOwners'),ownership==='shared');assert.equal(fields.includes('initialSolution'),trial==='implemented');assert.equal(fields.includes('initialSolutionOutcome'),trial==='implemented');
 assert(fields.every(k=>chatFields[k]));assert(!fields.includes('author'));assert.equal(new Set(fields).size,fields.length);
 assert.equal(v.activeGroup,v.sections.find(s=>s.keys.includes('impact')).id);
 assert.equal(v.canReview,false,'The numeric tally alone cannot unlock review.');
}
const complete={...base,ownership:'individual',initialSolutionStatus:'none'};
assert.equal(get(complete,'review',true).canReview,true);assert(!get(complete,'review',true).current);
assert.equal(get({...complete,need:''},undefined,false,true).current,'need');
assert.equal(get({...complete,need:''},'people').current,'need');assert.equal(get({...complete,stakeholders:''},'people').current,'stakeholders');
const noMeta=challengeChatView(complete,false,undefined,[{role:'user',content:'توضيح'}],false);assert.equal(noMeta.current,undefined,'Do not invent a current field for a legacy transcript without focus');
assert.deepEqual(get(fresh).sections.map(s=>s.title),assistantDisplay.sections.map(s=>s.title));assert.equal(assistantDisplay.starters.length,3);
registry.dispose();sql.close();console.log('PASS: unchanged live percentage across 18 combinations, weighted groups, conditional and optional fields, actual focus, legacy sessions, completion and original review gate.');
