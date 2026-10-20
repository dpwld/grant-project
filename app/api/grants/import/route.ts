import { api,json,owner,body } from "@/lib/server/http";
import { ingest,writeSync } from "@/lib/server/store";
import { importSchema } from "@/lib/server/validation";
export const POST=(req:Request)=>api(async()=>{const id=await owner(req);const rows=importSchema.parse(await body(req));const count=await ingest(id,rows);await writeSync(id,{source:"import",fetched:rows.length,inserted:count,ranAt:new Date().toISOString()});return json({inserted:count});});
