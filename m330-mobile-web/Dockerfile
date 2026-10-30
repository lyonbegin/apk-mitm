FROM oven/bun:1.2.20-alpine
WORKDIR /app
COPY package.json index.ts twin.ts robot-simulator.ts twin-client.js sim-client.js twin.css ./
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", "index.ts"]
