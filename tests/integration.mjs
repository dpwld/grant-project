// Run against the built worker on loopback, never a hosted/real-data service.
import assert from 'node:assert/strict';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:4315';
assert.equal(new URL(base).hostname,'127.0.0.1');
const suffix=process.env.TEST_OWNER_SUFFIX??Date.now().toString();
const user=`grants-integration-${suffix}`;
async function req(path,method='GET',value,identity=user,extra={}){
 const res=await fetch(base+path,{method,headers:{...(identity?{'oai-authenticated-user-id':identity,'oai-authenticated-user-email':'integration@example.invalid'}:{}),...(value===undefined?{}:{'Content-Type':'application/json'}),...extra},body:value===undefined?undefined:JSON.stringify(value)});
 return {status:res.status,data:await res.json()};
}
if(process.argv.includes('--verify-restart')){
 const state=await req('/api/grants');assert.equal(state.data.profile.companyName,'Integration verification');assert.equal(state.data.programs[0].starred,true);assert.equal(state.data.programs[0].feedback,null);console.log('PASS persistence after worker restart');process.exit(0);
}
assert.equal((await req('/api/grants','GET',undefined,null)).status,401);
assert.equal((await req('/api/grants/profile','PUT',{},user,{Origin:'https://other.invalid'})).status,403);
const profile={companyName:'Integration verification',entityType:'',foundedOn:null,industry:'',subIndustry:'',regionSi:'',regionGu:'',businessSummary:'',employeeCount:0,revenueBand:'',certifications:[],keywords:[],excludeKeywords:[],achievements:'',coreTech:'',matchFocus:''};
assert.equal((await req('/api/grants/profile','PUT',profile)).status,200);
assert.equal((await req('/api/grants/profile','PUT',{...profile,employeeCount:-3})).status,400);
let state=await req('/api/grants');assert.equal(state.data.profile.employeeCount,0);
const record={source:'manual',sourceId:'qa-only',title:'Integration record',url:'https://example.invalid/',summary:'Disposable integration fixture',supportTypes:[],targets:[],region:'',amountText:'',applyStart:null,applyEnd:null};
assert.equal((await req('/api/grants/import','POST',[record])).status,200);
const id='manual:qa-only';
assert.equal((await req('/api/grants/programs/'+id,'PATCH',{starred:true,feedback:'up'})).status,200);
assert.equal((await req('/api/grants/programs/'+id,'PATCH',{feedback:null})).data.feedback,null);
assert.equal((await req('/api/grants/import','POST',[{...record,title:'Updated source title'}])).status,200);
state=await req('/api/grants');assert.equal(state.data.programs.length,1);assert.equal(state.data.programs[0].starred,true);assert.equal(state.data.programs[0].title,'Updated source title');
assert.equal((await req('/api/grants','GET',undefined,user+'-other')).data.programs.length,0);
assert.equal((await req('/api/grants/programs/'+id,'PATCH',{starred:false},user+'-other')).status,404);
assert.equal((await req('/api/grants/programs/'+id,'PATCH',{owner:'someone-else'})).status,400);
assert.equal((await req('/api/grants/import','POST',[{...record,sourceId:'invalid',applyEnd:'2026-02-30'}])).status,400);
assert.equal((await req('/api/grants')).data.programs.length,1);
assert.equal((await req('/api/grants/sync','POST')).status,503);
assert.equal((await req('/api/grants/match','POST',{mode:'all'})).status,503);
const specialRecord={...record,sourceId:'qa/odd?value#fragment',url:''};
assert.equal((await req('/api/grants/import','POST',[specialRecord])).status,200);
const encodedId=encodeURIComponent('manual:'+specialRecord.sourceId);
assert.equal((await req('/api/grants/programs/'+encodedId,'PATCH',{starred:true})).status,200);
assert.equal((await req('/api/grants/programs/'+encodedId,'PATCH',{feedback:'up'})).data.feedback,'up');
assert.equal((await req('/api/grants/programs/'+encodedId,'PATCH',{dismissed:true})).data.dismissed,true);
assert.equal((await req('/api/grants/programs/'+encodedId,'PATCH',{sprintTaskId:'qa-only-task'})).data.sprintTaskId,'qa-only-task');
console.log(`PASS server integration assertions, including encoded IDs; TEST_OWNER_SUFFIX=${suffix}; no external paid calls; isolated disposable owner`);
