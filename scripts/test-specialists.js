const USER_ID = "f415abfc-0823-460e-8857-302b78a92de1";
const BASE = "https://stg-agentic.abafusion.ai/api/v1/run/public";

const agents = {
  docs: {
    flow: "f7eca20d-4b99-4922-9e1d-90923d1c3eb3",
    question: "Procedure porte paliere bloquee ouverte, sans personne sur la voie.",
  },
  equipment: {
    flow: "eb1ca679-f9c8-4f9c-a51e-77b2a5bcdb67",
    question: "Points de controle du controleur EQ-PSD-CTRL et etape concernee.",
  },
  degraded: {
    flow: "1dcba96a-3b37-49a9-918b-7276b5deafd4",
    question: "Quand appliquer D2 et qui decide ?",
  },
  annuaire: {
    flow: "ee00269b-0f15-4876-97e8-225c27528872",
    question: "Qui appeler quand l'alimentation PSD est absente ?",
  },
};

const started = Date.now();

const results = await Promise.all(
  Object.entries(agents).map(async ([name, { flow, question }]) => {
    const t0 = Date.now();
    try {
      const response = await fetch(`${BASE}/${flow}?user_id=${USER_ID}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input_value: question, input_type: "chat", output_type: "chat" }),
        signal: AbortSignal.timeout(90000),
      });
      const body = await response.json();
      const text = body?.outputs?.[0]?.outputs?.[0]?.results?.message?.data?.text || "";
      return { name, ms: Date.now() - t0, status: response.status, chars: text.length, head: text.slice(0, 160) };
    } catch (error) {
      return { name, ms: Date.now() - t0, error: error.message };
    }
  }),
);

for (const result of results) {
  console.log(JSON.stringify(result));
}
console.log(`total=${Date.now() - started}ms`);
