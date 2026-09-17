# ---------------------------------------------------------- development ----
FROM node:22-alpine AS development
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ----------------------------------------------------------- build --------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The middleware reads this. Set at build time as well as run time, so the
# production image reaches the API by its compose service name either way.
ARG API_INTERNAL_URL=http://api:8080
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build

# --------------------------------------------------------- production -----
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Security fixes released since the base image was built, and no package
# managers: the server runs `node server.js` and never installs anything, so
# npm, npx, corepack and yarn are attack surface with nothing to offset it.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg \
 && addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
