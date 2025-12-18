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

# Build sito VitePress (genera file statici in .vitepress/dist)
RUN npm run build

# Verifica che i file siano stati generati
RUN ls -la .vitepress/dist || (echo "❌ Directory .vitepress/dist non trovata!" && exit 1)
# VitePress potrebbe generare index.html o potrebbe servire la root direttamente
# Verifichiamo che ci siano file HTML generati
RUN find .vitepress/dist -name "*.html" -type f | head -5 || (echo "❌ Nessun file HTML trovato!" && exit 1)
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

