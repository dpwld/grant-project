// Explicit, local-only screenshot fixture. Never imported by application code.
// The announcements AND assessment results below are fictional.
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { grantInputKey, REVIEW_VERSION } from '../lib/grants/assessment.ts';

const mode=process.argv[2];
if(!['seed','cleanup'].includes(mode))throw new Error('Use: node --experimental-strip-types scripts/readme-example.mjs seed|cleanup');
const base='http://127.0.0.1:4311';
const manifest='.wrangler/readme-example-grants.json';
const profileName='루미노랩 — 예시 기업';
const owner='local_seedy';
const prefix='readme-example-';
async function request(path,method='GET',data){
  const response=await fetch(base+path,{method,redirect:'error',headers:{Cookie:'__sites_local_auth=1',...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error??'Local request failed');
  return result;
}
const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
function sql(statements){
  mkdirSync('.wrangler',{recursive:true});
  const file='.wrangler/readme-example-grants.sql';
  writeFileSync(file,statements.join(';\n')+';\n');
  const result=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.json','--persist-to','.wrangler/state','--file',file],{stdio:'pipe',encoding:'utf8'});
  unlinkSync(file);
  if(result.status!==0)throw new Error(result.stderr||result.stdout);
}
if(mode==='cleanup'){
  if(!existsSync(manifest))throw new Error('No screenshot-fixture manifest; nothing deleted.');
  const {ids}=JSON.parse(readFileSync(manifest,'utf8'));
  if(!ids.every(id=>id.startsWith('manual:'+prefix)))throw new Error('Unexpected fixture ID.');
  sql([
    `DELETE FROM grant_programs WHERE owner=${quote(owner)} AND id IN (${ids.map(quote).join(',')})`,
    `DELETE FROM grant_profiles WHERE owner=${quote(owner)} AND json_extract(data,'$.companyName')=${quote(profileName)}`,
  ]);
  unlinkSync(manifest);
  console.log('Only the named local screenshot fixture was removed.');
  process.exit(0);
}
if(existsSync(manifest))throw new Error('Fixture already exists; cleanup first.');
const before=await request('/api/grants');
if(before.profile||before.programs.length)throw new Error('Use an empty local development workspace; existing data is never overwritten.');
mkdirSync('.wrangler',{recursive:true});
const now=new Date();
const date=offset=>new Date(now.getTime()+offset*86400000).toISOString().slice(0,10);
const profile=await request('/api/grants/profile','PUT',{
  companyName:profileName,entityType:'법인 (주식회사)',foundedOn:date(-700),
  industry:'소프트웨어 개발',subIndustry:'업무 자동화',regionSi:'서울',regionGu:'성동구',
  businessSummary:'소규모 조직을 위한 데이터 연결과 업무 자동화 도구를 개발하는 가상 기업입니다.',
  employeeCount:8,revenueBand:'10억 미만',certifications:['벤처기업인증 (예시)'],
  keywords:['AI','SaaS','업무 자동화'],excludeKeywords:['제조 설비'],achievements:'예시 서비스 출시',
  coreTech:'문서 분석, 데이터 연결, 워크플로 자동화',matchFocus:'사업화·기술개발·해외 진출을 위한 지원',
});
const rows=[
 ['초기 기술기업 사업화 패키지',7,'최대 8천만원','사업화','S',94,'업무 자동화 제품의 고객 검증과 초기 판매 준비에 맞는 예시입니다.'],
 ['AI 서비스 실증 프로젝트',14,'최대 1억 2천만원','R&D','A',89,'문서 분석 기술을 실제 업무에 적용하는 실증 과정을 가정했습니다.'],
 ['글로벌 SaaS 시장 검증',21,'최대 5천만원','해외 진출','A',86,'해외 고객 인터뷰와 현지화 준비에 활용하는 가상 프로그램입니다.'],
 ['디지털 전환 협업 바우처',5,'최대 3천만원','바우처','B',77,'협업 기관 확보 여부를 추가 확인하는 예시입니다.'],
 ['기술사업화 멘토링',28,'전문가 멘토링','컨설팅','B',72,'제품 가격과 영업 전략 검토에 도움이 되는 가상 프로그램입니다.'],
 ['초기기업 클라우드 이용 지원',10,'이용료 일부 지원','인프라','B',70,'클라우드 비용 지원 항목을 검토하는 예시입니다.'],
 ['지식재산 출원 지원',35,'출원비 일부 지원','특허','C',58,'현재 사업 우선순위와의 관련성이 낮은 예시입니다.'],
 ['지역 제품 홍보 프로그램',18,'홍보 콘텐츠 제작','마케팅','C',52,'참여 지역과 모집 대상을 추가 확인해야 하는 가상 공고입니다.'],
];
const imports=rows.map(([title,days,amountText,type],index)=>({
  source:'manual',sourceId:prefix+String(index+1).padStart(2,'0'),title:title+' (예시)',url:'',
  summary:'README 화면 설명을 위한 가상 지원사업입니다. 실제 모집 공고가 아닙니다.',
  supportTypes:[type],targets:['기술 창업기업'],region:'전국',amountText,applyStart:date(-14),applyEnd:date(days),
}));
const ids=imports.map(row=>'manual:'+row.sourceId);
writeFileSync(manifest,JSON.stringify({owner,profileName,ids},null,2));
await request('/api/grants/import','POST',imports);
const state=await request('/api/grants');
sql(state.programs.map(program=>{
  const index=ids.indexOf(program.id);if(index<0)throw new Error('Unexpected local record.');
  const [, , , , grade,score,why]=rows[index];
  const value={...program,grade,score,why,matchedAt:now.toISOString(),starred:index<2,
    matchedTags:['예시 데이터',...(index<3?['AI','사업화']:['검토 후보'])],
    eligibility:[{requirement:'신청 대상과 사업 분야',status:'meets',note:'가상 기업·가상 공고의 화면 예시입니다.'}],
    assessment:{version:REVIEW_VERSION,status:'complete',reviewedAt:now.toISOString(),profileUpdatedAt:profile.updatedAt,
      inputKey:grantInputKey(program),sourceStatus:'summary_only',sourceUrl:'',sourceError:'실제 AI 심사 결과가 아닌 README 예시입니다.',originalChars:0,truncated:false,attachmentsReviewed:false},
  };
  return `UPDATE grant_programs SET data=${quote(JSON.stringify(value))} WHERE owner=${quote(owner)} AND id=${quote(program.id)}`;
}));
console.log('Fictional local profile + 8 announcements and illustrative assessments saved for screenshots. No external API was called.');
