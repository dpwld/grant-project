// Explicit, local-only screenshot fixture. Never imported by application code.
// The announcements AND assessment results below are fictional.
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { grantInputKey, REVIEW_VERSION } from '../lib/grants/assessment.ts';

const mode=process.argv[2];
if(!['seed','cleanup'].includes(mode))throw new Error('Use: node --experimental-strip-types scripts/readme-example.mjs seed|cleanup');
const base='http://127.0.0.1:4311';
const manifest='.wrangler/readme-example-grants.json';
const profileName='Luminolab — Example Company';
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
  companyName:profileName,entityType:'Corporation',foundedOn:date(-700),
  industry:'Software development',subIndustry:'Workflow automation',regionSi:'Seoul',regionGu:'Seongdong-gu',
  businessSummary:'A fictional company building data connections and workflow automation tools for small organizations.',
  employeeCount:8,revenueBand:'Under KRW 1 billion',certifications:['Venture certification (example)'],
  keywords:['AI','SaaS','Workflow automation'],excludeKeywords:['Manufacturing equipment'],achievements:'Example product launch',
  coreTech:'Document analysis, data connections, workflow automation',matchFocus:'Support for commercialization, technology development, and international expansion',completeSetup:true,
});
const rows=[
 ['Early Technology Commercialization',7,'Up to KRW 80 million','Commercialization','S',94,'An illustrative fit for customer validation and early sales preparation for a workflow automation product.'],
 ['AI Service Pilot Program',14,'Up to KRW 120 million','R&D','A',89,'This fictional pilot applies document analysis technology to real business workflows.'],
 ['Global SaaS Market Validation',21,'Up to KRW 50 million','International expansion','A',86,'A fictional program for overseas customer interviews and localization preparation.'],
 ['Digital Transformation Voucher',5,'Up to KRW 30 million','Voucher','B',77,'This example requires additional confirmation of an implementation partner.'],
 ['Technology Commercialization Mentoring',28,'Expert mentoring','Consulting','B',72,'A fictional program for reviewing product pricing and sales strategy.'],
 ['Startup Cloud Support',10,'Partial cloud service costs','Infrastructure','B',70,'An example of assessing cloud cost support for a young company.'],
 ['Intellectual Property Filing Support',35,'Partial filing costs','Patents','C',58,'An illustrative program with limited relevance to current business priorities.'],
 ['Regional Product Promotion',18,'Promotional content production','Marketing','C',52,'A fictional announcement requiring further checks of location and applicant eligibility.'],
];
const imports=rows.map(([title,days,amountText,type],index)=>({
  source:'manual',sourceId:prefix+String(index+1).padStart(2,'0'),title:title+' (example)',url:'',
  summary:'A fictional grant program for README screenshots. This is not an actual announcement.',
  supportTypes:[type],targets:['Technology startups'],region:'Nationwide',amountText,applyStart:date(-14),applyEnd:date(days),
}));
const ids=imports.map(row=>'manual:'+row.sourceId);
writeFileSync(manifest,JSON.stringify({owner,profileName,ids},null,2));
await request('/api/grants/import','POST',imports);
const state=await request('/api/grants');
sql(state.programs.map(program=>{
  const index=ids.indexOf(program.id);if(index<0)throw new Error('Unexpected local record.');
  const [, , , , grade,score,why]=rows[index];
  const value={...program,grade,score,why,matchedAt:now.toISOString(),starred:index<2,
    matchedTags:['Example data',...(index<3?['AI','Commercialization']:['Consider'])],
    eligibility:[{requirement:'Applicant type and business area',status:'meets',note:'This screen uses a fictional company and announcement.'}],
    assessment:{version:REVIEW_VERSION,status:'complete',reviewedAt:now.toISOString(),profileUpdatedAt:profile.updatedAt,
      inputKey:grantInputKey(program),sourceStatus:'summary_only',sourceUrl:'',sourceError:'Illustrative README example, not an actual AI review result.',originalChars:0,truncated:false,attachmentsReviewed:false},
  };
  return `UPDATE grant_programs SET data=${quote(JSON.stringify(value))} WHERE owner=${quote(owner)} AND id=${quote(program.id)}`;
}));
console.log('Fictional local profile + 8 announcements and illustrative assessments saved for screenshots. No external API was called.');
