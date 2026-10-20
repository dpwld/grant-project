"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ds/core/Button";
import { Tag } from "@/components/ds/core/Tag";
import { ProgressBar } from "@/components/ds/feedback/ProgressBar";
import { FormField } from "@/components/ds/forms/FormField";
import { Input } from "@/components/ds/forms/Input";
import { Textarea } from "@/components/ds/forms/Textarea";
import { EMPTY_PROFILE, type GrantProfile } from "@/lib/data/grants";
import { completeProfileSchema, profileSchema } from "@/lib/server/validation";
import { profileCompleteness } from "./grantFormat";

const FOCUS_PRESETS = [
  { label: "Funding (default)", text: "" },
  { label: "Patents & IP", text: "Prioritize patent and intellectual property support: filing and registration costs, IP commercialization and consulting, international filings, and patent-based R&D. General operating funds or training-only programs are less relevant." },
  { label: "All support types", text: "No restriction on support type. Consider funding, patents, certifications, exports, hiring, and workspace when relevant to the business." },
];

interface GrantsProfileTabProps {
  profile: GrantProfile | null;
  saving: boolean;
  onboarding?: boolean;
  onSave: (p: GrantProfile, completeSetup: boolean) => Promise<void>;
}

export function GrantsProfileTab({ profile, saving, onboarding = false, onSave }: GrantsProfileTabProps) {
  const [form, setForm] = useState<GrantProfile>(profile ?? EMPTY_PROFILE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [dirty, setDirty] = useState(false);
  const comp = profileCompleteness(form);
  const set = <K extends keyof GrantProfile>(key: K, value: GrantProfile[K]) => {
    setForm(f => ({ ...f, [key]: value }));
    setDirty(true);
    setErrors(previous => ({ ...previous, [key]: "" }));
    setSaveError("");
  };
  const save = async (completeSetup: boolean) => {
    const result = (completeSetup ? completeProfileSchema : profileSchema).safeParse(form);
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])));
      setSaveError("Check the highlighted fields. Your changes have not been saved.");
      return;
    }
    setErrors({});
    setSaveError("");
    try { await onSave(result.data, completeSetup); setDirty(false); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save. Your entries are still here; please retry."); }
  };
  const field = (key: keyof GrantProfile) => ({ id: `company-${key}`, "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `error-${key}` : undefined });
  const label = (key: keyof GrantProfile, name: string, required = false) => ({ label: name, required, htmlFor: `company-${key}`, error: errors[key] ? <span id={`error-${key}`}>{errors[key]}</span> : undefined });

  return (
    <form noValidate onSubmit={event => { event.preventDefault(); void save(true); }} className="company-profile" aria-label={onboarding ? "Company setup" : "Edit company profile"}>
      <div className="profile-progress">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <strong>Profile completeness {comp.pct}%</strong>
          {comp.tiers.map(t => <span key={t.label}>{t.label} {t.done}/{t.total}</span>)}
        </div>
        <ProgressBar value={comp.pct} />
        <p>Complete the six required fields to start. Add other details whenever you are ready.</p>
      </div>

      <Section title="Company basics" hint="Required for recommendations · * required">
        <Row>
          <FormField {...label("companyName", "Company name", true)}><Input {...field("companyName")} className="sx-ghost" maxLength={500} value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Your company name" /></FormField>
          <FormField {...label("entityType", "Company type", true)}><Input {...field("entityType")} className="sx-ghost" maxLength={500} value={form.entityType} onChange={e => set("entityType", e.target.value)} placeholder="e.g. Corporation or sole proprietor" /></FormField>
        </Row>
        <Row>
          <FormField {...label("foundedOn", "Founding date", true)}><Input {...field("foundedOn")} className="sx-ghost" type="date" max={new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())} value={form.foundedOn ?? ""} onChange={e => set("foundedOn", e.target.value || null)} /></FormField>
          <FormField {...label("industry", "Primary industry", true)}><Input {...field("industry")} className="sx-ghost" maxLength={500} value={form.industry} onChange={e => set("industry", e.target.value)} placeholder="e.g. Software development" /></FormField>
        </Row>
        <Row>
          <FormField {...label("regionSi", "City or province", true)}><Input {...field("regionSi")} className="sx-ghost" maxLength={500} value={form.regionSi} onChange={e => set("regionSi", e.target.value)} placeholder="Company's registered location" /></FormField>
          <FormField {...label("regionGu", "District")}><Input {...field("regionGu")} className="sx-ghost" maxLength={500} value={form.regionGu} onChange={e => set("regionGu", e.target.value)} placeholder="City, county, or district" /></FormField>
        </Row>
        <FormField {...label("businessSummary", "Business summary", true)}><Textarea {...field("businessSummary")} className="sx-ghost" rows={3} maxLength={20000} value={form.businessSummary} onChange={e => set("businessSummary", e.target.value)} placeholder="Describe what you make and who you serve in 2–3 sentences." /></FormField>
      </Section>

      <details className="profile-extra" open={!onboarding}><summary>Matching preferences and optional details</summary><div className="profile-extra-fields">
      <Section title="Matching preferences" hint="Choose the support you need">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{FOCUS_PRESETS.map(p => <Button key={p.label} type="button" size="sm" variant={form.matchFocus === p.text ? "soft" : "ghost"} onClick={() => set("matchFocus", p.text)}>{p.label}</Button>)}</div>
        <FormField {...label("matchFocus", "Matching focus")} hint="Leave blank to prioritize funding."><Textarea {...field("matchFocus")} className="sx-ghost" rows={3} maxLength={20000} value={form.matchFocus} onChange={e => set("matchFocus", e.target.value)} placeholder="Describe the support you want, such as patent filing costs or export assistance." /></FormField>
        <p className="profile-hint">After changing a saved profile, run Review all again from Recommendations to update existing grades.</p>
      </Section>

      <Section title="Recommended details" hint="Help assess eligibility more accurately">
        <ChipEditor label="Matching keywords" hint="Relevant terms to compare with announcements." values={form.keywords} onChange={v => set("keywords", v)} placeholder="Business keyword" error={errors.keywords} />
        <ChipEditor label="Certifications" values={form.certifications} onChange={v => set("certifications", v)} placeholder="e.g. Venture certification" error={errors.certifications} />
        <Row>
          <FormField {...label("employeeCount", "Employee count")}><Input {...field("employeeCount")} className="sx-ghost" type="number" min={0} max={10000000} step={1} value={form.employeeCount ?? ""} onChange={e => set("employeeCount", e.target.value === "" ? null : Number(e.target.value))} suffix="people" /></FormField>
          <FormField {...label("coreTech", "Core technology")}><Input {...field("coreTech")} className="sx-ghost" maxLength={20000} value={form.coreTech} onChange={e => set("coreTech", e.target.value)} placeholder="Technology and differentiators" /></FormField>
        </Row>
        <ChipEditor label="Excluded keywords" hint="Fields you prefer to avoid; actual eligibility is assessed separately." values={form.excludeKeywords} onChange={v => set("excludeKeywords", v)} placeholder="Field to avoid" error={errors.excludeKeywords} />
      </Section>

      <Section title="Additional details" hint="Optional">
        <Row>
          <FormField {...label("revenueBand", "Revenue range")}><Input {...field("revenueBand")} className="sx-ghost" maxLength={500} value={form.revenueBand} onChange={e => set("revenueBand", e.target.value)} placeholder="e.g. Under KRW 1 billion" /></FormField>
          <FormField {...label("subIndustry", "Industry specialization")}><Input {...field("subIndustry")} className="sx-ghost" maxLength={500} value={form.subIndustry} onChange={e => set("subIndustry", e.target.value)} placeholder="Your specific business area" /></FormField>
        </Row>
        <FormField {...label("achievements", "Key achievements")}><Textarea {...field("achievements")} className="sx-ghost" rows={3} maxLength={20000} value={form.achievements} onChange={e => set("achievements", e.target.value)} placeholder="Awards, investment, or major contracts" /></FormField>
      </Section>
      </div></details>
      <div className="profile-save">
        {saveError && <p role="alert" className="profile-error">{saveError}</p>}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Button type="submit" variant="primary" loading={saving}>{onboarding ? "Save and continue" : "Save profile"}</Button>
          {onboarding && <Button type="button" variant="secondary" disabled={saving} onClick={() => void save(false)}>Save draft</Button>}
          <span role="status" className="profile-hint">{saving ? "Saving to your account…" : dirty ? "Unsaved changes" : profile ? "Saved to your account" : "Not saved yet"}</span>
        </div>
        <p className="profile-hint">{onboarding ? "Save a draft with your company name to resume later. Recommendations open when all required fields are complete." : "Your saved information is available when you return. Save changes before leaving this page."}</p>
      </div>
    </form>
  );
}
function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return <section className="profile-section"><div><h2>{title}</h2><p className="profile-hint">{hint}</p></div>{children}</section>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="sx-grid-m1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{children}</div>;
}
function ChipEditor({ label, hint, values, onChange, placeholder, error }: { label: string; hint?: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; error?: string }) {
  const [draft, setDraft] = useState("");
  const add = () => { const value = draft.trim(); if (!value || values.includes(value)) return; onChange([...values, value]); setDraft(""); };
  return <FormField label={label} hint={hint} error={error}><div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
    {values.map(value => <Tag key={value} size="sm" onRemove={() => onChange(values.filter(item => item !== value))}>{value}</Tag>)}
    <div style={{ display: "flex", gap: 4, alignItems: "center", maxWidth: "100%" }}><Input className="sx-ghost" size="sm" aria-label={label} maxLength={500} value={draft} placeholder={placeholder} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }} /><Button type="button" variant="ghost" size="sm" onClick={add} aria-label={`Add ${label.toLowerCase()}`}><Plus size={14} /></Button></div>
  </div></FormField>;
}
