"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, FileText, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Trash2, RefreshCw } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  const [stats, setStats] = useState({ total: 0, pending: 0, high_risk: 0, approved: 0 });
  const [recentDrafts, setRecentDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);
  const [countdown, setCountdown] = useState(10);

  const fetchData = async () => {
    try {
      const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/stats`);
      if (!statsRes.ok) throw new Error("Failed to fetch stats");
      setStats(await statsRes.json());

      const draftsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/`);
      if (!draftsRes.ok) throw new Error("Failed to fetch drafts");
      setRecentDrafts(await draftsRes.json());
      setBackendError(false);
    } catch (e) {
      console.error("Failed to fetch dashboard data:", e);
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds for updates
    const interval = setInterval(() => {
      if (!backendError) fetchData();
    }, 5000);
    return () => clearInterval(interval);
  }, [backendError]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (backendError) {
      setCountdown(10);
      timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            fetchData();
            return 10;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [backendError]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete draft ${id}?`)) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRecentDrafts(recentDrafts.filter((d) => d.id !== id));
        const statsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/stats`);
        if (statsRes.ok) setStats(await statsRes.json());
      } else {
        alert("Failed to delete draft.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting draft.");
    }
  };

  const handleRetry = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/${id}/retry`, {
        method: "POST",
      });
      if (res.ok) {
        window.location.href = `/requests/${id}/progress`;
      } else {
        alert("Failed to retry request.");
      }
    } catch (err) {
      console.error(err);
      alert("Error retrying request.");
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "processing": return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Loader2 className="h-3 w-3 animate-spin mr-1"/> Processing</Badge>;
      case "awaiting_review": return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Needs Review</Badge>;
      case "completed": return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      case "rejected": return <Badge variant="outline" className="bg-muted text-muted-foreground">Rejected</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 pt-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Monitor content generation pipelines and compliance risks.</p>
        </div>
        <Link href="/requests/new" className={cn(buttonVariants({ variant: "default" }), "shrink-0", backendError && "opacity-50 pointer-events-none")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Content Request
        </Link>
      </div>

      {backendError && (
        <Card className="border-red-200 bg-red-50 text-red-900 animate-in fade-in slide-in-from-top-4">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between p-6 gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-800">Cannot connect to server</h3>
                <p className="text-sm text-red-700 mt-1">The backend service is unreachable. Ensure the server is running on port 8000.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-mono font-medium text-red-600">Auto-retry in {countdown}s</span>
              <Button variant="outline" className="border-red-200 bg-white hover:bg-red-50 text-red-700" onClick={fetchData}>
                Retry Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", backendError && "opacity-50 pointer-events-none")}>
        <Card className="hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-blue-50/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Drafts</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Generated by AI</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-amber-50/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-red-50/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Flags</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.high_risk}</div>
            <p className="text-xs text-muted-foreground">Compliance or Hallucination</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all hover:scale-[1.02] bg-gradient-to-br from-background to-green-50/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Content</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
            <p className="text-xs text-muted-foreground">Ready for export</p>
          </CardContent>
        </Card>
      </div>

      <Card className={cn("hover:shadow-sm transition-shadow", backendError && "opacity-50 pointer-events-none")}>
        <CardHeader>
          <CardTitle>Recent Drafts</CardTitle>
          <CardDescription>
            Latest AI-generated drafts and their current compliance status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentDrafts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium">No drafts yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first content request to see it here.</p>
              <Link href="/requests/new" className={buttonVariants({ variant: "outline" })}>
                Create Request
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDrafts.map((draft) => (
                    <TableRow key={draft.id} className={cn("group cursor-pointer hover:bg-muted/50 transition-colors", draft.status === "rejected" ? "opacity-60" : "")} onClick={() => window.location.href = draft.status === "processing" ? `/requests/${draft.id}/progress` : `/review/${draft.id}`}>
                      <TableCell className="font-medium font-mono text-xs">{draft.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{draft.topic || "—"}</TableCell>
                      <TableCell>{formatStatus(draft.status)}</TableCell>
                      <TableCell>
                        {draft.risk_level ? (
                           <Badge variant="outline" className={draft.risk_level === "High" ? "text-red-600 border-red-200 bg-red-50" : draft.risk_level === "Medium" ? "text-amber-600 border-amber-200 bg-amber-50" : "text-green-600 border-green-200 bg-green-50"}>
                             {draft.risk_level}
                           </Badge>
                        ) : (
                           <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">{formatDate(draft.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {draft.status === "failed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                              onClick={(e) => handleRetry(e, draft.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={(e) => handleDelete(e, draft.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Link href={draft.status === "processing" ? `/requests/${draft.id}/progress` : `/review/${draft.id}`} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity")}>
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
