"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  ArrowRight,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AGENT_DESCRIPTIONS: Record<string, string> = {
  Initializing: "Preparing the pipeline and loading configuration...",
  "Content Strategist Agent":
    "Analyzing topic, audience, and keyword to create a content strategy brief.",
  "Retrieval Engine":
    "Querying the ChromaDB vector database for verified DLF property facts.",
  "Competitor Intelligence Agent":
    "Scraping competitor sites for comparative context.",
  "Drafting Agent":
    "Writing a luxury editorial draft grounded in retrieved facts.",
  "Localization Agent":
    "Adjusting draft tone and nuances based on target audience.",
  "Human Review Required":
    "Waiting for human review and approval of the generated draft.",
  "Compliance Validator":
    "Scanning draft for RERA violations, investment claims, and unverifiable superlatives.",
  "Brand Tone Validator":
    "Checking alignment with DLF's luxury brand voice guidelines.",
  "SEO Intelligence Agent":
    "Analyzing keyword density, header structure, and content length.",
  "Risk Scoring Engine":
    "Cross-referencing draft claims against verified facts for hallucination detection.",
};

export default function RequestProgressPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;
  const [completedAgents, setCompletedAgents] = useState<Set<string>>(new Set());

  const [statusData, setStatusData] = useState<{
    status: string;
    current_agent: string;
    logs: string[];
    topic?: string;
    target_keyword?: string;
  } | null>(null);

  const prevAgentRef = useRef<string | null>(null);
  const [agentStartTime, setAgentStartTime] = useState<number>(Date.now());
  const [isSlow, setIsSlow] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    // Check for slow agent
    const slowInterval = setInterval(() => {
      if (statusData?.status === "processing" && Date.now() - agentStartTime > 45000) {
        setIsSlow(true);
      } else {
        setIsSlow(false);
      }
    }, 1000);
    return () => clearInterval(slowInterval);
  }, [agentStartTime, statusData?.status]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${requestId}/status`
        );
        if (res.ok) {
          const data = await res.json();
          
          // Track completed agents by comparing current agent changes
          if (prevAgentRef.current && prevAgentRef.current !== data.current_agent) {
            setCompletedAgents((prev) => new Set([...prev, prevAgentRef.current!]));
            setAgentStartTime(Date.now());
          }
          prevAgentRef.current = data.current_agent;
          
          setStatusData(data);

          if (
            data.status === "completed" ||
            data.status === "awaiting_review" ||
            data.status === "failed"
          ) {
            if (data.status === "completed") {
              setCompletedAgents((prev) => new Set([...prev, data.current_agent]));
            }
            clearInterval(interval);
            
            // Auto redirect countdown
            if (data.status !== "failed") {
              let c = 3;
              setCountdown(c);
              const countInterval = setInterval(() => {
                c -= 1;
                setCountdown(c);
                if (c <= 0) {
                  clearInterval(countInterval);
                  router.push(`/review/${requestId}`);
                }
              }, 1000);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch status:", err);
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [requestId]);

  const agents = [
    "Content Strategist Agent",
    "Retrieval Engine",
    "Competitor Intelligence Agent",
    "Drafting Agent",
    "Localization Agent",
    "Human Review Required",
    "Compliance Validator",
    "Brand Tone Validator",
    "SEO Intelligence Agent",
    "Risk Scoring Engine",
  ];

  const isCompleted = statusData?.status === "completed";
  const isAwaitingReview = statusData?.status === "awaiting_review";
  const isFailed = statusData?.status === "failed";
  const isDone = isCompleted || isAwaitingReview;

  // Find the log line relevant to a given agent
  const getAgentLog = (agentName: string): string | null => {
    if (!statusData?.logs) return null;
    const mapping: Record<string, string> = {
      "Content Strategist Agent": "Content Strategist:",
      "Retrieval Engine": "Retrieval Engine:",
      "Competitor Intelligence Agent": "Competitor Intelligence:",
      "Drafting Agent": "Drafting Agent:",
      "Localization Agent": "Localization Agent:",
      "Compliance Validator": "Compliance Validator:",
      "Brand Tone Validator": "Brand Tone Validator:",
      "SEO Intelligence Agent": "SEO Intelligence Agent:",
      "Risk Scoring Engine": "Risk Scoring Engine:",
      "Human Review Required": "Awaiting human",
    };
    const prefix = mapping[agentName];
    if (!prefix) return null;
    // Get the *last* matching log
    const matches = statusData.logs.filter((l) => l.includes(prefix));
    return matches.length > 0 ? matches[matches.length - 1] : null;
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 py-8 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Agent Pipeline
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              variant="outline"
              className="font-mono text-xs"
            >
              {requestId}
            </Badge>
            {statusData?.topic && (
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                {statusData.topic}
              </span>
            )}
          </div>
        </div>
        {isDone && (
          <Link href={`/review/${requestId}`} className={buttonVariants({ variant: "default" })}>
            {isAwaitingReview ? "Review Draft" : "View Results"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        )}
        {isFailed && (
          <Badge variant="destructive">Pipeline Failed</Badge>
        )}
      </div>

      {isSlow && !isDone && !isFailed && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start gap-3 animate-in slide-in-from-top-2 fade-in">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm">Taking longer than usual</h4>
            <p className="text-sm mt-1">The LLM API is responding slowly (over 45 seconds). The pipeline is still running in the background. You can keep waiting, or check the dashboard later.</p>
          </div>
        </div>
      )}

      {countdown !== null && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <span className="font-medium text-sm">Ready! Redirecting to review...</span>
          </div>
          <span className="font-mono font-bold">{countdown}s</span>
        </div>
      )}

      {/* Pipeline Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {!isDone && !isFailed && (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            )}
            {isCompleted && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {isAwaitingReview && (
              <Clock className="h-4 w-4 text-amber-500" />
            )}
            {isFailed && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            Live Orchestration
          </CardTitle>
          <CardDescription>
            {isFailed 
              ? "The pipeline encountered a fatal error and stopped."
              : isAwaitingReview
              ? "Draft is ready for your review. Validation agents will run after approval."
              : isCompleted
              ? "All agents have completed. View the full results in the Review Dashboard."
              : "Agents are sequentially processing your request through the governance pipeline."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {agents.map((agentName, index) => {
              // Determine agent status
              let agentStatus: "pending" | "processing" | "complete" | "awaiting" = "pending";

              const currentIndex = statusData?.current_agent ? agents.indexOf(statusData.current_agent) : -1;
              const thisIndex = index;

              if (isCompleted) {
                agentStatus = "complete";
              } else if (isAwaitingReview) {
                if (agentName === "Human Review Required") {
                  agentStatus = "awaiting";
                } else if (thisIndex < agents.indexOf("Human Review Required")) {
                  agentStatus = "complete";
                }
              } else if (currentIndex > -1) {
                if (thisIndex < currentIndex) {
                  agentStatus = "complete";
                } else if (thisIndex === currentIndex) {
                  agentStatus = "processing";
                }
              }

              const agentLog = getAgentLog(agentName);

              return (
                <div key={agentName} className="relative flex gap-4">
                  {/* Connector */}
                  {index !== agents.length - 1 && (
                    <div
                      className={`absolute left-3 top-8 bottom-0 w-[2px] transition-colors duration-500 ${
                        agentStatus === "complete"
                          ? "bg-green-500"
                          : agentStatus === "awaiting"
                          ? "bg-amber-400"
                          : "bg-muted"
                      }`}
                    />
                  )}

                  {/* Icon */}
                  <div className="relative z-10 flex-shrink-0 mt-1">
                    {agentStatus === "complete" ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500 bg-background rounded-full transition-all duration-300" />
                    ) : agentStatus === "processing" ? (
                      <Loader2 className="h-6 w-6 text-blue-500 animate-spin bg-background rounded-full" />
                    ) : agentStatus === "awaiting" ? (
                      <Clock className="h-6 w-6 text-amber-500 bg-background rounded-full animate-pulse" />
                    ) : (
                      <CircleDashed className="h-6 w-6 text-muted-foreground/40 bg-background rounded-full" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-6">
                    <h4
                      className={`font-semibold text-sm ${
                        agentStatus === "pending"
                          ? "text-muted-foreground/50"
                          : agentStatus === "awaiting"
                          ? "text-amber-600"
                          : "text-foreground"
                      }`}
                    >
                      {agentName}
                    </h4>

                    {/* Description for current or awaiting agent */}
                    {(agentStatus === "processing" || agentStatus === "awaiting") && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {AGENT_DESCRIPTIONS[agentName]}
                      </p>
                    )}

                    {/* Log output for completed agents */}
                    {agentStatus === "complete" && agentLog && (
                      <p className="text-xs text-muted-foreground mt-1 bg-muted/30 p-2 rounded-md border border-border/50">
                        {agentLog}
                      </p>
                    )}

                    {/* Processing indicator */}
                    {agentStatus === "processing" && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 max-w-[200px] bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full animate-[indeterminate_1.5s_ease-in-out_infinite]" 
                               style={{width: '40%', animation: 'indeterminate 1.5s ease-in-out infinite'}} />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Working... {Math.floor((Date.now() - agentStartTime) / 1000)}s
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Bottom action */}
      {isDone && (
        <div className="flex justify-center">
          <Link href={`/review/${requestId}`} className={cn(buttonVariants({ variant: "default", size: "lg" }), "gap-2")}>
            {isAwaitingReview ? (
              <>
                <Clock className="h-4 w-4" />
                Review & Approve Draft
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Open Review Dashboard
              </>
            )}
          </Link>
        </div>
      )}
      
      {isFailed && statusData?.logs && (
        <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-lg">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Last Error Log
          </h4>
          <p className="text-xs font-mono mt-2 bg-red-100/50 p-2 rounded">
            {statusData.logs[statusData.logs.length - 1] || "Unknown error occurred."}
          </p>
          <div className="mt-4">
            <Button variant="outline" className="text-red-700 bg-red-50 hover:bg-red-100" onClick={async () => {
              try {
                await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${requestId}/retry`, { method: "POST" });
                window.location.reload();
              } catch (e) {}
            }}>
              Retry Pipeline
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
