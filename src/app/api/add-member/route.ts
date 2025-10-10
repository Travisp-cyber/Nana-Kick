import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Temporary endpoint to quickly add Travis to the members table
export async function GET() {
  try {
    const email = 'tpark19.tp@gmail.com';
    const plan = 'creator';
    const poolLimit = 2000; // Creator plan limit
    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1); // Add 1 month
    
    // Upsert member record
    const { data, error: upsertErr } = await supabaseAdmin
      .from('members')
      .upsert({
        email: email.toLowerCase(),
        plan,
        pool_limit: poolLimit,
        renewal_date: renewalDate.toISOString().split('T')[0], // YYYY-MM-DD format
        current_usage: 0,
      }, {
        onConflict: 'email',
        ignoreDuplicates: false,
      })
      .select('*');
    
    if (upsertErr) {
      console.error('Supabase upsert error', upsertErr);
      return NextResponse.json({ 
        error: 'Failed to add member', 
        details: upsertErr.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      member: data?.[0],
      message: `Successfully added ${email} as ${plan} member`
    });
    
  } catch (error) {
    console.error('Add member error:', error);
    return NextResponse.json({
      error: 'Failed to add member',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
