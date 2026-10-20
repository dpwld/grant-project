import { z } from "zod";
import { api,json,owner,body } from "@/lib/server/http";
import { setting } from "@/lib/server/config";
import { readProfile,readPrograms,patchProgram } from "@/lib/server/store";
import { matchSchema,hasCompanySetup } from "@/lib/server/validation";
import { readOriginal,plainText } from "@/lib/grants/source";
import { grantInputKey,REVIEW_VERSION,needsReview,type GrantAssessment } from "@/lib/grants/assessment";
import { SCHEMA,buildSystem,type MatchResult } from "@/lib/grants/matching";
const resultSchema=z.object({id:z.string(),grade:z.enum(["S","A","B","C","D"]),score:z.number().int().min(0).max(100),why:z.string().min(1),eligibility:z.array(z.object({requirement:z.string(),status:z.enum(["meets","unclear","fails"]),note:z.string()})),matched_tags:z.array(z.string())});
export const POST=(request:Request)=>api(async()=>{
 const user=await owner(request);const input=matchSchema.parse(await body(request));
 const profile=await readProfile(user);if(!profile||!hasCompanySetup(profile))return json({error:"profile_missing",guidance:"Complete company setup in Profile first."},409);
 const key=setting("OPENAI_API_KEY"),model=setting("OPENAI_MODEL");
 if(!key||!model)return json({error:"api_key_missing",guidance:"Set your OPENAI_API_KEY and OPENAI_MODEL on the server to use AI review. Saving, searching, and browsing work without AI."},503);

 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date());
 const programs=(await readPrograms(user)).filter(p=>!p.dismissed&&(!p.applyEnd||p.applyEnd>=today)&&(input.ids?input.ids.includes(p.id):input.mode==='all'||needsReview(p,profile.updatedAt??""))).slice(0,8);
 if(!programs.length)return json({matched:0,results:[],failed:[]});
 const sources=await Promise.all(programs.map(p=>readOriginal({source:p.source,source_id:p.sourceId})));
 const reviewedAt=new Date().toISOString();
 const assessments=programs.map((p,i):GrantAssessment=>{const {text:_,...source}=sources[i];return {...source,version:REVIEW_VERSION,status:"complete",reviewedAt,profileUpdatedAt:profile.updatedAt??"",inputKey:grantInputKey(p)};});
 const results:MatchResult[]=[];const failed:{id:string;error:string;assessment?:GrantAssessment}[]=[];
 async function failure(i:number,message:string){const assessment:GrantAssessment={...assessments[i],status:"failed",error:message};const stored=await patchProgram(user,programs[i].id,{assessment});failed.push({id:programs[i].id,error:message,assessment:stored?assessment:undefined});}
 try{
  const response=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(50000),body:JSON.stringify({model,messages:[{role:"system",content:buildSystem({...profile,match_focus:profile.matchFocus})},{role:"user",content:JSON.stringify(programs.map((p,i)=>({...p,summary:plainText(p.summary),official_page:sources[i]})))}],response_format:{type:"json_schema",json_schema:{name:"grant_match",strict:true,schema:SCHEMA}}})});
  if(!response.ok)throw new Error(`AI service request failed (HTTP ${response.status})`);
  const completion=await response.json() as {choices?:{message?:{content?:string}}[]};
  const parsed=JSON.parse(completion.choices?.[0]?.message?.content??"{}");
  for(let i=0;i<programs.length;i++){
   const candidates=Array.isArray(parsed.results)?parsed.results.filter((r:{id?:string})=>r.id===programs[i].id):[];
   const check=resultSchema.safeParse(candidates[0]);
   if(candidates.length!==1||!check.success){await failure(i,"The AI result was missing or invalid. Please review again.");continue;}
   const r=check.data;
   if(sources[i].sourceStatus!=="original"||sources[i].truncated){if(r.grade==='S'||r.grade==='A'){r.grade='B';r.score=Math.min(r.score,79);}r.eligibility.push({requirement:"Verify the complete official source",status:"unclear",note:sources[i].sourceError??"Only part of the long source was read. Check the complete source."});}
   if(r.grade==='S'&&r.eligibility.some(e=>e.status!=='meets')){r.grade='B';r.score=Math.min(r.score,79);}
   const stored=await patchProgram(user,r.id,{grade:r.grade,score:r.score,why:r.why,eligibility:r.eligibility,matchedTags:r.matched_tags,matchedAt:reviewedAt,assessment:assessments[i]});
   if(stored)results.push({...r,assessment:assessments[i]});else await failure(i,"Could not save the review result");
  }
  return json({matched:results.length,results,failed,batchSize:8});
 }catch(error){
  const detail=error instanceof Error&&error.message.startsWith('AI service')?error.message:"Could not process the AI response. Please try again.";
  const done=new Set([...results,...failed].map(r=>r.id));for(let i=0;i<programs.length;i++)if(!done.has(programs[i].id))await failure(i,detail);
  return json({error:"match_failed",detail,matched:results.length,results,failed},502);
 }
});
