import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import { sql } from 'drizzle-orm';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { closeDatabase, db } from './db.js';
import { registerErrorHandler } from './lib/errors.js';
import { closeRateLimit } from './lib/rate-limit.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerIssueRoutes } from './routes/issues.js';
import { registerProfileRoutes } from './routes/profile.js';
import { registerCommunityRoutes } from './routes/community.js';
import { registerConversationRoutes } from './routes/conversations.js';
export async function buildServer() {
 const app = Fastify({ logger:{level:config.logLevel}, trustProxy:config.trustProxy, requestIdHeader:false, genReqId:()=>randomUUID(), bodyLimit:1_048_576, disableRequestLogging:false, ajv:{customOptions:{coerceTypes:false,removeAdditional:false,useDefaults:false}} });
 if (config.startupConfigurationIssues.length) app.log.error({ configuration_issues: config.startupConfigurationIssues }, 'IBIOS startup configuration is incomplete');
 app.decorateRequest('user', null);
 await app.register(cookie);
 await app.register(cors,{credentials:true,methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:['Authorization','Content-Type','X-Request-ID'],exposedHeaders:['X-Request-ID'],origin:(origin,callback)=>{if(!origin||config.corsOrigins.includes(origin))callback(null,true);else callback(null,false);}});
 await app.register(helmet,{contentSecurityPolicy:false,crossOriginEmbedderPolicy:false,referrerPolicy:{policy:'strict-origin-when-cross-origin'}});
 if(!config.isProduction){await app.register(swagger,{openapi:{info:{title:'IBIOS API',version:'2.0.0',description:'Issue reporting, IBIS positions and arguments, votes, administration, and audit history.'},servers:[{url:'/'}],tags:[{name:'Authentication'},{name:'Issues and IBIS Map'},{name:'Campus Pulse'},{name:'Case Chat and Notifications'},{name:'Profile'},{name:'Administration'},{name:'Health'}]}});await app.register(swaggerUi,{routePrefix:'/docs',uiConfig:{docExpansion:'list',deepLinking:false}});}
 app.addHook('onRequest',async(request,reply)=>{
  const hostname=request.hostname.toLowerCase();
  if(config.allowedHosts.length&&!config.allowedHosts.includes(hostname))return reply.code(400).send({detail:'Invalid host header',request_id:request.id});
  if(request.url.startsWith('/api/')&&!config.databaseConfigured&&!request.url.startsWith('/api/v1/health/ready'))return reply.code(503).send({detail:'Database is not configured. Set DATABASE_URL in the production environment.',request_id:request.id});
 });
 app.addHook('onSend',async(request,reply,payload)=>{reply.header('X-Request-ID',request.id);reply.header('X-Content-Type-Options','nosniff');reply.header('X-Frame-Options','DENY');reply.header('Permissions-Policy','camera=(), microphone=(), geolocation=()');reply.header('Cache-Control',request.url.startsWith('/api/')?'no-store':'no-cache');if(config.isProduction)reply.header('Strict-Transport-Security','max-age=31536000; includeSubDomains');return payload;});
 app.get('/',async()=>({service:'IBIOS API',version:'2.0.0',status:config.startupConfigurationIssues.length?'degraded':'ok',docs:config.isProduction?null:'/docs'}));
 app.get('/health/live',{schema:{tags:['Health'],summary:'Process liveness probe'}},async()=>({status:'alive',service:'ibios-api'}));
 app.get('/api/v1/health/ready',{schema:{tags:['Health'],summary:'Database readiness probe'}},async(_request,reply)=>{if(!config.databaseConfigured)return reply.code(503).send({status:'not_ready',database:'not_configured'});try{await db.execute(sql`SELECT 1`);return{status:'ready',database:'connected'};}catch(error){app.log.warn({err:error},'Database readiness check failed');return reply.code(503).send({status:'not_ready',database:'unavailable'});}});
 await registerAuthRoutes(app);await registerIssueRoutes(app);await registerCommunityRoutes(app);await registerConversationRoutes(app);await registerProfileRoutes(app);await registerAdminRoutes(app);registerErrorHandler(app);
 app.addHook('onClose',async()=>{await closeRateLimit();await closeDatabase();});return app;
}
const isMain=process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1];
if(isMain){const app=await buildServer();const shutdown=async(signal:string)=>{app.log.info({signal},'Shutting down');await app.close();process.exit(0);};process.once('SIGINT',()=>{void shutdown('SIGINT');});process.once('SIGTERM',()=>{void shutdown('SIGTERM');});try{await app.listen({host:config.host,port:config.port});app.log.info({port:config.port},'IBIOS TypeScript API started');}catch(error){app.log.error(error);process.exitCode=1;await app.close();}}
