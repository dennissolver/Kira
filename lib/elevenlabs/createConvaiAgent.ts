export async function createConvaiAgent({
  apiKey,
  name,
  prompt,
  greeting,
  voiceId,
  webhookUrl,
}: {
  apiKey: string;
  name: string;
  prompt: string;
  greeting: string;
  voiceId: string;
  webhookUrl: string;
}) {
  const res = await fetch(
    'https://api.elevenlabs.io/v1/convai/agents/create',
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        conversation_config: {
          agent: {
            prompt: {
              prompt: prompt,  // ✅ Single string, not nested object
              llm: 'gpt-4o-mini',
              temperature: 0.7,
            },
            first_message: greeting,  // ✅ Correct location at agent level
            language: 'en',
          },
          tts: {
            voice_id: voiceId,
            model_id: 'eleven_turbo_v2_5',
          },
        },
        platform_settings: {
          webhook: {
            url: webhookUrl,
            events: ['conversation.transcript', 'conversation.ended'],
          },
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs failed: ${res.status} ${err}`);
  }

  return res.json();
}