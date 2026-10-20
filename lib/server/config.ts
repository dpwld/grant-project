import { env } from "cloudflare:workers";
export function setting(name:string):string{return String((env as unknown as Record<string,unknown>)[name]??process.env[name]??"").trim();}
export function sprintServiceUrl(){const url=setting("SPRINT_SERVICE_URL");if(!url)return null;try{const parsed=new URL(url);return parsed.protocol==='https:'||(['localhost','127.0.0.1'].includes(parsed.hostname)&&parsed.protocol==='http:')?parsed.origin:null;}catch{return null;}}
