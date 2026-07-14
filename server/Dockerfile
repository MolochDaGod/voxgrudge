FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY index.js space-room.js carrier-room.js ./
ENV PORT=8787
EXPOSE 8787
CMD ["npm", "start"]
