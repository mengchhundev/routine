# Base images are pinned by digest as well as tag: a tag can be re-pointed at
# different contents, a digest cannot. Dependabot proposes digest updates.
#
# Dependencies are installed with `npm ci`, which installs exactly what
# package-lock.json records (registry URL and sha512 integrity included) and
# fails rather than resolving anything new. Install scripts are disabled by
# .npmrc, so no dependency runs code at install time.

# ---------------------------------------------------------- development ----
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS development
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ----------------------------------------------------------- build --------
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS build
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# The middleware reads this. Set at build time as well as run time, so the
# production image reaches the API by its compose service name either way.
ARG API_INTERNAL_URL=http://api:8080
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build

# --------------------------------------------------------- production -----
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS production
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
