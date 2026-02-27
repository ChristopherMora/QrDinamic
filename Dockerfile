FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_FILE_PATH=/app/data/qrs.json

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY public ./public

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000; fetch(`http://127.0.0.1:${p}/health`).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1));"

CMD ["node", "src/server.js"]
