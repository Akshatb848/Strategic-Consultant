FROM node:20-alpine

WORKDIR /app

COPY asis/frontend/package.json /app/package.json
RUN npm install

COPY asis/frontend /app

ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx next start --port ${PORT:-3000}"]

