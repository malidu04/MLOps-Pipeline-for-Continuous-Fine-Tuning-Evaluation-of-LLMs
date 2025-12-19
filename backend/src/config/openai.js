export default {
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
  basePath: process.env.OPENAI_BASE_PATH || 'https://api.openai.com/v1',
  defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4',
  fineTuneModel: process.env.OPENAI_FINE_TUNE_MODEL || 'gpt-3.5-turbo',
  timeout: parseInt(process.env.OPENAI_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || '3'),
};