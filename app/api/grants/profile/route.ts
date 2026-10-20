import { api,json,owner,body } from "@/lib/server/http";
import { writeProfile } from "@/lib/server/store";
import { profileSaveSchema } from "@/lib/server/validation";
export const PUT=(req:Request)=>api(async()=>{const id=await owner(req);const {completeSetup:_,...input}=profileSaveSchema.parse(await body(req));return json(await writeProfile(id,input));});
