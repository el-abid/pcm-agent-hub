# Serveur MCP MongoDB et journalisation

## Démarrage du serveur MCP

```powershell
# Terminal 1
$env:MDB_MCP_CONNECTION_STRING = $env:MONGODB_ATLAS_URI
npx.cmd -y mongodb-mcp-server@3.0.4 --transport http --httpHost 127.0.0.1 --httpPort 3000
```

```powershell
# Terminal 2
cloudflared tunnel --url http://127.0.0.1:3000
```

Utiliser `127.0.0.1`, pas `localhost`. Cloudflared résout `localhost` en IPv6 et
le serveur n'écoute qu'en IPv4.

L'URL du tunnel change à chaque redémarrage. La reporter dans Langflow, sinon le
compteur d'outils affiche `Error`.

## Enregistrement dans Langflow

```powershell
PATCH /api/v2/mcp/servers/mongodb-atlas-http
{ "url": "https://xxxx.trycloudflare.com/mcp" }
```

Vérification :

```powershell
GET /api/v2/mcp/servers?action_count=true
# attendu : mode=streamable_http, toolsCount=31
```

## Connexion Atlas

Le DNS SRV expire sur ce réseau. Utiliser les trois hôtes directs avec TLS :

```powershell
$user = 'VOTRE_UTILISATEUR'
$pass = 'le mot de passe'
$enc = [uri]::EscapeDataString($pass)   # % devient %25
$hosts = 'ac-7pa0fcv-shard-00-00.rpvrk0r.mongodb.net:27017,ac-7pa0fcv-shard-00-01.rpvrk0r.mongodb.net:27017,ac-7pa0fcv-shard-00-02.rpvrk0r.mongodb.net:27017'
$env:MDB_MCP_CONNECTION_STRING = "mongodb://${user}:${enc}@${hosts}/?authSource=admin&retryWrites=true&w=majority&tls=true"
npx.cmd -y mongodb-mcp-server@3.0.4 --transport http --httpHost 127.0.0.1 --httpPort 3000
```

Un `%` littéral dans le mot de passe doit être encodé en `%25`. Sinon Atlas
renvoie `bad auth`.

## Base locale de secours

Si Atlas est indisponible, un conteneur local peut prendre le relais :

```powershell
docker start pcm-mongo
$env:MDB_MCP_CONNECTION_STRING = 'mongodb://127.0.0.1:27017'
npx.cmd -y mongodb-mcp-server@3.0.4 --transport http --httpHost 127.0.0.1 --httpPort 3000
```

Le conteneur `pcm-mongo` est arrêté, ses données sont conservées.

## Journalisation

Le flow `A2A · Logger` utilise un composant `Log Interaction (MCP)` :

- `question`
- `answer`
- `session_id`

Le composant appelle `POST /log` sur la passerelle A2A. La passerelle utilise le
client MCP officiel et exécute :

```
insert-many
connectionId = preconfigured
database = pcm_agent
collection = interactions
documents = [{ question, answer, source, session_id, created_at }]
```

La passerelle journalise aussi automatiquement chaque réponse de l'orchestrateur
(`AUTO_LOG_INTERACTIONS=true`) : la question A2A et la réponse finale sont
envoyées au flow logger en arrière-plan, sans bloquer la réponse utilisateur.

## Vérification de l'insertion

```powershell
py scripts/atlas-query.py
```

Ou avec pymongo, en construisant l'URI directe avec TLS et l'encodage du `%`.

## Erreurs connues

| Erreur | Cause | Correction |
|---|---|---|
| `bad auth : authentication failed` | URI Atlas obsolète | Mettre à jour `MONGODB_ATLAS_URI` ou utiliser la base locale |
| `Connection "x" does not exist` | L'agent a inventé un connectionId | Utiliser `preconfigured` |
| `Failed to connect via Streamable HTTP` | URL du tunnel obsolète ou serveur arrêté | Redémarrer et PATCH l'URL |
| `toolsCount: null` | Même cause | Vérifier le tunnel et le port 3000 |
| `LOG_ERROR` dans le logger | Passerelle ou MCP indisponible | Vérifier `/log` et le tunnel MCP |

## Sécurité

Le serveur tourne en écriture et le tunnel est public. Pour une démonstration :

- utiliser un utilisateur Atlas dédié, limité à `pcm_agent` ;
- couper le tunnel et le conteneur après la démo ;
- ne jamais mettre l'URI Atlas dans un flow ou un prompt ;
- garder `A2A_BEARER_TOKEN` sur `/log` et sur les routes A2A.
