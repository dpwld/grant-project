import { api,json,owner } from "@/lib/server/http";
import { readPrograms,readProfile,lastSync } from "@/lib/server/store";
export const GET=()=>api(async()=>{const id=await owner();const [programs,profile,sync]=await Promise.all([readPrograms(id),readProfile(id),lastSync(id)]);return json({programs,profile,lastSync:sync});});
