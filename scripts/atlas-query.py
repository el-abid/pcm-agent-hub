import json
import os
import sys
from pathlib import Path

from pymongo import MongoClient

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def load_env() -> None:
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env()
uri = os.environ.get("ATLAS_URI")
if not uri:
    raise SystemExit("ATLAS_URI manquant. Ajoutez-le dans .env (voir .env.example).")

client = MongoClient(uri, serverSelectionTimeoutMS=12000)
db = client.get_database("pcm_agent")
print("count", db.interactions.count_documents({}))
latest = db.interactions.find_one(sort=[("_id", -1)])
print(json.dumps(latest, default=str, ensure_ascii=False, indent=2)[:1500])
client.close()
