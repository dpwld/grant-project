import { z } from "zod";
const short=z.string().trim().max(500);
const long=z.string().max(20000);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v).nullable();
const tags=z.array(short).max(100);
export const profileSchema=z.object({
 companyName:short.min(1,"Enter a company name."),entityType:short,foundedOn:date.refine(v=>v===null||v<=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul"}).format(new Date()),"Founding date cannot be in the future."),industry:short,subIndustry:short,
 regionSi:short,regionGu:short,businessSummary:long,employeeCount:z.number().int().min(0).max(10000000).nullable(),
 revenueBand:short,certifications:tags,keywords:tags,excludeKeywords:tags,achievements:long,coreTech:long,matchFocus:long,
});
export const completeProfileSchema=profileSchema.extend({
 entityType:short.min(1,"Enter the company type."),
 foundedOn:profileSchema.shape.foundedOn.refine(v=>v!==null,"Enter the founding date."),
 industry:short.min(1,"Enter the primary industry."),
 regionSi:short.min(1,"Enter the city or province."),
 businessSummary:long.trim().min(1,"Describe what your company does."),
});
export const hasCompanySetup=(profile:unknown)=>completeProfileSchema.safeParse(profile).success;
export const profileSaveSchema=profileSchema.extend({completeSetup:z.boolean().optional()}).superRefine((value,context)=>{
 if(value.completeSetup){const result=completeProfileSchema.safeParse(value);if(!result.success)for(const issue of result.error.issues)context.addIssue(issue);}
});
const safeUrl=z.string().max(4000).refine(v=>v===""||(/^https?:\/\//.test(v)&&(()=>{try{const u=new URL(v);return !u.username&&!u.password;}catch{return false;}})()));
export const ingestSchema=z.object({
 source:z.enum(["bizinfo","kstartup","manual"]),sourceId:short.min(1),title:short.min(1),url:safeUrl,summary:long,
 supportTypes:tags,targets:tags,region:short,amountText:short,applyStart:date,applyEnd:date,
}).strict();
export const patchSchema=z.object({starred:z.boolean().optional(),dismissed:z.boolean().optional(),feedback:z.enum(["up","down"]).nullable().optional(),sprintTaskId:z.string().max(100).nullable().optional()}).strict().refine(v=>Object.keys(v).length>0);
export const importSchema=z.array(ingestSchema).min(1).max(500);
export const matchSchema=z.object({mode:z.enum(["all","unmatched"]).optional(),ids:z.array(z.string().min(1).max(300)).min(1).max(8).optional()}).strict();
export type IngestProgram=z.infer<typeof ingestSchema>;
