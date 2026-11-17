// Full HTTP handlers against an isolated, migrated SQLite fixture: no production users or scores.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {load,req,seedEmployee,sql} from './test-fixture.mjs';

const api=await load('app/api/teams/route.ts');
const admin=seedEmployee('700'),judgeA=seedEmployee('701'),judgeB=seedEmployee('702'),member=seedEmployee('703'),stranger=seedEmployee('704');
sql.prepare('UPDATE employees SET phone=? WHERE id=?').run('+966599999901',admin.id);
const teamX=randomUUID(),teamY=randomUUID();
for(const [id,title,owner] of [[teamX,'تجربة المراجعة',member],[teamY,'تجربة التسليم',judgeB]]){
 sql.prepare("INSERT INTO challenges(id,owner,payload,status,created_at,published_at,updated_at) VALUES(?,?,?,'published',1,1,1)").run(id,'employee:'+owner.id,JSON.stringify({title}));
}
const post=async(user,body,status=200)=>{const res=await api.POST(req(user,body));assert.equal(res.status,status,body.action+': '+await res.text());};
const get=async(user)=>{const res=await api.GET(req(user));assert.equal(res.status,200);return res.json();};
const find=async(user,id)=>(await get(user)).teams.find(t=>t.id===id);
const projection=async(user,teamId)=>{
 const from=req(user),url='https://site.test/api/teams?view=results'+(teamId?'&team='+teamId:'');
 return api.GET(new Request(url,{headers:from.headers}));
};
const live=async id=>(await (await projection(admin)).json()).teams.find(t=>t.id===id);
const {resultDisplay}=await load('lib/team-card.ts');
const result=async id=>(await find(admin,id)).result;
const vote=(team,value)=>({action:'audience',team,value});
const score=(team,scores,signature)=>({action:'score',team,scores,notes:scores.map((_,i)=>'ملاحظة '+signature+' '+i),signature});

await post(admin,{action:'announce',ids:[teamX,teamY],revision:0});
await post(admin,vote(teamX,0));
assert.equal((await result(teamX)).final,null,'Even a recorded audience zero cannot produce a result without an eligible jury');
for(const judge of [judgeA,judgeB])await post(admin,{action:'judge',person:judge.id,enabled:true});
const beforeY=await result(teamY);
assert.equal(beforeY.required,1);assert.equal(beforeY.submitted,0);assert.equal(beforeY.committee,null);
assert.equal(beforeY.audience,null,'No audience vote is distinct from zero');
assert.equal(beforeY.final,null);
await post(judgeB,score(teamY,[5,5,5,5,5,5],'مقيم فريقه'),403);
await post(member,score(teamX,[5,5,5,5,5,5],'عضو غير مكلّف'),403);
await post(judgeA,vote(teamX,30),403);
await post(null,vote(teamX,30),401);
await post(admin,vote(teamX,31),400);await post(admin,vote(teamX,-0.1),400);
await post(judgeA,score(teamX,[5,4,3,2,1],'خمسة معايير فقط'),400);
await post(judgeA,score(teamX,[5,4,3,2,1,6],'درجة غير صالحة'),400);
for(const user of [judgeA,member,stranger,null])assert.equal((await projection(user,teamX)).status,user?403:401);
await post(judgeA,score(teamX,[5,4,3,2,1,5],'توقيع الأول')); // 20 + 12 + 9 + 4 + 1 + 5 = 51
const partial=await result(teamX);
assert.deepEqual(partial,{required:2,submitted:1,committee:51,audience:0,final:51});
assert.deepEqual((await live(teamX)).result,partial);
assert.equal(resultDisplay(partial).complete,false,'A running result is not marked complete');
assert.equal(resultDisplay(partial).max,100,'An explicit zero is still a recorded audience grade');
await post(admin,vote(teamX,12.5));
assert.equal((await live(teamX)).result.final,63.5,'An audience grade is added before the second card arrives');
await post(admin,vote(teamX,0));
const slim=await (await projection(admin)).json();assert(slim.teams.every(t=>!('evaluations' in t))&&!JSON.stringify(slim).includes('توقيع الأول'));
const one=await (await projection(admin,teamX)).json();assert.equal(one.teams.length,1);assert.equal(one.teams[0].evaluations[0].card.signature,'توقيع الأول');
await post(judgeB,score(teamX,[5,5,5,5,5,5],'توقيع الثاني')); // 70; mean 60.5
assert.equal((await result(teamX)).final,60.5,'Zero audience points is valid once all counted cards exist');
await post(admin,vote(teamX,25.75));
assert.equal((await result(teamX)).final,86.25,'Fractional audience points are added once, after committee averaging');
await post(judgeA,score(teamX,[4,4,4,4,4,4],'توقيع معدّل')); // replaces 51 with 56
assert.equal((await result(teamX)).final,88.75);
const judgeTeam=await find(judgeA,teamX);
assert.equal(judgeTeam.evaluations.length,1);
assert.equal(judgeTeam.evaluations[0].person,judgeA.id);
assert.equal(judgeTeam.evaluations[0].card.signature,'توقيع معدّل');
assert.equal(judgeTeam.evaluations[0].card.notes[5],'ملاحظة توقيع معدّل 5');
assert(!('audience' in judgeTeam)&&!('result' in judgeTeam),'Committee members must not see other scores or audience data');
assert.equal((await find(admin,teamX)).evaluations.length,2,'Editing a card must not create a duplicate');
const memberTeam=await find(member,teamX);assert(!('result' in memberTeam));assert.deepEqual(memberTeam.evaluations,[]);
assert.deepEqual((await get(null)).teams,[]);assert.deepEqual((await get(stranger)).teams,[]);
assert.deepEqual((await find(judgeB,teamY)).evaluations,[]);
await post(judgeA,score(teamY,[5,5,5,5,5,5],'توقيع للفريق الثاني'));
assert.equal((await result(teamY)).final,null,'A missing audience grade does not yield a combined result');
const committeeOnly=resultDisplay((await live(teamY)).result);
assert.equal(committeeOnly.value,70);assert.equal(committeeOnly.max,70,'Show the current committee mark before any audience grade is recorded');
await post(admin,vote(teamY,30));
assert.equal((await result(teamY)).final,100,'Own-team juror excluded; full eligible committee plus 30 yields exactly 100');
assert.equal((await result(teamX)).final,88.75,'Audience and committee results remain scoped to the individual team');
await post(admin,{action:'judge',person:judgeB.id,enabled:false});
assert.deepEqual(await result(teamX),{required:1,submitted:1,committee:56,audience:25.75,final:81.75});
assert.equal(sql.prepare('SELECT count(*) n FROM team_scores WHERE team=? AND person=?').get(teamX,judgeB.id).n,1,'Revocation changes eligibility without deleting historical reviews');
await post(admin,{action:'judge',person:judgeB.id,enabled:true});
assert.equal((await result(teamX)).final,88.75,'Restoring the reviewer counts their existing card once');
sql.prepare('UPDATE employees SET active=0 WHERE id=?').run(judgeA.id);
assert.deepEqual(await result(teamX),{required:1,submitted:1,committee:70,audience:25.75,final:95.75});
assert.deepEqual(await result(teamY),{required:0,submitted:0,committee:null,audience:30,final:null});
console.log('PASS: independent team/judge cards, weighted average, own-team exclusion, replacement, privacy and distinct null / zero / fractional / maximum audience scores.');
