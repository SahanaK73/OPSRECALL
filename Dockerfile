FROM node:22-bookworm-slim AS build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --include=dev
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --include=dev
COPY frontend/index.html frontend/tsconfig.json frontend/vite.config.ts ./
COPY frontend/src ./src
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/frontend/dist ./public
USER node
CMD ["node", "dist/server.js"]
