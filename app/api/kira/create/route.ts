import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { createConvaiAgent } from '@/lib/elevenlabs/createConvaiAgent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  try {
    const { draftId, email } = await req.json();

    if (!draftId || !email) {
      return NextResponse.json({ error: 'Missing draftId or email' }, { status: 400 });
    }

    const { data: draft } = await supabase
      .from('kira_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (!draft) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    }

    const prompt = draft.system_prompt;      // already assembled text
    const greeting = draft.first_message;    // already assembled text

    const agent = await createConvaiAgent({
      apiKey: process.env.ELEVENLABS_API_KEY!,
      name: `Kira_${draft.journey_type}_${draft.user_name}`,
      prompt,
      greeting,
      voiceId: 'EXAVITQu4vr4xnSDxMaL',
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/elevenlabs`,
    });

    await supabase.from('kira_agents').insert({
      draft_id: draftId,
      email,
      elevenlabs_agent_id: agent.agent_id,
      status: 'active',
    });

    return NextResponse.json({
      success: true,
      agentId: agent.agent_id,
      requestId,
    });

  } catch (err: any) {
    console.error('[KIRA CREATE]', err.message);
    return NextResponse.json(
      { error: err.message, requestId },
      { status: 500 }
    );
  }
}
