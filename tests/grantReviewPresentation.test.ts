import test from 'node:test';
import assert from 'node:assert/strict';
import type { GrantProgram } from '../lib/data/grants.ts';
import { grantInputKey, REVIEW_VERSION } from '../lib/grants/assessment.ts';
import { grantReviewPresentation } from '../lib/grants/reviewPresentation.ts';

const program = (): GrantProgram => {
 const value: GrantProgram = {id:'test',source:'manual',sourceId:'test',title:'Test grant',url:'',summary:'Imported summary',supportTypes:[],targets:[],region:'',amountText:'',applyStart:null,applyEnd:null,grade:'S',score:95,why:'Previous rationale',eligibility:[{requirement:'Test requirement',status:'meets',note:'Previous note'}],matchedTags:['Previous tag'],matchedAt:'2026-10-01T00:00:00Z',starred:false,dismissed:false,feedback:null,sprintTaskId:null,createdAt:'2026-10-01T00:00:00Z'};
 value.assessment={version:REVIEW_VERSION,status:'complete',reviewedAt:value.matchedAt!,profileUpdatedAt:'profile-v1',inputKey:grantInputKey(value),sourceStatus:'summary_only',sourceUrl:'',originalChars:0,truncated:false,attachmentsReviewed:false};
 return value;
};
test('only an assessment of the current profile and source exposes a current grade/score',()=>{
 const p=program();const current=grantReviewPresentation(p,'profile-v1');assert.equal(current.grade,'S');assert.equal(current.score,95);assert.equal(current.previous,false);assert.equal(current.statusLabel,null);
 for(const [row,profile] of [[p,'profile-v2'],[{...p,summary:'Newly imported contents'},'profile-v1'],[{...p,assessment:{...p.assessment!,version:REVIEW_VERSION-1}},'profile-v1']] as const){const state=grantReviewPresentation(row,profile);assert.equal(state.grade,null);assert.equal(state.score,null);assert.equal(state.previous,true);assert.equal(state.statusLabel,'재심사 필요');assert.equal(row.why,'Previous rationale');}
});
test('a failed rerun is visible and never revives the previous successful grade',()=>{
 const p=program();p.assessment={...p.assessment!,status:'failed',error:'Test provider failure'};const state=grantReviewPresentation(p,'profile-v1');assert.equal(state.failed,true);assert.equal(state.statusLabel,'심사 실패');assert.equal(state.grade,null);assert.equal(state.score,null);assert.equal(state.previous,true);assert.equal(p.grade,'S');assert.equal(p.eligibility[0].note,'Previous note');
});
test('current grade filters and rankings exclude stale high grades',()=>{
 const stale=program();const fresh={...program(),id:'fresh',grade:'B' as const,score:60};const programs=[stale,fresh];stale.assessment={...stale.assessment!,profileUpdatedAt:'previous-profile'};
 assert.deepEqual(programs.filter(p=>grantReviewPresentation(p,'profile-v1').grade==='S'),[]);
 assert.deepEqual(programs.filter(p=>grantReviewPresentation(p,'profile-v1').grade==='B').map(p=>p.id),['fresh']);
 assert(grantReviewPresentation(fresh,'profile-v1').rank<grantReviewPresentation(stale,'profile-v1').rank);
});
test('never-reviewed records are distinct from preserved previous evaluations',()=>{
 const p={...program(),grade:null,score:null,assessment:null,why:'',eligibility:[],matchedTags:[],matchedAt:null};const state=grantReviewPresentation(p,'profile-v1');assert.equal(state.statusLabel,'미심사');assert.equal(state.previous,false);assert.equal(state.grade,null);assert.equal(state.score,null);
});
