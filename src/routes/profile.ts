import type { FastifyInstance } from 'fastify';
import { inTransaction } from '../db.js';
import { audit } from '../lib/audit.js';
import { conflict, parseOrThrow } from '../lib/errors.js';
import { profileSchema } from '../lib/schemas.js';
import { requireAuth, userFrom, type PublicUser } from '../lib/security.js';
export async function registerProfileRoutes(app:FastifyInstance):Promise<void>{app.patch('/api/v1/profile',{preHandler:requireAuth},async(request)=>{const user=userFrom(request);const input=parseOrThrow(profileSchema,request.body);return inTransaction(async(client)=>{const duplicate=await client.query('SELECT id FROM users WHERE email=$1 AND id<>$2 LIMIT 1',[input.email,user.id]);if(duplicate.rowCount)conflict('Email is already used by another account');await client.query('UPDATE users SET email=$2,full_name=$3,updated_at=now() WHERE id=$1',[user.id,input.email,input.full_name]);await audit(client,request,user,'profile.updated','user',user.id,{fields:['email','full_name']});const result=await client.query<PublicUser>('SELECT id,username,email,full_name,role,is_active,created_at FROM users WHERE id=$1',[user.id]);return result.rows[0];});});}
