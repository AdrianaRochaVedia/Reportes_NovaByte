require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 4001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,
  
  REPORTS_OUTPUT_DIR: process.env.REPORTS_OUTPUT_DIR || './reports',
  REPORTS_TEMP_DIR: process.env.REPORTS_TEMP_DIR || './temp',
  SUPPORTED_FORMATS: ['pdf', 'xlsx', 'csv'],
  
  GRAPHQL_PATH: process.env.GRAPHQL_PATH || '/graphql',
  ENABLE_PLAYGROUND: process.env.NODE_ENV !== 'production',
  
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
};