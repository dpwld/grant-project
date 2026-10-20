import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPages } from '../lib/grants/collectPages.ts';
import { runGrantReview } from '../lib/grants/reviewQueue.ts';
import { grantInputKey, needsReview, REVIEW_VERSION } from '../lib/grants/assessment.ts';
import { profileSchema,importSchema } from '../lib/server/validation.ts';
import { readOriginal } from '../lib/grants/source.ts';

test('collection deduplicates pages and refuses a repeated full page',async()=>{
 const rows=await collectPages(async p=>p===1?[{id:'a'},{id:'b'}]:p===2?[{id:'b'},{id:'c'}]:[],r=>r.id,2);
 assert.deepEqual(rows.map(r=>r.id),['a','b','c']);
 await assert.rejects(()=>collectPages(async()=>[{id:'a'},{id:'b'}],r=>r.id,2),/같은 페이지/);
});
test('profile or announcement changes invalidate previous AI review',()=>{
 const p={title:'Test',summary:'text',url:'',applyStart:null,applyEnd:null,targets:[],region:'',amountText:'',supportTypes:[],grade:'B',assessment:{version:REVIEW_VERSION,status:'complete' as const,reviewedAt:'t',profileUpdatedAt:'v1',inputKey:'',sourceStatus:'summary_only' as const,sourceUrl:'',originalChars:0,truncated:false,attachmentsReviewed:false as const}};
 p.assessment.inputKey=grantInputKey(p);assert.equal(needsReview(p,'v1'),false);
 assert.equal(needsReview(p,'v2'),true);assert.equal(needsReview({...p,title:'changed'},'v1'),true);
});
test('review queue uses bounded batches, deduplicates ids and accounts for missing results',async()=>{
 const batches:string[][]=[];const ids=Array.from({length:35},(_,i)=>String(i));
 const result=await runGrantReview([...ids,'0'],{shouldStop:()=>false,onProgress:()=>{},review:async batch=>{batches.push(batch);return{results:batch.filter(id=>id!=='3').map(id=>({id})),failed:[]};}});
 assert.equal(result.total,35);assert.equal(result.completed,34);assert.deepEqual(result.failed.map(f=>f.id),['3']);assert.ok(batches.every(batch=>batch.length<=8));
});
test('unsupported original URLs never cause arbitrary network access',async()=>{
 const r=await readOriginal({source:'manual',source_id:'https://127.0.0.1/private'});assert.equal(r.sourceStatus,'summary_only');assert.equal(r.sourceUrl,'');
});
test('validation rejects impossible dates, negative employee counts and unsafe URLs',()=>{
 const p={companyName:'test',entityType:'',foundedOn:null,industry:'',subIndustry:'',regionSi:'',regionGu:'',businessSummary:'',employeeCount:0,revenueBand:'',certifications:[],keywords:[],excludeKeywords:[],achievements:'',coreTech:'',matchFocus:''};
 assert.equal(profileSchema.safeParse(p).success,true);assert.equal(profileSchema.safeParse({...p,employeeCount:-1}).success,false);assert.equal(profileSchema.safeParse({...p,foundedOn:'2026-02-30'}).success,false);
 const r={source:'manual',sourceId:'test',title:'test',url:'javascript:alert(1)',summary:'',supportTypes:[],targets:[],region:'',amountText:'',applyStart:null,applyEnd:null};assert.equal(importSchema.safeParse([r]).success,false);
});
