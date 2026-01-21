// app/api/kira/knowledge/upload/route.ts
// Upload files to ElevenLabs knowledge base and optionally attach to agent

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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const agentId = formData.get('agentId') as string | null;
    const userId = formData.get('userId') as string | null;
    const customName = formData.get('name') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`[knowledge/upload] Uploading file: ${file.name} (${file.size} bytes)`);

    // Create form data for ElevenLabs
    const elevenFormData = new FormData();
    elevenFormData.append('file', file);
    if (customName) {
      elevenFormData.append('name', customName);
    }

    // Upload to ElevenLabs knowledge base
    const elevenRes = await fetch(
      'https://api.elevenlabs.io/v1/convai/knowledge-base/file',
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: elevenFormData,
      }
    );

    if (!elevenRes.ok) {
      const errorText = await elevenRes.text();
      console.error('[knowledge/upload] ElevenLabs error:', errorText);
      return NextResponse.json(
        { error: 'Failed to upload to ElevenLabs', details: errorText },
        { status: 502 }
      );
    }

    const elevenData = await elevenRes.json();
    const documentId = elevenData.id;
    const documentName = elevenData.name || customName || file.name;

    console.log(`[knowledge/upload] Created document: ${documentId}`);

    // Save to our database for tracking
    const supabase = createServiceClient();

    const { data: knowledgeRecord, error: dbError } = await supabase
      .from('kira_knowledge')
      .insert({
        user_id: userId,
        created_by: userId,
        elevenlabs_document_id: documentId,
        source_type: 'user_upload',
        title: customName || file.name,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type,
        summary: customName || `Uploaded file: ${file.name}`,
        status: 'ready',
      })
      .select()
      .single();

    if (dbError) {
      console.error('[knowledge/upload] DB error:', dbError);
      // Don't fail - the document was uploaded to ElevenLabs
    }

    // If agentId provided, attach document to agent
    if (agentId) {
      const attachResult = await attachDocumentToAgent(agentId, documentId, documentName);
      if (!attachResult.success) {
        console.error('[knowledge/upload] Failed to attach to agent:', attachResult.error);
      } else {
        console.log(`[knowledge/upload] Attached document to agent: ${agentId}`);
      }
    }

    return NextResponse.json({
      success: true,
      documentId,
      documentName,
      knowledgeId: knowledgeRecord?.id,
    });

  } catch (error) {
    console.error('[knowledge/upload] Error:', error);
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
    // First get current agent config to preserve existing knowledge base
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

    // Add new document to knowledge base with required name field
    const updatedKnowledgeBase = [
      ...existingKnowledgeBase,
      {
        type: 'file',
        id: documentId,
        name: documentName,
      }
    ];

    // Update agent with new knowledge base
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