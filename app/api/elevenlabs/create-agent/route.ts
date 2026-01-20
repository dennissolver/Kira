import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { name } = await req.json();

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'Missing ELEVENLABS_API_KEY' },
        { status: 500 }
      );
    }

    const res = await fetch(
      'https://api.elevenlabs.io/v1/convai/agents',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          name,
          language: 'en',
          model: 'eleven_multilingual_v2',
          voice_id: 'EXAVITQu4vr4xnSDxMaL', // replace if needed
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: 'ElevenLabs agent creation failed', details: err },
        { status: 500 }
      );
    }

    const data = await res.json();

    return NextResponse.json({
      elevenlabs_agent_id: data.agent_id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Unexpected error creating ConvAI agent' },
      { status: 500 }
    );
  }
}
