# Deployment Guide

This document provides deployment instructions for the Homeschool Learning Platform.

## Railway Deployment

### Prerequisites
- Railway account connected to GitHub
- Environment variables configured

### Frontend Deployment
1. Create a new Railway project
2. Connect your GitHub repository
3. Set build command: `npm run build --workspace=apps/web`
4. Set start command: `npx serve apps/web/dist -s`
5. Set environment variables:
   - `NODE_ENV=production`

### Backend Deployment
1. Create a second Railway service in the same project
2. Set build command: `npm run build --workspace=apps/api`
3. Set start command: `npm start --workspace=apps/api`
4. Set environment variables:
   - `NODE_ENV=production`
   - `SURREALDB_URL=memory` (for development)
   - `SURREALDB_NAMESPACE=homeschool`
   - `SURREALDB_DATABASE=main`
   - `JWT_SECRET=your-secret-key`

## Render Deployment

### Using render.yaml
The included `render.yaml` file contains the complete configuration for deploying both services to Render.

1. Connect your GitHub repository to Render
2. Render will automatically detect the `render.yaml` configuration
3. Both frontend and backend services will be deployed automatically

### Manual Setup
If you prefer manual configuration:

#### Frontend Service
- **Type**: Web Service
- **Build Command**: `npm ci && npm run build --workspace=apps/web`
- **Start Command**: `npx serve apps/web/dist -s -p $PORT`
- **Environment**: Node.js

#### Backend Service
- **Type**: Web Service
- **Build Command**: `npm ci && npm run build --workspace=apps/api`
- **Start Command**: `npm start --workspace=apps/api`
- **Environment**: Node.js

## Environment Variables

### Required for Backend
- `NODE_ENV`: Set to `production`
- `SURREALDB_URL`: Database connection URL
- `SURREALDB_NAMESPACE`: Database namespace (default: `homeschool`)
- `SURREALDB_DATABASE`: Database name (default: `main`)
- `JWT_SECRET`: Secret key for JWT token signing

### Optional
- `PORT`: Server port (default: 3001 for development, auto-assigned in production)

## Cost Considerations

### Railway
- Free tier: 500 hours/month
- Estimated cost: $0-5/month for small applications

### Render
- Free tier: 750 hours/month
- Static sites: Free
- Estimated cost: $0/month for development

## Production Database Setup

For production deployment, replace the memory-based SurrealDB with a persistent instance:

1. Set up SurrealDB Cloud or self-hosted instance
2. Update `SURREALDB_URL` environment variable
3. Run database migrations if needed

## Monitoring and Logs

Both platforms provide:
- Application logs
- Performance metrics
- Health monitoring
- Custom domain configuration

## Troubleshooting

### Common Issues
1. **Build failures**: Check Node.js version compatibility
2. **Environment variables**: Ensure all required variables are set
3. **Database connection**: Verify SurrealDB URL and credentials
4. **CORS issues**: Configure allowed origins for API endpoints

### Support
- Railway: https://docs.railway.app/
- Render: https://render.com/docs/