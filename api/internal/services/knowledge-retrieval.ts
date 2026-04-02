// Knowledge Retrieval Service
// Retrieves relevant gold responses and snippets from Neon database

import { neon } from '@neondatabase/serverless';
import type { CanonicalCategory } from '../types';

const sql = neon(process.env.DATABASE_URL!);

// Database types
interface GoldResponseDB {
  id: string;
  title: string;
  category: CanonicalCategory;
  body_template: string;
  tone_notes: string;
  is_active: boolean;
  use_count: number;
  avg_word_count: number;
  avg_paragraph_count: number;
  sample_count: number;
  created_at: Date;
  updated_at: Date;
}

interface KnowledgeSnippetDB {
  id: string;
  title: string;
  type: 'policy' | 'fact' | 'guidance';
  category: CanonicalCategory;
  content: string;
  tags: string[];
  source: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RetrievalResult {
  gold_responses: GoldResponseDB[];
  knowledge_snippets: KnowledgeSnippetDB[];
}

/**
 * Retrieve gold responses by category
 */
export async function getGoldResponsesByCategory(category: CanonicalCategory): Promise<GoldResponseDB[]> {
  const results = await sql`
    SELECT
      id,
      title,
      category,
      body_template,
      tone_notes,
      is_active,
      use_count,
      avg_word_count,
      avg_paragraph_count,
      sample_count,
      created_at,
      updated_at
    FROM gold_responses
    WHERE category = ${category}
      AND is_active = true
    ORDER BY use_count DESC
    LIMIT 3
  `;

  // Transform snake_case DB columns to camelCase properties
  return results.map((row: any) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    body_template: row.body_template,
    tone_notes: row.tone_notes,
    is_active: row.is_active,
    use_count: row.use_count,
    avg_word_count: row.avg_word_count,
    avg_paragraph_count: row.avg_paragraph_count,
    sample_count: row.sample_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Retrieve knowledge snippets by category
 */
export async function getKnowledgeSnippetsByCategory(category: CanonicalCategory): Promise<KnowledgeSnippetDB[]> {
  const results = await sql`
    SELECT
      id,
      title,
      type,
      category,
      content,
      tags,
      source,
      is_active,
      created_at,
      updated_at
    FROM knowledge_snippets
    WHERE category = ${category}
      AND is_active = true
    ORDER BY created_at ASC
  `;

  // Transform snake_case DB columns to camelCase properties
  return results.map((row: any) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    category: row.category,
    content: row.content,
    tags: row.tags || [],
    source: row.source,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

/**
 * Retrieve all knowledge for a category (both responses and snippets)
 */
export async function getKnowledgeByCategory(category: CanonicalCategory): Promise<RetrievalResult> {
  const [responses, snippets] = await Promise.all([
    getGoldResponsesByCategory(category),
    getKnowledgeSnippetsByCategory(category),
  ]);

  return {
    gold_responses: responses,
    knowledge_snippets: snippets,
  };
}

/**
 * Search across all categories using keyword matching
 * For cases where primary classification is uncertain
 */
export async function searchKnowledge(query: string, limit: number = 5): Promise<RetrievalResult> {
  const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  // Get all active responses
  const allResponses = await sql`
    SELECT
      id,
      title,
      category,
      body_template,
      tone_notes,
      is_active,
      use_count,
      avg_word_count,
      avg_paragraph_count,
      sample_count,
      created_at,
      updated_at
    FROM gold_responses
    WHERE is_active = true
    LIMIT 50
  `;

  // Get all active snippets
  const allSnippets = await sql`
    SELECT
      id,
      title,
      type,
      category,
      content,
      tags,
      source,
      is_active,
      created_at,
      updated_at
    FROM knowledge_snippets
    WHERE is_active = true
    LIMIT 50
  `;

  // Transform to camelCase and score responses
  const transformedResponses = allResponses.map((row: any) => ({
    id: row.id,
    title: row.title,
    category: row.category,
    body_template: row.body_template,
    tone_notes: row.tone_notes,
    is_active: row.is_active,
    use_count: row.use_count,
    avg_word_count: row.avg_word_count,
    avg_paragraph_count: row.avg_paragraph_count,
    sample_count: row.sample_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  const transformedSnippets = allSnippets.map((row: any) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    category: row.category,
    content: row.content,
    tags: row.tags || [],
    source: row.source,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  // Score responses by keyword matches
  const scoredResponses = transformedResponses
    .map((response) => ({
      response,
      score: keywords.reduce((acc, keyword) => {
        const titleMatch = response.title.toLowerCase().includes(keyword) ? 2 : 0;
        const bodyMatch = response.body_template.toLowerCase().includes(keyword) ? 1 : 0;
        return acc + titleMatch + bodyMatch;
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ response }) => response);

  // Score snippets by keyword matches
  const scoredSnippets = transformedSnippets
    .map((snippet) => ({
      snippet,
      score: keywords.reduce((acc, keyword) => {
        const titleMatch = snippet.title.toLowerCase().includes(keyword) ? 2 : 0;
        const contentMatch = snippet.content.toLowerCase().includes(keyword) ? 1 : 0;
        const tagMatch = snippet.tags?.some((tag: string) => tag.toLowerCase().includes(keyword)) ? 1 : 0;
        return acc + titleMatch + contentMatch + tagMatch;
      }, 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ snippet }) => snippet);

  return {
    gold_responses: scoredResponses,
    knowledge_snippets: scoredSnippets,
  };
}
