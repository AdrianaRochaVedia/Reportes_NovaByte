const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_KEY) {
  console.error('Faltan las credenciales de Supabase');
  console.error('SUPABASE_URL:', config.SUPABASE_URL ? 'Configurada' : 'Falta');
  console.error('SUPABASE_SERVICE_KEY:', config.SUPABASE_SERVICE_KEY ? 'Configurada' : 'Falta');
  throw new Error('Faltan las credenciales de Supabase en las variables de entorno');
}

const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false
    }
  }
);

console.log('Cliente de Supabase inicializado');

module.exports = supabase;