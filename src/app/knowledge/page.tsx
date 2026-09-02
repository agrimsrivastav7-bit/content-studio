"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Database, Plus, Upload, Trash2, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function KnowledgeBasePage() {
  const [stats, setStats] = useState({ total_facts: 0, source_count: 0 });
  const [facts, setFacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add Form State
  const [newFacts, setNewFacts] = useState("");
  const [sourceName, setSourceName] = useState("");
  
  // Upload State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadSource, setUploadSource] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, factsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/knowledge/stats`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/knowledge/`)
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (factsRes.ok) {
        const data = await factsRes.json();
        setFacts(data.facts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddFacts = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFacts.trim() || !sourceName.trim()) return;
    
    setIsSubmitting(true);
    try {
      const factsArray = newFacts.split("\n").filter(f => f.trim().length > 0);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/knowledge/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facts: factsArray, source: sourceName })
      });
      
      if (res.ok) {
        setNewFacts("");
        setSourceName("");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
    setIsSubmitting(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    
    setIsSubmitting(true);
    setUploadSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("source", uploadSource || uploadFile.name);
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/knowledge/upload`, {
        method: "POST",
        body: formData
      });
      
      if (res.ok) {
        const data = await res.json();
        setUploadSuccess(`Successfully extracted and embedded ${data.chunks_extracted} facts from ${data.filename}`);
        setUploadFile(null);
        setUploadSource("");
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this fact?")) return;
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/knowledge/${id}`, {
        method: "DELETE"
      });
      if (res.ok) fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-blue-600" />
            Knowledge Base
          </h2>
          <p className="text-muted-foreground mt-1">Manage verified facts in the vector database for RAG retrieval.</p>
        </div>
        <div className="flex gap-4">
          <Badge variant="outline" className="px-3 py-1.5 text-sm bg-background">
            <span className="font-bold mr-1 text-blue-600">{stats.total_facts}</span> Verified Facts
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5 text-sm bg-background">
            <span className="font-bold mr-1 text-blue-600">{stats.source_count}</span> Sources
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: List of facts */}
        <Card className="lg:col-span-2 flex flex-col h-[700px]">
          <CardHeader>
            <CardTitle>Vector Database Contents</CardTitle>
            <CardDescription>Live view of the ChromaDB index powering the Retrieval Engine.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : facts.length === 0 ? (
              <div className="text-center py-12">
                <Database className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium">Database is empty</h3>
                <p className="text-sm text-muted-foreground mt-1">Add facts to populate the knowledge base.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {facts.map((fact) => (
                  <div key={fact.id} className="p-4 border rounded-lg hover:shadow-sm transition-shadow group relative bg-background">
                    <Badge variant="secondary" className="mb-2 text-xs">{fact.source}</Badge>
                    <p className="text-sm leading-relaxed">{fact.content}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(fact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT COLUMN: Add new facts */}
        <div className="flex flex-col gap-6 h-[700px]">
          <Card className="flex-1 flex flex-col">
            <Tabs defaultValue="paste" className="flex-1 flex flex-col">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="paste">Paste Text</TabsTrigger>
                  <TabsTrigger value="upload">Upload File</TabsTrigger>
                </TabsList>
              </CardHeader>

              <TabsContent value="paste" className="flex-1 p-0 m-0 border-none outline-none">
                <form onSubmit={handleAddFacts} className="flex flex-col h-full">
                  <CardContent className="flex-1 space-y-4 flex flex-col">
                    <div className="space-y-2">
                      <Label htmlFor="sourceName">Source Name</Label>
                      <Input 
                        id="sourceName" 
                        placeholder="e.g. The Camellias Brochure 2026" 
                        value={sourceName}
                        onChange={e => setSourceName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2 flex-1 flex flex-col">
                      <Label htmlFor="facts">Verified Facts (One per line)</Label>
                      <Textarea 
                        id="facts" 
                        placeholder="Paste facts here. Each line will be chunked and embedded separately."
                        className="flex-1 resize-none"
                        value={newFacts}
                        onChange={e => setNewFacts(e.target.value)}
                        required
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Button type="submit" className="w-full" disabled={isSubmitting || !newFacts.trim()}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Embed into ChromaDB
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              <TabsContent value="upload" className="flex-1 p-0 m-0 border-none outline-none">
                <form onSubmit={handleUpload} className="flex flex-col h-full">
                  <CardContent className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="uploadSource">Source Name (Optional)</Label>
                      <Input 
                        id="uploadSource" 
                        placeholder="Overrides filename if provided" 
                        value={uploadSource}
                        onChange={e => setUploadSource(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Document (PDF or DOCX)</Label>
                      <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                        <Input 
                          type="file" 
                          accept=".pdf,.docx" 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={e => setUploadFile(e.target.files?.[0] || null)}
                          required
                        />
                        <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
                        <p className="text-sm font-medium">{uploadFile ? uploadFile.name : "Click or drag file to upload"}</p>
                        <p className="text-xs text-muted-foreground mt-1">PDF or DOCX. Text will be automatically chunked.</p>
                      </div>
                    </div>
                    
                    {uploadSuccess && (
                      <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm flex items-start gap-2 border border-green-200">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        {uploadSuccess}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-2">
                    <Button type="submit" className="w-full" disabled={isSubmitting || !uploadFile}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Parse & Embed
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  );
}
