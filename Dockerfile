FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/api/ready').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
CMD ["node","campusly-server-clean.js"]
