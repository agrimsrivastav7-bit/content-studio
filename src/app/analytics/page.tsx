"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/analytics/`);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 pt-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Compiling analytics report...</p>
      </div>
    );
  }

  const { summary, risk_distribution, project_scores, top_violations } = data;

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 p-4 md:p-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics & Governance</h2>
        <p className="text-muted-foreground">Portfolio-wide compliance health and AI generation statistics.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Generated</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">Documents across all projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved Content</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.approved}</div>
            <p className="text-xs text-muted-foreground">Passed validation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Drafts</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.high_risk}</div>
            <p className="text-xs text-muted-foreground">Require immediate attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Compliance Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {project_scores.length > 0 
                ? Math.round(project_scores.reduce((acc: any, p: any) => acc + p.compliance, 0) / project_scores.length) 
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Portfolio-wide average</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Project Scores */}
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader>
            <CardTitle>Project Health Matrix</CardTitle>
            <CardDescription>Average scores across all validated content by project.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Factual</TableHead>
                  <TableHead className="text-right">Compliance</TableHead>
                  <TableHead className="text-right">Brand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {project_scores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No project data available
                    </TableCell>
                  </TableRow>
                ) : (
                  project_scores.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.project}</TableCell>
                      <TableCell className="text-right">
                        <span className={p.factual >= 85 ? "text-green-600" : p.factual >= 70 ? "text-amber-600" : "text-red-600"}>
                          {p.factual}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={p.compliance >= 85 ? "text-green-600" : p.compliance >= 70 ? "text-amber-600" : "text-red-600"}>
                          {p.compliance}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={p.brand >= 85 ? "text-green-600" : p.brand >= 70 ? "text-amber-600" : "text-red-600"}>
                          {p.brand}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Top Violations */}
        <Card className="hover:shadow-sm transition-shadow">
          <CardHeader>
            <CardTitle>Top Compliance Vulnerabilities</CardTitle>
            <CardDescription>Most frequently flagged RERA and Brand issues.</CardDescription>
          </CardHeader>
          <CardContent>
            {top_violations.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No compliance violations found
              </div>
            ) : (
              <div className="space-y-4">
                {top_violations.map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-red-100 text-red-700 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">
                        {v.count}
                      </div>
                      <span className="text-sm font-medium">{v.category}</span>
                    </div>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      High Risk
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
