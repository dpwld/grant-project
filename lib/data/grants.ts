import type { GrantAssessment } from "@/lib/grants/assessment";
export type GrantSource = "bizinfo" | "kstartup" | "manual";
export type GrantGrade = "S" | "A" | "B" | "C" | "D";
export type EligibilityStatus = "meets" | "unclear" | "fails";

export interface GrantEligibility {
  requirement: string;
  status: EligibilityStatus;
  note: string;
}

export interface GrantProgram {
  id: string;
  source: GrantSource;
  sourceId: string;
  title: string;
  url: string;
  summary: string;
  supportTypes: string[];
  targets: string[];
  region: string;
  amountText: string;
  applyStart: string | null;
  applyEnd: string | null;
  grade: GrantGrade | null;
  score: number | null;
  why: string;
  eligibility: GrantEligibility[];
  matchedTags: string[];
  matchedAt: string | null;
  assessment?: GrantAssessment | null;
  starred: boolean;
  dismissed: boolean;
  feedback: "up" | "down" | null;
  sprintTaskId: string | null;
  createdAt: string;
}

export interface GrantProfile {
  companyName: string;
  entityType: string;
  foundedOn: string | null;
  industry: string;
  subIndustry: string;
  regionSi: string;
  regionGu: string;
  businessSummary: string;
  employeeCount: number | null;
  revenueBand: string;
  certifications: string[];
  keywords: string[];
  excludeKeywords: string[];
  achievements: string;
  coreTech: string;
  /** AI 매칭 기준 — 이번 검색에서 찾는 지원 형태 (빈 값 = 기본: 자금 지원 중심). */
  matchFocus: string;
  updatedAt?: string;
}

export interface GrantSyncRun {
  source: string;
  fetched: number;
  inserted: number;
  ranAt: string;
}

export const EMPTY_PROFILE: GrantProfile = {
  companyName: "", entityType: "", foundedOn: null, industry: "", subIndustry: "",
  regionSi: "", regionGu: "", businessSummary: "", employeeCount: null, revenueBand: "",
  certifications: [], keywords: [], excludeKeywords: [], achievements: "", coreTech: "", matchFocus: "",
};

export interface GrantsData {
  programs: GrantProgram[];
  profile: GrantProfile | null;
  lastSync: GrantSyncRun | null;
}


async function request<T>(path:string, method="GET", body?:unknown):Promise<T>{
 const response=await fetch(path,{method,headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await response.json() as T & {guidance?:string;error?:string}; if(!response.ok) throw new Error(value.guidance??value.error??"요청 실패"); return value;
}
export const fetchGrantsData=()=>request<GrantsData>("/api/grants");
export const saveProfile=(profile:GrantProfile,_meKey:string)=>request<GrantProfile>("/api/grants/profile","PUT",profile);
export const setStarred=(id:string,v:boolean)=>request<GrantProgram>(`/api/grants/programs/${encodeURIComponent(id)}`,"PATCH",{starred:v});
export const setDismissed=(id:string,v:boolean)=>request<GrantProgram>(`/api/grants/programs/${encodeURIComponent(id)}`,"PATCH",{dismissed:v});
export const setFeedback=(id:string,v:"up"|"down"|null)=>request<GrantProgram>(`/api/grants/programs/${encodeURIComponent(id)}`,"PATCH",{feedback:v});
export const linkSprintTask=(id:string,taskId:string)=>request<GrantProgram>(`/api/grants/programs/${encodeURIComponent(id)}`,"PATCH",{sprintTaskId:taskId});
