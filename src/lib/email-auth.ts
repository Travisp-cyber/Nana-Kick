import { supabaseAdmin } from '@/lib/supabase/admin';

// Alternative auth method using email-based membership (from webhooks)
export async function checkEmailMembership(email: string): Promise<boolean> {
  if (!email) return false;
  
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('email', email.toLowerCase())
      .gte('renewal_date', new Date().toISOString().split('T')[0]) // Check if renewal date is in future
      .single();
    
    if (error) {
      console.log('Email membership check error:', error.message);
      return false;
    }
    
    return !!data && data.pool_limit > 0; // Has active membership with usage allowance
  } catch (error) {
    console.error('Email membership check failed:', error);
    return false;
  }
}

// Check if email has any membership record (even expired)
export async function getEmailMembership(email: string) {
  if (!email) return null;
  
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    
    if (error) return null;
    return data;
  } catch (error) {
    console.error('Get email membership failed:', error);
    return null;
  }
}