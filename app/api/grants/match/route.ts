import { z } from "zod";
import { api,json,owner,body } from "@/lib/server/http";
import { setting } from "@/lib/server/config";
import { readProfile,readPrograms,patchProgram } from "@/lib/server/store";
import { matchSchema } from "@/lib/server/validation";
import { readOriginal,plainText } from "@/lib/grants/source";
import { grantInputKey,REVIEW_VERSION,needsReview,type GrantAssessment } from "@/lib/grants/assessment";
import { SCHEMA,buildSystem,type MatchResult } from "@/lib/grants/matching";
const resultSchema=z.object({id:z.string(),grade:z.enum(["S","A","B","C","D"]),score:z.number().int().min(0).max(100),why:z.string().min(1),eligibility:z.array(z.object({requirement:z.string(),status:z.enum(["meets","unclear","fails"]),note:z.string()})),matched_tags:z.array(z.string())});
export const POST=(request:Request)=>api(async()=>{
 const user=await owner(request);const input=matchSchema.parse(await body(request));
 const key=setting("OPENAI_API_KEY"),model=setting("OPENAI_MODEL");
 if(!key||!model)return json({error:"api_key_missing",guidance:"AI 심사는 본인 OPENAI_API_KEY와 OPENAI_MODEL을 서버 환경변수에 설정해야 합니다. 저장·검색·공고 검토는 API 없이 사용할 수 있습니다."},503);
 const profile=await readProfile(user);if(!profile)return json({error:"profile_missing",guidance:"프로필 탭에서 기업 프로필을 먼저 저장해주세요."},409);
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
  if(!response.ok)throw new Error(`AI 서비스 요청 실패 (HTTP ${response.status})`);
  const completion=await response.json() as {choices?:{message?:{content?:string}}[]};
  const parsed=JSON.parse(completion.choices?.[0]?.message?.content??"{}");
  for(let i=0;i<programs.length;i++){
   const candidates=Array.isArray(parsed.results)?parsed.results.filter((r:{id?:string})=>r.id===programs[i].id):[];
   const check=resultSchema.safeParse(candidates[0]);
   if(candidates.length!==1||!check.success){await failure(i,"AI 결과 누락 또는 잘못된 결과: 다시 심사해주세요");continue;}
   const r=check.data;
   if(sources[i].sourceStatus!=="original"||sources[i].truncated){if(r.grade==='S'||r.grade==='A'){r.grade='B';r.score=Math.min(r.score,79);}r.eligibility.push({requirement:"공식 원문 전체 확인",status:"unclear",note:sources[i].sourceError??"긴 본문의 일부만 읽었습니다. 원문 전체를 확인해주세요."});}
   if(r.grade==='S'&&r.eligibility.some(e=>e.status!=='meets')){r.grade='B';r.score=Math.min(r.score,79);}
   const stored=await patchProgram(user,r.id,{grade:r.grade,score:r.score,why:r.why,eligibility:r.eligibility,matchedTags:r.matched_tags,matchedAt:reviewedAt,assessment:assessments[i]});
   if(stored)results.push({...r,assessment:assessments[i]});else await failure(i,"평가 결과를 저장하지 못했습니다");
  }
  return json({matched:results.length,results,failed,batchSize:8});
 }catch(error){
  const detail=error instanceof Error&&error.message.startsWith('AI 서비스')?error.message:"AI 응답을 처리하지 못했습니다. 다시 시도해주세요.";
  const done=new Set([...results,...failed].map(r=>r.id));for(let i=0;i<programs.length;i++)if(!done.has(programs[i].id))await failure(i,detail);
  return json({error:"match_failed",detail,matched:results.length,results,failed},502);
 }
});
