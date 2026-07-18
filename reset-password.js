const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// 1. Load environment variables from .env.local
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim();
const serviceRoleKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)[1].trim();

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ==========================================
// CHANGE THESE TWO VALUES TO YOUR NEEDS:
const targetEmail = 'checker.ccje@attendease.test'; 
const newPassword = 'Checker123!';
// ==========================================

async function resetPassword() {
  console.log(`Searching for user with email: ${targetEmail}...`);
  
  // 2. Get user by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError.message);
    return;
  }

  const user = users.find(u => u.email.toLowerCase() === targetEmail.toLowerCase());
  if (!user) {
    console.error(`\nCould not find user with email: ${targetEmail}`);
    console.log('Available user emails in your database:');
    users.forEach(u => console.log(` - ${u.email}`));
    return;
  }

  // 3. Update password
  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateError) {
    console.error('Error updating password:', updateError.message);
  } else {
    console.log(`\n========================================`);
    console.log(`SUCCESS! Password updated successfully.`);
    console.log(`Email: ${targetEmail}`);
    console.log(`New Password: ${newPassword}`);
    console.log(`========================================`);
  }
}

resetPassword();