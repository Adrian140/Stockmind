import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials. Make sure .env file is configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestAccount() {
  const email = 'contact@prep-center.eu';
  const password = 'Parola.1234';
  const keepaApiKey = 'fmp0pac4j28u1binprtjhdtk54guq7f30sj1g4j8qs5i2ndrcf4naiknm8rs6kft';

  console.log('Creating test account...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    console.error('Error creating account:', signUpError.message);
    return;
  }

  console.log('✅ Account created successfully!');
  console.log('User ID:', signUpData.user?.id);
  console.log('Email:', signUpData.user?.email);

  if (signUpData.user) {
    console.log('\nCreating subscription record...');
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: signUpData.user.id,
        tier: 'pro',
        status: 'active'
      });

    if (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError.message);
    } else {
      console.log('✅ Subscription created (tier: pro)');
    }

    console.log('\nAdding Keepa API key...');
    const { error: integrationError } = await supabase
      .from('integrations')
      .insert({
        user_id: signUpData.user.id,
        keepa_api_key: keepaApiKey
      });

    if (integrationError) {
      console.error('Error adding Keepa API key:', integrationError.message);
    } else {
      console.log('✅ Keepa API key added successfully');
    }
  }

  console.log('\n========================================');
  console.log('TEST ACCOUNT READY!');
  console.log('========================================');
  console.log('Email:', email);
  console.log('Password:', password);
  console.log('Keepa API Key: Connected');
  console.log('Subscription: Pro (active)');
  console.log('========================================');
}

createTestAccount();
</parameter>
