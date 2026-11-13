# État d'avancement

Mis à jour le 13 novembre 2026.

## Équipe alignée sur le brief

| Rôle brief | Agent | État |
|---|---|---|
| Diagnostic | `docs-agent` | testé |
| Équipements | `equipment-agent` | testé |
| Modes dégradés | `degraded-agent` | testé |
| Annuaire | `support-agent` recadré | testé |
| Critique | `critic-agent` | testé |
| Orchestration | `PCM Agent · Fanout` | testé en direct |

Extras : `distributor-agent` (DAT), `logger-agent`.

## Livré et testé

- Fan-out déterministe `PCM Agent · Fanout` : 4 appels A2A en parallèle, puis critique, révision, enrichissement des contacts.
- Test final via la passerelle : 30,3 s, 2954 caractères, EQ-PSD présent, D2 présent, contacts `06 00 00 00 01`, `06 00 00 00 02` et PCC 4000.
- Les 4 agents ont répondu `completed` : docs, équipements, modes dégradés, annuaire.
- Critique testé : dangereux = `REVISE` + `safety_block`, sûr = `APPROVED`, placeholder = `REVISE`.
- Anti-placeholder : prompts durcis, garde déterministe, 7 tests verts.
- Journalisation Atlas opérationnelle : 15 interactions, auto-log `completed`.

## Correctifs récents

- Nouvelle clé OpenRouter installée dans la variable `openrouter_api`.
- `docs` et `support` utilisaient encore une ancienne clé en dur avec `load_from_db: false`. Corrigé : variable `openrouter_api` + `load_from_db: true`.
- Les 4 nodes `A2A Call` du fan-out pointent vers la nouvelle URL de tunnel.
- L'ancienne URL `employee-ethical-mlb-visible` est morte, remplacée par `resident-sheets-blind-parade`.
- L'URL MCP a été mise à jour, 31 outils.

## Ce qui reste

1. Enregistrer la vidéo de démonstration.
2. Ingérer d'autres familles de maintenance : escaliers mécaniques, portillons, éclairage, ascenseurs.
3. Ajouter une fiche AgentCard pour le critique et le réviseur.

## Où sont stockées les interactions

- Atlas `cluster0.rpvrk0r.mongodb.net`, base `pcm_agent`, collection `interactions`.
- Vérification : `py scripts/atlas-query.py`.

## Commandes utiles

```powershell
npm test
npm run smoke
py scripts/atlas-query.py
Get-Content logs/a2a-requests.ndjson -Tail 10
```

## Sécurité

- Flows publics pour contourner l'authentification staging.
- Tunnel MCP public en écriture, à couper après la démo.
- URI Atlas et mot de passe absents des fichiers du projet.
