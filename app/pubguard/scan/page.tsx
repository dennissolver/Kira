// app/pubguard/scan/page.tsx
// PubGuard scan page - uses the modular Kira infrastructure

import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { PubGuardScanClient } from './client';

export default async function ScanPage() {
  const supabase = createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/pubguard/login');
  }

  // Get user profile for personalization
  const { data: profile } = await supabase
    .from('pubguard_users')
    .select('*')
    .eq('id', user.id)
    .single();

  // Get recent scans for context
  const { data: recentScans } = await supabase
    .from('pubguard_scans')
    .select('id, repo_url, risk_rating, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <PubGuardScanClient
      userId={user.id}
      userEmail={user.email || ''}
      profile={profile}
      recentScans={recentScans || []}
    />
  );
}