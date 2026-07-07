"""
Module 12 — Monitor (AgentOps)
Tracks LLM costs, latency, errors, and per-phase telemetry.
"""
import time
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class LLMMetric:
    timestamp: str
    model: str
    tokens_used: int
    latency_ms: float
    status: str  # success | error
    error_msg: str = ""
    phase: str = "llm_call"
    cost_estimate: float = 0.0


@dataclass
class PipelineMetrics:
    request_id: str = ""
    user_email: str = ""
    workspace_id: str = ""
    intent: str = ""
    emotion: str = ""
    total_latency_ms: float = 0.0
    phase_latencies: dict = field(default_factory=dict)
    llm_calls: list = field(default_factory=list)
    total_tokens: int = 0
    total_cost: float = 0.0
    tools_used: list = field(default_factory=list)
    error: str = ""

    def to_dict(self) -> dict:
        return {
            "timestamp": datetime.now().isoformat(),
            "request_id": self.request_id,
            "user_email": self.user_email,
            "workspace_id": self.workspace_id,
            "intent": self.intent,
            "emotion": self.emotion,
            "total_latency_ms": self.total_latency_ms,
            "phase_latencies": self.phase_latencies,
            "llm_calls": [
                {
                    "model": c.model,
                    "tokens": c.tokens_used,
                    "latency_ms": c.latency_ms,
                    "status": c.status,
                    "phase": c.phase,
                    "cost": c.cost_estimate,
                }
                for c in self.llm_calls
            ],
            "total_tokens": self.total_tokens,
            "total_cost": self.total_cost,
            "tools_used": self.tools_used,
            "error": self.error,
        }


class Monitor:
    """
    Collects telemetry for every pipeline run.
    Stores in-memory and optionally persists to MongoDB.
    """

    # Rough cost per 1K tokens by model prefix ($)
    COST_TABLE: dict[str, float] = {
        "nvidia/": 0.0,
        "cohere/": 0.0,
        "meta-llama/": 0.0,
        "google/": 0.0001,
        "openai/": 0.003,
        "anthropic/": 0.003,
        "default": 0.0001,
    }

    def __init__(self):
        self._recent: list[PipelineMetrics] = []
        self._max_recent = 100

    def start_request(self, request_id: str, user_email: str, workspace_id: str) -> PipelineMetrics:
        metrics = PipelineMetrics(
            request_id=request_id,
            user_email=user_email,
            workspace_id=workspace_id,
        )
        return metrics

    def start_phase(self, metrics: PipelineMetrics, phase_name: str) -> float:
        return time.time()

    def end_phase(self, metrics: PipelineMetrics, phase_name: str, start: float):
        elapsed_ms = round((time.time() - start) * 1000, 2)
        metrics.phase_latencies[phase_name] = elapsed_ms

    def log_llm_call(
        self,
        metrics: PipelineMetrics,
        model: str,
        tokens_used: int,
        latency_ms: float,
        status: str = "success",
        error_msg: str = "",
        phase: str = "llm_call",
    ):
        cost = self._estimate_cost(model, tokens_used)
        metric = LLMMetric(
            timestamp=datetime.now().isoformat(),
            model=model,
            tokens_used=tokens_used,
            latency_ms=latency_ms,
            status=status,
            error_msg=error_msg,
            phase=phase,
            cost_estimate=cost,
        )
        metrics.llm_calls.append(metric)
        metrics.total_tokens += tokens_used
        metrics.total_cost += cost

    def finish_request(self, metrics: PipelineMetrics, error: str = ""):
        metrics.error = error
        self._recent.append(metrics)
        if len(self._recent) > self._max_recent:
            self._recent = self._recent[-self._max_recent:]

        self._print_summary(metrics)

    def _estimate_cost(self, model: str, tokens: int) -> float:
        rate = 0.0001
        for prefix, cost_per_1k in self.COST_TABLE.items():
            if model.startswith(prefix):
                rate = cost_per_1k
                break
        return round((tokens / 1000) * rate, 6)

    def _print_summary(self, m: PipelineMetrics):
        pass  # logging removed for production

    def get_recent_metrics(self, count: int = 10) -> list[dict]:
        return [m.to_dict() for m in self._recent[-count:]]

    def get_stats(self) -> dict:
        if not self._recent:
            return {"total_requests": 0, "avg_latency_ms": 0, "total_tokens": 0, "total_cost": 0}
        total_latency = sum(m.total_latency_ms for m in self._recent)
        return {
            "total_requests": len(self._recent),
            "avg_latency_ms": round(total_latency / len(self._recent), 2),
            "total_tokens": sum(m.total_tokens for m in self._recent),
            "total_cost": round(sum(m.total_cost for m in self._recent), 6),
        }


# Global singleton
monitor = Monitor()
