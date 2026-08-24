# Pre-built: dist/ is compiled locally (Windows) and sent with the deploy.
# Reason: vite-plugin-pwa has a known buildEnd hook incompatibility on
# Linux/Alpine when running without a Vite transform cache.
FROM nginx:alpine

# Copy pre-built assets
COPY dist /usr/share/nginx/html/taskflow

# Custom nginx config for SPA under /taskflow/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
