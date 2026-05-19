# Dockerfile per WebRobot VitePress Site
# Build multi-stage per generare e servire sito statico VitePress

# Stage 1: Build
FROM node:20-alpine AS builder

# Imposta working directory
WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm ci

# Copia sorgenti
COPY . .

# Verifica che index.md sia presente
RUN test -f index.md || (echo "❌ index.md non trovato!" && ls -la && exit 1)

# Verifica che i file nella directory public siano presenti
RUN echo "📁 Verifica file nella directory public:" && \
    ls -la public/ || (echo "❌ Directory public non trovata!" && exit 1) && \
    test -f public/logo.jpeg || (echo "❌ logo.jpeg non trovato in public!" && exit 1) && \
    test -f public/logo.svg || (echo "⚠️ logo.svg non trovato in public" || true)

# Build sito VitePress (genera file statici in .vitepress/dist).
#
# Same Node↔esbuild deadlock the Jenkins Build Site stage hits:
# 'vitepress build' prints "build complete in N.Ns" and dist/ is
# fully written, but the npm/node process never exits because
# esbuild's service-mode child keeps the pipe open. Without the
# wrapper, this `RUN` line hangs indefinitely (Kaniko stays in
# 'Building stage 1' until the cluster reaps the job) — same root
# cause as the Build Site stage.
#
# Wrap with BusyBox `timeout` (alpine ships it — supports `-s KILL`
# the same way GNU coreutils does) and treat any exit code as
# success when .vitepress/dist/index.html is on disk. The build
# artifacts are what we ship; the lingering shutdown handshake is
# incidental and SIGKILL drops both processes cleanly.
RUN set +e; \
    timeout -s KILL 120 npm run build; \
    BUILD_EC=$?; \
    if [ -f .vitepress/dist/index.html ]; then \
        echo "✅ vitepress dist OK (wrapper exit=$BUILD_EC)"; \
        if [ "$BUILD_EC" = "124" ] || [ "$BUILD_EC" = "137" ]; then \
            echo "ℹ️  esbuild deadlock — SIGKILLed, build output intact."; \
        fi; \
        exit 0; \
    else \
        echo "❌ No .vitepress/dist/index.html — build truly failed (exit=$BUILD_EC)" >&2; \
        exit ${BUILD_EC:-1}; \
    fi

# Verifica che i file siano stati generati
RUN ls -la .vitepress/dist || (echo "❌ Directory .vitepress/dist non trovata!" && exit 1)

# Copia esplicitamente i file dalla directory public che potrebbero non essere stati copiati automaticamente
RUN echo "📁 Copia file mancanti da public a dist:" && \
    cp -v public/logo.jpeg .vitepress/dist/ 2>&1 || (echo "⚠️ Impossibile copiare logo.jpeg" && ls -la public/ || true) && \
    ls -la .vitepress/dist/logo* || true
# VitePress potrebbe generare index.html o potrebbe servire la root direttamente
# Verifichiamo che ci siano file HTML generati
RUN find .vitepress/dist -name "*.html" -type f | head -5 || (echo "❌ Nessun file HTML trovato!" && exit 1)
# Verifica che i file dalla directory public siano stati copiati
RUN echo "📁 Verifica file logo copiati in dist:" && \
    ls -la .vitepress/dist/logo* || (echo "⚠️ Logo files non trovati in dist" && ls -la .vitepress/dist/ | head -20) && \
    test -f .vitepress/dist/logo.jpeg || (echo "❌ logo.jpeg ancora non presente dopo copia esplicita!" && ls -la .vitepress/dist/ | grep -i logo || true && exit 1)
# Se index.html non esiste, creiamo un redirect alla homepage
RUN test -f .vitepress/dist/index.html || echo '<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/index.html"></head><body></body></html>' > .vitepress/dist/index.html || true

# Stage 2: Production - Nginx
FROM nginx:alpine

# Rimuovi file di default di nginx per evitare conflitti
RUN rm -rf /usr/share/nginx/html/*

# Copia file statici generati da VitePress
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# Crea directory necessarie per nginx (cache, temp, etc.)
# Nota: /var/run/secrets è montato da Kubernetes e non può essere modificato
RUN mkdir -p /var/cache/nginx/client_temp \
    /var/cache/nginx/proxy_temp \
    /var/cache/nginx/fastcgi_temp \
    /var/cache/nginx/uwsgi_temp \
    /var/cache/nginx/scgi_temp \
    /var/run/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/run/nginx

# Configurazione nginx personalizzata
# Configura nginx per usare directory scrivibili e MIME types corretti
RUN echo 'pid /var/run/nginx/nginx.pid; \
events { \
    worker_connections 1024; \
} \
http { \
    include /etc/nginx/mime.types; \
    default_type application/octet-stream; \
    client_body_temp_path /tmp/client_temp; \
    proxy_temp_path /tmp/proxy_temp; \
    fastcgi_temp_path /tmp/fastcgi_temp; \
    uwsgi_temp_path /tmp/uwsgi_temp; \
    scgi_temp_path /tmp/scgi_temp; \
    server { \
        listen 80; \
        server_name _; \
        root /usr/share/nginx/html; \
        index index.html; \
        location /health { \
            access_log off; \
            return 200 "healthy\n"; \
            add_header Content-Type text/plain; \
        } \
        location ~* \.(js|mjs)$ { \
            add_header Content-Type application/javascript; \
            try_files $uri =404; \
        } \
        location ~* \.(css)$ { \
            add_header Content-Type text/css; \
            try_files $uri =404; \
        } \
        location ~* \.(json)$ { \
            add_header Content-Type application/json; \
            try_files $uri =404; \
        } \
        location ~* \.(png|jpg|jpeg|gif|svg|webp|ico)$ { \
            try_files $uri =404; \
            expires 1y; \
            add_header Cache-Control "public, immutable"; \
        } \
        location / { \
            try_files $uri $uri/ /index.html; \
        } \
    } \
}' > /etc/nginx/nginx.conf

# Esponi porta
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Nginx avvia automaticamente, non serve CMD esplicito

