# SurrealDB Functionality Overview

## **SurrealDB Core Functionality**

### **Multi-Model Database Architecture**
SurrealDB is a multi-model database that enables developers to use multiple techniques to store and model data without having to choose a method in advance. It combines document, relational, and graph database functionality in a single platform.

### **Data Models & Types**

**Basic Data Types:**
- Booleans, strings, numerics (decimal, int, float), durations, datetimes, arrays, objects, geometries (GeoJSON), futures, and null/none values
- Complex Record IDs using arrays for timeseries contexts
- Strict typing system with casting operators for type conversion

**Advanced Features:**
- Nested fields and arrays with unlimited depth
- Inter-document record links without JOINs, eliminating N+1 query problems
- Graph database functionality with vertices and edges containing metadata

### **Query Language (SurrealQL)**

**Core Statements:**
- SELECT, CREATE, UPDATE, DELETE statements for data manipulation
- INSERT statements with VALUES clause or object specification
- RELATE statements for adding graph edges between records
- FOR statements for iteration over data and advanced logic
- THROW statements for custom error handling

**Advanced Query Features:**
- Parameters for storing values across queries
- Recursive subqueries for complex data manipulation
- Nested field queries using dot notation and array notation
- Record ID ranges for timeseries querying
- Graph traversal with multi-table, multi-depth document retrieval

### **Indexing & Search**

**Full-Text Search:**
- Full-text indexing with configurable text analyzers, relevance matching, and highlighting with offset extraction
- Support for field queries and BM25 scoring

**Vector Embeddings:**
- Vector embedding indexing with euclidean distance metrics for similarity matching and advanced data analysis
- Vector functions including vector::similarity::cosine and KNN operator support

**Other Indexing:**
- Table indexes for performance improvement and UNIQUE constraints
- Support for single and multi-column indexes including nested fields

### **Real-Time Features**

**Live Queries:**
- Live SQL queries for real-time change notifications on specific documents or tables
- Support for sending full documents or only changesets using DIFF-MATCH-PATCH algorithm

**WebSocket Support:**
- Built-in WebSocket support for real-time data change notifications
- SurrealQL over HTTP/WebSocket connectivity

### **Functions & Programming**

**Built-in Functions:**
- Array, HTTP, Math, Parsing, Random, Search, String, Type, Vector, Geo, Time, Count, and Validation functions
- Math constants including π, e, and various fractional constants

**Custom Programming:**
- Embedded JavaScript functions with ES2020 standard support and context isolation
- Custom functions with typed arguments and nested queries

### **Machine Learning (SurrealML)**

**Model Support:**
- Support for PyTorch, TensorFlow, and Sklearn models in custom .surml format
- Model training in Python with consistent execution in Python, Rust, or SurrealDB
- CPU and GPU model inference within the database alongside data

**Model Management:**
- Import/export models from cloud storage (Amazon S3, Google Cloud Storage, Azure)
- Multiple model versions with automatic field mapping and normalization

### **Schema Management**

**Flexible Schema:**
- Schemafull or schemaless tables with ability to switch between modes
- Table fields with type definitions, default values, and constraints
- Table events triggered after data changes with access to before/after values

**Advanced Features:**
- Versioned temporal tables for point-in-time querying (in development)
- Aggregate analytics views for pre-computed analytics with time-based windowing

### **Security & Permissions**

**Access Control:**
- Root, namespace, database, and scope-level access control
- Fine-grained table permissions for select, create, update, delete operations
- 3rd party OAuth authentication with JWT token support

**Authentication:**
- Support for ES256, ES384, ES512, HS256, HS384, HS512, PS256, PS384, PS512, RS256, RS384, RS512 algorithms

### **Deployment Options**

**Architecture:**
- Single-node in-memory or persistent storage (SurrealKV, RocksDB)
- Distributed clusters with SurrealKV (in development)
- Built entirely in Rust as both embedded library and database server

**Platform Support:**
- Multi-tenancy data separation with unlimited namespaces and databases
- Docker container support with configuration via command-line
- WebAssembly support for browser-based persistence in IndexedDB

### **Connectivity & APIs**

**API Options:**
- REST API for Key-Value operations and SurrealQL submission
- JSON RPC, CBOR RPC, and Binary RPC over HTTP/WebSocket
- GraphQL schema generation and querying (experimental)

**SDKs Available:**
- **Server-side:** Rust, JavaScript/TypeScript, Node.js, Python, Java, Golang, .NET, PHP
- **Client-side:** JavaScript/TypeScript, WebAssembly, React.js, Next.js, Vue.js, Angular, Solid.js, Svelte

### **Tooling & Management**

**Development Tools:**
- Command-line tool for import/export, backup, and server management
- Surrealist UI with table views, SurrealQL querying, and graph visualization
- VS Code language support with TextMate grammar

### **Recent Additions (2025)**
- Distributed sequences support
- SQL base64 encoding/decoding functionality
- Array functions for natural and lexical sorting
- Official n8n integration for AI workflows
- Graph visualization in Surrealist 3.2

### **Key Benefits**

SurrealDB positions itself as a comprehensive solution that consolidates multiple database needs into a single dependency, supporting:
- Graph links and record links
- Full-text search capabilities
- Vector embeddings and vector search
- Offline capability through WebAssembly
- Real-time data synchronization
- Multi-model data storage and querying

This makes it an attractive option for modern applications requiring complex data relationships, real-time features, and AI/ML capabilities all within a single database platform.