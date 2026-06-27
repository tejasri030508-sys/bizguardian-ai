import os
os.environ["OTEL_SDK_DISABLED"] = "true"  # Disable OTEL to bypass contextvars/GeneratorExit bug in ADK runner

# Monkeypatch opentelemetry context detach to ignore contextvars ValueError
try:
    from opentelemetry.context.contextvars_context import ContextVarsRuntimeContext
    _orig_class_detach = ContextVarsRuntimeContext.detach
    def _safe_class_detach(self, token):
        try:
            _orig_class_detach(self, token)
        except ValueError:
            pass  # Suppress the "created in a different Context" error
    ContextVarsRuntimeContext.detach = _safe_class_detach
except Exception:
    pass

from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "False")  # Gemini API key only

# Ensure GEMINI_API_KEY is populated if GOOGLE_API_KEY is provided
if "GOOGLE_API_KEY" in os.environ and "GEMINI_API_KEY" not in os.environ:
    os.environ["GEMINI_API_KEY"] = os.environ["GOOGLE_API_KEY"]

@dataclass
class AgentConfig:
    # Reads model from environment GEMINI_MODEL. Default gemini-2.5-flash (the 1.5 family is retired and returns 404). Use gemini-2.5-flash-lite for tighter free-tier quota.
    model: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    mcp_server_port: int = 8090
    max_iterations: int = 3
    pii_redaction_enabled: bool = True
    injection_detection_enabled: bool = True
    # Path to the SQLite database
    db_path: str = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "bizguardian.db"))

config = AgentConfig()
