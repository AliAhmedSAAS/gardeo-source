import { storage } from "./storage";
import type { InboxEmail, AiLearningEvent } from "@shared/schema";

const EMAIL_CATEGORIES = [
  "new_shift", "cancellation", "lateness", "blowout", "new_client",
  "site_change", "officer_replacement", "schedule_change", "general_enquiry"
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  new_shift: "New Shift Request",
  cancellation: "Cancellation",
  lateness: "Lateness Report",
  blowout: "Blowout / No-Show",
  new_client: "New Client",
  site_change: "Site Change",
  officer_replacement: "Officer Replacement",
  schedule_change: "Schedule Change",
  general_enquiry: "General Enquiry",
};

type ClassificationResult = {
  category: typeof EMAIL_CATEGORIES[number];
  confidence: number;
  summary: string;
  extractedEntities: Record<string, any>;
  reasoning: string;
  proposedActions: Array<{
    actionType: string;
    actionLabel: string;
    actionParams: Record<string, any>;
  }>;
};

function buildLearningContext(events: AiLearningEvent[]): string {
  if (events.length === 0) return "";

  const accepted = events.filter(e => e.status === "accepted");
  const rejected = events.filter(e => e.status === "rejected");

  let context = `\n\nSELF-LEARNING CONTEXT (from ${events.length} past email decisions):\n`;

  if (accepted.length > 0) {
    context += `APPROVED patterns (continue doing these):\n`;
    context += accepted.slice(0, 10).map(e => {
      const proposal = e.aiProposal as any;
      return `- Category: ${proposal?.category || "unknown"}, Action: ${proposal?.actionType || "unknown"} — approved`;
    }).join("\n");
    context += "\n";
  }

  if (rejected.length > 0) {
    context += `REJECTED patterns (avoid these, learn from corrections):\n`;
    context += rejected.slice(0, 10).map(e => {
      const proposal = e.aiProposal as any;
      const correction = e.operatorCorrection || "No correction provided";
      return `- Category: ${proposal?.category || "unknown"}, Action: ${proposal?.actionType || "unknown"} — REJECTED. Correction: "${correction}"`;
    }).join("\n");
    context += "\n";
  }

  return context;
}

function buildCrossDomainContext(events: AiLearningEvent[]): string {
  if (events.length === 0) return "";

  const rejected = events.filter(e => e.status === "rejected" && e.feedback);
  if (rejected.length === 0) return "";

  let context = `\nCROSS-DOMAIN INTELLIGENCE (from scheduling decisions):\n`;
  context += rejected.slice(0, 5).map(e => {
    const proposal = e.aiProposal as any;
    return `- ${proposal?.employeeName || "Officer"} at ${proposal?.siteName || "site"}: rejected — "${e.feedback}"`;
  }).join("\n");

  return context;
}

export async function classifyEmail(email: InboxEmail, tenantId: number): Promise<ClassificationResult> {
  const emailLearning = await storage.getAiLearningEvents(tenantId, "email_classification", 50);
  const emailActionLearning = await storage.getAiLearningEvents(tenantId, "email_action", 50);
  const schedulingLearning = await storage.getAiLearningEvents(tenantId, "scheduling", 30);

  const allEmailLearning = [...emailLearning, ...emailActionLearning];
  const learningContext = buildLearningContext(allEmailLearning);
  const crossDomainContext = buildCrossDomainContext(schedulingLearning);

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const prompt = `You are an AI assistant for a UK security company's control room. You analyse incoming emails and classify them to help operators take action quickly.

EMAIL TO CLASSIFY:
From: ${email.fromName || email.fromAddress} <${email.fromAddress}>
Subject: ${email.subject || "(no subject)"}
Body:
${(email.bodyText || email.bodyPreview || "").slice(0, 3000)}

CATEGORIES (pick exactly one):
- new_shift: Client requesting new shift coverage or additional officers
- cancellation: Client or officer cancelling a shift or contract
- lateness: Report of an officer running late or delayed
- blowout: Officer no-show or site left uncovered
- new_client: Enquiry from a potential new client
- site_change: Changes to site details, location, access, or requirements
- officer_replacement: Request to swap or replace a specific officer
- schedule_change: Changes to existing shift times, patterns, or dates
- general_enquiry: Everything else (questions, admin, invoicing queries, etc.)
${learningContext}${crossDomainContext}

Respond in JSON:
{
  "category": "one of the categories above",
  "confidence": 0 to 100,
  "summary": "Brief 1-2 sentence summary of what this email is about",
  "reasoning": "Why you classified it this way",
  "extractedEntities": {
    "siteName": "if mentioned",
    "clientName": "if mentioned",
    "officerName": "if mentioned",
    "date": "if mentioned (ISO format)",
    "time": "if mentioned",
    "endTime": "if mentioned",
    "shiftCount": "number if mentioned"
  },
  "proposedActions": [
    {
      "actionType": "create_shift | cancel_shift | update_shift | create_site | create_client | assign_employee | notify_team | none",
      "actionLabel": "Human-readable description of what this action will do",
      "actionParams": {}
    }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    max_tokens: 1200,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {
      category: "general_enquiry",
      confidence: 0,
      summary: "Could not classify this email",
      extractedEntities: {},
      reasoning: "AI response was empty",
      proposedActions: [],
    };
  }

  const parsed = JSON.parse(content);
  const category = EMAIL_CATEGORIES.includes(parsed.category) ? parsed.category : "general_enquiry";

  return {
    category,
    confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
    summary: parsed.summary || "No summary available",
    extractedEntities: parsed.extractedEntities || {},
    reasoning: parsed.reasoning || "",
    proposedActions: (parsed.proposedActions || []).map((a: any) => ({
      actionType: a.actionType || "none",
      actionLabel: a.actionLabel || "Unknown action",
      actionParams: a.actionParams || {},
    })),
  };
}

export async function processEmail(emailId: number, tenantId: number, userId: string): Promise<void> {
  const email = await storage.getInboxEmail(emailId);
  if (!email) throw new Error("Email not found");

  if (email.processingStatus !== "unread") {
    return;
  }

  const result = await classifyEmail(email, tenantId);

  const classification = await storage.createEmailClassification({
    emailId: email.id,
    tenantId,
    category: result.category,
    confidence: result.confidence,
    extractedEntities: result.extractedEntities,
    reasoning: result.reasoning,
  });

  await storage.updateInboxEmail(email.id, {
    processingStatus: "classified",
    aiSummary: result.summary,
  });

  const autoApproveSettings = await storage.getEmailAutoApproveSettings(tenantId);
  const autoApproveMap = new Map(autoApproveSettings.map(s => [s.actionType, s.enabled]));

  for (const action of result.proposedActions) {
    if (action.actionType === "none") continue;

    const isAutoApproved = autoApproveMap.get(action.actionType) === true;

    const learningEvent = await storage.createAiLearningEvent({
      tenantId,
      userId,
      domain: "email_action",
      inputContext: {
        emailId: email.id,
        subject: email.subject,
        from: email.fromAddress,
        category: result.category,
      },
      aiProposal: {
        category: result.category,
        actionType: action.actionType,
        actionLabel: action.actionLabel,
        actionParams: action.actionParams,
      },
      status: isAutoApproved ? "accepted" : "suggested",
      batchId: `email_${email.id}_${Date.now()}`,
    });

    const proposedAction = await storage.createProposedAction({
      emailId: email.id,
      tenantId,
      actionType: action.actionType,
      actionLabel: action.actionLabel,
      actionParams: action.actionParams,
      status: isAutoApproved ? "approved" : "pending",
      autoApproved: isAutoApproved,
      learningEventId: learningEvent.id,
    });

    if (isAutoApproved) {
      try {
        const { executeAction } = await import("./email-action-executor");
        const executionResult = await executeAction(proposedAction, tenantId);
        await storage.updateProposedAction(proposedAction.id, {
          status: executionResult.success ? "executed" : "failed",
          executionResult,
          decidedAt: new Date(),
        });
        await storage.updateAiLearningEvent(learningEvent.id, {
          status: "accepted",
          decidedAt: new Date(),
        });
      } catch (err: any) {
        await storage.updateProposedAction(proposedAction.id, {
          status: "failed",
          executionResult: { success: false, error: err.message },
        });
      }
    }
  }

  if (result.proposedActions.length > 0 && result.proposedActions.some(a => a.actionType !== "none")) {
    await storage.updateInboxEmail(email.id, { processingStatus: "action_proposed" });
  }

  await storage.createAiLearningEvent({
    tenantId,
    userId,
    domain: "email_classification",
    inputContext: {
      emailId: email.id,
      subject: email.subject,
      from: email.fromAddress,
      bodyPreview: (email.bodyText || "").slice(0, 200),
    },
    aiProposal: {
      category: result.category,
      confidence: result.confidence,
      summary: result.summary,
    },
    status: "suggested",
    batchId: `classify_${email.id}`,
  });
}

export { CATEGORY_LABELS, EMAIL_CATEGORIES };
