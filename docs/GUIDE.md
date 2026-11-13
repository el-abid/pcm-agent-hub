# Guide d'utilisation

## Prérequis

- Accès au projet J35 sur `https://stg-agentic.abafusion.ai`.
- Clé API Langflow avec droit d'exécution des flows.
- Node.js 20 ou plus pour la passerelle.
- `cloudflared` ou un hébergement pour rendre la passerelle joignable.

## 1. Créer la clé API Langflow

Dans l'espace de travail, ouvrir les paramètres du projet, section API keys, créer une clé nommée `pcm-a2a-gateway`. La copier immédiatement, elle n'est affichée qu'une fois. Elle est indépendante de la session navigateur.

## 2. Créer les flows spécialisés

Dans le projet J35, créer les flows du brief. Chacun contient `Chat Input → Agent → Chat Output`.

| Flow | Outil | Prompt |
|---|---|---|
| `A2A · Docs` | Astra DB `pcm_doc` | `docs/prompts/docs-agent.md` |
| `A2A · Equipements` | Astra DB `pcm_doc` | `docs/prompts/equipment-agent.md` |
| `A2A · Modes degrades` | Astra DB `pcm_doc` | `docs/prompts/degraded-agent.md` |
| `A2A · Annuaire` | Astra DB `pcm_doc` | `docs/prompts/annuaire-agent.md` |
| `A2A · Critique` | aucun | `docs/prompts/critic.md` |
| `A2A · Distributor` (extra) | Astra DB `pcm_destributer_doc` | `docs/prompts/distributor-agent.md` |
| `A2A · Logger` (extra) | MCP `mongodb-atlas-http` | `docs/prompts/logger-agent.md` |

Régler la température basse (0 à 0.2), activer les outils, et vérifier chaque flow dans le Playground avec une question de test avant de continuer.

Récupérer l'identifiant de chaque flow depuis l'URL : `https://stg-agentic.abafusion.ai/flow/{flow_id}`. Récupérer aussi l'identifiant du flow `PCM Agent` existant : il sert d'orchestrateur exposé en A2A.

## 3. Configurer la passerelle

```powershell
cd pcm-agent-hub
npm install
Copy-Item .env.example .env
```

Renseigner dans `.env` :

- `LANGFLOW_API_KEY` : clé de l'étape 1 ;
- `LANGFLOW_FLOW_ORCHESTRATOR` : identifiant du flow `PCM Agent` ;
- `LANGFLOW_FLOW_DOCS`, `LANGFLOW_FLOW_EQUIPMENT`, `LANGFLOW_FLOW_DEGRADED`, `LANGFLOW_FLOW_SUPPORT`, `LANGFLOW_FLOW_CRITIC` : flows du brief ;
- `A2A_BEARER_TOKEN` : chaîne aléatoire longue, par exemple 48 caractères ;
- `PUBLIC_BASE_URL` : URL publique de l'étape 4.

Vérifier :

```powershell
npm test
npm start
```

`/healthz` doit renvoyer `configured: true` pour les huit agents.

## 4. Exposer la passerelle

```powershell
cloudflared tunnel --url http://localhost:8787
```

Copier l'URL `https://...trycloudflare.com` dans `PUBLIC_BASE_URL`, redémarrer la passerelle, puis regénérer les cartes :

```powershell
npm run cards
```

Contrôle rapide :

```powershell
Invoke-RestMethod "https://VOTRE-URL/docs-agent/.well-known/agent-card.json"
Invoke-RestMethod "https://VOTRE-URL/healthz"
```

## 5. Câbler l'orchestrateur

Dans le flow `PCM Agent` :

1. Ajouter `Chat Input` et `Chat Output` s'ils manquent.
2. Importer `langflow/a2a_client_tool.py` comme composant personnalisé.
3. Ajouter quatre instances du brief : `docs-agent`, `equipment-agent`, `degraded-agent`, `support-agent` (Annuaire). Renseigner `hub_url`, `bearer_token`, `agent_id`.
4. Connecter chaque sortie `Tool` à l'entrée `Tools` de l'orchestrateur.
5. Coller le prompt `docs/prompts/orchestrator.md` dans les instructions de l'orchestrateur.
6. Remplacer `openrouter/free` par un modèle fiable pour l'appel d'outils.

Garder les agents internes actuels comme solution de secours, mais le chemin de démonstration doit passer par les outils A2A.

## 6. Ajouter la boucle de critique

Dans le même flow, après l'orchestrateur :

1. `Critique` : agent avec le prompt `docs/prompts/critic.md`, sortie JSON.
2. `Combine Text` : `text1` reçoit la réponse de l'orchestrateur, `text2` reçoit le verdict du critique, délimiteur `--- VERDICT ---`.
3. `Réviseur` : agent avec le prompt `docs/prompts/revisor.md`, reçoit le texte combiné.
4. `Chat Output` : reçoit la réponse du réviseur.

Une seule passe de correction. Le verdict du critique reste inspectable sur son nœud pour la démonstration.

## 7. Tester de bout en bout

1. Appel direct de chaque agent A2A avec le script du README.
2. Appel de l'orchestrateur dans le Playground avec les trois scénarios de `docs/DEMO.md`.
3. Vérifier `logs/a2a-requests.ndjson` : une ligne par appel, statut `completed`.
4. Vérifier que le critique rejette bien une réponse volontairement dangereuse.

## 8. Exporter les preuves

```powershell
npm run cards
```

Le dossier `agent-cards/` contient les quatre cartes des agents exposés : orchestrateur, documentation, distributeur et support. Le critique est un composant interne du flow orchestrateur, décrit dans `docs/ARCHITECTURE.md`. Joindre `docs/ARCHITECTURE.md`, ce guide et la vidéo de démonstration.

## Dépannage

| Symptôme | Cause probable | Correction |
|---|---|---|
| `401 ACCESS_TOKEN_EXPIRED` | Clé API absente ou révoquée | Recréer la clé et redémarrer |
| `A2A_ERROR` dans l'orchestrateur | Tunnel arrêté ou URL obsolète | Relancer cloudflared, mettre à jour `.env` |
| `-32000` | Flow en erreur ou modèle sans accès | Tester le flow seul dans le Playground |
| Réponse vide | Sortie du flow mal connectée | Vérifier `Chat Output` |
| Lenteur | Modèle gratuit ou RAG volumineux | Changer de modèle, réduire `top_k` |
| Carte avec ancienne URL | `PUBLIC_BASE_URL` modifiée sans redémarrage | Redémarrer puis `npm run cards` |

## Limites connues

- Les tâches A2A sont en mémoire, perdues au redémarrage. Suffisant pour la démo, pas pour la production.
- Pas de streaming ni de notifications push.
- Le taux d'appel n'est pas limité. Ajouter un rate limit avant une exposition large.
- Les cartes sont publiques. Ne jamais y mettre de secret ni d'identifiant interne.
