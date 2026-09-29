FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
COPY package.json ./
COPY *.js *.html *.css *.webmanifest *.svg .env.example capacitor.config.json README.md ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/api/ai/health').then(r=>process.exit([200,502,503].includes(r.status)?0:1)).catch(()=>process.exit(1))"
CMD ["sh","-c","cp app-v2.js app.js && cp styles-v2.css styles.css && node server-ai.js"]
