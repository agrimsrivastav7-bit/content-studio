import os
import json
import re
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from .llm_factory import get_llm
import requests
from bs4 import BeautifulSoup
from langgraph.checkpoint.memory import MemorySaver
from langchain_chroma import Chroma
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv

# Load environment variables from backend/.env explicitly
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(backend_dir, ".env"))


# Initialize global memory for Human-in-the-loop checkpoints
memory = MemorySaver()


# Define the state dictionary for LangGraph
class ContentWorkflowState(TypedDict):
    request_id: str
    topic: str
    target_keyword: str
    content_type: str
    project_reference: Optional[str]
    target_audience: Optional[str]
    
    # Internal agent states
    brief: Optional[str]
    retrieved_facts: List[str]
    draft: Optional[str]
    headline_variants: List[str]
    
    # Risk Scores
    factual_confidence_score: Optional[int]
    compliance_score: Optional[int]
    brand_alignment_score: Optional[int]
    seo_score: Optional[int]
    
    # Detailed feedback from agents
    compliance_flags: List[str]
    brand_feedback: Optional[str]
    seo_feedback: Optional[str]
    risk_summary: Optional[str]
    
    workflow_logs: List[str]


import time

def invoke_with_retry(chain, inputs, max_retries=3):
    delays = [2, 4, 8]
    for attempt in range(max_retries):
        try:
            return chain.invoke(inputs)
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(delays[attempt])
            else:
                raise e

def _parse_score(text: str, fallback: int = 70) -> int:
    """Extract a numeric score from LLM output. Looks for prefixed patterns first."""
    # Look for "FACTUAL_SCORE: XX" or "SCORE: XX" (case insensitive)
    match = re.search(r'(?:FACTUAL_SCORE|SCORE)[:\s\*`]+(\d{1,3})', text, re.IGNORECASE)
    if match:
        val = int(match.group(1))
        return min(val, 100)
    
    # Try generic "score: XX" or "**Score**: 85" or "| Score | 85 |"
    match_generic = re.search(r'score[^\d]+(\d{1,3})', text, re.IGNORECASE)
    if match_generic:
        val = int(match_generic.group(1))
        if 0 <= val <= 100:
            return val
        
    # As a fallback, scan from bottom lines for any 1-3 digit number
    lines = text.split("\n")
    for line in reversed(lines):
        line = line.strip()
        if not line:
            continue
        match_num = re.search(r'\b(\d{1,3})\b', line)
        if match_num:
            val = int(match_num.group(1))
            if 0 <= val <= 100:
                return val
                
    return fallback


# ─── NODES ──────────────────────────────────────────────

def content_strategist(state: ContentWorkflowState):
    state["workflow_logs"].append("Content Strategist: Analyzing input and generating brief.")
    
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert luxury real estate content strategist for DLF Homes, India's premier luxury developer.

Your job is to create a concise content strategy brief that will guide a copywriter. The brief must include:
1. Core messaging angle (what story to tell)
2. Key selling points to emphasize
3. Tone direction (e.g. understated luxury, aspirational, etc.)
4. Target emotional response from reader
5. Content structure recommendation

Keep the brief under 200 words. Be specific and actionable."""),
        ("user", "Topic: {topic}\nKeyword: {keyword}\nContent Type: {type}\nDLF Project: {project}\nTarget Audience: {audience}")
    ])
    chain = prompt | llm | StrOutputParser()
    
    brief = invoke_with_retry(chain, {
        "topic": state["topic"],
        "keyword": state["target_keyword"],
        "type": state["content_type"],
        "project": state.get("project_reference", "General"),
        "audience": state.get("target_audience", "General")
    })
    
    state["brief"] = brief
    state["workflow_logs"].append(f"Content Strategist: Brief generated — {len(brief.split())} words.")
    return state


def retrieval_engine(state: ContentWorkflowState):
    state["workflow_logs"].append("Retrieval Engine: Querying ChromaDB for verified facts.")
    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-2")
        db_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
        vectorstore = Chroma(
            persist_directory=db_dir, 
            embedding_function=embeddings,
            collection_name="dlf_properties"
        )
        
        query = f"{state['topic']} {state['target_keyword']}"
        project_ref = state.get("project_reference")
        
        if project_ref and project_ref != "none":
            # Filter by project first
            docs = vectorstore.similarity_search(
                query, 
                k=8,
                filter={"project": project_ref}
            )
            # Fallback if too few
            if len(docs) < 3:
                more_docs = vectorstore.similarity_search(query, k=5)
                docs.extend([d for d in more_docs if d not in docs])
        else:
            docs = vectorstore.similarity_search(query, k=8)
        
        if docs:
            state["retrieved_facts"] = [doc.page_content for doc in docs]
            state["workflow_logs"].append(f"Retrieval Engine: Found {len(docs)} verified facts from knowledge base.")
        else:
            state["retrieved_facts"] = ["No specific facts found in the knowledge base for this query."]
            state["workflow_logs"].append("Retrieval Engine: No matching facts found — draft will rely on strategy brief only.")
            
    except Exception as e:
        state["workflow_logs"].append(f"Retrieval Engine Error: {str(e)}")
        state["retrieved_facts"] = ["Knowledge base unavailable — using general DLF brand guidelines only."]
        
    return state


def competitor_intelligence(state: ContentWorkflowState):
    """Fetch competitor data on demand for each request.
    Uses a simple HTTP GET and extracts the <title> tag as a placeholder fact.
    The competitor list is defined in the .env as a comma‑separated list of URLs.
    """
    state["workflow_logs"].append("Competitor Intelligence: Scraping competitor sites.")
    competitors = os.getenv("COMPETITORS", "").split(",")
    facts = []
    for url in competitors:
        url = url.strip()
        if not url:
            continue
        try:
            resp = requests.get(url, timeout=5)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            title = soup.title.string.strip() if soup.title else "No title"
            facts.append(f"Competitor fact from {url}: {title}")
        except Exception as e:
            state["workflow_logs"].append(f"Competitor Intelligence error for {url}: {str(e)}")
    # Append competitor facts to the retrieved_facts list
    if facts:
        state["retrieved_facts"].extend(facts)
        state["workflow_logs"].append(f"Competitor Intelligence: Added {len(facts)} facts.")
    else:
        state["workflow_logs"].append("Competitor Intelligence: No facts retrieved.")
    return state

def localization_agent(state: ContentWorkflowState):
    """Adjust draft tone based on audience (NRI vs local).
    Only English is used, but we apply a more formal tone for NRI investors.
    """
    state["workflow_logs"].append("Localization Agent: Adjusting draft tone for audience.")
    draft = state.get("draft", "")
    audience = state.get("target_audience", "").lower()
    if "nri" in audience:
        # Formal, data‑driven tone
        prepend = "Esteemed Investor,\n\n"
        draft = prepend + draft
    else:
        # Conversational, community‑focused tone
        prepend = "Dear Home‑Seeker,\n\n"
        draft = prepend + draft
    state["draft"] = draft
    state["workflow_logs"].append("Localization Agent: Draft tone adjusted.")
    return state

def drafting_agent(state: ContentWorkflowState):
    state["workflow_logs"].append("Drafting Agent: Generating luxury editorial draft.")
    
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a premium luxury real estate copywriter for DLF Homes, writing in the style of Architectural Digest.

STRICT RULES:
- Write in a sophisticated, calm, understated tone
- ONLY use facts that are provided in the "Verified Facts" section below
- Do NOT invent statistics, prices, square footage, or amenity details
- If a fact is not provided, do not mention it
- Include the target keyword naturally 2-3 times
- Structure: Headline → Introduction → 2-3 body sections → Closing CTA
- Length: 400-600 words
- Use markdown formatting (headers, bold, bullet points)"""),
        ("user", "Topic: {topic}\nTarget Keyword: {keyword}\nContent Strategy Brief: {brief}\n\nVerified Facts (ONLY use these):\n{facts}")
    ])
    chain = prompt | llm | StrOutputParser()

    draft = invoke_with_retry(chain, {
        "topic": state["topic"],
        "keyword": state["target_keyword"],
        "brief": state["brief"],
        "facts": "\n- ".join(state["retrieved_facts"])
    })

    state["draft"] = draft
    word_count = len(draft.split())
    state["workflow_logs"].append(f"Drafting Agent: Draft generated — {word_count} words.")
    return state


def compliance_validator(state: ContentWorkflowState):
    state["workflow_logs"].append("Compliance Validator: Scanning draft for strict RERA and legal advertising compliance.")
    
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a senior RERA (Real Estate Regulatory Authority) Compliance Auditor and Legal Officer for premier Indian luxury developments.
Analyze the provided marketing draft for strict RERA violations and advertising guidelines.

CRITICAL RERA AUDIT RULES TO ENFORCE:
1. UNREGISTERED FACTUAL CLAIMS (RERA Section 11(4)): Developers are strictly prohibited from advertising any specific physical specifications, layouts, timelines, or amenities NOT officially registered. You MUST cross-reference every claim in the draft against the provided "Verified Facts" (actual registered filings). If the draft makes any specific physical or timeline claim (e.g., a "130,000 sq ft clubhouse", "Olympic-sized pool", specific possession date, or construction details) that is NOT explicitly stated in the Verified Facts, you MUST flag it as a "RERA Unregistered Claim Violation".
2. UNVERIFIABLE SUPERLATIVES (RERA Advertising Code): Claims such as "best in India", "largest ever", "ultimate luxury", "first-of-its-kind", "number one", or "market leader" are illegal under RERA as they are subjective and unverifiable. Flag these and suggest professional, objective replacements.
3. INVESTMENT & RETURN PROMISES (RERA Section 3): Promising specific monetary returns, "guaranteed rental yields", "guaranteed appreciation", "assured buybacks", or labeling property as "the ultimate investment asset" is strictly prohibited. Flag all salesy financial guarantees.
4. TIMELINE & AMENITY MISREPRESENTATION: Any specific dates or future phases must be clearly marked with registered phase disclaimers. 
5. MISSING DISCLAIMERS & RERA DETAILS: Advertisements must display the RERA registration number and RERA disclaimer. If the draft lacks a placeholder or real statement like "RERA Reg. No. [Pending/Registered]" or "Disclaimer: Artist's impression only, specifications subject to change as per registered authority...", flag it as a violation.

For each issue found, state the violation clearly and suggest a precise RERA-compliant rewrite. You MUST quote the exact problematic text from the draft in double quotes.

Then give an overall compliance score from 0-100:
- 90-100: Flawless RERA alignment, no unregistered claims or superlatives, proper disclaimers included.
- 70-89: Minor violations (e.g., a subjective superlative or missing RERA registration disclaimer, easily corrected).
- 50-69: Moderate risks (unregistered claims or minor financial hype, requires revision).
- Below 50: Severe RERA violations (made-up specifications not in RERA context, or guaranteed return claims).

Format your response EXACTLY like this with no deviations:
ISSUES:
- [RERA Category] "Exact quote from text" → Suggested fix: Proposed Rewrite
- [RERA Category] "Another exact quote" → Suggested fix: Another Proposed Rewrite

SCORE: [number]"""),
        ("user", "Verified Facts (Official RERA Registered Data):\n{facts}\n\nDraft to review:\n\n{draft}")
    ])
    chain = prompt | llm | StrOutputParser()
    
    # Format verified facts
    facts_str = "\n- ".join(state.get("retrieved_facts", []))
    if not facts_str:
        facts_str = "No verified facts registered in the knowledge base."
        
    result = invoke_with_retry(chain, {
        "facts": facts_str,
        "draft": state["draft"]
    })
    
    # Parse compliance flags
    flags = []
    for line in result.split("\n"):
        line = line.strip()
        if line.startswith("- ") and ("→" in line or "->" in line):
            flags.append(line[2:])  # Remove "- " prefix
            
    state["compliance_flags"] = flags if flags else ["No significant RERA or compliance issues detected."]
    state["compliance_score"] = _parse_score(result, fallback=75)
    state["workflow_logs"].append(f"Compliance Validator: Score {state['compliance_score']}/100 — {len(flags)} RERA/compliance issue(s) flagged.")
    return state


def brand_tone_validator(state: ContentWorkflowState):
    state["workflow_logs"].append("Brand Tone Validator: Analyzing brand voice alignment.")
    
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are the brand guardian for DLF Homes, India's premier luxury developer.

DLF's brand voice is:
- Understated luxury (never flashy or salesy)
- Confident authority (heritage since 1946)
- Architectural sophistication (design-led narrative)
- Aspirational but grounded (real amenities, real lifestyle)
- Never uses: "affordable", "cheap", "deal", "offer", "discount", "best price"
- Always uses: sophisticated vocabulary, architectural terminology, lifestyle imagery

Analyze the draft for brand alignment. Look for:
1. Off-brand language or tone breaks
2. Overly salesy or aggressive CTAs
3. Generic language that doesn't feel premium
4. Inconsistent tone shifts
5. Missed opportunities to reinforce luxury positioning

Provide specific feedback with examples from the text. You MUST quote the exact problematic text from the draft in double quotes.

Then give a brand alignment score from 0-100 where:
- 90-100: Perfectly on-brand
- 70-89: Good with minor adjustments needed
- 50-69: Needs tone revision
- Below 50: Significantly off-brand

Format your response EXACTLY like this:
FEEDBACK:
- [Tone Issue Category] "Exact quote from text" → Suggested fix: Proposed Rewrite
- [Tone Issue Category] "Another quote" → Suggested fix: Another Proposed Rewrite

SCORE: [number]"""),
        ("user", "Draft to review:\n\n{draft}")
    ])
    chain = prompt | llm | StrOutputParser()
    
    result = invoke_with_retry(chain, {"draft": state["draft"]})
    
    state["brand_feedback"] = result.split("SCORE:")[0].replace("FEEDBACK:", "").strip() if "SCORE:" in result else result
    state["brand_alignment_score"] = _parse_score(result, fallback=80)
    state["workflow_logs"].append(f"Brand Tone Validator: Score {state['brand_alignment_score']}/100.")
    return state


def seo_intelligence_agent(state: ContentWorkflowState):
    state["workflow_logs"].append("SEO Intelligence Agent: Analyzing keyword optimization and structure.")
    
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an SEO specialist for luxury real estate content. Analyze the draft for:

1. Target keyword usage — is "{keyword}" used naturally 2-3 times?
2. Header structure — proper H1/H2/H3 hierarchy for featured snippets?
3. Meta description potential — does the intro work as a compelling 155-char meta?
4. Internal linking opportunities — where could we link to other DLF properties?
5. Content length — is it in the optimal 500-800 word range for SEO?
6. Readability — sentence length variation, paragraph breaks

Provide specific, actionable recommendations. For any specific phrase changes, you MUST quote the exact text from the draft in double quotes.

Then give an SEO readiness score from 0-100 where:
- 90-100: Excellent SEO optimization
- 70-89: Good with minor improvements
- 50-69: Needs significant SEO work
- Below 50: Poor SEO structure

Format your response EXACTLY like this:
RECOMMENDATIONS:
- [SEO Category] "Exact quote from text" (if applicable) → Suggested fix: Proposed Rewrite
- [SEO Category] General recommendation description

SCORE: [number]"""),
        ("user", "Target Keyword: {keyword}\n\nDraft to review:\n\n{draft}")
    ])
    chain = prompt | llm | StrOutputParser()
    
    result = invoke_with_retry(chain, {
        "keyword": state["target_keyword"],
        "draft": state["draft"]
    })
    
    state["seo_feedback"] = result.split("SCORE:")[0].replace("RECOMMENDATIONS:", "").strip() if "SCORE:" in result else result
    state["seo_score"] = _parse_score(result, fallback=75)
    state["workflow_logs"].append(f"SEO Intelligence Agent: Score {state['seo_score']}/100.")
    return state


def risk_scoring_engine(state: ContentWorkflowState):
    state["workflow_logs"].append("Risk Scoring Engine: Computing final risk assessment.")
    
    # Compute factual confidence based on how many verified facts were used
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a fact-checking engine. Compare the draft against the verified facts provided.

For each claim in the draft, determine if it is:
- VERIFIED: Directly supported by the provided facts
- INFERRED: Reasonable inference from the facts but not explicitly stated
- UNVERIFIED: Not supported by any provided fact

Then calculate a factual confidence score from 0-100:
- 90-100: All claims verified or reasonably inferred
- 70-89: Most claims verified, a few inferences
- 50-69: Several unverified claims
- Below 50: Many unverified or potentially hallucinated claims

Provide a brief risk summary listing each major claim and its verification status, and the score.

Format your response EXACTLY like this:
SUMMARY:
- [VERIFIED/INFERRED/UNVERIFIED] "Exact claim from text": Explanation

FACTUAL_SCORE: [number]"""),
        ("user", "Verified Facts:\n{facts}\n\nDraft:\n{draft}")
    ])
    chain = prompt | llm | StrOutputParser()
    
    result = invoke_with_retry(chain, {
        "facts": "\n- ".join(state["retrieved_facts"]),
        "draft": state["draft"]
    })
    
    state["factual_confidence_score"] = _parse_score(result, fallback=70)
    state["risk_summary"] = result.split("FACTUAL_SCORE:")[0].replace("SUMMARY:", "").strip() if "FACTUAL_SCORE:" in result else result
    
    # Log the final summary
    compliance = state.get("compliance_score", 0)
    brand = state.get("brand_alignment_score", 0)
    seo = state.get("seo_score", 0)
    factual = state["factual_confidence_score"]
    
    state["workflow_logs"].append(
        f"Risk Scoring Engine: Final scores — Factual: {factual}, Compliance: {compliance}, Brand: {brand}, SEO: {seo}."
    )
    return state


def headline_generator(state: ContentWorkflowState):
    state["workflow_logs"].append("Headline Generator: Creating 5 compelling variants.")
    
    llm = get_llm()
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a luxury real estate copywriter. Given the final draft, generate exactly 5 compelling headline variants. 
They should be premium, engaging, and include the target keyword if possible.

Format your response as a simple newline-separated list of 5 headlines without numbers or bullets. Do not include any other text."""),
        ("user", "Target Keyword: {keyword}\n\nDraft:\n{draft}")
    ])
    chain = prompt | llm | StrOutputParser()
    
    result = invoke_with_retry(chain, {
        "keyword": state["target_keyword"],
        "draft": state["draft"]
    })
    
    variants = [h.strip().replace('"', '') for h in result.split("\n") if h.strip()]
    # Fallback if parsing fails
    if not variants:
        variants = [state["topic"]]
        
    state["headline_variants"] = variants[:5]
    return state


# ─── BUILD GRAPH ────────────────────────────────────────

def build_workflow():
    workflow = StateGraph(ContentWorkflowState)

    workflow.add_node("content_strategist", content_strategist)
    workflow.add_node("retrieval_engine", retrieval_engine)
    workflow.add_node("competitor_intelligence", competitor_intelligence)
    workflow.add_node("drafting_agent", drafting_agent)
    workflow.add_node("localization_agent", localization_agent)
    workflow.add_node("compliance_validator", compliance_validator)
    workflow.add_node("brand_tone_validator", brand_tone_validator)
    workflow.add_node("seo_intelligence_agent", seo_intelligence_agent)
    workflow.add_node("risk_scoring_engine", risk_scoring_engine)
    workflow.add_node("headline_generator", headline_generator)

    workflow.set_entry_point("content_strategist")
    workflow.add_edge("content_strategist", "retrieval_engine")
    workflow.add_edge("retrieval_engine", "competitor_intelligence")
    workflow.add_edge("competitor_intelligence", "drafting_agent")
    workflow.add_edge("drafting_agent", "localization_agent")
    workflow.add_edge("localization_agent", "compliance_validator")
    workflow.add_edge("compliance_validator", "brand_tone_validator")
    workflow.add_edge("brand_tone_validator", "seo_intelligence_agent")
    workflow.add_edge("seo_intelligence_agent", "risk_scoring_engine")
    workflow.add_edge("risk_scoring_engine", "headline_generator")
    workflow.add_edge("headline_generator", END)

    return workflow.compile(
        checkpointer=memory,
        interrupt_before=["compliance_validator"]
    )

app_workflow = build_workflow()
