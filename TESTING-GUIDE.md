# 🧪 BlueVerse Testing Guide

## Complete User Flow Testing

Once you add your Supabase keys, follow these steps to test the entire platform:

---

## 🔑 Setup (Do This First!)

1. **Add Supabase Keys to `.env.local`**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-key
   ```

2. **Run Database Schema**
   - Open Supabase SQL Editor
   - Paste contents of `supabase-schema.sql`
   - Run the query
   - Verify tables created

3. **Restart Dev Server**
   ```bash
   npm run dev
   ```

---

## 📝 Test Scenario: Complete Marketplace Flow

### Part 1: Student Posts Assignment (5 minutes)

1. **Create Student Account**
   - Go to http://localhost:3001/auth/signup
   - Name: John Student
   - Email: student@test.com
   - Type: **Student**
   - Password: test123456
   - Click "Create Account"

2. **Sign In**
   - Go to http://localhost:3001/auth/signin
   - Email: student@test.com
   - Password: test123456
   - Should redirect to student dashboard

3. **Post an Assignment**
   - Click "Post New Assignment" or visit `/dashboard/post-assignment`
   - Fill in details:
     ```
     Title: Research Paper on Climate Change
     Description: Need a 5-page research paper on the impacts of climate change on coastal cities. Must include at least 5 academic sources and follow APA format.
     Subject: English & Literature
     Academic Level: Undergraduate
     Pages: 5
     Words: 1500
     Deadline: [Tomorrow's date]
     Budget Min: 50
     Budget Max: 100
     ```
   - Click "Post Assignment"
   - Should redirect to assignment detail page

4. **Verify Assignment Posted**
   - Go to "My Assignments"
   - Should see the assignment listed
   - Status should be "open"
   - Click on it to see details

### Part 2: Writer Browses and Bids (5 minutes)

5. **Sign Out and Create Writer Account**
   - Click "Sign Out"
   - Go to /auth/signup
   - Name: Jane Writer
   - Email: writer@test.com
   - Type: **Writer**
   - Password: test123456
   - Click "Create Account"

6. **Sign In as Writer**
   - Email: writer@test.com
   - Password: test123456
   - Should see writer dashboard

7. **Browse Assignments**
   - Click "Browse Jobs" or visit `/dashboard/browse`
   - Should see the climate change assignment
   - Try filters:
     - Subject: Enter "English"
     - Budget Min: 40
     - Should still show the assignment

8. **View Assignment and Submit Bid**
   - Click "View & Bid" on the assignment
   - Should see full assignment details
   - Fill in bid form:
     ```
     Your Price: 75
     Estimated Delivery: [Before deadline]
     Cover Letter: I'm an experienced academic writer with expertise in environmental science. I've completed 20+ research papers and can deliver high-quality work with proper citations and formatting.
     ```
   - Click "Submit Bid"
   - Should show success message

9. **Verify Bid Submitted**
   - Go to "My Bids" (`/dashboard/bids`)
   - Should see your bid listed
   - Status should be "pending"
   - Note your success rate stats

### Part 3: Student Reviews and Accepts Bid (3 minutes)

10. **Sign Out and Sign In as Student**
    - Sign out from writer account
    - Sign in as student@test.com

11. **View Received Bids**
    - Go to "My Assignments"
    - Click on the climate change assignment
    - Should see 1 bid from Jane Writer
    - Bid shows:
      - Writer name
      - Proposed price: $75
      - Delivery date
      - Cover letter/proposal

12. **Accept the Bid**
    - Review the bid details
    - Click "Accept Bid"
    - Confirm the action
    - Should show success message
    - Bid status changes to "accepted"
    - Other bids would be auto-rejected (if there were any)
    - Assignment status changes to "assigned"

### Part 4: Writer Sees Accepted Bid (2 minutes)

13. **Sign Out and Sign In as Writer**
    - Sign out from student account
    - Sign in as writer@test.com

14. **Check Bid Status**
    - Go to "My Bids"
    - The climate change bid should show "accepted" status
    - Should see green badge indicating acceptance
    - Can view assignment details

15. **Check Dashboard**
    - Go to main dashboard
    - "Active Jobs" count should be 1
    - "Accepted" bids should be 1
    - Success rate should be 100%

---

## ✅ What to Verify

### Student Side
- [ ] Can create account
- [ ] Can post assignment with all fields
- [ ] Assignment appears in "My Assignments"
- [ ] Can filter assignments by status
- [ ] Can view assignment details
- [ ] Can see received bids
- [ ] Can accept bids
- [ ] Assignment status updates after accepting bid
- [ ] Dashboard shows correct statistics

### Writer Side
- [ ] Can create account
- [ ] Can browse all open assignments
- [ ] Can filter assignments
- [ ] Can view assignment details
- [ ] Can submit bid
- [ ] Bid appears in "My Bids"
- [ ] Can update bid if pending
- [ ] Can withdraw bid
- [ ] Cannot submit duplicate bids
- [ ] Sees "accepted" status when bid accepted
- [ ] Dashboard shows correct statistics

### System
- [ ] Authentication works
- [ ] Protected routes work
- [ ] Role-based dashboards work
- [ ] Database queries work
- [ ] Form validation works
- [ ] Toast notifications appear
- [ ] Status badges display correctly
- [ ] Mobile responsive design works

---

## 🐛 Common Issues & Solutions

### "Module not found" error
**Solution:** jsconfig.json is configured, restart the dev server

### "Invalid API key" error
**Solution:** Check `.env.local` has correct Supabase keys

### No assignments showing for writer
**Solution:** Make sure assignment status is "open" and not "assigned"

### Can't submit bid
**Solution:** Check that you're signed in as a writer, not student

### Bid not showing up
**Solution:** Refresh the page, check Supabase database directly

### Assignment not updating status
**Solution:** Check RLS policies in Supabase, ensure proper permissions

---

## 🧪 Additional Test Scenarios

### Test Multiple Bids
1. Create 2 more writer accounts
2. Have each submit a bid on the same assignment
3. Student should see 3 bids
4. Accept one bid
5. Other 2 should be auto-rejected

### Test Filters
1. Post multiple assignments with different subjects
2. Test subject filter on browse page
3. Test academic level filter
4. Test budget range filter
5. Test filter combinations

### Test Edge Cases
1. Try submitting bid without filling all fields
2. Try setting delivery date before deadline
3. Try posting assignment with past deadline
4. Try accepting already-accepted bid
5. Try withdrawing accepted bid

### Test Statistics
1. Post multiple assignments
2. Submit multiple bids
3. Accept some bids
4. Check dashboard statistics update
5. Verify success rate calculations

---

## 📊 Database Verification

After testing, check Supabase tables:

### profiles table
```sql
SELECT * FROM profiles;
```
Should show 2 users (1 student, 1 writer)

### assignments table
```sql
SELECT * FROM assignments;
```
Should show posted assignment with status "assigned"

### bids table
```sql
SELECT * FROM bids;
```
Should show submitted bid with status "accepted"

### Check relationships
```sql
SELECT 
  a.title,
  a.status,
  p.full_name as student,
  b.proposed_price,
  b.status as bid_status
FROM assignments a
JOIN profiles p ON a.student_id = p.id
LEFT JOIN bids b ON a.id = b.assignment_id;
```

---

## 🎯 Success Criteria

Your platform is working if:

✅ Students can post assignments
✅ Writers can browse assignments
✅ Writers can submit bids
✅ Students can see and accept bids
✅ Assignment status updates correctly
✅ Bid status updates correctly
✅ All pages load without errors
✅ Forms validate properly
✅ Navigation works correctly
✅ Dashboards show correct data

---

## 📝 Feature Testing Checklist

### Authentication ✅
- [ ] Sign up (student)
- [ ] Sign up (writer)
- [ ] Sign in
- [ ] Sign out
- [ ] Protected routes redirect to signin
- [ ] Role-based dashboards

### Student Features ✅
- [ ] Post assignment form
- [ ] View assignments list
- [ ] Filter assignments
- [ ] View assignment detail
- [ ] View bids
- [ ] Accept bid
- [ ] Reject bid
- [ ] Dashboard statistics

### Writer Features ✅
- [ ] Browse assignments
- [ ] Filter assignments
- [ ] View assignment detail
- [ ] Submit bid
- [ ] Update bid
- [ ] Withdraw bid
- [ ] View bids list
- [ ] Filter bids
- [ ] Dashboard statistics

### UI/UX ✅
- [ ] Responsive design
- [ ] Loading states
- [ ] Empty states
- [ ] Error messages
- [ ] Success messages
- [ ] Status badges
- [ ] Hover effects
- [ ] Smooth transitions

---

## 🚀 After Testing Successfully

Once all tests pass:

1. **Celebrate!** 🎉 You have a working marketplace!

2. **Next Steps:**
   - Add Stripe payment integration
   - Build messaging system
   - Add file uploads
   - Implement reviews
   - Create admin panel

3. **Deploy to Production:**
   - Set up production Supabase project
   - Configure environment variables
   - Deploy to Vercel
   - Test live site

4. **Get Real Users:**
   - Share with friends for beta testing
   - Gather feedback
   - Iterate and improve

---

**Happy Testing! 🧪**
