# Multi-stage build:
#   1. node:22-alpine builds the static site into /dist
#   2. nginx:alpine serves the built artefacts on port 80
#
# Result image is ~25 MB and contains no Node toolchain, no source, no
# secrets — only the compiled HTML/CSS/JS the Starlight build produces.

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first so Docker can cache them when only source changes.
COPY package.json package-lock.json ./
RUN npm ci

# Build the static site.
COPY . .
RUN npm run build

# ─── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:alpine AS serve

# Drop the default nginx config and copy our minimal one.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built site from stage 1.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
