require('dotenv').config(); 

const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const { typeDefs, resolvers } = require('./graphql');
const { setupDownloadRoutes } = require('./controllers/downloadController');
const { 
  PORT, 
  CORS_ORIGIN, 
  GRAPHQL_PATH,
  SUPABASE_URL, 
  SUPABASE_SERVICE_KEY,
  REPORTS_OUTPUT_DIR, 
  REPORTS_TEMP_DIR 
} = require('./config');


console.log('PORT:', PORT);
console.log('SUPABASE_URL:', SUPABASE_URL ? 'Configurada' : 'FALTA');
console.log('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? 'Configurada' : 'FALTA');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('\nERROR CRÍTICO: Faltan credenciales de Supabase');
  console.error('Por favor verifica tu archivo .env');
  console.error('Debe contener:');
  console.error('  SUPABASE_URL=tu_url_de_supabase');
  console.error('  SUPABASE_SERVICE_KEY=tu_service_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  }
});

console.log('Cliente de Supabase creado');

async function verificarConexionSupabase() {
  try {
    console.log('🔌 Probando conexión con Supabase...');
    
    const { data, error } = await supabase
      .from('perfil')
      .select('count')
      .limit(1);

    if (error) {
      console.error('Error al conectar con Supabase:', error.message);
      console.error('Detalles del error:', error);
      return false;
    }

    console.log('Conexión exitosa con Supabase');
    return true;
  } catch (err) {
    console.error('Error al verificar conexión:', err.message);
    return false;
  }
}

[REPORTS_OUTPUT_DIR, REPORTS_TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(` Creado: ${dir}`);
  } else {
    console.log(` Ya existe: ${dir}`);
  }
});

async function startServer() {
  try {
    const conexionOk = await verificarConexionSupabase();
    if (!conexionOk) {
      console.error('No se pudo verificar la conexión con Supabase');
      console.error('El servidor iniciará pero las consultas pueden fallar');
    }

    const app = express();

    app.use(express.json());
    app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', CORS_ORIGIN);
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-token');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });

    const server = new ApolloServer({ 
      typeDefs, 
      resolvers,
      context: ({ req }) => {
        // Extraer token del header
        const token = req.headers['authorization']?.replace('Bearer ', '') || 
                      req.headers['x-token'] || '';

        return { 
          token,
          supabase
        };
      },
      formatError: (err) => {
        console.error('GraphQL Error:', err.message);
        console.error('Stack:', err.extensions?.exception?.stacktrace);
        return err;
      },
    });

    // Iniciar servidor de GraphQL
    await server.start();
    console.log('Apollo Server iniciado');

    server.applyMiddleware({ 
      app,
      path: GRAPHQL_PATH,
      cors: false 
    });

    setupDownloadRoutes(app);

    app.use('/reportes', express.static(REPORTS_OUTPUT_DIR));

    app.get('/health', async (req, res) => {
      const supabaseStatus = await verificarConexionSupabase();
      
      res.json({ 
        status: supabaseStatus ? 'ok' : 'warning',
        service: 'Microservicio de Reportes Médicos',
        timestamp: new Date().toISOString(),
        supabase: supabaseStatus ? 'connected' : 'disconnected',
        environment: process.env.NODE_ENV || 'development'
      });
    });

    app.get('/', (req, res) => {
      res.json({
        message: 'Microservicio de Reportes Médicos',
        graphql: `http://localhost:${PORT}${GRAPHQL_PATH}`,
        health: `http://localhost:${PORT}/health`,
        downloads: `http://localhost:${PORT}/download/`
      });
    });

    app.listen(PORT, () => {
      console.log(`GraphQL:     http://localhost:${PORT}${server.graphqlPath}`);
      console.log(`Descargas:   http://localhost:${PORT}/download/`);
      console.log(`Reportes:    http://localhost:${PORT}/reportes/`);
    });

  } catch (error) {
    console.error('\nERROR AL INICIAR EL SERVIDOR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Iniciar el servidor
startServer();