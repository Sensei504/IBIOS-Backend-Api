import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError } from './errors.js';
export interface PublicUser{id:string;username:string;email:string;full_name:string;role:'student'|'faculty'|'staff'|'admin'|'super_admin';is_active:boolean;created_at:string;}
export type AuthRequest=FastifyRequest;
declare module 'fastify'{interface FastifyRequest{user:PublicUser|null}}
const signingKey=new TextEncoder().encode(config.secretKey);let dummyPasswordHashPromise:Promise<string>|undefined;const cookiePath=`${config.apiPrefix}/auth`;
export async function hashPassword(password:string):Promise<string>{return argon2.hash(password,{type:argon2.argon2id,memoryCost:65_536,timeCost:3,parallelism:2});}
export function needsPasswordRehash(hash:string):boolean{try{return argon2.needsRehash(hash,{memoryCost:65_536,timeCost:3,parallelism:2});}catch{return false;}}
export async function verifyPassword(password:string,hash:string):Promise<boolean>{try{return await argon2.verify(hash,password);}catch{return false;}}
export async function verifyPasswordOrDummy(password:string,hash?:string|null):Promise<boolean>{if(hash)return verifyPassword(password,hash);dummyPasswordHashPromise??=hashPassword(randomBytes(24).toString('hex'));return verifyPassword(password,await dummyPasswordHashPromise);}
export function newRefreshToken():string{return randomBytes(48).toString('base64url');}export function hashToken(raw:string):string{return createHash('sha256').update(raw).digest('hex');}
export function assertSigningKeyConfigured():void{if(config.isProduction&&!config.secretKeyConfigured)throw new HttpError(503,'Authentication is unavailable until IBIOS_SECRET_KEY is configured with a unique random secret of at least 48 characters.');}
export async function createAccessToken(user:PublicUser):Promise<{access_token:string;expires_in:number}>{assertSigningKeyConfigured();const expiresIn=config.accessTokenMinutes*60;const token=await new SignJWT({role:user.role,typ:'access'}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setSubject(user.id).setIssuer('ibios-mdc').setAudience('ibios-web').setIssuedAt().setJti(randomUUID()).setExpirationTime(`${expiresIn}s`).sign(signingKey);return{access_token:token,expires_in:expiresIn};}
export async function verifyAccessToken(token:string):Promise<{sub:string;role?:string}>{assertSigningKeyConfigured();const {payload}=await jwtVerify(token,signingKey,{algorithms:['HS256'],issuer:'ibios-mdc',audience:'ibios-web'});if(payload.typ!=='access'||typeof payload.sub!=='string')throw new Error('Invalid access token');return{sub:payload.sub,...(typeof payload.role==='string'?{role:payload.role}:{})};}
export function setRefreshCookie(reply:FastifyReply,raw:string):void{reply.setCookie(config.refreshCookieName,raw,{path:cookiePath,maxAge:config.refreshTokenDays*86_400,httpOnly:true,secure:config.cookieSecure,sameSite:config.cookieSameSite});}
export function clearRefreshCookie(reply:FastifyReply):void{reply.clearCookie(config.refreshCookieName,{path:cookiePath,httpOnly:true,secure:config.cookieSecure,sameSite:config.cookieSameSite});}
export async function loadPublicUser(id:string):Promise<PublicUser|null>{const result=await pool.query<PublicUser>('SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = $1',[id]);return result.rows[0]??null;}
async function authenticateRequest(request:FastifyRequest):Promise<PublicUser>{const authRequest=request as AuthRequest;if(authRequest.user)return authRequest.user;const header=request.headers.authorization;if(!header?.startsWith('Bearer '))throw new HttpError(401,'Authentication required');try{const claim=await verifyAccessToken(header.slice(7));const user=await loadPublicUser(claim.sub);if(!user||!user.is_active)throw new Error('User no longer active');authRequest.user=user;return user;}catch(error){if(error instanceof HttpError&&error.statusCode===503)throw error;throw new HttpError(401,'Invalid or expired session',{'WWW-Authenticate':'Bearer'});}}
export const requireAuth:preHandlerHookHandler=async(request)=>{await authenticateRequest(request);};
export function requireRoles(...roles:PublicUser['role'][]):preHandlerHookHandler{return async(request)=>{const user=await authenticateRequest(request);if(!roles.includes(user.role)&&!(user.role==='super_admin'&&roles.includes('admin')))throw new HttpError(403,'You do not have permission to do that');};}
export function userFrom(request:FastifyRequest):PublicUser{const user=(request as AuthRequest).user;if(!user)throw new HttpError(401,'Authentication required');return user;}
