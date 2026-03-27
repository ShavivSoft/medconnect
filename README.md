# MedConnect

MedConnect is a comprehensive healthcare companion application designed to bridge the gap between patients, their caretakers, and their health data. By integrating native health functionality and real-time vital monitoring, MedConnect provides an intuitive platform for continuous health tracking and management.

## Key Features

- **Native Health Data Sync**: Seamlessly integrates with native mobile health frameworks (Health Connect for Android, HealthKit for iOS) and smart wearables to sync user vitals accurately.
- **Real-Time Vital Monitoring**: Live tracking of heart rate, blood pressure, oxygen levels, and other essential metrics using intelligent data bridging (`WatchBridge`).
- **Caregiver Dashboard**: A dedicated portal (Caretaker View) allowing assigned caretakers and medical professionals to monitor patient metrics remotely and receive alerts.
- **Secure Authentication & Data Storage**: Powered by Supabase to handle secure user authentication, role-based access control (Patient vs. Caretaker), and secure health records.
- **Document & Prescription Processing**: Incorporates advanced OCR via the backend for processing medical records and prescription text.

## Tech Stack

**Frontend:**
- React
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui

**Backend:**
- Node.js & Express
- Supabase (PostgreSQL, Auth, Storage)
- Python (for specialized AI and OCR tasks)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm, yarn, or bun
- Supabase project for backend configuration

### Installation

1. **Clone the repository:**
   ```bash
   git clone <YOUR_GIT_URL>
   cd medic-companion-link-main
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Ensure you have your environment variables set up properly. Create a `.env` file based on `.env.local` if necessary, and include your Supabase keys:
   ```plaintext
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

## Deployment

The application is structured for straightforward deployment to modern cloud hosting providers:

- **Frontend**: Ready for deployment on platforms like Vercel or Netlify.
- **Backend**: Can be hosted on Render or similar Node.js compatible environments.
- **Database**: Managed seamlessly via Supabase.

Ensure your environment variables are correctly mirrored in your deployment environment settings to maintain connectivity between your frontend, backend, and database.
