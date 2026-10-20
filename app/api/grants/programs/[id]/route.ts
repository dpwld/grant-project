import { api,json,owner,body,HttpError } from "@/lib/server/http";
import { patchProgram } from "@/lib/server/store";
import { patchSchema } from "@/lib/server/validation";
export const PATCH=(req:Request,context:{params:Promise<{id:string}>})=>api(async()=>{const user=await owner(req);const {id}=await context.params;const patch=patchSchema.parse(await body(req));const result=await patchProgram(user,id,patch);if(!result)throw new HttpError(404,"Announcement not found.");return json(result);});
