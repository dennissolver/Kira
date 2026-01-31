// app/api/pubguard/scan/save/route.ts
// Save scan results to Supabase database

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ScanResult, RiskLevel } from '../../types';

// Initialize Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Generate a unique scan ID
function generateScanId(): string {
  return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Determine overall risk level from scan result
function determineRiskLevel(type: ScanResult['type'], result: any): RiskLevel {
  switch (type) {
    case 'github':
      return result.analysis?.riskLevel || 'medium';
    case 'cve':
      // Base on highest severity CVE found
      const cves = result.vulnerabilities || [];
      if (cves.some((c: any) => c.severity === 'CRITICAL')) return 'critical';
      if (cves.some((c: any) => c.severity === 'HIGH')) return 'high';
      if (cves.some((c: any) => c.severity === 'MEDIUM')) return 'medium';
      return 'low';
    case 'news':
      // News doesn't have inherent risk level
      return 'medium';
    case 'exposure':
      return result.exposure?.riskLevel || 'medium';
    default:
      return 'medium';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,           // 'github' | 'cve' | 'news' | 'exposure'
      target,         // What was scanned
      result,         // The scan result object
      agentId,        // Optional: Kira agent ID
      conversationId, // Optional: Conversation ID
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

    const supabase = getSupabaseClient();
    const scanId = generateScanId();
    const riskLevel = determineRiskLevel(type, result);

    const scanRecord: ScanResult = {
      id: scanId,
      type,
      target,
      result,
      riskLevel,
      createdAt: new Date().toISOString(),
      agentId,
      conversationId,
    };

    // Insert into pubguard_scans table
    const { data, error } = await supabase
      .from('pubguard_scans')
      .insert({
        id: scanId,
        type,
        target,
        result: JSON.stringify(result),
        risk_level: riskLevel,
        agent_id: agentId || null,
        conversation_id: conversationId || null,
        created_at: scanRecord.createdAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      
      // If table doesn't exist, return helpful error
      if (error.code === '42P01') {
        return NextResponse.json({
          error: 'Database table not found. Please run the migration.',
          migration: `
-- Run this SQL in Supabase:
CREATE TABLE IF NOT EXISTS pubguard_scans (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('github', 'cve', 'news', 'exposure')),
  target TEXT NOT NULL,
  result JSONB NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  agent_id TEXT REFERENCES kira_agents(id),
  conversation_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pubguard_scans_type ON pubguard_scans(type);
CREATE INDEX idx_pubguard_scans_risk ON pubguard_scans(risk_level);
CREATE INDEX idx_pubguard_scans_agent ON pubguard_scans(agent_id);
CREATE INDEX idx_pubguard_scans_created ON pubguard_scans(created_at DESC);
          `,
        }, { status: 500 });
      }
      
      throw error;
    }

    return NextResponse.json({
      success: true,
      scan: scanRecord,
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
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('pubguard_scans')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (id) {
      query = query.eq('id', id);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (agentId) {
      query = query.eq('agent_id', agentId);
    }
    if (riskLevel) {
      query = query.eq('risk_level', riskLevel);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Parse JSON results
    const scans = (data || []).map(row => ({
      id: row.id,
      type: row.type,
      target: row.target,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
      riskLevel: row.risk_level,
      createdAt: row.created_at,
      agentId: row.agent_id,
      conversationId: row.conversation_id,
    }));

    return NextResponse.json({
      scans,
      total: count,
      limit,
      offset,
    });
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
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('pubguard_scans')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete scan' },
      { status: 500 }
    );
  }
}
