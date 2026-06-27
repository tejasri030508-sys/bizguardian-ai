import os
import sys
import re
from google.adk.workflow import Workflow, node, FunctionNode, START
from google.adk.agents import LlmAgent
from google.adk.agents.context import Context
from google.adk.tools import AgentTool
from google.adk.events.event import Event
from google.adk.events.request_input import RequestInput
from google.adk.apps import App, ResumabilityConfig
from google.genai import types
from pydantic import BaseModel, Field
from typing import List, Optional

from app.config import config
from app.database import log_security_event

# ─────────────────────────────────────────────────────────────────────────────
# MCP Server Configuration
# ─────────────────────────────────────────────────────────────────────────────
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams
from mcp import StdioServerParameters

mcp_toolset = McpToolset(
    connection_params=StdioConnectionParams(
        server_params=StdioServerParameters(
            command=sys.executable,
            args=[os.path.abspath(os.path.join(os.path.dirname(__file__), "mcp_server.py"))],
        )
    )
)

# ─────────────────────────────────────────────────────────────────────────────
# Structured Schemas for Agents
# ─────────────────────────────────────────────────────────────────────────────
class SalesAnalysis(BaseModel):
    trends: str = Field(description="A summary of sales trends identified in the data.")
    top_products: List[str] = Field(description="List of top-performing products.")
    low_products: List[str] = Field(description="List of low-performing products.")
    forecast: str = Field(description="Sales forecast for the upcoming period.")

class InventoryAnalysis(BaseModel):
    shortages: List[str] = Field(description="List of products with high risk of shortage.")
    overstock: List[str] = Field(description="List of overstocked products.")
    reorder_recommendations: List[str] = Field(description="Specific reorder recommendation quantities.")

class AdvisorAnalysis(BaseModel):
    health_score: int = Field(description="Calculated Business Health Score out of 100.")
    risks: List[str] = Field(description="Key business or operational risks identified.")
    recommendations: List[str] = Field(description="Actionable strategic recommendations.")
    requires_approval: bool = Field(description="Whether a major reorder requires human approval.")
    reorder_details: Optional[str] = Field(default=None, description="Details of the reorder needing approval.")

# ─────────────────────────────────────────────────────────────────────────────
# Agent Definitions
# ─────────────────────────────────────────────────────────────────────────────
sales_agent = LlmAgent(
    name="sales_agent",
    model=config.model,
    instruction="""You are the Sales Agent for BizGuardian AI.
Your job is to analyze sales records, query recent trends, list top-performing and low-performing products, and forecast sales.
Always use the query_sales_trends tool to load sales data from the database.
Always provide structured output conforming to the SalesAnalysis schema.""",
    tools=[mcp_toolset],
    output_schema=SalesAnalysis,
)

inventory_agent = LlmAgent(
    name="inventory_agent",
    model=config.model,
    instruction="""You are the Inventory Agent for BizGuardian AI.
Your job is to analyze current inventory status, identify potential stock shortages, locate overstocked products, and suggest reorder quantities.
Always use the query_inventory_status tool to fetch inventory data from the database.
Always provide structured output conforming to the InventoryAnalysis schema.""",
    tools=[mcp_toolset],
    output_schema=InventoryAnalysis,
)

business_advisor_agent = LlmAgent(
    name="business_advisor",
    model=config.model,
    instruction="""You are the Lead Business Advisor Agent for BizGuardian AI.
Your job is to provide MSMEs with strategic advice and a holistic Business Health Score.
You must ALWAYS respond in JSON conforming to the AdvisorAnalysis schema.
If the user query is a simple greeting or general conversation (like "hello" or "how are you" or "Say hello"), set health_score to 100, risks to [], requires_approval to false, and put your conversational response or greeting inside the recommendations list (e.g. ["Hello! How can I help you analyze your business today?"]).
If the user asks for analysis, run the specialized sub-agents and combine their findings.
You must also query financials using query_financial_summary to include in your final reasoning.
Always calculate a Business Health Score (0-100), identify risks, and offer strategic recommendations.
If a recommendation suggests placing a purchase or reorder of more than 50 units or costing more than $1000, set requires_approval to true and specify details in reorder_details.
Always conform to the AdvisorAnalysis schema.""",
    tools=[AgentTool(sales_agent), AgentTool(inventory_agent), mcp_toolset],
    output_schema=AdvisorAnalysis,
)

# ─────────────────────────────────────────────────────────────────────────────
# Workflow Nodes
# ─────────────────────────────────────────────────────────────────────────────
def security_checkpoint(node_input: types.Content) -> Event:
    """Performs PII scrubbing and prompt injection checks on incoming queries."""
    query = ""
    if hasattr(node_input, "parts") and node_input.parts:
        query = "".join([part.text for part in node_input.parts if part.text])
    elif isinstance(node_input, str):
        query = node_input
    elif isinstance(node_input, dict) and "query" in node_input:
        query = node_input["query"]

    # 1. PII Redaction
    email_pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"
    phone_pattern = r"\+?\b\d{3}[-.]?\d{3}[-.]?\d{4}\b"
    
    scrubbed_query = query
    pii_detected = False
    
    if re.search(email_pattern, query):
        scrubbed_query = re.sub(email_pattern, "[EMAIL_REDACTED]", scrubbed_query)
        pii_detected = True
    if re.search(phone_pattern, query):
        scrubbed_query = re.sub(phone_pattern, "[PHONE_REDACTED]", scrubbed_query)
        pii_detected = True
        
    if pii_detected:
        log_security_event("PII_REDACTION", "WARNING", f"PII redacted. Query: {query}")
        
    # 2. Prompt Injection Checking
    injection_keywords = ["ignore previous", "system prompt", "override instructions", "you must ignore", "ignore the instructions"]
    is_injection = any(kw in query.lower() for kw in injection_keywords)
    
    if is_injection:
        log_security_event("PROMPT_INJECTION", "CRITICAL", f"Prompt injection blocked. Query: {query}")
        return Event(output="Security Block: Prompt injection keywords detected.", route="security_violation")

    return Event(output=scrubbed_query, route="passed", state={"query": scrubbed_query})

def handle_security_violation(node_input: str) -> dict:
    """Handles cases where prompt injection or security issues were flagged."""
    return {
        "security_issue": True,
        "message": node_input
    }

async def hitl_gate(ctx: Context, node_input: dict):
    """Pauses execution to ask for human confirmation if a reorder needs approval."""
    # Check if a security issue was flagged previously
    if node_input.get("security_issue"):
        yield Event(output=node_input)
        return

    requires_approval = node_input.get("requires_approval", False)
    
    if requires_approval:
        if not ctx.resume_inputs:
            details = node_input.get("reorder_details", "Confirm reorder recommendations")
            yield RequestInput(
                interrupt_id="reorder_approval",
                message=f"✋ Approval Required: {details}. Do you approve? (Yes/No)"
            )
            return
        
        reply = ctx.resume_inputs.get("reorder_approval", "").strip().lower()
        is_approved = "yes" in reply
        log_security_event(
            "HITL_APPROVAL",
            "INFO",
            f"User decision on reorder: {reply}. Approved: {is_approved}"
        )
        status = "APPROVED" if is_approved else "REJECTED"
        
        yield Event(output={
            "health_score": node_input.get("health_score", 100),
            "risks": node_input.get("risks", []),
            "recommendations": node_input.get("recommendations", []),
            "approval_status": f"Reorder recommendation was {status} by the user."
        })
    else:
        yield Event(output={
            "health_score": node_input.get("health_score", 100),
            "risks": node_input.get("risks", []),
            "recommendations": node_input.get("recommendations", []),
            "approval_status": "No approval was required."
        })

def final_output(node_input: dict):
    """Outputs the formatted text message for UI rendering and saves response data."""
    if node_input.get("security_issue"):
        msg = f"⚠️ **Security Alert**: {node_input.get('message')}"
    else:
        msg = f"## 🛡️ BizGuardian AI Report\n\n"
        msg += f"### 📊 Business Health Score: **{node_input.get('health_score')}/100**\n\n"
        
        msg += "### ⚠️ Key Risks:\n"
        for risk in node_input.get("risks", []):
            msg += f"- {risk}\n"
        msg += "\n"
        
        msg += "### 💡 Actionable Recommendations:\n"
        for rec in node_input.get("recommendations", []):
            msg += f"- {rec}\n"
        msg += "\n"
        
        msg += f"### ✋ HITL Status: {node_input.get('approval_status')}\n"
        
    yield Event(
        content=types.Content(role='model', parts=[types.Part.from_text(text=msg)]),
        output=node_input
    )

# ─────────────────────────────────────────────────────────────────────────────
# Workflow Graph
# ─────────────────────────────────────────────────────────────────────────────

workflow = Workflow(
    name="bizguardian_advisor",
    edges=[
        ('START', security_checkpoint),
        (security_checkpoint, {"security_violation": handle_security_violation, "passed": business_advisor_agent}),
        (business_advisor_agent, hitl_gate),
        (hitl_gate, final_output),
        (handle_security_violation, final_output)
    ],
    description="Business advisor agent workflow checking query logs, analyzing sales and inventory database records, and auditing reorder triggers."
)

app = App(
    name="app",
    root_agent=workflow,
    resumability_config=ResumabilityConfig(is_resumable=True)
)
