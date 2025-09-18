# Portrait Studio

## Overview

Portrait Studio is a full-stack web application that enables AI-powered portrait transformations and video generation. Built with React, Express.js, and Drizzle ORM, it integrates with Replicate's AI models to provide advanced image processing capabilities. The application features a modern, responsive interface with real-time processing status updates and support for multiple output formats.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **State Management**: Zustand for client-side state management with subscribeWithSelector middleware
- **Styling**: Tailwind CSS with custom CSS variables and Radix UI components for consistent design
- **Query Management**: TanStack React Query for server state management and API caching
- **File Handling**: React Dropzone for drag-and-drop file uploads with base64 encoding

### Backend Architecture
- **Server Framework**: Express.js with TypeScript support
- **File Processing**: Multer middleware for handling multipart form data and file uploads
- **API Design**: RESTful endpoints with comprehensive error handling and request logging
- **Development Setup**: Vite integration for hot module replacement in development mode

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Connection**: Neon Database serverless PostgreSQL with connection pooling
- **File Storage**: Memory-based storage with file system fallback for uploaded assets

### Authentication and Authorization
- **User Management**: Basic user schema with username/password authentication
- **Session Handling**: Express session management with connect-pg-simple for PostgreSQL session store
- **Security**: Environment variable validation for sensitive API tokens

### External Service Integrations
- **AI Processing**: Replicate API integration for image transformations and video generation
- **Model Support**: Flux Kontext Pro model for advanced portrait styling and character generation
- **Asset Management**: Static file serving for uploads and generated content with proper MIME type handling

### Key Design Decisions

**Monorepo Structure**: The application uses a shared TypeScript configuration across client, server, and shared directories, enabling code reuse and type safety across the full stack.

**Real-time Processing**: Implements polling-based status checking for long-running AI operations rather than WebSockets, providing simpler error handling and recovery.

**Type Safety**: Comprehensive TypeScript usage with Zod schema validation for API requests and database operations, ensuring runtime type safety.

**Asset Handling**: Support for large model files (GLTF, GLB) and audio assets through Vite configuration, enabling rich media experiences.

**Error Boundaries**: Replit-specific error overlay integration for enhanced development experience with runtime error reporting.