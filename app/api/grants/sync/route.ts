import { api,json,owner } from "@/lib/server/http";
import { setting } from "@/lib/server/config";
import { ingest,writeSync } from "@/lib/server/store";
import { ingestSchema } from "@/lib/server/validation";
import { fetchBizinfo,fetchKstartup,normalizeKey,type IngestRow } from "@/lib/grants/collectors";
export const POST=(request:Request)=>api(async()=>{
 const user=await owner(request);
 const keys={bizinfo:normalizeKey(setting("BIZINFO_API_KEY")),kstartup:normalizeKey(setting("KSTARTUP_API_KEY"))};
 if(!keys.bizinfo&&!keys.kstartup)return json({error:"api_key_missing",guidance:"Set BIZINFO_API_KEY or KSTARTUP_API_KEY on the server to sync announcements. See the README prerequisites. JSON import works without collection API keys."},503);
 const sources=[{source:"bizinfo" as const,run:fetchBizinfo},{source:"kstartup" as const,run:fetchKstartup}];
 const results=await Promise.all(sources.map(async({source,run})=>{
  if(!keys[source])return {source,fetched:0,upserted:0,error:"An announcement API key is not configured"};
  try{
   const records:IngestRow[]=await run(keys[source]);
   const rows=records.map(r=>ingestSchema.parse({source:r.source,sourceId:r.source_id,title:r.title,url:r.url,summary:r.summary,supportTypes:r.support_types,targets:r.targets,region:r.region,amountText:r.amount_text,applyStart:r.apply_start,applyEnd:r.apply_end}));
   const upserted=await ingest(user,rows);
   await writeSync(user,{source,fetched:rows.length,inserted:upserted,ranAt:new Date().toISOString()});
   return {source,fetched:rows.length,upserted};
  }catch(error){let message=error instanceof Error?error.message:"Announcement collection failed";for(const key of Object.values(keys))if(key)message=message.split(key).join("[redacted]");return {source,fetched:0,upserted:0,error:message.slice(0,180)};}
 }));
 const complete=results.every(r=>!r.error);return json({results,complete},complete?200:502);
});
