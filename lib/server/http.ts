import { getChatGPTUser } from "@/app/chatgpt-auth";
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export async function owner(request?:Request){
 const user=await getChatGPTUser(); if(!user) throw new HttpError(401,"로그인이 필요합니다.");
 if(request && !["GET","HEAD"].includes(request.method)) {
  const origin=request.headers.get("origin");
  if(origin && origin!==new URL(request.url).origin) throw new HttpError(403,"허용되지 않은 요청 출처입니다.");
 }
 return user.userId;
}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store"}});}
export async function body(request:Request){
 const value=await request.text(); if(value.length>1_000_000) throw new HttpError(413,"파일은 1MB 이하로 나눠주세요.");
 try{return JSON.parse(value);}catch{throw new HttpError(400,"올바른 JSON이 필요합니다.");}
}
export async function api(run:()=>Promise<Response>){
 try{return await run();}catch(error){
  if(error instanceof HttpError)return json({error:error.message},error.status);
  if(error && typeof error==='object' && 'issues' in error)return json({error:"입력 형식 또는 값이 올바르지 않습니다."},400);
  console.error("Grants request failed",error instanceof Error?error.name:"unknown");
  return json({error:"서버 처리에 실패했습니다. 입력을 유지한 채 다시 시도해 주세요."},500);
 }
}
