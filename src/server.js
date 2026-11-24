require('dotenv').config(); 

const { ApolloServer, AuthenticationError } = require('apollo-server-express');
const { autenticarAdmin, firmarUrl, verificarFirma, registrar } = require('./security/auth');
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
    console.log('Probando conexión con Supabase...');
    
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

    // Cada operacion exige sesion de administrador, queda en la bitacora y devuelve enlaces de descarga firmados.
    const resolversSeguros = (Array.isArray(resolvers) ? resolvers : [resolvers]).map((r) => {
      const salida = { ...r };
      for (const tipo of ['Query', 'Mutation']) {
        if (!r[tipo]) continue;
        salida[tipo] = {};
        for (const [nombre, fn] of Object.entries(r[tipo])) {
          salida[tipo][nombre] = async (parent, args, ctx, info) => {
            if (!ctx.user) throw new AuthenticationError('No autorizado');
            const res = await fn(parent, args, ctx, info);
            const filtro = (args && args.filtro) || args || {};
            const cuenta = Object.entries(filtro).find(([k, v]) => /paciente/i.test(k) && typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v));
            await registrar({
              actor_id: ctx.user.id, actor_rol: ctx.user.rol, cuenta_id: cuenta ? cuenta[1] : null,
              accion: tipo === 'Mutation' ? 'exportacion' : 'consulta', objeto: `reporte:${nombre}`,
              ip: ctx.req && ctx.req.ip, user_agent: ctx.req && ctx.req.headers['user-agent'],
            });
            if (res && res.downloadUrl) res.downloadUrl = firmarUrl(res.downloadUrl, ctx.user.id);
            return res;
          };
        }
      }
      return salida;
    });

    const server = new ApolloServer({ 
      typeDefs, 
      resolvers: resolversSeguros,
      context: async ({ req }) => {
        let user;
        try {
          user = await autenticarAdmin(req);
        } catch (e) {
          throw new AuthenticationError('No autorizado');
        }
        return { user, supabase, req };
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

    // Descargas: enlace firmado y vigente, o sesion de administrador. Listar, borrar y estadisticas: solo administrador.
    app.use('/download', async (req, res, next) => {
      const esArchivo = req.method === 'GET' && /^\/[^/]+$/.test(req.path);
      if (esArchivo) {
        const { e, u, t } = req.query;
        if (verificarFirma(decodeURIComponent(req.path.slice(1)), e, u, t)) {
          registrar({ actor_id: u, actor_rol: 'medicoAdmin', accion: 'descarga', objeto: 'reporte_archivo', ip: req.ip, user_agent: req.headers['user-agent'] });
          return next();
        }
      }
      try {
        req.usuario = await autenticarAdmin(req);
        next();
      } catch (err) {
        res.status(401).json({ error: 'No autorizado' });
      }
    });

    setupDownloadRoutes(app);

    // (Se elimino la carpeta publica /reportes: los archivos solo salen por /download con enlace firmado.)

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