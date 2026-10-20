import { env } from "cloudflare:workers";
import type { GrantProgram, GrantProfile, GrantSyncRun } from "@/lib/data/grants";
import type { IngestProgram } from "./validation";
export const database=()=>env.DB!;
export async function readProfile(owner:string):Promise<GrantProfile|null>{
 const row=await database().prepare("SELECT data FROM grant_profiles WHERE owner=?").bind(owner).first<{data:string}>();
 return row?JSON.parse(row.data):null;
}
export async function writeProfile(owner:string,input:GrantProfile){
 const value={...input,updatedAt:new Date().toISOString()};
 await database().prepare("INSERT INTO grant_profiles(owner,data) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET data=excluded.data").bind(owner,JSON.stringify(value)).run();return value;
}
export async function readPrograms(owner:string):Promise<GrantProgram[]>{
 const result=await database().prepare("SELECT data FROM grant_programs WHERE owner=? ORDER BY json_extract(data,'$.applyEnd') IS NULL,json_extract(data,'$.applyEnd'),id").bind(owner).all<{data:string}>();
 return result.results.map(row=>JSON.parse(row.data));
}
export async function readProgram(owner:string,id:string):Promise<GrantProgram|null>{
 const row=await database().prepare("SELECT data FROM grant_programs WHERE owner=? AND id=?").bind(owner,id).first<{data:string}>();return row?JSON.parse(row.data):null;
}
export async function patchProgram(owner:string,id:string,patch:Partial<GrantProgram>):Promise<GrantProgram|null>{
 // json_set keeps explicit null values, unlike JSON Merge Patch.
 const entries=Object.entries(patch); const placeholders=entries.map(()=>"?,json(?)").join(",");
 const args=entries.flatMap(([key,value])=>[`$.${key}`,JSON.stringify(value)]);
 const row=await database().prepare(`UPDATE grant_programs SET data=json_set(data,${placeholders}) WHERE owner=? AND id=? RETURNING data`).bind(...args,owner,id).first<{data:string}>();
 return row?JSON.parse(row.data):null;
}
export async function ingest(owner:string,rows:IngestProgram[]){
 const now=new Date().toISOString();
 for(let start=0;start<rows.length;start+=100){
  await database().batch(rows.slice(start,start+100).map(row=>{
   const id=`${row.source}:${row.sourceId}`;
   const fresh:GrantProgram={...row,id,grade:null,score:null,why:"",eligibility:[],matchedTags:[],matchedAt:null,assessment:null,starred:false,dismissed:false,feedback:null,sprintTaskId:null,createdAt:now};
   // Imported official content cannot overwrite user's review or curation fields.
   const fields=Object.entries(row);const paths=fields.map(()=>"?,json(?)").join(",");
   return database().prepare(`INSERT INTO grant_programs(owner,id,data) VALUES(?,?,?) ON CONFLICT(owner,id) DO UPDATE SET data=json_set(grant_programs.data,${paths})`).bind(owner,id,JSON.stringify(fresh),...fields.flatMap(([key,value])=>[`$.${key}`,JSON.stringify(value)]));
  }));
 }
 return rows.length;
}
export async function writeSync(owner:string,run:GrantSyncRun){await database().prepare("INSERT INTO grant_sync_runs(owner,id,data) VALUES(?,?,?)").bind(owner,crypto.randomUUID(),JSON.stringify(run)).run();}
export async function lastSync(owner:string):Promise<GrantSyncRun|null>{const row=await database().prepare("SELECT data FROM grant_sync_runs WHERE owner=? ORDER BY json_extract(data,'$.ranAt') DESC LIMIT 1").bind(owner).first<{data:string}>();return row?JSON.parse(row.data):null;}
