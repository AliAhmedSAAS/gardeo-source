import { useEffect, useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { Loader2, CheckCircle2, XCircle, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Question = { key: "q1" | "q2" | "q3" | "q4" | "q5" | "q6" | "q7" | "q8" | "q9"; label: string };
type Rating = { value: string; label: string };

type FormData = {
  companyName: string;
  officerName: string;
  issueNumber: number;
  expiresAt: string;
  questions: Question[];
  ratings: Rating[];
  alreadySubmitted: boolean;
};

const EMPTY_ANSWERS = {
  q1: "",
  q2: "",
  q3: "",
  q4: "",
  q5: "",
  q6: "",
  q7: "",
  q8: "",
  q9: "",
};

function StatusCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f1ea] p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-3">
          {icon}
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-muted-foreground text-sm">{children}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StaffFeedbackPage() {
  const [, params] = useRoute("/feedback/:token");
  const token = params?.token ?? "";
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);
  const [comments, setComments] = useState("");
  const [printName, setPrintName] = useState("");
  const [signature, setSignature] = useState("");
  const [namePrefill, setNamePrefill] = useState(false);

  const { data, isLoading, isError, error } = useQuery<FormData>({
    queryKey: ["/api/public/feedback", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/feedback/${token}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to load form");
      return body;
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (!data?.officerName || namePrefill) return;
    setPrintName(data.officerName);
    setNamePrefill(true);
  }, [data?.officerName, namePrefill]);

  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/public/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...answers,
          comments,
          printName,
          signature,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to submit");
      return body;
    },
    onSuccess: () => setSubmitted(true),
  });

  if (!token) {
    return (
      <StatusCard icon={<XCircle className="w-12 h-12 text-red-500 mx-auto" />} title="Invalid link">
        Use the full feedback link from the email.
      </StatusCard>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f1ea]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F2942]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <StatusCard icon={<XCircle className="w-12 h-12 text-red-500 mx-auto" />} title="Link unavailable">
        {(error as Error)?.message || "This feedback link is invalid or has expired."}
      </StatusCard>
    );
  }

  if (submitted) {
    return (
      <StatusCard
        icon={<CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />}
        title="Thank you"
      >
        Your Security Personnel Feedback Questionnaire has been submitted to {data.companyName}.
      </StatusCard>
    );
  }

  const questions = data.questions?.length ? data.questions : [];
  const ratings = data.ratings?.length ? data.ratings : [];
  const unanswered = questions.some((q) => !answers[q.key]);
  const hasPoor = questions.some((q) => answers[q.key] === "poor" || answers[q.key] === "very_poor");
  const commentsRequired = hasPoor && !comments.trim();

  return (
    <div className="min-h-screen bg-[#f4f1ea] py-6 px-3">
      <div className="w-full max-w-[780px] mx-auto bg-white shadow-md px-5 sm:px-8 py-7">
        <h1 className="text-center text-xl font-bold text-[#0F2942] tracking-tight">
          {data.companyName}
        </h1>
        <h2 className="text-center text-[13px] sm:text-sm font-bold text-[#1F4E79] mt-2 tracking-wide">
          SECURITY PERSONNEL FEEDBACK QUESTIONNAIRE
        </h2>
        <p className="text-center text-xs text-[#8B7355] mt-1.5">
          Confidential appraisal of company support, training and supervision
        </p>
        <div className="h-px bg-[#0F2942] mt-4 mb-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div className="flex gap-3 items-baseline py-1.5 border-b border-dotted border-neutral-300">
            <span className="text-xs font-bold text-[#0F2942] w-[92px] shrink-0">Name</span>
            <span className="text-sm text-[#111]">{data.officerName || "—"}</span>
          </div>
          <div className="flex gap-3 items-baseline py-1.5 border-b border-dotted border-neutral-300">
            <span className="text-xs font-bold text-[#0F2942] w-[92px] shrink-0">Issue number</span>
            <span className="text-sm text-[#111]">{data.issueNumber || 1}</span>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-[#0F2942]/30">
                <th className="text-left text-xs font-bold text-[#0F2942] pb-2 pr-2">Question</th>
                {ratings.map((opt) => (
                  <th key={opt.value} className="text-center text-[11px] font-bold text-[#0F2942] pb-2 w-[72px]">
                    {opt.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questions.map((q, i) => (
                <tr key={q.key} className="border-b border-neutral-200">
                  <td className="py-2 pr-3 text-[13px] text-[#111] leading-snug">
                    {i + 1}. {q.label}
                  </td>
                  {ratings.map((opt) => {
                    const selected = answers[q.key] === opt.value;
                    return (
                      <td key={opt.value} className="py-2 text-center">
                        <button
                          type="button"
                          aria-label={`${q.label}: ${opt.label}`}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: opt.value }))}
                          className="inline-flex h-7 w-7 items-center justify-center mx-auto"
                        >
                          <span className="inline-flex h-[15px] w-[15px] items-center justify-center border border-black bg-white">
                            {selected ? <Check className="h-3 w-3 text-black" strokeWidth={3} /> : null}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[12px] text-[#333] mt-5 leading-relaxed">
          If you the SELF EMPLOYED PERSONNEL has scored &quot;POOR or VERY POOR&quot; please expand
          in order for us analyse your concerns. Please make comments if you wish to provide
          information to enhance the appraisal process.
        </p>
        <Textarea
          rows={2}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder={hasPoor ? "Required for Poor or Very poor ratings" : "Optional comments"}
          className="mt-2 min-h-[52px] border-0 border-b border-dotted border-neutral-400 rounded-none px-0 shadow-none focus-visible:ring-0"
          data-testid="input-feedback-comments"
        />

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <div>
            <div className="text-xs font-bold text-[#0F2942] mb-1">Signed</div>
            <SignaturePad value={signature} onChange={setSignature} label="" compact />
          </div>
          <div className="flex flex-col justify-end">
            <div className="flex gap-3 items-baseline py-1.5 border-b border-dotted border-neutral-300">
              <span className="text-xs font-bold text-[#0F2942] w-[92px] shrink-0">Print name</span>
              <Input
                value={printName}
                onChange={(e) => setPrintName(e.target.value)}
                className="h-7 border-0 rounded-none px-0 shadow-none focus-visible:ring-0"
                data-testid="input-feedback-print-name"
              />
            </div>
          </div>
        </div>

        {submitMut.isError && (
          <p className="text-sm text-red-600 mt-4">{(submitMut.error as Error).message}</p>
        )}
        {unanswered || commentsRequired || !printName.trim() || !signature ? (
          <p className="text-xs text-amber-800 mt-4">
            {unanswered
              ? "Please answer every question."
              : commentsRequired
                ? "Please add comments for Poor or Very poor ratings."
                : !signature
                  ? "Please sign the form."
                  : "Please enter your print name."}
          </p>
        ) : null}

        <Button
          className="w-full mt-5 bg-[#0F2942] hover:bg-[#0F2942]/90"
          size="lg"
          disabled={
            submitMut.isPending ||
            unanswered ||
            commentsRequired ||
            !printName.trim() ||
            !signature
          }
          onClick={() => submitMut.mutate()}
          data-testid="button-submit-staff-feedback"
        >
          {submitMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Submit feedback
        </Button>

        <p className="text-center text-[11px] text-neutral-500 mt-4">
          This form expires after use or after 14 days.
        </p>
      </div>
    </div>
  );
}
