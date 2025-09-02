FROM node:18-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm install && npm --prefix backend install && npm --prefix frontend install

COPY . .

EXPOSE 3000 3001

CMD ["npm", "run", "dev"]