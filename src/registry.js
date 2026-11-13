/**
 * Registry of the PCM agents exposed over A2A.
 * Flow IDs are read from the environment so the same build works in staging and locally.
 */
const AGENT_DEFINITIONS = [
  {
    id: "orchestrator",
    flowEnv: "LANGFLOW_FLOW_ORCHESTRATOR",
    card: {
      name: "Assistant PCM (Orchestrateur)",
      description:
        "Point d'entrée de l'assistant PCM. Il qualifie une panne de porte palière, coordonne les agents documentation, distributeur et support, puis produit une réponse contrôlée.",
      version: "1.0.0",
      skills: [
        {
          id: "triage",
          name: "Qualification de panne",
          description:
            "Collecte le site, l'étage, l'état de la porte et le niveau de risque avant toute action.",
          tags: ["triage", "diagnostic", "porte palière"],
          examples: ["La porte palière du 2e est bloquée ouverte, que faire ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
        {
          id: "coordination",
          name: "Coordination des spécialistes",
          description:
            "Délègue aux agents documentation, distributeur et support, puis synthétise les réponses avec leurs sources.",
          tags: ["orchestration", "A2A", "synthèse"],
          examples: ["Quelle pièce commander et qui contacter pour une porte qui ne se ferme plus ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
        {
          id: "escalation",
          name: "Décision d'escalade",
          description:
            "Décide entre résolution par l'utilisateur, confirmation ou escalade support avec niveau d'urgence.",
          tags: ["escalade", "support", "urgence"],
          examples: ["Une personne est bloquée dans l'ascenseur, que faire ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    },
  },
  {
    id: "docs-agent",
    flowEnv: "LANGFLOW_FLOW_DOCS",
    card: {
      name: "Agent Documentation PCM",
      description:
        "Agent de documentation technique PCM. Il répond aux questions sur les portes palières bloquées à partir des documents de maintenance ingérés dans Astra DB (collection pcm_doc).",
      version: "1.0.0",
      skills: [
        {
          id: "door-jam-procedure",
          name: "Procédure de déblocage porte palière",
          description:
            "Retrouve la procédure de déblocage d'une porte palière, les prérequis de sécurité et les étapes de vérification.",
          tags: ["maintenance", "porte palière", "procédure", "sécurité"],
          examples: [
            "La porte palière du 3e étage est bloquée ouverte, que faire ?",
            "Quelle est la procédure de déblocage d'une porte palière PCM ?",
          ],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
        {
          id: "evidence-citation",
          name: "Réponse sourcée",
          description:
            "Répond uniquement à partir des extraits retrouvés et cite le document et la section utilisés. Signale l'absence de preuve.",
          tags: ["RAG", "citation", "traçabilité"],
          examples: ["Quels documents parlent du capteur de fermeture ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    },
  },
  {
    id: "equipment-agent",
    flowEnv: "LANGFLOW_FLOW_EQUIPMENT",
    card: {
      name: "Agent Équipements PSD",
      description:
        "Agent équipements. Il identifie l'armoire d'alimentation, le contrôleur de porte ou le capteur d'obstacle, les points de contrôle et l'étape concernée.",
      version: "1.0.0",
      skills: [
        {
          id: "equipment-check",
          name: "Contrôle des équipements PSD",
          description:
            "Décrit EQ-PSD-ALIM, EQ-PSD-CTRL et EQ-PSD-OBS : rôle, points de contrôle, symptôme et étape E1 ou E2.",
          tags: ["équipement", "PSD", "alimentation", "contrôleur", "capteur"],
          examples: ["Que vérifier sur le contrôleur de porte EQ-PSD-CTRL ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    },
  },
  {
    id: "degraded-agent",
    flowEnv: "LANGFLOW_FLOW_DEGRADED",
    card: {
      name: "Agent Modes dégradés PSD",
      description:
        "Agent modes dégradés. Il applique D1, D2 ou D3 selon l'état de la porte, précise les mesures, qui décide et quand escalader au PCC.",
      version: "1.0.0",
      skills: [
        {
          id: "degraded-mode",
          name: "Mode dégradé PSD",
          description:
            "Choisit entre D1, D2 et D3, décrit les mesures et la décision d'exploitation.",
          tags: ["mode dégradé", "D1", "D2", "D3", "PCC"],
          examples: ["Quand appliquer D2 et qui décide ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    },
  },
  {
    id: "distributor-agent",
    flowEnv: "LANGFLOW_FLOW_DISTRIBUTOR",
    card: {
      name: "Agent Distributeur DAT",
      description:
        "Agent spécialisé sur le distributeur automatique de titres (DAT) et le monnayeur. Il identifie les composants, les pannes, les contacts de maintenance et les procédures à partir de la collection pcm_destributer_doc.",
      version: "1.0.0",
      skills: [
        {
          id: "dat-components",
          name: "Composants du DAT",
          description:
            "Identifie les éléments du distributeur automatique de titres : écran, imprimante, fente, porte de service.",
          tags: ["DAT", "distributeur", "composants"],
          examples: ["Quels sont les composants du distributeur automatique de titres ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
        {
          id: "monnayeur-faults",
          name: "Pannes du monnayeur",
          description:
            "Diagnostique les bourrages et incidents du monnayeur à partir des procédures distributeur.",
          tags: ["monnayeur", "bourrage", "panne"],
          examples: ["Le monnayeur indique un bourrage, que faire ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
        {
          id: "maintenance-contacts",
          name: "Contacts et conditions de maintenance",
          description:
            "Retrouve le contact du distributeur, les horaires et les conditions d'intervention pour le site concerné.",
          tags: ["contact", "maintenance", "SLA"],
          examples: ["Qui contacter pour une intervention sur le DAT du site J35 ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    },
  },
  {
    id: "critic-agent",
    flowEnv: "LANGFLOW_FLOW_CRITIC",
    card: {
      name: "Agent Critique PCM",
      description:
        "Agent critique. Il relit une réponse proposée, vérifie la sécurité, l'ancrage, la complétude et l'absence de placeholder, puis renvoie un verdict JSON.",
      version: "1.0.0",
      skills: [
        {
          id: "safety-review",
          name: "Contrôle sécurité",
          description:
            "Bloque les instructions dangereuses : forcer une porte, neutraliser un verrou, monter sans protection, omettre une escalade.",
          tags: ["sécurité", "critique", "safety"],
          examples: ["Faut-il forcer la porte au tournevis ?"],
          inputModes: ["text/plain"],
          outputModes: ["application/json"],
        },
        {
          id: "grounding-review",
          name: "Contrôle d'ancrage",
          description:
            "Vérifie que chaque procédure, contact et référence est sourcé, et détecte les placeholders.",
          tags: ["ancrage", "citation", "placeholder"],
          examples: ["La réponse contient-elle un numéro inventé ?"],
          inputModes: ["text/plain"],
          outputModes: ["application/json"],
        },
      ],
    },
  },
  {
    id: "logger-agent",
    flowEnv: "LANGFLOW_FLOW_LOGGER",
    card: {
      name: "Agent Journalisation PCM",
      description:
        "Agent de journalisation. Il enregistre chaque question utilisateur et la réponse finale dans MongoDB via les outils MCP, pour audit et amélioration continue.",
      version: "1.0.0",
      skills: [
        {
          id: "interaction-log",
          name: "Journalisation des interactions",
          description:
            "Écrit un document question, réponse, source, date et session dans la collection interactions.",
          tags: ["journalisation", "audit", "MCP", "MongoDB"],
          examples: ["Enregistre cette interaction dans MongoDB."],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    },
  },
  {
    id: "support-agent",
    flowEnv: "LANGFLOW_FLOW_SUPPORT",
    card: {
      name: "Agent Annuaire PCM",
      description:
        "Agent annuaire. Il retrouve le bon contact et la condition d'appel : astreinte maintenance, astreinte électricité, PCC, agent de station.",
      version: "1.0.0",
      skills: [
        {
          id: "contact-lookup",
          name: "Recherche de contact",
          description:
            "Donne le numéro exact, le rôle, les horaires et la condition d'appel à partir de PROC-PAL-001 §6.",
          tags: ["annuaire", "contact", "astreinte", "PCC"],
          examples: ["Qui appeler quand l'alimentation PSD est absente ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
        {
          id: "escalation-routing",
          name: "Orientation d'escalade",
          description:
            "Distingue astreinte maintenance, astreinte électricité, PCC et agent de station selon l'étape du diagnostic.",
          tags: ["escalade", "orientation", "urgence"],
          examples: ["Qui contacter après deux réarmements sans succès ?"],
          inputModes: ["text/plain"],
          outputModes: ["text/plain"],
        },
      ],
    },
  },
];

export function buildRegistry(config) {
  const env = config.env || process.env;
  return AGENT_DEFINITIONS.map((definition) => ({
    id: definition.id,
    flowId: env[definition.flowEnv] || "",
    flowEnv: definition.flowEnv,
    card: definition.card,
  }));
}

export function buildAgentCard(agent, config) {
  const base = `${config.publicBaseUrl}/${agent.id}`;
  return {
    protocolVersion: "0.3.0",
    name: agent.card.name,
    description: agent.card.description,
    url: base,
    preferredTransport: "JSONRPC",
    version: agent.card.version,
    provider: {
      organization: "Abafusion",
      url: "https://stg-agentic.abafusion.ai",
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: agent.card.skills,
    securitySchemes: {
      bearer: {
        type: "http",
        scheme: "bearer",
        description: "Jeton Bearer partagé avec l'orchestrateur PCM.",
      },
    },
    security: [{ bearer: [] }],
    supportsAuthenticatedExtendedCard: false,
  };
}
