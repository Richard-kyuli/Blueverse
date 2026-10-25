-- ============================================================================
-- BLUEVERSE DATABASE SCHEMA
-- Student-Writer Marketplace Platform
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('student', 'writer', 'admin')),
    avatar_url TEXT,
    phone TEXT,
    bio TEXT,
    
    -- Writer-specific fields
    expertise TEXT[], -- Array of subjects/topics
    rating DECIMAL(3,2) DEFAULT 0.00,
    completed_assignments INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Verification
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    
    -- Account status
    is_active BOOLEAN DEFAULT true,
    suspended_at TIMESTAMP WITH TIME ZONE,
    suspension_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ASSIGNMENTS TABLE
-- ============================================================================
CREATE TABLE public.assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Assignment details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    subject TEXT NOT NULL,
    academic_level TEXT NOT NULL CHECK (academic_level IN ('high_school', 'undergraduate', 'masters', 'phd')),
    
    -- Requirements
    pages INTEGER,
    words INTEGER,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Files
    attachment_urls TEXT[], -- Array of file URLs
    
    -- Pricing
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    final_price DECIMAL(10,2),
    
    -- Status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'under_review', 'completed', 'cancelled', 'disputed')),
    
    -- Assignment tracking
    assigned_writer_id UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    submitted_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- BIDS TABLE
-- ============================================================================
CREATE TABLE public.bids (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    writer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Bid details
    proposed_price DECIMAL(10,2) NOT NULL,
    estimated_delivery TIMESTAMP WITH TIME ZONE NOT NULL,
    cover_letter TEXT NOT NULL,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate bids
    UNIQUE(assignment_id, writer_id)
);

-- ============================================================================
-- TRANSACTIONS TABLE
-- ============================================================================
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id),
    
    -- Parties
    student_id UUID REFERENCES public.profiles(id),
    writer_id UUID REFERENCES public.profiles(id),
    
    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    writer_earnings DECIMAL(10,2) NOT NULL,
    
    -- Stripe details
    stripe_payment_intent_id TEXT UNIQUE,
    stripe_transfer_id TEXT,
    
    -- Transaction status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'held', 'released', 'refunded', 'failed')),
    
    -- Transaction type
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('payment', 'refund', 'withdrawal')),
    
    -- Metadata
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Message content
    message TEXT NOT NULL,
    attachment_urls TEXT[],
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- REVIEWS TABLE
-- ============================================================================
CREATE TABLE public.reviews (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE CASCADE,
    
    -- Parties
    reviewer_id UUID REFERENCES public.profiles(id),
    reviewee_id UUID REFERENCES public.profiles(id),
    
    -- Review details
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    
    -- Review type
    review_type TEXT NOT NULL CHECK (review_type IN ('student_to_writer', 'writer_to_student')),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate reviews
    UNIQUE(assignment_id, reviewer_id, reviewee_id)
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Notification details
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for performance
-- ============================================================================
CREATE INDEX idx_assignments_student ON public.assignments(student_id);
CREATE INDEX idx_assignments_writer ON public.assignments(assigned_writer_id);
CREATE INDEX idx_assignments_status ON public.assignments(status);
CREATE INDEX idx_bids_assignment ON public.bids(assignment_id);
CREATE INDEX idx_bids_writer ON public.bids(writer_id);
CREATE INDEX idx_messages_assignment ON public.messages(assignment_id);
CREATE INDEX idx_messages_receiver ON public.messages(receiver_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_transactions_student ON public.transactions(student_id);
CREATE INDEX idx_transactions_writer ON public.transactions(writer_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Assignments policies
CREATE POLICY "Assignments are viewable by everyone" ON public.assignments
    FOR SELECT USING (true);

CREATE POLICY "Students can create assignments" ON public.assignments
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update own assignments" ON public.assignments
    FOR UPDATE USING (auth.uid() = student_id);

-- Bids policies
CREATE POLICY "Bids are viewable by assignment owner and bid owner" ON public.bids
    FOR SELECT USING (
        auth.uid() = writer_id OR 
        auth.uid() IN (SELECT student_id FROM public.assignments WHERE id = assignment_id)
    );

CREATE POLICY "Writers can create bids" ON public.bids
    FOR INSERT WITH CHECK (auth.uid() = writer_id);

-- Messages policies
CREATE POLICY "Users can view their own messages" ON public.messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON public.bids
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
