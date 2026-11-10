FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The waiting-list address is compiled into the page, so it is needed at build time.
ARG NEXT_PUBLIC_WAITLIST_URL=""
ENV NEXT_PUBLIC_WAITLIST_URL=$NEXT_PUBLIC_WAITLIST_URL NEXT_TELEMETRY_DISABLED=1
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 DATA_DIR=/app/var
COPY --from=build /app/package.json /app/next.config.ts ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
# Fonts and holiday data are read from disk when a print file is made.
COPY --from=build /app/src/planner/fonts ./src/planner/fonts
COPY --from=build /app/data ./data
RUN mkdir -p /app/var && chown -R node:node /app/var
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
