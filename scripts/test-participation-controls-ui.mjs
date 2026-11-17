import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url),{build}=createRequire(require.resolve('wrangler/package.json'))('esbuild');
const built=await build({stdin:{contents:"export {HomeCardActions} from './app/components/home-participation';export {default as AdminWorkshop} from './app/components/admin-workshop';export {default as Detail} from './app/components/challenge-detail';export {exampleChallenges} from './lib/challenges';",resolveDir:process.cwd()},bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',external:['react','react/*']});
const mod={exports:{}};new Function('require','module','exports',built.outputFiles[0].text)(require,mod,mod.exports);
const {HomeCardActions,AdminWorkshop,exampleChallenges}=mod.exports;
const entry={...exampleChallenges[0],example:false,status:'published',voted:true,interested:true};
for(const votingOpen of [true,false])for(const joiningOpen of [true,false]){
 const h=renderToStaticMarkup(createElement(HomeCardActions,{entry,busy:false,votingOpen,joiningOpen,toggle(){}}));
 const vote=h.match(/<button[^>]*data-badra-anchor="home-vote"[^>]*>/)[0],join=h.match(/<button[^>]*data-badra-anchor="home-join"[^>]*>/)[0];
 assert.equal(vote.includes('disabled'),!votingOpen);assert.equal(join.includes('disabled'),!joiningOpen);
 assert.equal(h.includes('التصويت مغلق'),!votingOpen);assert.equal(h.includes('الانضمام مغلق'),!joiningOpen);
 const admin=renderToStaticMarkup(createElement(AdminWorkshop,{entries:[],order:[],workshop:{title:'test',count:3,open:votingOpen,joiningOpen,selected:[],finalized:false,revision:1},count:3,title:'test',busy:false,onAction(){},setCount(){},setTitle(){},download(){}}));
 assert(admin.includes(votingOpen?'إغلاق التصويت':'فتح التصويت'));assert(admin.includes(joiningOpen?'إغلاق الانضمام':'فتح الانضمام'));
}
console.log('PASS: four independent voting/joining UI states, disabled controls, saved selections and separate manager controls.');
