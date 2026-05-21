FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY crypto.mjs producer.mjs consumer.mjs noise-generator.mjs ./

CMD ["node", "producer.mjs"]
