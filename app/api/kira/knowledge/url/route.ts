// app/api/kira/knowledge/url/route.ts
// Add URL to ElevenLabs knowledge base

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'ELEVENLABS_API_KEY missing' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { url, agentId, userId, name } = body as {
      url: string;
      agentId?: string;
      userId?: string;
      name?: string;
    };

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    console.log(`[knowledge/url] Adding URL: ${url}`);

    // Create knowledge base document from URL
    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/knowledge-base/url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          url,
          name: name || url,
        }),
      }
    );

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text();
      console.error('[knowledge/url] ElevenLabs error:', errorText);
      return NextResponse.json(
        { error: 'Failed to add URL to knowledge base', details: errorText },
        { status: 502 }
      );
    }

    const elevenData = await elevenRes.json();
    const documentId = elevenData.id;
    const documentName = elevenData.name || name || url;

    console.log(`[knowledge/url] Created document: ${documentId}`);

    // Generate a summary for the database
    let hostname = 'website';
    try {
      hostname = new URL(url).hostname;
    } catch {
      // Use default
    }

    // Save to our database
    const supabase = createServiceClient();

    const { data: knowledgeRecord, error: dbError } = await supabase
      .from('kira_knowledge')
      .insert({
        user_id: userId,
        elevenlabs_document_id: documentId,
        source_type: 'user_url',
        title: name || url,
        url: url,
        summary: name || `Content from ${hostname}`,
        status: 'ready',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[knowledge/url] DB error:', dbError);
    }

    // If agentId provided, attach document to agent
    if (agentId) {
      const attachResult = await attachDocumentToAgent(agentId, documentId, documentName);
      if (!attachResult.success) {
        console.error('[knowledge/url] Failed to attach to agent:', attachResult.error);
      } else {
        console.log(`[knowledge/url] Attached document to agent: ${agentId}`);
      }
    }

    return NextResponse.json({
      success: true,
      documentId,
      documentName,
      knowledgeId: knowledgeRecord?.id,
    });

  } catch (error) {
    console.error('[knowledge/url] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to attach document to an existing agent
async function attachDocumentToAgent(
  agentId: string,
  documentId: string,
  documentName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // First get current agent config
    const getRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!getRes.ok) {
      return { success: false, error: 'Failed to get agent' };
    }

    const agentData = await getRes.json();
    const existingKnowledgeBase = agentData.conversation_config?.agent?.prompt?.knowledge_base || [];

    // Add new document with required name field
    const updatedKnowledgeBase = [
      ...existingKnowledgeBase,
      {
        type: 'url',
        id: documentId,
        name: documentName,
      }
    ];

    // Update agent
    const updateRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          conversation_config: {
            agent: {
              prompt: {
                knowledge_base: updatedKnowledgeBase,
              },
            },
          },
        }),
      }
    );

    if (!updateRes.ok) {
      const errorText = await updateRes.text();
      return { success: false, error: errorText };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: String(error) };
  }
}