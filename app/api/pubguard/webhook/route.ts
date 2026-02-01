// app/api/pubguard/webhook/route.ts
// PubGuard Webhook for Kira Voice Agent
// Handles tool calls from ElevenLabs Conversational AI

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface ToolCall {
  tool_name: string;
  parameters: Record<string, any>;
}

interface WebhookPayload {
  tool_call?: ToolCall;
  tool_calls?: ToolCall[];
  conversation_id?: string;
  agent_id?: string;
}

interface ToolResponse {
  success: boolean;
  data?: any;
  error?: string;
  speak?: string;  // What Kira should say
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase not configured');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// HMAC VERIFICATION
// ============================================================================

function verifyHmacSignature(payload: string, signature: string | null): boolean {
  // Use PubGuard-specific secret, fallback to generic one
  const secret = process.env.ELEVENLABS_WEBHOOK_PUBGUARD_SECRET || process.env.ELEVENLABS_WEBHOOK_SECRET;
  
  // If no secret configured, allow all requests (development mode)
  if (!secret) {
    console.log('[PubGuard Webhook] No HMAC secret configured, allowing request');
    return true;
  }
  
  // If no signature provided but secret is set, check if we should enforce
  if (!signature) {
    // For now, allow requests without signature to support ElevenLabs setup
    // TODO: Enforce signature once ElevenLabs is configured properly
    console.warn('[PubGuard Webhook] No signature provided, allowing request (enforcement disabled)');
    return true;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  if (!isValid) {
    console.error('[PubGuard Webhook] Signature mismatch');
  }
  
  return isValid;
}

// ============================================================================
// TOOL HANDLERS
// ============================================================================

// Get the latest scan for a repository
async function handleGetLatestScan(params: Record<string, any>): Promise<ToolResponse> {
  const supabase = getSupabaseClient();
  const searchTerm = params.repo_name || params.repo_url;
  
  if (!searchTerm) {
    return {
      success: false,
      error: 'Please provide a repository name or URL',
      speak: "I need a repository name or URL to look up. Which project would you like me to check?",
    };
  }

  const { data, error } = await supabase
    .from('pubguard_scans')
    .select('*')
    .or(`target_name.ilike.%${searchTerm}%,target_url.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return {
      success: false,
      error: 'No scan found for this repository',
      speak: `I don't have any previous scans for ${searchTerm}. Would you like me to run a new scan?`,
    };
  }

  const scan = data;
  const daysAgo = Math.floor((Date.now() - new Date(scan.created_at).getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    success: true,
    data: scan,
    speak: `I found a scan for ${scan.target_name} from ${daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`}. ` +
           `It has a ${scan.traffic_light.toUpperCase()} rating with a risk score of ${scan.risk_score} out of 100. ` +
           `${scan.traffic_light === 'red' ? "I have serious concerns about this software." : 
              scan.traffic_light === 'amber' ? "There are some risks to be aware of." : 
              "It looks safe overall."} ` +
           `Would you like me to go through the findings?`,
  };
}

// Get scan history for a repository
async function handleGetScanHistory(params: Record<string, any>): Promise<ToolResponse> {
  const supabase = getSupabaseClient();
  const searchTerm = params.repo_name;
  const limit = params.limit || 5;
  
  if (!searchTerm) {
    return {
      success: false,
      error: 'Please provide a repository name',
      speak: "Which repository would you like to see the scan history for?",
    };
  }

  const { data, error } = await supabase
    .from('pubguard_scans')
    .select('id, target_name, traffic_light, risk_score, created_at')
    .or(`target_name.ilike.%${searchTerm}%,target_url.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) {
    return {
      success: false,
      error: 'No scan history found',
      speak: `I don't have any scan history for ${searchTerm}.`,
    };
  }

  const historyText = data.map((scan, i) => {
    const date = new Date(scan.created_at).toLocaleDateString();
    return `${date}: ${scan.traffic_light.toUpperCase()} rating, score ${scan.risk_score}`;
  }).join('. ');

  return {
    success: true,
    data: data,
    speak: `I found ${data.length} scan${data.length > 1 ? 's' : ''} for ${data[0].target_name}. ${historyText}. ` +
           `${data.length > 1 && data[0].risk_score !== data[data.length - 1].risk_score ? 
             `The risk score has ${data[0].risk_score > data[data.length - 1].risk_score ? 'increased' : 'decreased'} over time.` : ''}`,
  };
}

// List recent scans (user's or all)
async function handleListRecentScans(params: Record<string, any>): Promise<ToolResponse> {
  const supabase = getSupabaseClient();
  const limit = params.limit || 10;
  
  let query = supabase
    .from('pubguard_scans')
    .select('id, target_name, traffic_light, risk_score, created_at, user_type')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (params.user_id) {
    query = query.eq('user_id', params.user_id);
  }
  
  if (params.traffic_light) {
    query = query.eq('traffic_light', params.traffic_light);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      success: false,
      error: 'No recent scans found',
      speak: "I don't have any recent scans to show you.",
    };
  }

  const redCount = data.filter(s => s.traffic_light === 'red').length;
  const amberCount = data.filter(s => s.traffic_light === 'amber').length;
  const greenCount = data.filter(s => s.traffic_light === 'green').length;

  return {
    success: true,
    data: data,
    speak: `I found ${data.length} recent scans. ${redCount > 0 ? `${redCount} had RED ratings. ` : ''}` +
           `${amberCount > 0 ? `${amberCount} had AMBER ratings. ` : ''}` +
           `${greenCount > 0 ? `${greenCount} had GREEN ratings. ` : ''}` +
           `The most recent was ${data[0].target_name} with a ${data[0].traffic_light.toUpperCase()} rating. ` +
           `Would you like details on any of these?`,
  };
}

// Compare two scans
async function handleCompareScans(params: Record<string, any>): Promise<ToolResponse> {
  const supabase = getSupabaseClient();

  // If repo name provided, compare latest two scans
  if (params.repo_name && !params.scan_id_1) {
    const { data, error } = await supabase
      .from('pubguard_scans')
      .select('*')
      .or(`target_name.ilike.%${params.repo_name}%,target_url.ilike.%${params.repo_name}%`)
      .order('created_at', { ascending: false })
      .limit(2);

    if (error || !data || data.length < 2) {
      return {
        success: false,
        error: 'Need at least 2 scans to compare',
        speak: `I need at least two scans of ${params.repo_name} to make a comparison. I only found ${data?.length || 0}.`,
      };
    }

    const [newer, older] = data;
    const scoreDiff = newer.risk_score - older.risk_score;
    const improved = scoreDiff < 0;

    return {
      success: true,
      data: { newer, older, scoreDiff },
      speak: `Comparing the two most recent scans of ${newer.target_name}. ` +
             `The risk score went from ${older.risk_score} to ${newer.risk_score}, ` +
             `${improved ? `an improvement of ${Math.abs(scoreDiff)} points` : scoreDiff === 0 ? 'no change' : `an increase of ${scoreDiff} points`}. ` +
             `${newer.traffic_light !== older.traffic_light ? 
               `The rating changed from ${older.traffic_light.toUpperCase()} to ${newer.traffic_light.toUpperCase()}.` : 
               `The rating stayed at ${newer.traffic_light.toUpperCase()}.`}`,
    };
  }

  return {
    success: false,
    error: 'Please provide a repository name or two scan IDs to compare',
    speak: "Which repository would you like me to compare scans for?",
  };
}

// Get specific finding details
async function handleGetFindingDetails(params: Record<string, any>): Promise<ToolResponse> {
  const supabase = getSupabaseClient();
  
  let scan;
  
  if (params.scan_id) {
    const { data, error } = await supabase
      .from('pubguard_scans')
      .select('*')
      .eq('id', params.scan_id)
      .single();
    
    if (error || !data) {
      return { success: false, error: 'Scan not found', speak: "I couldn't find that scan." };
    }
    scan = data;
  } else if (params.repo_name) {
    const { data, error } = await supabase
      .from('pubguard_scans')
      .select('*')
      .or(`target_name.ilike.%${params.repo_name}%,target_url.ilike.%${params.repo_name}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      return { success: false, error: 'No scan found', speak: `I don't have any scans for ${params.repo_name}.` };
    }
    scan = data;
  } else {
    return { success: false, error: 'Need scan_id or repo_name', speak: "Which scan would you like finding details for?" };
  }

  const findings = scan.findings as any;
  const type = params.finding_type?.toLowerCase() || 'critical';
  
  const relevantFindings = findings[type] || [];
  
  if (relevantFindings.length === 0) {
    return {
      success: true,
      data: { findings: [], type },
      speak: `Good news! There are no ${type} findings for ${scan.target_name}.`,
    };
  }

  const findingsList = relevantFindings.slice(0, 3).map((f: any) => f.title).join(', ');
  
  return {
    success: true,
    data: { findings: relevantFindings, type, scan_id: scan.id },
    speak: `${scan.target_name} has ${relevantFindings.length} ${type} finding${relevantFindings.length > 1 ? 's' : ''}. ` +
           `${relevantFindings.length <= 3 ? `They are: ${findingsList}.` : `The top ones are: ${findingsList}.`} ` +
           `Would you like me to explain any of these in detail?`,
  };
}

// Search scans
async function handleSearchScans(params: Record<string, any>): Promise<ToolResponse> {
  const supabase = getSupabaseClient();
  
  if (!params.query) {
    return {
      success: false,
      error: 'Please provide a search query',
      speak: "What would you like me to search for?",
    };
  }

  let query = supabase
    .from('pubguard_scans')
    .select('id, target_name, target_url, traffic_light, risk_score, created_at')
    .or(`target_name.ilike.%${params.query}%,target_url.ilike.%${params.query}%`)
    .order('created_at', { ascending: false })
    .limit(params.limit || 10);

  if (params.traffic_light) {
    query = query.eq('traffic_light', params.traffic_light);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      success: false,
      error: 'No matching scans found',
      speak: `I couldn't find any scans matching "${params.query}".`,
    };
  }

  return {
    success: true,
    data: data,
    speak: `I found ${data.length} scan${data.length > 1 ? 's' : ''} matching "${params.query}". ` +
           `${data.slice(0, 3).map(s => `${s.target_name} with a ${s.traffic_light.toUpperCase()} rating`).join(', ')}. ` +
           `Would you like details on any of these?`,
  };
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-elevenlabs-signature') || 
                      request.headers.get('x-webhook-signature');

    // Verify HMAC signature
    if (!verifyHmacSignature(rawBody, signature)) {
      console.error('[PubGuard Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload: WebhookPayload = JSON.parse(rawBody);
    console.log('[PubGuard Webhook] Received:', JSON.stringify(payload, null, 2));

    // Handle single tool call or array of tool calls
    const toolCalls = payload.tool_calls || (payload.tool_call ? [payload.tool_call] : []);

    if (toolCalls.length === 0) {
      return NextResponse.json({ error: 'No tool calls provided' }, { status: 400 });
    }

    // Process each tool call
    const results: ToolResponse[] = [];

    for (const toolCall of toolCalls) {
      const { tool_name, parameters } = toolCall;
      console.log(`[PubGuard Webhook] Processing tool: ${tool_name}`, parameters);

      let result: ToolResponse;

      switch (tool_name) {
        case 'get_latest_scan':
        case 'get_scan':
        case 'lookup_scan':
          result = await handleGetLatestScan(parameters);
          break;

        case 'get_scan_history':
        case 'list_scan_history':
          result = await handleGetScanHistory(parameters);
          break;

        case 'list_recent_scans':
        case 'get_recent_scans':
          result = await handleListRecentScans(parameters);
          break;

        case 'compare_scans':
        case 'compare_scan_results':
          result = await handleCompareScans(parameters);
          break;

        case 'get_finding_details':
        case 'get_findings':
        case 'explain_finding':
          result = await handleGetFindingDetails(parameters);
          break;

        case 'search_scans':
        case 'find_scans':
          result = await handleSearchScans(parameters);
          break;

        default:
          result = {
            success: false,
            error: `Unknown tool: ${tool_name}`,
            speak: `I'm not sure how to handle that request. I can help you look up scan results, compare scans, or search through scan history.`,
          };
      }

      results.push(result);
    }

    // Return response in ElevenLabs expected format
    const response = results.length === 1 ? results[0] : { results };
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('[PubGuard Webhook] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Webhook processing failed',
        speak: "I encountered an error processing that request. Please try again.",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'PubGuard Kira Webhook',
    version: '1.0',
    tools: [
      'get_latest_scan',
      'get_scan_history',
      'list_recent_scans',
      'compare_scans',
      'get_finding_details',
      'search_scans',
    ],
  });
}
