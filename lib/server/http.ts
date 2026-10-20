import { getChatGPTUser } from "@/app/chatgpt-auth";
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export async function owner(request?:Request){
 const user=await getChatGPTUser(); if(!user) throw new HttpError(401,"Sign in to continue.");
 if(request && !["GET","HEAD"].includes(request.method)) {
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin) throw new HttpError(403,"This request origin is not allowed.");
 }
 return user.userId;
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
export async function body(request:Request){
 const value=await request.text(); if(value.length>1_000_000) throw new HttpError(413,"Split the file into files of 1 MB or less.");
 try{return JSON.parse(value);}catch{throw new HttpError(400,"Provide valid JSON.");}
}
export async function api(run:()=>Promise<Response>){
 try{return await run();}catch(error){
  if(error instanceof HttpError)return json({error:error.message},error.status);
  if(error && typeof error==='object' && 'issues' in error)return json({error:"The input format or value is invalid."},400);
  console.error("Grants request failed",error instanceof Error?error.name:"unknown");
  return json({error:"The server could not complete the request. Keep your entries and try again."},500);
 }
}
