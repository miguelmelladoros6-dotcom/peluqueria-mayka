# Peluquería Mayka · Los Alcázares
# Imagen de producción (compatible con Render, Railway, Fly.io, DigitalOcean, VPS...)
FROM node:20-alpine

WORKDIR /app

# Dependencias primero (aprovecha la caché de Docker)
COPY package.json ./
RUN npm install --omit=dev || npm install

# Código
COPY . .

# Carpeta de citas (se sobreescribe con un volumen si se quiere persistir)
RUN mkdir -p /app/data && touch /app/data/citas.json

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
