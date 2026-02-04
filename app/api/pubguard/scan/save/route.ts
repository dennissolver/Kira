// app/api/pubguard/scan/save/route.ts
// Save scan results to Supabase database
// FIXED: Now accepts and stores user_id, session_id, user_type

import { NextRequest, NextResponse } from 'next/server';
import { saveScanToSupabase } from '@/lib/pubguard/supabase';

// Also keep direct Supabase client for the GET/DELETE endpoints
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      target,
      result,
      agentId,
      conversationId,
      // NEW fields - these were missing before
      user_id,
      userId,        // accept both naming conventions
      session_id,
      sessionId,
      user_type,
      userType,
    } = body;

    if (!type || !target || !result) {
      return NextResponse.json(
        { error: 'Type, target, and result are required' },
        { status: 400 }
      );
    }

    const validTypes = ['github', 'cve', 'news', 'exposure'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Use the shared saveScanToSupabase function which handles all fields
    const resolvedUserId = user_id || userId || null;
    const resolvedSessionId = session_id || sessionId || null;
    const resolvedUserType = user_type || userType || 'user';

    // Build a report-like object that saveScanToSupabase expects
    const report = {
      trafficLight: result.riskLevel || result.trafficLight || 'amber',
      overallRiskScore: result.overallRiskScore || result.risk_score || null,
      target: { url: target, name: result.targetName || target },
      targetName: result.targetName || target,
      findings: result.findings || null,
      github: result.github || null,
      cve: result.cve || null,
      news: result.news || null,
      securityTests: result.securityTests || null,
      sourcesChecked: result.sourcesChecked || null,
      reportHash: result.reportHash || null,
      // Pass through the full result as well
      ...result,
    };

    const saved = await saveScanToSupabase(
      report,
      result.scanDurationMs || 0,
      resolvedUserId,
      resolvedSessionId,
      resolvedUserType,
      agentId,
      conversationId
    );

    if (!saved) {
      return NextResponse.json(
        { error: 'Failed to save scan result' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      scan: {
        id: saved.id,
        type,
        target,
        riskLevel: report.trafficLight,
        userId: resolvedUserId,
        userType: resolvedUserType,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Save scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save scan result' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve saved scans
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const agentId = searchParams.get('agentId');
    const riskLevel = searchParams.get('riskLevel');
    const userId = searchParams.get('userId');
    const userType = searchParams.get('userType');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('pubguard_scans')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (id) query = query.eq('id', id);
    if (type) query = query.eq('type', type);
    if (agentId) query = query.eq('agent_id', agentId);
    if (riskLevel) query = query.eq('risk_level', riskLevel);
    if (userId) query = query.eq('user_id', userId);
    if (userType) query = query.eq('user_type', userType);

    const { data, error, count } = await query;

    if (error) throw error;

    const scans = (data || []).map(row => ({
      id: row.id,
      type: row.type,
      target: row.target,
      targetName: row.target_name,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
      riskLevel: row.risk_level,
      riskScore: row.risk_score,
      userId: row.user_id,
      userType: row.user_type,
      sessionId: row.session_id,
      createdAt: row.created_at,
      agentId: row.agent_id,
      conversationId: row.conversation_id,
    }));

    return NextResponse.json({ scans, total: count, limit, offset });
  } catch (error) {
    console.error('Get scans error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve scans' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to remove a scan
export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Scan ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('pubguard_scans').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete scan' },
      { status: 500 }
    );
  }
}