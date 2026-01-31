// lib/kira/prompt-builder.ts
// Utilities for building prompts from templates and context

import type { KiraContext, KiraFramework, KiraKnowledge, KiraVerticalConfig } from './types';
import { getPhilosophy, mergePhilosophy, CORE_PHILOSOPHY } from './core-philosophy';

// =============================================================================
// PROMPT SECTION BUILDERS
// =============================================================================

/**
 * Build the "What you know about [User]" section
 */
export function buildContextSection(context: KiraContext, framework?: KiraFramework): string {
  if (!framework && !context.userName) {
    return '';
  }

  const name = framework?.userName || context.userName || 'the user';
  const firstName = framework?.firstName || context.firstName || name.split(' ')[0];

  const sections: string[] = [
    `## WHAT YOU KNOW ABOUT ${firstName.toUpperCase()}`,
    ''
  ];

  if (framework) {
    sections.push(`**Name:** ${framework.userName}`);
    if (framework.location) sections.push(`**Location:** ${framework.location}`);
    sections.push(`**Journey:** ${framework.journeyType === 'personal' ? 'Personal (life stuff)' : framework.journeyType === 'business' ? 'Business (work stuff)' : 'Custom'}`);
    sections.push('');
    sections.push(`**What they want help with:**`);
    sections.push(framework.primaryObjective);
    sections.push('');

    if (framework.keyContext.length > 0) {
      sections.push('**Key context:**');
      framework.keyContext.forEach(c => sections.push(`- ${c}`));
      sections.push('');
    }

    if (framework.successDefinition) {
      sections.push('**Success looks like:**');
      sections.push(framework.successDefinition);
      sections.push('');
    }

    if (framework.constraints && framework.constraints.length > 0) {
      sections.push('**Constraints:**');
      framework.constraints.forEach(c => sections.push(`- ${c}`));
      sections.push('');
    }
  } else {
    // Minimal context from KiraContext
    sections.push(`**Name:** ${name}`);
    if (context.journeyType) {
      sections.push(`**Journey:** ${context.journeyType}`);
    }
  }

  return sections.join('\n');
}

/**
 * Build the knowledge base section
 */
export function buildKnowledgeSection(knowledge?: KiraKnowledge): string {
  if (!knowledge) return '';

  const sections: string[] = [];

  if (knowledge.files && knowledge.files.length > 0) {
    sections.push(`**Uploaded files:** ${knowledge.files.map(f => f.name).join(', ')}`);
  }

  if (knowledge.urls && knowledge.urls.length > 0) {
    sections.push(`**Reference URLs:** ${knowledge.urls.join(', ')}`);
  }

  if (knowledge.notes) {
    sections.push(`**Additional notes:** ${knowledge.notes}`);
  }

  if (sections.length === 0) return '';

  return `
## KNOWLEDGE BASE

${sections.join('\n\n')}
`;
}

/**
 * Build the tools section
 */
export function buildToolsSection(config: KiraVerticalConfig): string {
  if (config.tools.length === 0) return '';

  const toolDescriptions = config.tools.map(tool =>
    `- **${tool.name}**: ${tool.description.split('\n')[0]}`
  ).join('\n');

  return `
## AVAILABLE TOOLS

${toolDescriptions}

Use these naturally — don't announce when you're using them.
`;
}

// =============================================================================
// MAIN PROMPT BUILDER
// =============================================================================

export interface PromptBuilderOptions {
  config: KiraVerticalConfig;
  context: KiraContext;
  framework?: KiraFramework;
  knowledge?: KiraKnowledge;
  existingMemory?: string[];
  philosophyType?: 'default' | 'security' | 'interview' | 'custom';
}

/**
 * Build the complete system prompt for a Kira vertical
 */
export function buildSystemPrompt(options: PromptBuilderOptions): string {
  const { config, context, framework, knowledge, existingMemory, philosophyType } = options;

  // Get the appropriate philosophy
  const philosophy = config.corePhilosophy
    ? mergePhilosophy(config.corePhilosophy, true)
    : getPhilosophy(philosophyType || 'default');

  // Build the system prompt template
  let systemPrompt: string;

  if (typeof config.systemPromptTemplate === 'function') {
    systemPrompt = config.systemPromptTemplate(context);
  } else {
    systemPrompt = config.systemPromptTemplate;
  }

  // Replace template variables
  const firstName = framework?.firstName || context.firstName || context.userName?.split(' ')[0] || 'there';

  systemPrompt = systemPrompt
    .replace(/\{\{philosophy\}\}/g, philosophy)
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{userName\}\}/g, framework?.userName || context.userName || 'User')
    .replace(/\{\{objective\}\}/g, framework?.primaryObjective || '')
    .replace(/\{\{journeyType\}\}/g, framework?.journeyType || context.journeyType || 'custom');

  // Add context section
  const contextSection = buildContextSection(context, framework);
  if (contextSection) {
    systemPrompt += '\n\n' + contextSection;
  }

  // Add knowledge section
  const knowledgeSection = buildKnowledgeSection(knowledge);
  if (knowledgeSection) {
    systemPrompt += '\n' + knowledgeSection;
  }

  // Add memory section
  if (existingMemory && existingMemory.length > 0) {
    systemPrompt += `

## ONGOING MEMORY

${existingMemory.map(m => `- ${m}`).join('\n')}
`;
  }

  // Add tools section
  const toolsSection = buildToolsSection(config);
  if (toolsSection) {
    systemPrompt += '\n' + toolsSection;
  }

  return systemPrompt;
}

/**
 * Build the first message for a conversation
 */
export function buildFirstMessage(options: PromptBuilderOptions): string {
  const { config, context, framework } = options;

  if (typeof config.firstMessageTemplate === 'function') {
    return config.firstMessageTemplate(context);
  }

  // Replace template variables
  const firstName = framework?.firstName || context.firstName || context.userName?.split(' ')[0] || 'there';
  const objective = framework?.primaryObjective || '';

  return config.firstMessageTemplate
    .replace(/\{\{firstName\}\}/g, firstName)
    .replace(/\{\{userName\}\}/g, framework?.userName || context.userName || 'there')
    .replace(/\{\{objective\}\}/g, objective)
    .replace(/\{\{journeyType\}\}/g, framework?.journeyType || context.journeyType || 'custom');
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract first name from full name
 */
export function extractFirstName(fullName: string): string {
  return fullName.split(' ')[0];
}

/**
 * Generate a unique agent name for ElevenLabs
 */
export function generateAgentName(
  verticalId: string,
  firstName: string,
  objective: string,
  uniqueId: string
): string {
  const cleanFirstName = firstName.replace(/[^a-zA-Z]/g, '');
  const shortId = uniqueId.slice(0, 6);

  // Extract a short topic from the objective
  const topicWords = objective
    .replace(/[^a-zA-Z\s]/g, '')
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  return `${verticalId}_${cleanFirstName}_${topicWords || 'Session'}_${shortId}`;
}