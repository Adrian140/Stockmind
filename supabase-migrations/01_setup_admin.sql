-- ============================================
-- SETUP FULL ADMIN ACCOUNT
-- ============================================
-- This SQL script sets up a full admin account for the existing user
-- User ID: 79e11c7f-8c35-4091-b6de-f9b7909f1495
-- Email: contact@prep-center.eu
-- 
-- What this does:
-- 1. Creates ENTERPRISE subscription (highest tier)
-- 2. Sets up complete integrations (Keepa + Sellerboard API keys)
-- 3. Ensures all permissions are active

-- ============================================
-- STEP 1: INSERT/UPDATE SUBSCRIPTION TO ENTERPRISE
-- ============================================
-- Delete existing subscription if any (to avoid conflicts)
DELETE FROM subscriptions 
WHERE user_id = '79e11c7f-8c35-4091-b6de-f9b7909f1495';

-- Insert ENTERPRISE subscription
INSERT INTO subscriptions (
  user_id,
  tier,
  status,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
) VALUES (
  '79e11c7f-8c35-4091-b6de-f9b7909f1495',
  'enterprise',  -- Highest tier
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',  -- Valid for 1 year
  NOW(),
  NOW()
);

-- ============================================
-- STEP 2: INSERT/UPDATE INTEGRATIONS
-- ============================================
-- Delete existing integrations if any
DELETE FROM integrations 
WHERE user_id = '79e11c7f-8c35-4091-b6de-f9b7909f1495';

-- Insert complete integration setup
INSERT INTO integrations (
  user_id,
  keepa_api_key,
  sellerboard_api_key,
  keepa_connected_at,
  sellerboard_connected_at,
  keepa_last_sync,
  sellerboard_last_sync,
  created_at,
  updated_at
) VALUES (
  '79e11c7f-8c35-4091-b6de-f9b7909f1495',
  'fmp0pac4j28u1binprtjhdtk54guq7f30sj1g4j8qs5i2ndrcf4naiknm8rs6kft',  -- Keepa API key
  'sb_test_api_key_full_access',  -- Sellerboard API key (can be updated later)
  NOW(),
  NOW(),
  NOW(),
  NOW(),
  NOW(),
  NOW()
);

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the admin setup is complete
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as account_created,
  u.confirmed_at as email_confirmed,
  s.tier as subscription_tier,
  s.status as subscription_status,
  s.current_period_end as subscription_expires,
  CASE WHEN i.keepa_api_key IS NOT NULL THEN 'Connected' ELSE 'Not Connected' END as keepa_status,
  CASE WHEN i.sellerboard_api_key IS NOT NULL THEN 'Connected' ELSE 'Not Connected' END as sellerboard_status
FROM auth.users u
LEFT JOIN subscriptions s ON s.user_id = u.id
LEFT JOIN integrations i ON i.user_id = u.id
WHERE u.id = '79e11c7f-8c35-4091-b6de-f9b7909f1495';

-- ============================================
-- EXPECTED RESULT:
-- ============================================
-- user_id: 79e11c7f-8c35-4091-b6de-f9b7909f1495
-- email: contact@prep-center.eu
-- subscription_tier: enterprise
-- subscription_status: active
-- keepa_status: Connected
-- sellerboard_status: Connected
-- ============================================
