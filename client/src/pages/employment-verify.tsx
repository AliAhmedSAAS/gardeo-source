import { useState } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

type FormData = {
  companyName: string;
  applicantName: string;
  dateOfBirth: string | null;
  address: string | null;
  postcode: string | null;
  nationalInsurance: string | null;
  appliedPosition: string;
  employerName: string;
  statedRole: string;
  dateFrom: string | null;
  dateTo: string | null;
  expiresAt: string;
  alreadySubmitted: boolean;
};

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2 border-b pb-3">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={value === opt.value ? "default" : "outline"}
            className={value === opt.value ? "bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" : ""}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-1.5 border-b border-muted/60 text-sm">
      <div className="text-muted-foreground font-medium">{label}</div>
      <div className="sm:col-span-2 font-semibold">{value || "—"}</div>
    </div>
  );
}

export default function EmploymentVerifyPage() {
  const [, params] = useRoute("/verify/employment/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    informationConfirmed: true,
    detailsIfDifferent: "",
    attitude: "good",
    timeKeeping: "good",
    timeOff: "average",
    reasonForLeaving: "own_accord",
    wouldReemploy: "yes",
    refereePrintName: "",
    refereeCompany: "",
    refereePosition: "",
    refereeSignature: "",
  });

  const { data, isLoading, isError, error } = useQuery<FormData>({
    queryKey: ["/api/verify/employment", token],
    queryFn: async () => {
      const res = await fetch(`/api/verify/employment/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to load form");
      return body;
    },
    enabled: !!token,
    retry: false,
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/verify/employment/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to submit");
      return body;
    },
    onSuccess: () => setSubmitted(true),
  });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Invalid link</h2>
            <p className="text-muted-foreground text-sm">Use the full verification link from the email.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#1F3A5F]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Link unavailable</h2>
            <p className="text-muted-foreground text-sm">
              {(error as Error)?.message || "This verification link is invalid or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-green-700">Thank you</h2>
            <p className="text-sm text-muted-foreground">
              Your employment reference for {data.applicantName} has been submitted to {data.companyName}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const period =
    data.dateFrom || data.dateTo
      ? `${data.dateFrom || "?"} to ${data.dateTo || "Present"}`
      : "—";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1F3A5F] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-[#1F3A5F]">{data.companyName}</span>
        </div>

        <Card className="shadow-md border-0">
          <CardHeader className="bg-[#1F3A5F] rounded-t-lg px-6 py-5">
            <h1 className="text-white text-lg font-bold">Employment reference verification</h1>
            <p className="text-blue-200 text-xs mt-1 uppercase tracking-wide">
              The information provided is strictly confidential. We would be grateful if you would supply us with the following information.
            </p>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold mb-2 text-[#1F3A5F]">Applicant information</h2>
              <InfoRow label="Name of applicant" value={data.applicantName} />
              <InfoRow label="Date of birth" value={data.dateOfBirth || "—"} />
              <InfoRow label="Address" value={data.address || "—"} />
              <InfoRow label="Post code" value={data.postcode || "—"} />
              <InfoRow label="N.I. No" value={data.nationalInsurance || "—"} />
              <InfoRow label="Applied position" value={data.appliedPosition} />
              <InfoRow label="Stated employment" value={`${period} — ${data.statedRole}`} />
              <InfoRow label="Previous employer" value={data.employerName} />
            </div>

            <div className="space-y-4">
              <ChoiceRow
                label="Confirmation of above information"
                value={form.informationConfirmed ? "yes" : "no"}
                options={[
                  { value: "yes", label: "YES" },
                  { value: "no", label: "NO" },
                ]}
                onChange={(v) => setForm((f) => ({ ...f, informationConfirmed: v === "yes" }))}
              />

              <div className="space-y-1.5">
                <Label className="text-sm">Details of employment (if different)</Label>
                <Textarea
                  rows={2}
                  value={form.detailsIfDifferent}
                  onChange={(e) => setForm((f) => ({ ...f, detailsIfDifferent: e.target.value }))}
                  placeholder="Leave blank if the stated details are correct"
                />
              </div>

              <ChoiceRow
                label="Attitude to work"
                value={form.attitude}
                options={[
                  { value: "good", label: "Good" },
                  { value: "average", label: "Average" },
                  { value: "poor", label: "Poor" },
                ]}
                onChange={(v) => setForm((f) => ({ ...f, attitude: v }))}
              />
              <ChoiceRow
                label="Time keeping"
                value={form.timeKeeping}
                options={[
                  { value: "good", label: "Good" },
                  { value: "poor", label: "Poor" },
                ]}
                onChange={(v) => setForm((f) => ({ ...f, timeKeeping: v }))}
              />
              <ChoiceRow
                label="Time off"
                value={form.timeOff}
                options={[
                  { value: "average", label: "Average" },
                  { value: "more_than_average", label: "More than average" },
                ]}
                onChange={(v) => setForm((f) => ({ ...f, timeOff: v }))}
              />
              <ChoiceRow
                label="Reason for leaving company"
                value={form.reasonForLeaving}
                options={[
                  { value: "own_accord", label: "Own accord" },
                  { value: "dismissed", label: "Dismissed" },
                ]}
                onChange={(v) => setForm((f) => ({ ...f, reasonForLeaving: v }))}
              />
              <ChoiceRow
                label="Would you re-employ this person"
                value={form.wouldReemploy}
                options={[
                  { value: "yes", label: "YES" },
                  { value: "no", label: "NO" },
                  { value: "cannot_comment", label: "Cannot comment" },
                ]}
                onChange={(v) => setForm((f) => ({ ...f, wouldReemploy: v }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label>Print name *</Label>
                <Input
                  value={form.refereePrintName}
                  onChange={(e) => setForm((f) => ({ ...f, refereePrintName: e.target.value }))}
                  data-testid="input-ref-print-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Company *</Label>
                <Input
                  value={form.refereeCompany}
                  onChange={(e) => setForm((f) => ({ ...f, refereeCompany: e.target.value }))}
                  placeholder={data.employerName}
                  data-testid="input-ref-company"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Position *</Label>
                <Input
                  value={form.refereePosition}
                  onChange={(e) => setForm((f) => ({ ...f, refereePosition: e.target.value }))}
                  data-testid="input-ref-position"
                />
              </div>
            </div>

            <SignaturePad
              value={form.refereeSignature}
              onChange={(data) => setForm((f) => ({ ...f, refereeSignature: data }))}
              label="Signature *"
            />

            {submitMut.isError && (
              <p className="text-sm text-red-600">{(submitMut.error as Error).message}</p>
            )}

            <Button
              className="w-full bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
              size="lg"
              disabled={
                submitMut.isPending ||
                !form.refereePrintName.trim() ||
                !form.refereeCompany.trim() ||
                !form.refereePosition.trim() ||
                !form.refereeSignature
              }
              onClick={() => submitMut.mutate()}
              data-testid="button-submit-employment-verify"
            >
              {submitMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Submit reference
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Secure reference portal for {data.companyName}. Link expires after use or after 14 days.
        </p>
      </div>
    </div>
  );
}
