# AutoCRM

A modern, full-stack customer support and ticket management system built with React, TypeScript, and Supabase.

## Features

- 🏢 **Multi-tenant Support**: Manage multiple organizations with isolated data and users
- 👥 **Role-based Access Control**: 
  - System roles: Admin, Agent, User
  - Organization roles: Owner, Admin, Member
- 🎫 **Advanced Ticket Management**:
  - Priority levels (Low, Medium, High)
  - Categories (Bug, Feature Request, Support, Billing, Other)
  - Status tracking (Open, In Progress, Resolved, Closed)
  - Custom tags support
- 💬 **Rich Communication**:
  - Public and internal message threading
  - System notifications
  - File attachments
- 📊 **Audit Logging**: Track all changes and activities within tickets

## Tech Stack

- **Frontend**:
  - React 18
  - TypeScript
  - Tailwind CSS
  - HeadlessUI Components
  - React Router
  - Vite (Build Tool)

- **Backend**:
  - Supabase (Backend as a Service)
  - PostgreSQL Database
  - Row Level Security
  - Real-time subscriptions

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sadaqat12/autocrm
   cd autocrm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Database Setup**
   - Run the schema migrations:
     ```bash
     # Import schema.sql into your Supabase project
     ```
   - (Optional) Seed the database with test data:
     ```bash
     # Import seeds/seed_data.json
     ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Project Structure

```
autocrm/
├── src/
│   ├── components/     # Reusable React components
│   ├── pages/         # Page components
│   ├── lib/           # Utilities and helpers
│   └── types/         # TypeScript type definitions
├── migrations/        # Database migrations
├── seeds/            # Seed data
├── public/           # Static assets
└── currentschema/    # Current database schema
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Database Schema

Key tables:
- `organizations` - Organization management
- `profiles` - User profiles and system roles
- `organization_users` - Organization membership and roles
- `tickets` - Support tickets
- `ticket_messages` - Message threading
- `ticket_attachments` - File attachments
- `audit_log` - Change tracking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request


