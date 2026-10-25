# BlueVerse Setup Guide

Complete step-by-step guide to get your BlueVerse marketplace up and running.

## ✅ Step 1: Supabase Setup (5-10 minutes)

### Create Supabase Project

1. **Sign up for Supabase**
   - Go to https://supabase.com
   - Click "Start your project"
   - Sign up with GitHub or email

2. **Create New Project**
   - Click "New Project"
   - Choose your organization
   - Enter project name: `blueverse`
   - Create a strong database password (save this!)
   - Choose region closest to your users
   - Click "Create new project"
   - Wait 2-3 minutes for setup

3. **Get API Credentials**
   - Once project is ready, go to Project Settings (gear icon)
   - Click "API" in the sidebar
   - Copy these values:
     - Project URL (starts with https://...)
     - anon public key (starts with eyJ...)
   - Save these for .env.local file

### Set Up Database

4. **Run SQL Schema**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"
   - Open the `supabase-schema.sql` file from your project
   - Copy ALL the content
   - Paste into Supabase SQL Editor
   - Click "Run" (or press Ctrl/Cmd + Enter)
   - You should see "Success. No rows returned"

5. **Verify Tables Created**
   - Click "Table Editor" in left sidebar
   - You should see these tables:
     - profiles
     - assignments
     - bids
     - transactions
     - messages
     - reviews
     - notifications

### Configure Authentication

6. **Set Up Email Auth**
   - Go to Authentication > Settings
   - Scroll to "Email Auth"
   - Enable "Enable email confirmations" (optional for testing)
   - For development, you can disable this to test faster

7. **Configure Site URL**
   - Still in Authentication > Settings
   - Set Site URL to: `http://localhost:3000`
   - Add to Redirect URLs: `http://localhost:3000/auth/callback`

## ✅ Step 2: Stripe Setup (5 minutes)

### Create Stripe Account

1. **Sign up for Stripe**
   - Go to https://stripe.com
   - Click "Sign up" or "Start now"
   - Complete registration

2. **Activate Test Mode**
   - In dashboard, make sure you're in **Test mode** (toggle in top right)
   - You'll see a "Test mode" badge

3. **Get API Keys**
   - Click "Developers" in top menu
   - Click "API keys"
   - You'll see:
     - Publishable key (starts with pk_test_...)
     - Secret key (click "Reveal" to see, starts with sk_test_...)
   - Copy both keys for .env.local

4. **Set Up Webhooks** (Do this later when deploying)
   - For now, you can skip this
   - Webhooks are needed for production to handle payment events

## ✅ Step 3: Environment Configuration (2 minutes)

1. **Update .env.local file**
   - Open `.env.local` in your project
   - Replace the placeholder values:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-actual-key

# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...your-key
STRIPE_SECRET_KEY=sk_test_...your-key
STRIPE_WEBHOOK_SECRET=whsec_...your-webhook-secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

2. **Save the file**

## ✅ Step 4: Install Dependencies & Run (2 minutes)

1. **Install packages**
```bash
npm install
```

2. **Start development server**
```bash
npm run dev
```

3. **Open browser**
   - Go to http://localhost:3000
   - You should see the BlueVerse homepage

## ✅ Step 5: Test the Application

### Create Test Accounts

1. **Create a Student Account**
   - Click "Get Started" or "Sign Up"
   - Fill in details:
     - Full Name: John Student
     - Email: student@test.com
     - Select "Student"
     - Password: test123456
   - Click "Create Account"
   - Check email for verification (if enabled)
   - Sign in with credentials

2. **Create a Writer Account**
   - Sign out from student account
   - Click "Sign Up" again
   - Fill in details:
     - Full Name: Jane Writer
     - Email: writer@test.com
     - Select "Writer"
     - Password: test123456
   - Click "Create Account"
   - Sign in with credentials

3. **Verify Dashboards**
   - Student dashboard should show:
     - Stats cards
     - Post assignment button
     - Recent assignments (empty at first)
   - Writer dashboard should show:
     - Stats cards
     - Browse jobs button
     - New opportunities (empty at first)

## 🎯 What's Working Now

✅ User registration (Student & Writer)
✅ User authentication
✅ Dashboard layouts
✅ Database structure
✅ Basic navigation

## 🚧 What's Next (To Be Built)

The following features need to be implemented:

### Priority 1: Core Features
- [ ] Post assignment form (students)
- [ ] Browse assignments page (writers)
- [ ] Submit bid functionality (writers)
- [ ] View and accept bids (students)
- [ ] Assignment detail pages

### Priority 2: Payments
- [ ] Stripe checkout integration
- [ ] Payment escrow system
- [ ] Release payment to writer
- [ ] Earnings withdrawal

### Priority 3: Communication
- [ ] Messaging system
- [ ] File upload/download
- [ ] Notifications

### Priority 4: Polish
- [ ] Review and rating system
- [ ] User profiles
- [ ] Admin panel
- [ ] Email notifications

## ⚠️ Troubleshooting

### Issue: "Invalid API key" error
**Solution**: Double-check your Supabase API keys in .env.local

### Issue: Database connection error
**Solution**: Make sure you ran the SQL schema in Supabase SQL Editor

### Issue: Can't sign up users
**Solution**: Check Supabase Authentication settings, ensure email auth is enabled

### Issue: npm install fails
**Solution**: Make sure you have Node.js 18.17.0 or higher

### Issue: Port 3000 already in use
**Solution**: Run on different port: `npm run dev -- -p 3001`

## 📞 Need Help?

Contact: essaymaster1970@gmail.com
Phone: +254 171 754 04

## 🎉 You're All Set!

Your BlueVerse marketplace foundation is ready. You can now start building the remaining features!
