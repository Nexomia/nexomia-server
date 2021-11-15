FROM node as builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src/ ./src
RUN yarn build

FROM node as runner
WORKDIR /app
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/dist/ ./dist
RUN yarn --production

CMD ["yarn", "run", "start:prod"]