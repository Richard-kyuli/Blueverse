# BlueVerse Quick Start Guide

## 🚀 Quick Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

## 📁 Key Files to Know

```
.env.local              → Your secret credentials (DON'T COMMIT!)
supabase-schema.sql     → Database structure
contexts/AuthContext.jsx → User authentication logic
lib/supabase.js         → Supabase client
lib/stripe.js           → Stripe configuration
```

## 🔑 Quick Access URLs

```
Homepage:           http://localhost:3000
Sign Up:            http://localhost:3000/auth/signup
Sign In:            http://localhost:3000/auth/signin
Dashboard:          http://localhost:3000/dashboard

Supabase Dashboard: https://supabase.com/dashboard
Stripe Dashboard:   https://dashboard.stripe.com
```

## 👥 Test Accounts

Create these for testing:

**Student Account:**
- Email: student@test.com
- Password: test123456
- Type: Student

**Writer Account:**
- Email: writer@test.com  
- Password: test123456
- Type: Writer

## 🎨 Brand Colors (Tailwind)

```
brandBlue    → #2563EB (Primary)
brandAccent  → #1D4ED8 (Hover states)
brandNavy    → #1E293B (Dark text)
brandIce     → #F1F5F9 (Light background)
brandGrid    → #E2E8F0 (Borders)
textBody     → #64748B (Body text)
textMuted    → #94A3B8 (Muted text)
textDark     → #334155 (Dark text)
```

## 🗃️ Database Tables

| Table | Purpose |
|-------|---------|
| profiles | User accounts (students, writers, admins) |
| assignments | Posted assignments/jobs |
| bids | Writer proposals on assignments |
| transactions | Payment records |
| messages | Direct messages between users |
| reviews | Ratings and reviews |
| notifications | User notifications |

## 🔐 User Types

1. **Student**
   - Posts assignments
   - Reviews bids
   - Makes payments
   - Rates writers

2. **Writer**
   - Browses assignments
   - Submits bids
   - Delivers work
   - Earns money

3. **Admin** (future)
   - Manages platform
   - Resolves disputes
   - Views analytics

## 📊 Assignment Status Flow

```
open → assigned → in_progress → under_review → completed
                ↓
            cancelled
                ↓
            disputed
```

## 🔧 Common Development Tasks

### Add a new page
```bash
# Create file: app/your-page/page.jsx
# Add route: /your-page will automatically work
```

### Add a new component
```bash
# Create file: components/YourComponent.jsx
# Import and use in any page
```

### Query database
```javascript
// In any component
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value);
```

### Check auth status
```javascript
// In any component
const { user, profile, isStudent, isWriter } = useAuth();
```

## 🐛 Debugging Tips

### Check if user is authenticated
```javascript
console.log('User:', user);
console.log('Profile:', profile);
```

### Check database query
```javascript
const { data, error } = await supabase.from('assignments').select('*');
console.log('Data:', data);
console.log('Error:', error);
```

### Check environment variables
```javascript
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
// Should NOT be undefined
```

## ⚠️ Common Errors & Fixes

### "Invalid API key"
❌ Problem: Wrong Supabase credentials
✅ Fix: Check .env.local file has correct keys

### "Not authenticated"
❌ Problem: User not logged in
✅ Fix: Redirect to /auth/signin

### "Permission denied"
❌ Problem: RLS policy blocking access
✅ Fix: Check Supabase RLS policies

### "Module not found"
❌ Problem: Missing dependency
✅ Fix: Run `npm install`

### Port already in use
❌ Problem: 3000 is taken
✅ Fix: `npm run dev -- -p 3001`

## 📦 What's Included

✅ Authentication (signup, signin, signout)
✅ Protected routes
✅ Student dashboard
✅ Writer dashboard  
✅ Database schema
✅ Responsive design
✅ Toast notifications

## 🚧 What's NOT Built Yet

❌ Post assignment form
❌ Browse assignments
❌ Bidding system
❌ Payment processing
❌ Messaging
❌ File uploads
❌ Reviews

## 🎯 Next Features to Build

**Week 1-2:**
1. Assignment posting form
2. Assignment list page
3. Assignment detail page

**Week 3-4:**
4. Browse assignments (writers)
5. Submit bid form
6. View bids (students)

**Week 5-6:**
7. Accept/reject bids
8. Payment integration
9. Escrow system

## 💡 Pro Tips

1. **Always test in both roles** (student and writer)
2. **Check Supabase logs** for database errors
3. **Use React DevTools** to inspect components
4. **Test mobile view** early and often
5. **Commit often** with clear messages
6. **Keep .env.local safe** - never commit it!

## 🆘 Need Help?

1. Check SETUP-GUIDE.md for detailed setup
2. Check ROADMAP.md for feature planning
3. Check Supabase docs: https://supabase.com/docs
4. Check Next.js docs: https://nextjs.org/docs
5. Contact: essaymaster1970@gmail.com

## 🎉 You're Ready!

Open your browser to http://localhost:3000 and start building!
