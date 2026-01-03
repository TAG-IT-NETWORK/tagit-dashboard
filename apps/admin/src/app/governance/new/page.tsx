"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Button,
  Badge,
  Input,
} from "@tagit/ui";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Code,
  Eye,
  AlertTriangle,
  Plus,
  Trash2,
  Info,
} from "lucide-react";

type ProposalCategory = "protocol" | "parameter" | "treasury" | "other";

interface ProposalAction {
  target: string;
  value: string;
  calldata: string;
  description: string;
}

interface ProposalDraft {
  title: string;
  description: string;
  category: ProposalCategory;
  actions: ProposalAction[];
}

const STEPS = [
  { id: 1, title: "Details", icon: FileText },
  { id: 2, title: "Actions", icon: Code },
  { id: 3, title: "Review", icon: Eye },
];

const CATEGORIES: { value: ProposalCategory; label: string; description: string }[] = [
  {
    value: "protocol",
    label: "Protocol",
    description: "Core protocol upgrades and changes",
  },
  {
    value: "parameter",
    label: "Parameter",
    description: "Configuration changes like thresholds and limits",
  },
  {
    value: "treasury",
    label: "Treasury",
    description: "Fund allocations and financial decisions",
  },
  {
    value: "other",
    label: "Other",
    description: "Miscellaneous governance actions",
  },
];

const DESCRIPTION_TEMPLATE = `## Summary
Brief description of what this proposal does.

## Motivation
Why is this change needed? What problem does it solve?

## Specification
Technical details of the proposed changes.

## Timeline
- Voting: 7 days
- Timelock: 2 days
- Execution: Immediate after timelock`;

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              currentStep === step.id
                ? "bg-primary text-primary-foreground"
                : currentStep > step.id
                ? "bg-green-500/10 text-green-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {currentStep > step.id ? (
              <Check className="h-4 w-4" />
            ) : (
              <step.icon className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">{step.title}</span>
          </div>
          {idx < STEPS.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-2 ${
                currentStep > step.id ? "bg-green-500" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

interface DetailsStepProps {
  draft: ProposalDraft;
  onUpdate: (updates: Partial<ProposalDraft>) => void;
}

function DetailsStep({ draft, onUpdate }: DetailsStepProps) {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Proposal Title *</label>
        <Input
          placeholder="Enter a clear, concise title for your proposal"
          value={draft.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          className="text-lg"
        />
        <p className="text-xs text-muted-foreground">
          A good title summarizes the proposal in under 60 characters
        </p>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Category *</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => onUpdate({ category: cat.value })}
              className={`p-4 rounded-lg border text-left transition-colors ${
                draft.category === cat.value
                  ? "border-primary bg-primary/5"
                  : "hover:border-muted-foreground/50"
              }`}
            >
              <p className="font-medium text-sm">{cat.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{cat.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Description *</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onUpdate({ description: DESCRIPTION_TEMPLATE })}
          >
            Use Template
          </Button>
        </div>
        <textarea
          placeholder="Describe your proposal in detail using markdown..."
          value={draft.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          rows={15}
          className="w-full p-3 rounded-md border bg-background text-sm font-mono resize-y"
        />
        <p className="text-xs text-muted-foreground">
          Supports markdown formatting. Include Summary, Motivation, and Specification sections.
        </p>
      </div>
    </div>
  );
}

interface ActionsStepProps {
  draft: ProposalDraft;
  onUpdate: (updates: Partial<ProposalDraft>) => void;
}

function ActionsStep({ draft, onUpdate }: ActionsStepProps) {
  const addAction = () => {
    onUpdate({
      actions: [
        ...draft.actions,
        { target: "", value: "0", calldata: "0x", description: "" },
      ],
    });
  };

  const updateAction = (index: number, updates: Partial<ProposalAction>) => {
    const newActions = [...draft.actions];
    newActions[index] = { ...newActions[index], ...updates };
    onUpdate({ actions: newActions });
  };

  const removeAction = (index: number) => {
    onUpdate({ actions: draft.actions.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <Info className="h-5 w-5 text-blue-500" />
        <div className="text-sm text-blue-500">
          <p className="font-medium">What are proposal actions?</p>
          <p className="text-blue-500/80">
            Actions are the on-chain transactions that will be executed if the proposal passes.
            Each action consists of a target contract, value (in wei), and calldata.
          </p>
        </div>
      </div>

      {draft.actions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Code className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No actions defined</h3>
            <p className="text-muted-foreground mb-4">
              Add at least one action for your proposal to execute
            </p>
            <Button onClick={addAction}>
              <Plus className="h-4 w-4 mr-2" />
              Add Action
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {draft.actions.map((action, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Action {idx + 1}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(idx)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    placeholder="What does this action do?"
                    value={action.description}
                    onChange={(e) =>
                      updateAction(idx, { description: e.target.value })
                    }
                  />
                </div>

                {/* Target */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Address *</label>
                  <Input
                    placeholder="0x..."
                    value={action.target}
                    onChange={(e) => updateAction(idx, { target: e.target.value })}
                    className="font-mono"
                  />
                </div>

                {/* Value */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Value (wei)</label>
                  <Input
                    placeholder="0"
                    value={action.value}
                    onChange={(e) => updateAction(idx, { value: e.target.value })}
                    className="font-mono"
                  />
                </div>

                {/* Calldata */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Calldata *</label>
                  <textarea
                    placeholder="0x..."
                    value={action.calldata}
                    onChange={(e) =>
                      updateAction(idx, { calldata: e.target.value })
                    }
                    rows={3}
                    className="w-full p-3 rounded-md border bg-background text-sm font-mono resize-y"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={addAction} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Action
          </Button>
        </div>
      )}
    </div>
  );
}

interface ReviewStepProps {
  draft: ProposalDraft;
}

function ReviewStep({ draft }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {draft.category}
            </Badge>
          </div>
          <CardTitle className="text-xl">{draft.title || "Untitled Proposal"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/30 p-4 rounded-lg">
              {draft.description || "No description provided"}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Actions Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions ({draft.actions.length})</CardTitle>
          <CardDescription>
            These transactions will be executed if the proposal passes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {draft.actions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No actions defined
            </p>
          ) : (
            <div className="space-y-3">
              {draft.actions.map((action, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Action {idx + 1}</span>
                    {action.description && (
                      <span className="text-sm text-muted-foreground">
                        {action.description}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <code className="font-mono">
                        {action.target
                          ? `${action.target.slice(0, 10)}...${action.target.slice(-8)}`
                          : "Not set"}
                      </code>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Value</p>
                      <code className="font-mono">{action.value} wei</code>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Calldata</p>
                      <code className="font-mono">
                        {action.calldata
                          ? `${action.calldata.slice(0, 10)}...`
                          : "Not set"}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submission Info */}
      <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-5 w-5 text-yellow-600" />
        <div className="text-sm text-yellow-600">
          <p className="font-medium">Before submitting</p>
          <p className="text-yellow-600/80">
            Review all details carefully. Once submitted, the proposal cannot be edited.
            You will need to sign a transaction to create the proposal on-chain.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CreateProposalPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<ProposalDraft>({
    title: "",
    description: "",
    category: "protocol",
    actions: [],
  });

  const updateDraft = (updates: Partial<ProposalDraft>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return draft.title.trim() !== "" && draft.description.trim() !== "";
      case 2:
        return (
          draft.actions.length > 0 &&
          draft.actions.every(
            (a) => a.target.trim() !== "" && a.calldata.trim() !== ""
          )
        );
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate proposal submission
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // In real implementation, this would call the governance contract
    console.log("Proposal submitted:", draft);
    setIsSubmitting(false);
    router.push("/governance");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back Navigation */}
      <Link
        href="/governance"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Governance
      </Link>

      {/* Page Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Create Proposal</h1>
        <p className="text-muted-foreground">
          Submit a new governance proposal for community voting
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Demo Mode Indicator */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-600">
          Demo Mode: Proposals will not be submitted on-chain. Connect wallet for live governance.
        </span>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            Step {currentStep}: {STEPS[currentStep - 1].title}
          </CardTitle>
          <CardDescription>
            {currentStep === 1 && "Provide basic information about your proposal"}
            {currentStep === 2 && "Define the on-chain actions to execute"}
            {currentStep === 3 && "Review and submit your proposal"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && <DetailsStep draft={draft} onUpdate={updateDraft} />}
          {currentStep === 2 && <ActionsStep draft={draft} onUpdate={updateDraft} />}
          {currentStep === 3 && <ReviewStep draft={draft} />}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        {currentStep < 3 ? (
          <Button onClick={handleNext} disabled={!canProceed()}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || isSubmitting}
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Submit Proposal
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
