"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Check,
  X,
  Link as LinkIcon,
  AlertTriangle,
  Loader2,
  Shield,
  Palette,
  Search,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  GitCommitHorizontal,
  Sparkles,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { diffWords } from "diff";

function ScoreBar({
  label,
  score,
  icon,
}: {
  label: string;
  score: number | null;
  icon: React.ReactNode;
}) {
  const displayScore = score ?? 0;
  const color =
    displayScore >= 85
      ? "bg-green-500"
      : displayScore >= 70
      ? "bg-amber-500"
      : displayScore >= 50
      ? "bg-orange-500"
      : "bg-red-500";
  const textColor =
    displayScore >= 85
      ? "text-green-600"
      : displayScore >= 70
      ? "text-amber-600"
      : displayScore >= 50
      ? "text-orange-600"
      : "text-red-600";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground flex items-center gap-2">
          {icon}
          {label}
        </span>
        <span className={`font-bold tabular-nums ${score !== null ? textColor : "text-muted-foreground"}`}>
          {score !== null ? `${score}%` : "—"}
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${score !== null ? color : "bg-muted"} rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${score !== null ? displayScore : 0}%` }}
        />
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="hover:shadow-sm transition-shadow">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {badge}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <CardContent className="pt-0 pb-4 animate-in slide-in-from-top-1 fade-in duration-200">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function parseFeedbackToUI(text: string, onApplyRewrite?: (issue: string, suggestion: string) => void) {
  if (!text) return null;

  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const elements: React.ReactNode[] = [];
  let currentGroup: { title: string; items: React.ReactNode[] } | null = null;

  const flushGroup = (key: string | number) => {
    if (currentGroup && currentGroup.items.length > 0) {
      elements.push(
        <div key={key} className="space-y-3 mb-5">
          {currentGroup.title && (
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2 mt-2">
              {currentGroup.title}
            </h4>
          )}
          <div className="space-y-2.5">
            {currentGroup.items}
          </div>
        </div>
      );
      currentGroup = null;
    }
  };

  lines.forEach((line, idx) => {
    const headingMatch = line.match(/^\*\*(.+?)(:)?\*\*$/) || line.match(/^###\s*(.+)$/);
    if (headingMatch) {
      flushGroup(`group-pre-${idx}`);
      const title = headingMatch[1].replace(/:$/, "").trim();
      currentGroup = { title, items: [] };
      return;
    }

    const isBullet = line.startsWith("- ") || line.startsWith("* ") || line.match(/^\d+\.\s/);
    let cleanLine = line;
    if (line.startsWith("- ") || line.startsWith("* ")) {
      cleanLine = line.substring(2).trim();
    } else {
      const matchNum = line.match(/^\d+\.\s*(.+)$/);
      if (matchNum) cleanLine = matchNum[1].trim();
    }

    const lowerLine = cleanLine.toLowerCase();
    const isPositive = lowerLine.includes("perfect") || lowerLine.includes("good") || lowerLine.includes("excellent") || lowerLine.includes("aligns perfectly") || lowerLine.includes("understated grandeur") || lowerLine.includes("dialogue") || lowerLine.includes("positive");
    const isCritical = lowerLine.includes("unverified") || lowerLine.includes("violation") || lowerLine.includes("rera") || lowerLine.includes("returns") || lowerLine.includes("guarantee") || lowerLine.includes("salesy");

    const borderClass = isPositive 
      ? "border-l-2 border-green-500 bg-green-50/20" 
      : isCritical 
      ? "border-l-2 border-red-500 bg-red-50/20" 
      : "border-l-2 border-amber-500 bg-amber-50/20";

    const badgeColor = isPositive 
      ? "bg-green-100 text-green-800" 
      : isCritical 
      ? "bg-red-100 text-red-800" 
      : "bg-amber-100 text-amber-800";

    const badgeLabel = isPositive 
      ? "Positive Element" 
      : isCritical 
      ? "Compliance Flag" 
      : "Recommendation";

    if (cleanLine.includes("→") || cleanLine.includes("->")) {
      const parts = cleanLine.split(/→|->/);
      const issue = parts[0].trim();
      const suggestion = parts[1].replace(/^suggested\s+fix:?/i, "").trim();

      const itemNode = (
        <div key={idx} className={`rounded-md border p-3 text-[12px] leading-relaxed shadow-sm transition-all hover:shadow ${borderClass}`}>
          <div className="flex items-start gap-2 mb-1.5 justify-between">
            <Badge className={`text-[9px] font-semibold tracking-wide uppercase px-1.5 py-0 rounded ${badgeColor}`} variant="secondary">
              {badgeLabel}
            </Badge>
            {onApplyRewrite && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-blue-600 hover:bg-blue-50 flex items-center gap-1 shrink-0 font-medium"
                onClick={() => onApplyRewrite(issue, suggestion)}
              >
                <Sparkles className="h-3 w-3" />
                Apply Fix
              </Button>
            )}
          </div>
          <p className="text-foreground font-medium mb-2">{issue}</p>
          <div className="rounded border bg-background/60 p-2 border-dashed border-muted-foreground/20">
            <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Suggested Rewrite</span>
            <p className="text-foreground italic font-sans leading-relaxed">{suggestion}</p>
          </div>
        </div>
      );

      if (currentGroup) {
        currentGroup.items.push(itemNode);
      } else {
        elements.push(itemNode);
      }
    } else {
      const itemNode = (
        <div key={idx} className={`rounded-md border p-3 text-[12px] leading-relaxed shadow-sm hover:shadow transition-all ${borderClass}`}>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground">•</span>
            <p className="text-muted-foreground font-sans leading-relaxed">{cleanLine}</p>
          </div>
        </div>
      );

      if (currentGroup) {
        currentGroup.items.push(itemNode);
      } else {
        elements.push(itemNode);
      }
    }
  });

  flushGroup("last-group");

  return <div className="space-y-4">{elements.length > 0 ? elements : <p className="text-xs text-muted-foreground italic">No feedback points analyzed.</p>}</div>;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;

  const [statusData, setStatusData] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [editedDraft, setEditedDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftInitialized, setDraftInitialized] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${requestId}/status`
      );
      if (res.ok) {
        const data = await res.json();
        setStatusData(data);
        if (!draftInitialized && data.draft_content) {
          setEditedDraft(data.draft_content);
          setDraftInitialized(true);
        }
        // Stop polling when done
        if (data.status === "completed" || data.status === "awaiting_review" || data.status === "failed" || data.status === "rejected") {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          fetchVersions();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  const fetchVersions = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${requestId}/versions`);
      if (res.ok) {
        setVersions(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchVersions();
    pollRef.current = setInterval(fetchStatus, 1500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${requestId}/resume`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edited_draft: editedDraft }),
        }
      );
      if (res.ok) {
        setDraftInitialized(true); 
        pollRef.current = setInterval(fetchStatus, 1200);
      }
    } catch (err) {
      console.error(err);
    }
    setIsSubmitting(false);
  };

  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this draft? It will be archived and removed from your active queue.")) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${requestId}/reject`, {
        method: "POST"
      });
      if (res.ok) {
        router.push("/");
      } else {
        alert("Failed to reject draft.");
      }
    } catch (err) {
      console.error(err);
      alert("Error rejecting draft.");
    }
    setIsSubmitting(false);
  };

  const handleRerunValidation = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${requestId}/rerun`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ edited_draft: editedDraft }),
        }
      );
      if (res.ok) {
        setDraftInitialized(true); 
        pollRef.current = setInterval(fetchStatus, 1200);
      }
    } catch (err) {
      console.error(err);
    }
    setIsSubmitting(false);
  };

  const handleApplyRewrite = (issue: string, suggestion: string) => {
    const quoteMatch = issue.match(/"([^"]+)"/) || issue.match(/'([^']+)'/);
    const originalQuote = quoteMatch ? quoteMatch[1] : null;
    
    let matchedText = null;

    if (originalQuote) {
      if (editedDraft.includes(originalQuote)) {
        matchedText = originalQuote;
      } else if (originalQuote.length > 20) {
        const prefix = originalQuote.substring(0, 20);
        const index = editedDraft.indexOf(prefix);
        if (index !== -1) {
          const nextNewline = editedDraft.indexOf('\n', index);
          const nextPeriod = editedDraft.indexOf('.', index);
          let endIndex = nextNewline !== -1 ? nextNewline : editedDraft.length;
          if (nextPeriod !== -1 && nextPeriod < endIndex) endIndex = nextPeriod + 1;
          matchedText = editedDraft.substring(index, endIndex);
        }
      }
    }

    if (!matchedText) {
      const sentences = issue.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 15);
      for (const s of sentences) {
        if (editedDraft.includes(s)) {
          matchedText = s;
          break;
        }
      }
    }

    if (matchedText) {
      const updated = editedDraft.replace(matchedText, suggestion);
      setEditedDraft(updated);
    } else {
      navigator.clipboard.writeText(suggestion);
      alert(`Could not automatically locate the exact text block in the draft. The suggested rewrite has been copied to your clipboard:\n\n"${suggestion}"`);
    }
  };

  const renderComplianceFlags = () => {
    return (
      <div className="space-y-3">
        {complianceFlags.map((flag: string, idx: number) => {
          const cleanFlag = flag.trim();
          if (cleanFlag.includes("No significant")) {
            return (
              <div key={idx} className="rounded-md border p-3 text-xs bg-green-50/20 border-green-200 text-green-800 flex items-start gap-2 border-l-2 border-l-green-500">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                <span>{cleanFlag}</span>
              </div>
            );
          }
          
          if (cleanFlag.includes("→") || cleanFlag.includes("->")) {
            const parts = cleanFlag.split(/→|->/);
            const issue = parts[0].trim();
            const suggestion = parts[1].replace(/^suggested\s+fix:?/i, "").trim();
            
            return (
              <div key={idx} className="rounded-md border p-3 text-[12px] leading-relaxed border-red-200 bg-red-50/20 text-red-900 shadow-sm transition-all hover:shadow border-l-4 border-l-red-500">
                <div className="flex items-start gap-2 mb-1.5 justify-between">
                  <Badge className="text-[9px] font-semibold tracking-wide uppercase px-1.5 py-0 rounded bg-red-100 text-red-800" variant="secondary">
                    RERA Audit Violation
                  </Badge>
                  {!isProcessing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-red-600 hover:bg-red-50 flex items-center gap-1 shrink-0 font-medium"
                      onClick={() => handleApplyRewrite(issue, suggestion)}
                    >
                      <Sparkles className="h-3 w-3" />
                      Apply Fix
                    </Button>
                  )}
                </div>
                <p className="text-foreground font-medium mb-2">{issue}</p>
                <div className="rounded border bg-background/60 p-2 border-dashed border-red-200">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold block mb-1">Compliance Action / Rewrite</span>
                  <p className="text-foreground italic font-sans leading-relaxed">{suggestion}</p>
                </div>
              </div>
            );
          }
          
          return (
            <div key={idx} className="rounded-md border p-3 text-xs bg-amber-50/20 border-amber-200 text-amber-800 flex items-start gap-2 border-l-2 border-l-amber-500">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
              <span>{cleanFlag}</span>
            </div>
          );
        })}
      </div>
    );
  };


  const handleExport = (format: 'pdf' | 'docx') => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/export/${requestId}/${format}`;
  };

  if (!statusData) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading draft...</p>
      </div>
    );
  }

  const isCompleted = statusData.status === "completed";
  const isAwaitingReview = statusData.status === "awaiting_review";
  const isProcessing = statusData.status === "processing";
  const isFailed = statusData.status === "failed";
  const isRejected = statusData.status === "rejected";
  const isModified = statusData && editedDraft !== statusData.draft_content;

  const riskLevel = statusData.risk_level;
  const riskColor =
    riskLevel === "Low"
      ? "bg-green-50 text-green-700 border-green-200"
      : riskLevel === "Medium"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : riskLevel === "High"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-muted text-muted-foreground";

  const complianceFlags = statusData.compliance_flags || [];
  const hasRealFlags = complianceFlags.length > 0 && 
    !complianceFlags.every((f: string) => f.includes("No significant"));

  // Diff rendering
  const renderDiff = () => {
    const original = versions.find(v => v.version === 1)?.draft_content || statusData.original_draft || "";
    const current = editedDraft;
    
    if (!original) return <p className="text-sm text-muted-foreground p-6">Original draft not available for comparison.</p>;
    
    const diff = diffWords(original, current);
    let changeCount = 0;
    
    const diffContent = diff.map((part, index) => {
      if (part.added || part.removed) changeCount++;
      const color = part.added ? 'bg-green-100 text-green-900' : part.removed ? 'bg-red-100 text-red-900 line-through' : 'text-muted-foreground';
      return <span key={index} className={color}>{part.value}</span>;
    });

    return (
      <div className="p-6 text-[15px] leading-relaxed whitespace-pre-wrap font-serif">
        <div className="mb-4 flex gap-4 text-xs font-sans font-medium border-b pb-4">
          <span className="text-red-600 bg-red-50 px-2 py-1 rounded">Red: Removed by Human</span>
          <span className="text-green-600 bg-green-50 px-2 py-1 rounded">Green: Added by Human</span>
          <span className="ml-auto text-muted-foreground">{changeCount} change(s)</span>
        </div>
        {diffContent}
      </div>
    );
  };
  
  // What content to show in editor
  const displayContent = activeVersion !== null 
    ? versions.find(v => v.version === activeVersion)?.draft_content 
    : editedDraft;
    
  const isViewingHistorical = activeVersion !== null && activeVersion !== versions.length;

  return (
    <div className="h-full flex flex-col gap-5 px-4 py-6 max-w-[1400px] mx-auto animate-in fade-in duration-300">
      {/* ─── HEADER BAR ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              router.push("/")
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">
                {statusData.topic || `Review: ${requestId}`}
              </h2>
              {isAwaitingReview && (
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-200"
                >
                  Awaiting Your Review
                </Badge>
              )}
              {isProcessing && (
                <Badge
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Validating...
                </Badge>
              )}
              {isCompleted && (
                <Badge
                  variant="outline"
                  className={riskColor}
                >
                  {riskLevel} Risk — Complete
                </Badge>
              )}
              {isFailed && (
                <Badge variant="destructive">Failed</Badge>
              )}
              {isRejected && (
                <Badge variant="outline" className="bg-muted text-muted-foreground">Rejected</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {requestId}
              {statusData.target_keyword && ` · Keyword: "${statusData.target_keyword}"`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isAwaitingReview && (
            <>
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10"
                onClick={handleReject}
                disabled={isSubmitting}
              >
                <X className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Approve & Run Validation
              </Button>
            </>
          )}
          {isCompleted && (
            <div className="flex gap-2">
              {isModified && (
                <Button
                  className="bg-amber-600 hover:bg-amber-700 text-white animate-pulse"
                  onClick={handleRerunValidation}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Rerun Validation
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-blue-600 hover:bg-blue-700 text-white h-10 px-4 py-2">
                  <Download className="mr-2 h-4 w-4" />
                  Export Final Content
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport('pdf')}>
                    Export as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport('docx')}>
                    Export as DOCX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* ─── MAIN CONTENT ───────────────────────────── */}
      <div className="flex flex-1 gap-5 overflow-hidden min-h-[600px] flex-col lg:flex-row">
        {/* LEFT: Editor + Logs */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {statusData?.retrieved_facts && 
           statusData.retrieved_facts.length > 0 && 
           statusData.retrieved_facts.some((f: string) => f.includes("No specific facts found") || f.includes("Knowledge base unavailable")) && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg flex items-start gap-3 animate-in fade-in shrink-0">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">⚠️ Knowledge Base Warning</p>
                <p className="text-xs mt-0.5">This draft was generated without verified facts from the knowledge base. Claims may not be grounded in registered data. Please review carefully.</p>
              </div>
            </div>
          )}
          
          <div className="flex-1 flex flex-col border rounded-lg bg-background overflow-hidden shadow-sm">
            <Tabs defaultValue="editor" className="flex-1 flex flex-col">
            <div className="border-b px-4 py-2 bg-muted/20 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="editor">Document Editor</TabsTrigger>
                <TabsTrigger value="diff">Changes Diff</TabsTrigger>
                <TabsTrigger value="logs">
                  Agent Logs ({statusData.logs?.length || 0})
                </TabsTrigger>
              </TabsList>
              {isAwaitingReview && !isViewingHistorical && (
                <span className="text-xs text-amber-600 font-medium hidden sm:block animate-pulse">
                  ✏️ You can edit the draft before approving
                </span>
              )}
              {isCompleted && !isViewingHistorical && (
                <span className="text-xs text-blue-600 font-medium hidden sm:block">
                  ✏️ You can edit this draft to rerun validation
                </span>
              )}
              {isViewingHistorical && (
                <span className="text-xs text-blue-600 font-medium hidden sm:block">
                  Viewing Historical Version v{activeVersion}
                </span>
              )}
            </div>

            <TabsContent value="editor" className="flex-1 p-0 m-0 h-full relative">
              <Textarea
                aria-label="Document Editor"
                className="w-full h-full min-h-[500px] p-6 border-0 focus-visible:ring-0 resize-none text-[15px] leading-relaxed text-foreground bg-transparent font-serif"
                value={displayContent || ""}
                onChange={(e) => {
                  if (activeVersion === null) {
                    setEditedDraft(e.target.value);
                  }
                }}
                readOnly={isProcessing || isViewingHistorical}
                placeholder="Draft content will appear here..."
              />
              {isViewingHistorical && (
                <div className="absolute top-2 right-4">
                  <Button variant="secondary" size="sm" onClick={() => setActiveVersion(null)}>
                    Return to Current Version
                  </Button>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="diff" className="flex-1 p-0 m-0 h-full overflow-y-auto bg-muted/10">
              {renderDiff()}
            </TabsContent>

            <TabsContent
              value="logs"
              className="p-4 overflow-y-auto max-h-[550px]"
            >
              <div className="space-y-2">
                {(statusData.logs || []).map(
                  (log: string, idx: number) => {
                    const isError = log.toLowerCase().includes("error");
                    const isWarning = log.toLowerCase().includes("warning") || log.toLowerCase().includes("flagged");
                    return (
                      <div
                        key={idx}
                        className="flex gap-3 items-start py-1.5"
                      >
                        <div
                          className={`mt-0.5 p-1 rounded-full flex-shrink-0 ${
                            isError
                              ? "bg-red-100 text-red-600"
                              : isWarning
                              ? "bg-amber-100 text-amber-600"
                              : "bg-green-100 text-green-600"
                          }`}
                        >
                          {isError ? (
                            <X className="h-2.5 w-2.5" />
                          ) : isWarning ? (
                            <AlertTriangle className="h-2.5 w-2.5" />
                          ) : (
                            <Check className="h-2.5 w-2.5" />
                          )}
                        </div>
                        <p className="text-[13px] text-muted-foreground leading-relaxed mt-0.5">
                          {log}
                        </p>
                      </div>
                    );
                  }
                )}
                {isProcessing && (
                  <div className="flex items-center gap-2 pt-2">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    <span className="text-xs text-muted-foreground">
                      Processing: {statusData.current_agent}...
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
        </div>

        {/* RIGHT: Scores & Analysis */}
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-4 overflow-y-auto pb-8 pr-2">
          
          {/* Version History */}
          {versions.length > 0 && (
            <Card className="hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Version History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
                  {versions.map((v, i) => (
                    <div key={v.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${activeVersion === v.version ? 'border-blue-500 text-blue-500' : 'border-muted-foreground/30 text-muted-foreground'}`}>
                        <GitCommitHorizontal className="h-3 w-3" />
                      </div>
                      <div 
                        className={`w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-2 rounded border cursor-pointer transition-colors ${activeVersion === v.version ? 'bg-blue-50 border-blue-200' : 'bg-background hover:bg-muted/50 border-border'}`}
                        onClick={() => setActiveVersion(v.version === versions.length && !isProcessing ? null : v.version)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">v{v.version}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(v.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p className="text-xs font-medium truncate">{v.author}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{v.notes}</p>
                      </div>
                    </div>
                  ))}
                  
                  {/* Current Active Status */}
                  {(!isCompleted && !isFailed) && (
                     <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active mt-4">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 bg-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 border-amber-500 text-amber-500">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </div>
                      <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-2">
                        <span className="text-xs font-medium text-amber-600">
                          {isAwaitingReview ? 'Awaiting Edits' : 'Validating...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Scores */}
          <Card className="hover:shadow-sm transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Risk Assessment
                </span>
                {riskLevel ? (
                  <Badge variant="outline" className={riskColor}>
                    {riskLevel} Risk
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-muted text-muted-foreground"
                  >
                    {isAwaitingReview ? "Pending" : isProcessing ? "Running..." : "—"}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreBar
                label="Factual Confidence"
                score={statusData.risk_scores?.factual_confidence}
                icon={<FileCheck className="h-3.5 w-3.5" />}
              />
              <ScoreBar
                label="Legal & Compliance"
                score={statusData.risk_scores?.compliance}
                icon={<Shield className="h-3.5 w-3.5" />}
              />
              <ScoreBar
                label="Brand Alignment"
                score={statusData.risk_scores?.brand_alignment}
                icon={<Palette className="h-3.5 w-3.5" />}
              />
              <ScoreBar
                label="SEO Readiness"
                score={statusData.risk_scores?.seo}
                icon={<Search className="h-3.5 w-3.5" />}
              />
            </CardContent>
          </Card>

          {/* Compliance Flags */}
          {(isCompleted || hasRealFlags) && (
            <CollapsibleSection
              title="Compliance Flags"
              defaultOpen={hasRealFlags}
              badge={
                hasRealFlags ? (
                  <Badge
                    variant="outline"
                    className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                  >
                    {complianceFlags.length}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-green-50 text-green-700 border-green-200 text-xs"
                  >
                    Clean
                  </Badge>
                )
              }
            >
              {renderComplianceFlags()}
            </CollapsibleSection>
          )}

          {/* Brand Feedback */}
          {statusData.brand_feedback && (
            <CollapsibleSection title="Brand Tone Analysis" defaultOpen={false}>
              {parseFeedbackToUI(statusData.brand_feedback, !isProcessing ? handleApplyRewrite : undefined)}
            </CollapsibleSection>
          )}

          {/* SEO Feedback */}
          {statusData.seo_feedback && (
            <CollapsibleSection title="SEO Recommendations" defaultOpen={false}>
              {parseFeedbackToUI(statusData.seo_feedback, !isProcessing ? handleApplyRewrite : undefined)}
            </CollapsibleSection>
          )}

          {/* Headline Variants */}
          {statusData.headline_variants && statusData.headline_variants.length > 0 && (
            <CollapsibleSection title="Headline Variants" defaultOpen={false}>
              <div className="space-y-3">
                {statusData.headline_variants.map((headline: string, idx: number) => (
                  <div key={idx} className="rounded-md border p-3 text-sm bg-blue-50/20 border-blue-200 text-blue-900 shadow-sm transition-all hover:shadow">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold italic font-serif">"{headline}"</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-blue-600 hover:bg-blue-50"
                        onClick={() => {
                          navigator.clipboard.writeText(headline);
                          alert("Headline copied to clipboard!");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Risk Summary */}
          {statusData.risk_summary && (
            <CollapsibleSection title="Factual Accuracy Report" defaultOpen={false}>
              {parseFeedbackToUI(statusData.risk_summary, !isProcessing ? handleApplyRewrite : undefined)}
            </CollapsibleSection>
          )}

          {/* Retrieved Facts */}
          {statusData.retrieved_facts && statusData.retrieved_facts.length > 0 && (
            <CollapsibleSection
              title="Source Facts"
              badge={
                <Badge variant="outline" className="text-xs">
                  {statusData.retrieved_facts.length} facts
                </Badge>
              }
            >
              <div className="space-y-2">
                {statusData.retrieved_facts.map(
                  (fact: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <LinkIcon className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-500" />
                      <span>{fact}</span>
                    </div>
                  )
                )}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </div>
    </div>
  );
}
