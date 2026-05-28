-- ============================================
-- AuraMint Database Schema v1.0
-- Supabase PostgreSQL Migration
-- ============================================

-- ─── Profiles (extends auth.users) ──────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  total_aura BIGINT DEFAULT 0,
  current_tier TEXT DEFAULT 'NPC',
  streak_days INT DEFAULT 0,
  last_active_date DATE,
  is_premium BOOLEAN DEFAULT FALSE,
  premium_expires_at TIMESTAMPTZ,
  theme TEXT DEFAULT 'cosmic',
  language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Aura Events (core content) ─────────
CREATE TABLE aura_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(description) <= 280),
  aura_points INT NOT NULL,
  ai_verdict TEXT NOT NULL,
  ai_vibe_tag TEXT,
  ai_emoji TEXT,
  category TEXT NOT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  reaction_counts JSONB DEFAULT '{"crown":0,"skull":0,"fire":0,"yikes":0,"iconic":0,"npc":0}',
  upvotes INT DEFAULT 0,
  downvotes INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Reactions ──────────────────────────
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES aura_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('crown','skull','fire','yikes','iconic','npc')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ─── Votes ──────────────────────────────
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES aura_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value INT NOT NULL CHECK (value IN (1, -1)),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

-- ─── Friendships ────────────────────────
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- ─── Orders (Cashfree payments) ─────────
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cashfree_order_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','FAILED','REFUNDED')),
  plan TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Activity Log ───────────────────────
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_total_aura ON profiles(total_aura DESC);
CREATE INDEX idx_aura_events_user ON aura_events(user_id);
CREATE INDEX idx_aura_events_created ON aura_events(created_at DESC);
CREATE INDEX idx_aura_events_public ON aura_events(is_public, created_at DESC);
CREATE INDEX idx_aura_events_upvotes ON aura_events(upvotes DESC);
CREATE INDEX idx_reactions_event ON reactions(event_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);
CREATE INDEX idx_votes_event ON votes(event_id);
CREATE INDEX idx_votes_user ON votes(user_id);
CREATE INDEX idx_friendships_user ON friendships(user_id);
CREATE INDEX idx_friendships_friend ON friendships(friend_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_activity_log_user ON activity_log(user_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles readable" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Aura Events
ALTER TABLE aura_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public events readable" ON aura_events FOR SELECT USING (is_public = true OR user_id = auth.uid());
CREATE POLICY "Users can insert own events" ON aura_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own events" ON aura_events FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own events" ON aura_events FOR DELETE USING (user_id = auth.uid());

-- Reactions
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions readable" ON reactions FOR SELECT USING (true);
CREATE POLICY "Users can insert own reactions" ON reactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own reactions" ON reactions FOR DELETE USING (user_id = auth.uid());

-- Votes
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votes readable" ON votes FOR SELECT USING (true);
CREATE POLICY "Users can insert own votes" ON votes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own votes" ON votes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own votes" ON votes FOR DELETE USING (user_id = auth.uid());

-- Friendships
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own friendships" ON friendships FOR SELECT USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "Users can insert friendships" ON friendships FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own friendships" ON friendships FOR UPDATE USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "Users can delete own friendships" ON friendships FOR DELETE USING (user_id = auth.uid());

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own orders" ON orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own orders" ON orders FOR INSERT WITH CHECK (user_id = auth.uid());

-- Activity Log
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see own activity" ON activity_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own activity" ON activity_log FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Calculate aura tier from total points
CREATE OR REPLACE FUNCTION get_aura_tier(total BIGINT)
RETURNS TEXT AS $$
BEGIN
  IF total < 0 THEN RETURN 'Negative Aura';
  ELSIF total < 5000 THEN RETURN 'NPC';
  ELSIF total < 25000 THEN RETURN 'Civilian';
  ELSIF total < 100000 THEN RETURN 'Rising Star';
  ELSIF total < 500000 THEN RETURN 'Main Character';
  ELSIF total < 1000000 THEN RETURN 'Legendary';
  ELSIF total < 5000000 THEN RETURN 'Mythical';
  ELSE RETURN 'GOD MODE';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'AuraMinter'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
