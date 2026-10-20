import { api,json,owner,body } from "@/lib/server/http";
import { writeProfile } from "@/lib/server/store";
import { profileSchema } from "@/lib/server/validation";
export const PUT=(req:Request)=>api(async()=>{const id=await owner(req);const input=profileSchema.parse(await body(req));return json(await writeProfile(id,input));});
