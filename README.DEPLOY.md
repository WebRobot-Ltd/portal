# Deployment Guide - WebRobot VitePress Site

Guida per il deployment del sito VitePress su Kubernetes tramite Jenkins CI/CD.

## Prerequisiti

- Repository GitHub configurato (aggiorna `GITHUB_REPOSITORY` nel Jenkinsfile)
- Jenkins con accesso a Kubernetes cluster
- Credenziali Docker configurate per GHCR (github-token)
- Namespace Kubernetes `webrobot` esistente

## Build Locale

### Build Docker Image

```bash
# Build immagine Docker
npm run docker:build

# Oppure direttamente
docker build -t webrobot-vitepress-site .
```

### Test Locale

```bash
# Esegui container localmente
npm run docker:run

# Oppure direttamente
docker run -p 8080:80 webrobot-vitepress-site

# Accedi a http://localhost:8080
```

## CI/CD con Jenkins

### Configurazione Repository

1. Aggiorna `GITHUB_REPOSITORY` nel `Jenkinsfile` con il repository GitHub effettivo
2. Assicurati che il repository sia accessibile da Jenkins

### Pipeline Stages

1. **Checkout**: Clona il repository
2. **Build Site**: 
   - Installa dipendenze (`npm ci`)
   - Builda il sito (`npm run build`)
   - Genera file statici in `.vitepress/dist`
3. **Build & Push Docker Image**:
   - Builda immagine Docker con Kaniko
   - Push su GHCR (`ghcr.io/webrobot-ltd/webrobot-vitepress-site`)
4. **Deploy to Kubernetes**:
   - Applica manifesti Kubernetes (se presenti in `k8s/`)
   - Aggiorna deployment con nuova immagine

### Parametri Pipeline

- **BUILD_TYPE**: `dev`, `staging`, `production`
- **REDEPLOY_ONLY**: Salta build, solo deploy
- **PUSH_IMAGE**: Abilita/disabilita push Docker
- **DEPLOY_K8S**: Abilita/disabilita deploy Kubernetes

## Kubernetes Manifests

Crea i manifesti Kubernetes nella directory `k8s/`:

- `deployment.yaml`: Deployment del sito
- `service.yaml`: Service per esporre il sito
- `ingress.yaml`: Ingress per routing esterno

### Esempio Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: webrobot-vitepress-site
  namespace: webrobot
spec:
  replicas: 2
  selector:
    matchLabels:
      app: webrobot-vitepress-site
  template:
    metadata:
      labels:
        app: webrobot-vitepress-site
    spec:
      containers:
      - name: vitepress-site
        image: ghcr.io/webrobot-ltd/webrobot-vitepress-site:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
```

## Health Check

Il sito espone un endpoint `/health` per i health check Kubernetes:

```bash
curl http://localhost/health
# Risposta: healthy
```

## Note

- Il sito è completamente statico, generato da VitePress
- Nginx serve i file statici dalla directory `/usr/share/nginx/html`
- Il routing SPA è gestito da nginx con `try_files $uri $uri/ /index.html`
- Le directory cache/temp di nginx sono configurate per funzionare in Kubernetes

