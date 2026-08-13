FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# The official nginx entrypoint renders /etc/nginx/templates/*.template using
# environment variables at container start. API_UPSTREAM therefore can point to
# either the Docker API service or the Raspberry Pi's private address.
ENV API_UPSTREAM=sako.knnect.lk:8000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
