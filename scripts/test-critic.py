import json
import urllib.request

FLOW = "76faec26-4b83-4efd-a988-1ccc73182c19"
USER = "f415abfc-0823-460e-8857-302b78a92de1"
URL = f"https://stg-agentic.abafusion.ai/api/v1/run/public/{FLOW}?user_id={USER}"

text = open("logs/last-orchestrator.txt", encoding="utf-8").read().strip()
payload = {"input_value": text, "input_type": "chat", "output_type": "chat"}
request = urllib.request.Request(
    URL,
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",
    },
    method="POST",
)
with urllib.request.urlopen(request, timeout=90) as response:
    body = json.loads(response.read().decode("utf-8"))

answer = body["outputs"][0]["outputs"][0]["results"]["message"]["data"]["text"]
print(answer)
