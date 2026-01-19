// app/api/kira/webhooks/save_framework_draft/route.ts
// Webhook handler for Setup Kira's save_framework_draft tool

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

interface SaveFrameworkDraftPayload {
  tool_name: string;
  user_name: string;
  location: string;
  journey_type: 'personal' | 'business';
  primary_objective: string;
  key_context: string[];
  success_definition?: string;
  constraints?: string[];
  conversation_id?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();  // ✅ Now inside the function

  try {
    const payload: SaveFrameworkDraftPayload = await request.json();

    console.log('[save_framework_draft] Received:', {
      user_name: payload.user_name,
      journey_type: payload.journey_type,
      objective: payload.primary_objective?.slice(0, 50) + '...',
    });

    // Validate required fields
    if (!payload.user_name || !payload.location || !payload.journey_type || !payload.primary_objective) {
      return NextResponse.json(
        { error: 'Missing required fields: user_name, location, journey_type, primary_objective' },
        { status: 400 }
      );
    }

    // Extract first name for greeting
    const firstName = payload.user_name.split(' ')[0];

    // Save to kira_drafts table
    const { data: draft, error } = await supabase
      .from('kira_drafts')
      .insert({
        user_name: payload.user_name,
        first_name: firstName,
        location: payload.location,
        journey_type: payload.journey_type,
        primary_objective: payload.primary_objective,
        key_context: payload.key_context || [],
        success_definition: payload.success_definition,
        constraints: payload.constraints || [],
        status: 'draft',
        elevenlabs_conversation_id: payload.conversation_id,
      })
      .select()
      .single();

    if (error) {
      console.error('[save_framework_draft] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to save draft' },
        { status: 500 }
      );
    }

    console.log('[save_framework_draft] Draft saved:', draft.id);

    // Return success response for ElevenLabs
    // This is what Setup Kira will "hear" as the tool result
    return NextResponse.json({
      success: true,
      draft_id: draft.id,
      message: `Framework saved for ${firstName}. They can now see it on screen to review and edit.`,
    });

  } catch (error) {
    console.error('[save_framework_draft] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}