// lib/kira/research-tools.ts
// Tool definitions for Kira's collaborative research capabilities
// Includes Serper web search integration

export const KIRA_RESEARCH_TOOLS = [
  {
    name: 'start_research_session',
    description: `Start a collaborative research session with the user. Call this when the user wants to research a topic together. This creates a time-limited session (5 minutes) with search limits to prevent data overload. After starting, you can search and save findings while the user does their own research.`,
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'The topic to research together',
        },
        research_angles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific angles or questions you plan to research (2-4 items)',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'search_web',
    description: `Search the web for information during a research session using Google Search. Limited to 3 searches per session, 5 results per search. Use focused, specific queries. Always have a clear reason for each search. Can search regular web or news specifically.`,
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The research session ID (from start_research_session)',
        },
        query: {
          type: 'string',
          description: 'The search query - be specific and focused',
        },
        reason: {
          type: 'string',
          description: 'Why this search helps the user objective',
        },
        search_type: {
          type: 'string',
          enum: ['web', 'news'],
          description: 'Type of search: "web" for general search, "news" for recent news articles (default: web)',
        },
      },
      required: ['session_id', 'query', 'reason'],
    },
  },
  {
    name: 'fetch_url',
    description: `Fetch and read the content of a specific URL. Use this to get more detail from a search result or a URL the user shares. Limited to 5 URLs per session, content truncated to 2000 tokens per URL.`,
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The research session ID (optional)',
        },
        url: {
          type: 'string',
          description: 'The URL to fetch content from',
        },
        reason: {
          type: 'string',
          description: 'Why this URL is relevant to the research',
        },
      },
      required: ['url', 'reason'],
    },
  },
  {
    name: 'save_finding',
    description: `Save a research finding to the user's knowledge base. Use this to save useful information from your searches. Always include a relevance note explaining why this matters for the user's objective.`,
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The research session ID (optional - can save outside sessions too)',
        },
        title: {
          type: 'string',
          description: 'Clear, descriptive title for the finding',
        },
        url: {
          type: 'string',
          description: 'Source URL if applicable',
        },
        summary: {
          type: 'string',
          description: 'Your summary of the key information (2-4 sentences)',
        },
        key_points: {
          type: 'array',
          items: { type: 'string' },
          description: 'Bullet points of the most important takeaways (3-5 items)',
        },
        relevance_note: {
          type: 'string',
          description: 'Why this matters for the user objective - be specific',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for organization (e.g., "competitor", "pricing", "strategy")',
        },
        topic: {
          type: 'string',
          description: 'The broader topic this relates to',
        },
      },
      required: ['title', 'summary', 'relevance_note'],
    },
  },
  {
    name: 'search_knowledge',
    description: `Search the user's knowledge base for previously saved information. Use this before doing new research to see what you already know. Also use when the user asks about something you may have researched before.`,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for in the knowledge base',
        },
        topic: {
          type: 'string',
          description: 'Filter by topic (optional)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'complete_research',
    description: `Complete a research session and synthesize findings. Call this when you've finished your searches, or when the user has shared what they found, or when you're ready to discuss the combined findings.`,
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'The research session ID to complete',
        },
        synthesis: {
          type: 'string',
          description: 'Your synthesis of the combined findings from both your research and the user contributions',
        },
      },
      required: ['session_id'],
    },
  },
];

// Generate webhook tool configs for ElevenLabs
export function generateResearchToolConfigs(webhookBaseUrl: string) {
  return KIRA_RESEARCH_TOOLS.map(tool => ({
    type: 'webhook',
    name: tool.name,
    description: tool.description,
    params: {
      method: 'POST',
      url: `${webhookBaseUrl}/api/kira/research`,
      query_params: {},
      request_body_schema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            value_type: 'constant',
            constant: tool.name,
          },
          // Include user_id for all tools
          user_id: {
            type: 'string',
            value_type: 'llm_context',
            description: 'The user ID',
          },
          ...Object.fromEntries(
            Object.entries(tool.parameters.properties).map(([key, value]) => [
              key,
              { ...value, value_type: 'llm_prompt' },
            ])
          ),
        },
        required: ['tool_name', ...tool.parameters.required],
      },
    },
  }));
}

// Export tool names for reference
export const RESEARCH_TOOL_NAMES = KIRA_RESEARCH_TOOLS.map(t => t.name);