"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Sparkles, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function NewRequestPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    topic: "",
    target_keyword: "",
    content_type: "blog",
    project_reference: "none",
    target_audience: "",
    source_documents: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step === 1 && (!formData.topic || !formData.target_keyword)) {
      alert("Please fill in the required fields.");
      return;
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/requests/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error("Failed to submit request. Backend may be unreachable.");

      const data = await response.json();
      router.push(`/requests/${data.request_id}/progress`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 py-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" render={<Link href="/" />}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">New Content Request</h2>
          <p className="text-muted-foreground">Initiate a new AI-generated draft with governance checks.</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between relative px-2 mb-4">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-muted -z-10 rounded-full"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-blue-600 -z-10 rounded-full transition-all duration-500" style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}></div>
        
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-col items-center gap-2 bg-background p-1">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300", 
              step === s ? "bg-blue-600 text-white ring-4 ring-blue-100" : 
              step > s ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground")}>
              {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
            </div>
            <span className={cn("text-xs font-medium", step === s ? "text-foreground" : "text-muted-foreground")}>
              {s === 1 ? "Topic & Keyword" : s === 2 ? "Settings" : "Review"}
            </span>
          </div>
        ))}
      </div>

      <Card className="shadow-lg border-muted">
        {step === 1 && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-300">
            <CardHeader>
              <CardTitle>Topic & Keyword</CardTitle>
              <CardDescription>Define the core subject and SEO focus for this piece.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="topic">Topic / Angle <span className="text-red-500">*</span></Label>
                <Input 
                  id="topic" 
                  className="text-lg py-6"
                  placeholder="e.g. Sustainable luxury living in Gurugram" 
                  value={formData.topic}
                  onChange={(e) => handleChange("topic", e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">The AI will use this as the primary theme for the content strategy.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="keyword">Target Keyword <span className="text-red-500">*</span></Label>
                <Input 
                  id="keyword" 
                  className="text-lg py-6"
                  placeholder="e.g. luxury apartments gurgaon" 
                  value={formData.target_keyword}
                  onChange={(e) => handleChange("target_keyword", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Must be included 2-3 times naturally in the text.</p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 bg-muted/20">
              <Button variant="ghost" render={<Link href="/" />}>Cancel</Button>
              <Button onClick={handleNext} disabled={!formData.topic || !formData.target_keyword} className="bg-blue-600 hover:bg-blue-700">
                Next Step <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-300">
            <CardHeader>
              <CardTitle>Content Settings</CardTitle>
              <CardDescription>Target audience, project context, and formatting.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contentType">Content Type</Label>
                  <Select value={formData.content_type} onValueChange={(val) => handleChange("content_type", val as string)}>
                    <SelectTrigger id="contentType" className="py-6">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blog">Editorial Blog Post</SelectItem>
                      <SelectItem value="project">Project Overview</SelectItem>
                      <SelectItem value="amenity">Amenity Highlight</SelectItem>
                      <SelectItem value="market">Market Analysis Update</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="projectRef">Project Reference</Label>
                  <Select value={formData.project_reference} onValueChange={(val) => handleChange("project_reference", val as string)}>
                    <SelectTrigger id="projectRef" className="py-6">
                      <SelectValue placeholder="Select DLF Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / General</SelectItem>
                      <SelectItem value="camellias">The Camellias</SelectItem>
                      <SelectItem value="magnolias">The Magnolias</SelectItem>
                      <SelectItem value="aralias">The Aralias</SelectItem>
                      <SelectItem value="crest">The Crest</SelectItem>
                      <SelectItem value="privana">DLF Privana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="audience">Target Audience</Label>
                <Input 
                  id="audience" 
                  className="py-6"
                  placeholder="e.g. UHNIs seeking ultra-luxury real estate, NRI investors" 
                  value={formData.target_audience}
                  onChange={(e) => handleChange("target_audience", e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 bg-muted/20">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                Review <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in slide-in-from-right-4 fade-in duration-300">
            <CardHeader>
              <CardTitle>Review & Submit</CardTitle>
              <CardDescription>Verify your parameters before launching the agent pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border bg-muted/30 p-6 space-y-4">
                <div className="grid grid-cols-3 gap-4 border-b pb-4">
                  <div className="col-span-3 sm:col-span-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Topic</p>
                    <p className="font-medium mt-1">{formData.topic}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Keyword</p>
                    <p className="font-medium mt-1">{formData.target_keyword}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3 sm:col-span-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Type</p>
                    <p className="font-medium mt-1 capitalize">{formData.content_type}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Project</p>
                    <p className="font-medium mt-1 capitalize">{formData.project_reference === "none" ? "General" : formData.project_reference}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Audience</p>
                    <p className="font-medium mt-1 truncate">{formData.target_audience || "General"}</p>
                  </div>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-900 p-4 rounded-lg flex items-center justify-between animate-in fade-in">
                  <div className="text-sm font-medium">{error}</div>
                  <Button variant="outline" size="sm" className="border-red-200 bg-white hover:bg-red-50 text-red-700 shrink-0" onClick={handleSubmit}>
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-6 bg-muted/20">
              <Button variant="outline" onClick={handleBack} disabled={isLoading}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white w-40">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Draft
              </Button>
            </CardFooter>
          </div>
        )}
      </Card>
    </div>
  );
}
