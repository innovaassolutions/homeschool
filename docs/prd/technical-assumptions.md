# Technical Assumptions

## Repository Structure: Monorepo
Single repository containing frontend application, backend services, and shared utilities for streamlined development and deployment.

## Service Architecture
Modern web application with real-time communication capabilities:
- Frontend: React-based web application with WebRTC for voice/camera
- Backend: Node.js API server with ChatGPT integration
- Real-time: WebSocket connections for low-latency voice interaction
- Storage: Database for user profiles and progress tracking

## Testing Requirements: Unit + Integration
- Unit tests for core business logic and utility functions
- Integration tests for ChatGPT API interactions and voice processing
- End-to-end tests for critical user journeys
- Manual testing for voice interaction quality and age-appropriate usability

## Additional Technical Assumptions and Requests
- **ChatGPT Integration:** Use ChatGPT API with Actions for progress tracking and curriculum management
- **Voice Processing:** Web Speech API for browser-based voice recognition and synthesis
- **Camera Integration:** WebRTC Camera API for photo capture and upload
- **Real-time Requirements:** WebSocket or similar technology for responsive voice interactions
- **Security:** HTTPS required, encrypted data transmission, secure API key management
- **Browser Support:** Modern browsers supporting WebRTC (Chrome, Firefox, Safari, Edge)
- **Development Framework:** React with TypeScript for type safety and maintainability
- **Database:** PostgreSQL for structured user data and progress tracking
- **Deployment:** Cloud-based hosting with auto-scaling capabilities for future growth