FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_JOSLASYNC_API_URL
ARG VITE_MASTER_EMAIL
ENV VITE_JOSLASYNC_API_URL=$VITE_JOSLASYNC_API_URL
ENV VITE_MASTER_EMAIL=$VITE_MASTER_EMAIL

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
