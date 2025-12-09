const { typeDefs, resolvers } = require('./graphql');
const { PORT, CORS_ORIGIN, GRAPHQL_PATH } = require('./config');
const { ApolloServer } = require('apollo-server-express');
const express = require('express');
const { setupDownloadRoutes } = require('./controllers/downloadController');
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = require('./config');
const fs = require('fs');
const path = require('path');

// Crear cliente de Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Crear directorios para reportes si no existen
const { REPORTS_OUTPUT_DIR, REPORTS_TEMP_DIR } = require('./config');
[REPORTS_OUTPUT_DIR, REPORTS_TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

async function startServer() {
  const app = express();

  // Middleware para parsear JSON
  app.use(express.json());

  // CORS
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
      const token = req.headers['authorization']?.replace('Bearer ', '') || 
                    req.headers['x-token'] || '';
      
      // Pasar cliente de Supabase al contexto
      return { 
        token,
        supabase 
      };
    },
  });

  // Iniciar servidor de GraphQL
  await server.start();

  // Aplicar middleware de Apollo a Express
  server.applyMiddleware({ 
    app,
    path: GRAPHQL_PATH 
  });

  // Configurar rutas de descarga
  setupDownloadRoutes(app);

  // Servir archivos estáticos (reportes generados)
  app.use('/reportes', express.static(REPORTS_OUTPUT_DIR));

  // Ruta de health check
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      service: 'Microservicio de Reportes Médicos',
      timestamp: new Date().toISOString() 
    });
  });

  app.listen(PORT, () => {
    console.log(`Servidor GraphQL ejecutándose en http://localhost:${PORT}${server.graphqlPath}`);
    console.log(`Descargas disponibles en http://localhost:${PORT}/download/`);
    console.log(`Reportes estáticos en http://localhost:${PORT}/reportes/`);
    console.log(`Health check en http://localhost:${PORT}/health`);
  });
}

startServer().catch(error => {
  console.error('Error al iniciar el servidor:', error);
  process.exit(1);
});