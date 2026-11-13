"""Langflow custom component: log an interaction through the MCP gateway.

The gateway owns the MCP client and the MongoDB credentials. The agent only
sees a simple `log_interaction(question, answer, session_id)` tool.
"""

from __future__ import annotations

import requests
from langchain_core.tools import StructuredTool

from langflow.custom import Component
from langflow.io import Output, SecretStrInput, StrInput


class LogInteractionTool(Component):
    display_name = "Log Interaction (MCP)"
    description = "Log a user question and the final answer to MongoDB through the MCP gateway."
    name = "LogInteractionTool"
    icon = "database"

    inputs = [
        StrInput(
            name="gateway_url",
            display_name="Gateway URL",
            value="https://your-gateway.trycloudflare.com",
            info="Public URL of the pcm-agent-hub gateway.",
        ),
        SecretStrInput(
            name="bearer_token",
            display_name="Bearer Token",
            info="Name of the Langflow credential holding the gateway token.",
        ),
    ]

    outputs = [
        Output(display_name="Tool", name="tool", method="build_tool", output_types=["Tool"]),
    ]

    def _log(self, question: str, answer: str, session_id: str = "unknown") -> str:
        if not question or not answer:
            return "LOG_ERROR: question and answer are required"

        url = f"{str(self.gateway_url).rstrip('/')}/log"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.bearer_token}",
        }
        payload = {
            "question": str(question),
            "answer": str(answer),
            "session_id": str(session_id or "unknown"),
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=90)
            response.raise_for_status()
            body = response.json()
        except Exception as exc:  # noqa: BLE001
            return f"LOG_ERROR: {type(exc).__name__}: {exc}"

        if not body.get("ok"):
            return f"LOG_ERROR: {body.get('error', 'unknown error')}"
        return f"LOGGED: {body.get('inserted', 1)}"

    def build_tool(self) -> StructuredTool:
        return StructuredTool.from_function(
            func=self._log,
            name="log_interaction",
            description=(
                "Log the user question and the final answer to MongoDB via MCP. "
                "Arguments: question (full user text), answer (full final answer), "
                "session_id (short identifier)."
            ),
        )
