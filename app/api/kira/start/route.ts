// app/api/kira/start/route.ts
// Returns a signed URL for connecting to the Setup Kira agent
// Passes journey context so Setup Kira knows which path the user chose

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SETUP_AGENT_ID = process.env.KIRA_SETUP_AGENT_ID;

export async function GET(request: NextRequest) {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: 'ElevenLabs API key not configured' },
      { status: 500 }
    );
  }

  if (!SETUP_AGENT_ID) {
    return NextResponse.json(
      { error: 'Setup agent ID not configured' },
      { status: 500 }
    );
  }

  // Get the journey type from query params
  const { searchParams } = new URL(request.url);
  const journey = searchParams.get('journey') as 'personal' | 'business' | null;

  if (!journey || !['personal', 'business'].includes(journey)) {
    return NextResponse.json(
      { error: 'Invalid journey type. Must be "personal" or "business"' },
      { status: 400 }
    );
  }

  try {
    // Get signed URL from ElevenLabs with custom data
    // The journey context will be available to the agent via dynamic variables
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${SETUP_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[kira/start] ElevenLabs error:', errorText);
      return NextResponse.json(
        { error: 'Failed to get conversation URL' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Return the signed URL along with journey context
    // The frontend will pass this to the conversation session
    return NextResponse.json({
      signedUrl: data.signed_url,
      journey: journey,
      // Additional context that can be passed to the agent
      context: {
        journey_type: journey,
        journey_label: journey === 'personal' ? 'Personal Journey' : 'Business Journey',
        timestamp: new Date().toISOString(),
      }
    });
  } catch (error) {
    console.error('[kira/start] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}