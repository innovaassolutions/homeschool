# Use the official Playwright image — includes Chromium + all system libs
FROM mcr.microsoft.com/playwright:v1.58.2-jammy

WORKDIR /app

# Install Node deps (postinstall will skip browser download since they're pre-installed)
COPY package*.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install

# Copy source
COPY . .

CMD ["npm", "start"]
