# Tech Stack

This is the DEFINITIVE technology selection optimized for SurrealDB integration and cost efficiency.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Multi-Model Database** | SurrealDB | 2.0+ | Primary data store | Replaces PostgreSQL + Redis + file metadata with single solution |
| **Frontend Language** | TypeScript | 5.3.3 | Type-safe frontend development | Essential for complex educational logic and SurrealDB type safety |
| **Frontend Framework** | React | 18.2.0 | User interface framework | Mature ecosystem with excellent real-time capabilities |
| **UI Component Library** | Radix UI | 1.0.4 | Accessible UI primitives | WCAG compliance critical for educational software |
| **State Management** | Zustand + SurrealDB Live | 4.4.7 | Reactive state management | SurrealDB live queries provide real-time updates |
| **Backend Language** | Node.js | 20.11.0 LTS | Server runtime environment | Excellent SurrealDB SDK and real-time capabilities |
| **Backend Framework** | Express.js | 4.18.2 | Web application framework | Lightweight, integrates well with SurrealDB |
| **Database SDK** | surrealdb.js | 1.0+ | SurrealDB JavaScript SDK | Official SDK with full feature support |
| **API Style** | REST + SurrealDB RPC | OpenAPI 3.0 | API architecture | REST for CRUD, SurrealDB RPC for complex queries |
| **Authentication** | SurrealDB Auth + JWT | Latest | User authentication | SurrealDB's built-in auth with scope-based access |
| **File Storage** | SurrealDB + Base64 | Latest | Small file storage | Store images as Base64 in SurrealDB for simplicity |
| **Cache** | SurrealDB Memory | Latest | Session and temporary data | SurrealDB's in-memory capabilities replace Redis |
| **Real-time** | SurrealDB Live Queries | Latest | Live data updates | Native real-time without WebSocket complexity |
| **Vector Search** | SurrealDB Vectors | Latest | Content similarity | Built-in vector storage and similarity functions |
| **Frontend Testing** | Vitest + React Testing Library | 1.1.0 + 13.4.0 | Frontend testing | Fast, modern testing stack |
| **Backend Testing** | Jest + Supertest | 29.7.0 + 6.3.3 | Backend testing | Comprehensive API testing |
| **E2E Testing** | Playwright | 1.40.1 | End-to-end testing | Complete user journey testing |
| **Build Tool** | Turborepo | 1.11.2 | Monorepo orchestration | Efficient builds for SurrealDB schema management |
| **Bundler** | Vite | 5.0.10 | Frontend bundling | Fast development with SurrealDB SDK integration |
| **Deployment** | Railway/Render | Latest | Free tier hosting | Simple deployment for Node.js + SurrealDB |
| **Monitoring** | Plausible Analytics | Latest | Privacy-focused analytics | Open source, GDPR compliant |
| **Logging** | Winston + Console | 3.11.0 | Structured logging | Simple logging for development phase |
| **CSS Framework** | Tailwind CSS | 3.3.6 | Utility-first styling | Age-adaptive design system |
| **OCR** | Tesseract.js | 5.0+ | Client-side text recognition | Privacy-preserving work assessment |