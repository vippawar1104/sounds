FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Next.js resolves rewrites during the build, so expose Railway's service
# variable as a Docker build argument before running `next build`.
ARG BACKEND_URL
ENV BACKEND_URL=$BACKEND_URL

RUN npm run build

EXPOSE 3000
CMD sh -c "npm run start -- -H 0.0.0.0 -p ${PORT:-3000}"
