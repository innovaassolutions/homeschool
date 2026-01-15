# Deployment Architecture

## Free/Low-Cost Hosting Strategy

**SurrealDB Deployment Options:**

1. **Development:** SurrealDB embedded mode with file storage
2. **Production (Free Tier):** Railway/Render with SurrealDB single-node
3. **Production (Paid):** DigitalOcean droplet ($6/month) with SurrealDB

**Frontend Hosting:**
- Netlify or Vercel free tier for static React build
- Cloudflare Pages as backup option

**Cost Breakdown:**
- Database: $0 (embedded) or $6/month (DigitalOcean)
- Frontend: $0 (Netlify/Vercel free tier)  
- CDN: $0 (Cloudflare free tier)
- ChatGPT API: Pay-per-use
- **Total: $0-6/month + API usage**

## Docker Configuration

```dockerfile
# Multi-stage build for SurrealDB + Node.js
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM surrealdb/surrealdb:latest as surrealdb

FROM node:20-alpine
RUN apk add --no-cache curl
COPY --from=surrealdb /surreal /usr/local/bin/surreal
COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000 8000
CMD ["sh", "-c", "surreal start --bind 0.0.0.0:8000 file://data.db & npm start"]
```