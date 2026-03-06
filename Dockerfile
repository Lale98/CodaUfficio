FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=6666
ENV HOST=0.0.0.0

EXPOSE 6666

CMD ["npm", "start"]
