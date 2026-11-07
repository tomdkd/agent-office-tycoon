FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine-slim AS production

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build --chown=101:101 /app/dist/ /usr/share/nginx/html/

USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
