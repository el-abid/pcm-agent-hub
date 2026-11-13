"""Langflow custom component: A2A client tool.

Exposes one remote A2A agent (served by the pcm-agent-hub gateway) as a
LangChain tool that an Agent node can call.

Import this file in Langflow (Components > Custom component > Import) or paste
its content into a Code component.
"""

from __future__ import annotations

import json
import uuid

import requests
from langchain_core.tools import StructuredTool

from langflow.custom import Component
from langflow.io import DropdownInput, IntInput, Output, SecretStrInput, StrInput

AGENT_DESCRIPTIONS = {
    "docs-agent": (
        "Agent de documentation PCM. À utiliser pour retrouver une procédure de "
        "déblocage de porte palière, les règles de sécurité et les documents de "
        "maintenance. Répond avec des sources."
    ),
    "distributor-agent": (
        "Agent distributeur PCM. À utiliser pour identifier une pièce, une "
        "référence, un délai, un contact ou les conditions de maintenance."
    ),
    "support-agent": (
        "Agent d'escalade PCM. À utiliser quand la panne dépasse les capacités de "
        "l'utilisateur ou présente un risque. Prépare le dossier et le contact support."
    ),
}


class A2AClientTool(Component):
    display_name = "A2A Client Tool"
    description = "Call a remote A2A agent over JSON-RPC 2.0 and use it as an agent tool."
    name = "A2AClientTool"
    icon = "globe"

    inputs = [
        StrInput(
            name="hub_url",
            display_name="A2A Hub URL",
            value="https://your-tunnel.trycloudflare.com",
            info="Public base URL of the pcm-agent-hub gateway.",
        ),
        SecretStrInput(
            name="bearer_token",
            display_name="Bearer Token",
            info="Shared token configured as A2A_BEARER_TOKEN in the gateway.",
        ),
        DropdownInput(
            name="agent_id",
            display_name="Remote Agent",
            options=list(AGENT_DESCRIPTIONS),
            value="docs-agent",
            info="Agent exposed by the A2A gateway.",
        ),
        IntInput(
            name="timeout_seconds",
            display_name="Timeout (s)",
            value=75,
            info="HTTP timeout for the A2A call.",
        ),
    ]

    outputs = [
        Output(display_name="Tool", name="tool", method="build_tool", output_types=["Tool"]),
    ]

    def _call_agent(self, message: str) -> str:
        text = str(message or "").strip()
        if not text:
            return "A2A_ERROR: empty message"

        url = f"{str(self.hub_url).rstrip('/')}/{self.agent_id}"
        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": "message/send",
            "params": {
                "message": {
                    "kind": "message",
                    "messageId": str(uuid.uuid4()),
                    "role": "user",
                    "parts": [{"kind": "text", "text": text}],
                }
            },
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.bearer_token}",
        }

        try:
            response = requests.post(
                url,
                data=json.dumps(payload),
                headers=headers,
                timeout=int(self.timeout_seconds),
            )
            response.raise_for_status()
            body = response.json()
        except Exception as exc:  # noqa: BLE001
            return f"A2A_ERROR: {type(exc).__name__}: {exc}"

        if body.get("error"):
            return f"A2A_ERROR: {body['error'].get('message', 'unknown error')}"

        result = body.get("result") or {}
        artifacts = result.get("artifacts") or []
        for artifact in artifacts:
            for part in artifact.get("parts") or []:
                if part.get("kind") == "text" and part.get("text"):
                    return part["text"]

        return "A2A_ERROR: empty response"

    def build_tool(self) -> StructuredTool:
        agent_id = str(self.agent_id)
        description = AGENT_DESCRIPTIONS.get(
            agent_id, f"Call the remote A2A agent {agent_id}."
        )
        return StructuredTool.from_function(
            func=self._call_agent,
            name=f"ask_{agent_id.replace('-', '_')}",
            description=description,
            args_schema=None,
        )
