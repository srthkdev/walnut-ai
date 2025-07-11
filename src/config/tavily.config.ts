import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { groq } from '@ai-sdk/groq'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// AI provider configuration with updated priority
const AI_PROVIDERS = {
  openai: {
    model: openai('gpt-4o-mini'),
    enabled: !!process.env.OPENAI_API_KEY,
    name: 'OpenAI GPT-4o Mini',
    priority: 1
  },
  gemini: {
    model: google('gemini-2.0-flash-exp'),
    enabled: !!process.env.GOOGLE_API_KEY,
    name: 'Google Gemini 2.0 Flash',
    priority: 2
  },
  groq: {
    model: groq('llama-3.3-70b-versatile'),
    enabled: !!process.env.GROQ_API_KEY,
    name: 'Groq Llama 3.3 70B',
    priority: 3
  },
  anthropic: {
    model: anthropic('claude-3-5-sonnet-20241022'),
    enabled: !!process.env.ANTHROPIC_API_KEY,
    name: 'Anthropic Claude 3.5 Sonnet',
    priority: 4
  },
}

// Get the active AI provider with updated priority: OpenAI > Gemini > Groq > Anthropic
function getAIModel() {
  // Only check on server side
  if (typeof window !== 'undefined') {
    return null
  }
  
  // Priority: OpenAI > Gemini > Groq > Anthropic
  if (AI_PROVIDERS.openai.enabled) return AI_PROVIDERS.openai.model
  if (AI_PROVIDERS.gemini.enabled) return AI_PROVIDERS.gemini.model
  if (AI_PROVIDERS.groq.enabled) return AI_PROVIDERS.groq.model
  if (AI_PROVIDERS.anthropic.enabled) return AI_PROVIDERS.anthropic.model
  
  throw new Error('No AI provider configured. Please set at least one API key: OPENAI_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY, or ANTHROPIC_API_KEY')
}

// Rate limiter factory
function createRateLimiter(identifier: string, requests = 50, window = '1 d') {
  if (typeof window !== 'undefined') {
    return null
  }
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  
  try {
    // Validate Redis URL format
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL
    if (!redisUrl.startsWith('https://')) {
      console.warn(`⚠️ Invalid Redis URL format for rate limiter '${identifier}'. Expected HTTPS URL, got:`, redisUrl)
      return null
    }
    
    const redis = new Redis({
      url: redisUrl,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    
    return new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(requests, window),
      analytics: true,
      prefix: `tavily-chatbot:ratelimit:${identifier}`,
    })
  } catch (error) {
    console.error(`❌ Failed to create rate limiter '${identifier}':`, error)
    return null
  }
}

const config = {
  app: {
    name: 'Walnut AI',
    description: 'Business Intelligence Platform for Sales & Strategy Teams',
    url: process.env.NEXT_PUBLIC_URL || 'http://localhost:3000',
    logoPath: '/logo.svg',
  },

  ai: {
    model: getAIModel(),
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: `You are Walnut AI, a specialized business intelligence assistant designed for sales teams, corporate strategists, and entrepreneurs. You excel at company research, competitive analysis, and market intelligence.

## Your Expertise Areas:

### 1. Company Representation Mode
When acting as a company representative, you should:
- Use "we", "our", and "us" when referring to the company
- Provide authoritative information about products, services, and company operations
- Maintain the company's professional tone and brand voice
- Offer specific contact information and resources when appropriate
- Handle customer inquiries with expertise and care

### 2. M&A and Investment Analysis
- Due diligence research and risk assessment
- Financial health and performance metrics
- Market valuation and comparables analysis
- Strategic fit and synergy identification
- Investment thesis development

### 3. Market Research & Strategy
- Competitive landscape mapping
- Industry analysis and trends
- Market sizing and opportunity assessment
- Strategic positioning recommendations
- Partnership and collaboration opportunities

### 4. Executive Briefings
- C-suite ready summaries and reports
- Key metrics and performance indicators
- Strategic recommendations and insights
- Risk factors and mitigation strategies
- Market opportunity identification

## Response Guidelines:

### Professional Communication
- Use executive-level language appropriate for business contexts
- Provide actionable insights that drive business decisions
- Structure responses for quick scanning and decision-making
- Include relevant metrics, data points, and financial information
- Maintain objectivity while highlighting key strategic implications

### Source Attribution
- Always cite sources using [1], [2], etc. format
- Distinguish between verified facts and analytical insights
- Provide confidence levels for key assessments
- Include relevant URLs and reference materials
- Acknowledge data limitations and suggest additional research when needed

### Business Focus
- Prioritize information relevant to business decision-making
- Highlight competitive advantages and market positioning
- Identify risks, opportunities, and strategic implications
- Provide context for financial metrics and market performance
- Suggest follow-up questions for deeper analysis

Remember: Your goal is to accelerate business intelligence workflows, helping professionals make faster, better-informed decisions about companies, markets, and strategic opportunities.`,
    providers: AI_PROVIDERS,
  },

  tavily: {
    maxResults: 10,
    searchDepth: 'basic' as const,
    includeImages: false,
    includeRawContent: true,
    includeAnswer: true,
    defaultLimit: 10,
    maxLimit: 50,
    minLimit: 5,
    limitOptions: [5, 10, 20, 50],
    searchTimeout: 10000,
    cacheMaxAge: 604800, // 7 days
  },

  search: {
    maxResults: 100,
    maxContextDocs: 10,
    maxContextLength: 1500,
    maxSourcesDisplay: 20,
    snippetLength: 200,
  },

  storage: {
    maxIndexes: 50,
    localStorageKey: 'tavily_chatbot_indexes',
    redisPrefix: {
      indexes: 'tavily-chatbot:indexes',
      index: 'tavily-chatbot:index:',
    },
  },

  mem0: {
    enableUserMemory: true,
    memoryRetentionDays: 30,
    maxMemoriesPerUser: 100,
  },

  appwrite: {
    endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '',
    projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '',
    databaseId: process.env.APPWRITE_DATABASE_ID || 'tavily-chatbot',
    collections: {
      users: 'users',
      chatbots: 'chatbots', 
      conversations: 'conversations',
      messages: 'messages',
      sessions: 'sessions',
    },
  },

  rateLimits: {
    create: createRateLimiter('create', 20, '1 d'),
    query: createRateLimiter('query', 100, '1 h'),
    search: createRateLimiter('search', 50, '1 h'),
  },

  features: {
    enableCreation: process.env.DISABLE_CHATBOT_CREATION !== 'true',
    enableAppwrite: !!(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT && process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID),
    enableMem0: !!process.env.MEM0_API_KEY, // Now using official mem0ai library
    enableRedis: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    enableSearch: !!(process.env.UPSTASH_SEARCH_REST_URL && process.env.UPSTASH_SEARCH_REST_TOKEN),
  },
}

export type Config = typeof config

// Client-safe config (no AI model initialization)
export const clientConfig = {
  app: config.app,
  tavily: config.tavily,
  search: config.search,
  storage: config.storage,
  mem0: config.mem0,
  appwrite: config.appwrite,
  features: config.features,
}

// Server-only config (includes AI model)
export const serverConfig = config

// Default export for backward compatibility
export { clientConfig as config }
export default config 