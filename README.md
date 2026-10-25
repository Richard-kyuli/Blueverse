# BlueVerse - Academic Writing Marketplace

A full-stack marketplace platform connecting students with expert academic writers. Students can post assignments, writers can bid on projects, and payments are handled securely through Stripe.

## 🚀 Features

### For Students
- ✅ Create account and post assignments
- ✅ Set budget and deadline
- ✅ Review writer bids and profiles
- ✅ Secure payment processing with Stripe
- ✅ Real-time messaging with writers
- ✅ Track assignment progress
- ✅ Review and rate writers

### For Writers
- ✅ Browse available assignments
- ✅ Submit competitive bids
- ✅ Manage active projects
- ✅ Upload completed work
- ✅ Track earnings
- ✅ Build reputation through reviews

### Platform Features
- 🔐 Secure authentication with Supabase
- 💳 Payment processing with Stripe
- 📁 File upload/download for assignments
- 💬 Real-time messaging system
- ⭐ Rating and review system
- 🎨 Modern, responsive UI with Tailwind CSS

## 🛠 Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Authentication + Storage)
- **Payments**: Stripe
- **Notifications**: React Hot Toast

## 📋 Prerequisites

Before you begin, ensure you have:
- Node.js 18.17.0 or higher
- npm or yarn
- A Supabase account (free tier available)
- A Stripe account (test mode available)

## 🔧 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/Richard-kyuli/Blueverse.git
cd Blueverse
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to Project Settings > API
3. Copy your project URL and anon public key
4. Go to SQL Editor in Supabase dashboard
5. Copy the contents of `supabase-schema.sql` and run it in the SQL Editor
6. This will create all necessary tables, policies, and triggers

### 4. Set Up Stripe

1. Go to [stripe.com](https://stripe.com) and create an account
2. Get your API keys from the Developers > API keys section
3. Use test mode keys for development

### 5. Configure Environment Variables

1. Copy `.env.local` and update with your credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📂 Project Structure

```
Blueverse/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   │   ├── signin/        # Sign in page
│   │   └── signup/        # Sign up page
│   ├── dashboard/         # Dashboard routes
│   ├── globals.css        # Global styles
│   ├── layout.jsx         # Root layout
│   └── page.jsx           # Home page
├── components/            # React components
│   └── dashboard/         # Dashboard components
├── contexts/              # React contexts
│   └── AuthContext.jsx    # Authentication context
├── lib/                   # Utility libraries
│   ├── supabase.js       # Supabase client
│   └── stripe.js         # Stripe configuration
├── supabase-schema.sql   # Database schema
└── .env.local            # Environment variables
```

## 🗄 Database Schema

The database includes the following tables:
- **profiles**: User profiles (students, writers, admins)
- **assignments**: Posted assignments
- **bids**: Writer bids on assignments
- **transactions**: Payment records
- **messages**: Direct messaging between users
- **reviews**: Rating and review system
- **notifications**: User notifications

See `supabase-schema.sql` for complete schema with RLS policies.

## 🚦 Next Steps

### Phase 2: Post Assignment Feature
- Create assignment posting form
- File upload functionality
- Assignment management page

### Phase 3: Bidding System
- Browse assignments (writers)
- Submit and manage bids
- Accept/reject bids (students)

### Phase 4: Payment Integration
- Stripe checkout flow
- Escrow system
- Earnings dashboard

### Phase 5: Messaging & Reviews
- Real-time chat
- File sharing in messages
- Review and rating system

## 📝 License

This project is private and proprietary.

## 👨‍💻 Developer

Richard Kyuli
- Email: essaymaster1970@gmail.com
- Phone: +254 171 754 04

