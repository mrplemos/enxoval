import { validateData } from './domain.js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';
/** Storage contract used by the UI: load(), saveItem(item), deleteItem(id),
 * saveBenchmark(benchmark), deleteBenchmark(id), replaceAll(data).
 * All return promises. Mutations resolve only after durable commit.
 * Implement the same contract in a remote adapter to change the backend.
 */
export class IndexedDBRepository {
  constructor(name='enxoval-v3') { this.name=name; }
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve,reject)=>{
      const request=indexedDB.open(this.name,1);
      request.onupgradeneeded=()=>request.result.createObjectStore('state');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Feche as outras abas do Enxoval e tente novamente.'));
    });
    this.db.onversionchange=()=>{this.db.close();this.db=null;};
    return this.db;
  }
  async transaction(mode, update) {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('state',mode), store=tx.objectStore('state');
      let result, failure;
      const req=store.get('current');
      req.onsuccess=()=>{
        try {result=update(req.result); if(mode==='readwrite') store.put(result,'current');}
        catch(e) {failure=e;tx.abort();}
      };
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(failure || tx.error);
      tx.onabort=()=>reject(failure || tx.error || new Error('Não foi possível salvar.'));
    });
  }
  async initialize(seed) { return this.transaction('readwrite',state=>validateData(state ?? seed)); }
  async load() { return this.transaction('readonly',state=>validateData(state)); }
  async mutate(fn) { return this.transaction('readwrite',state=>{const data=validateData(state);fn(data);return validateData(data);}); }
  async saveItem(item) { return this.mutate(d=>{const n=d.items.findIndex(i=>i.id===item.id);if(n<0)d.items.push(item);else d.items[n]=item;}); }
  async deleteItem(id) { return this.mutate(d=>{d.items=d.items.filter(i=>i.id!==id);}); }
  async saveBenchmark(item) { return this.mutate(d=>{const n=d.benchmarks.findIndex(i=>i.id===item.id);if(n<0)d.benchmarks.push(item);else d.benchmarks[n]=item;}); }
  async deleteBenchmark(id) { return this.mutate(d=>{d.benchmarks=d.benchmarks.filter(i=>i.id!==id);}); }
  async replaceAll(data) { const valid=validateData(data);return this.transaction('readwrite',()=>valid); }
}

/** Storage for a self-contained HTML file opened directly from Downloads.
 * Browsers may deny IndexedDB to file:// pages, while localStorage is usually
 * available. If localStorage is also denied, the in-memory copy still lets the
 * dashboard open and the user can export a backup before closing the page.
 */
export class LocalStorageRepository {
  constructor(name='enxoval-v3-file',storage=globalThis.localStorage) {this.name=name;this.storage=storage;this.memory=null;}
  read() {
    try {const value=this.storage?.getItem(this.name);return value?JSON.parse(value):this.memory;}
    catch {return this.memory;}
  }
  write(data) {
    const copy=structuredClone(data);this.memory=copy;
    try {this.storage?.setItem(this.name,JSON.stringify(copy));} catch {}
    return structuredClone(copy);
  }
  async initialize(seed) {return this.write(validateData(this.read()??seed));}
  async load() {return structuredClone(validateData(this.read()));}
  async mutate(fn) {const data=structuredClone(validateData(this.read()));fn(data);return this.write(validateData(data));}
  async saveItem(item) {return this.mutate(d=>{const n=d.items.findIndex(i=>i.id===item.id);if(n<0)d.items.push(item);else d.items[n]=item;});}
  async deleteItem(id) {return this.mutate(d=>{d.items=d.items.filter(i=>i.id!==id);});}
  async saveBenchmark(item) {return this.mutate(d=>{const n=d.benchmarks.findIndex(i=>i.id===item.id);if(n<0)d.benchmarks.push(item);else d.benchmarks[n]=item;});}
  async deleteBenchmark(id) {return this.mutate(d=>{d.benchmarks=d.benchmarks.filter(i=>i.id!==id);});}
  async replaceAll(data) {return this.write(validateData(data));}
}

export class SupabaseRepository {
  constructor(url,key,storage=globalThis.sessionStorage) {
    this.url=url;this.key=key;this.storage=storage;this.storageKey='enxoval-supabase-session-v1';
    // v0.4 stored the refresh token in localStorage. Remove that legacy copy so
    // upgrading signs the editor out and future sessions end with the browser tab.
    try {globalThis.localStorage?.removeItem(this.storageKey);} catch {}
  }
  readSession() {try{return JSON.parse(this.storage?.getItem(this.storageKey)||'null');}catch{return null;}}
  saveSession(session) {try{this.storage?.setItem(this.storageKey,JSON.stringify(session));}catch{}return session;}
  clearSession() {try{this.storage?.removeItem(this.storageKey);}catch{}}
  getSignedInUser() {return this.readSession()?.user||null;}
  async auth(path,body,token='') {
    const response=await fetch(`${this.url}/auth/v1/${path}`,{method:'POST',headers:{apikey:this.key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(result.msg||result.message||result.error_description||'Não foi possível entrar. Confira o e-mail e a senha.');
    return result;
  }
  async signIn(email,password) {const session=await this.auth('token?grant_type=password',{email,password});session.expires_at=Math.floor(Date.now()/1000)+session.expires_in;return this.saveSession(session);}
  async signOut() {const session=this.readSession();this.clearSession();if(session?.access_token)await this.auth('logout',{},session.access_token).catch(()=>{});}
  async session() {
    let session=this.readSession();if(!session)return null;
    if((session.expires_at||0)>Math.floor(Date.now()/1000)+60)return session;
    try {const refreshed=await this.auth('token?grant_type=refresh_token',{refresh_token:session.refresh_token});refreshed.expires_at=Math.floor(Date.now()/1000)+refreshed.expires_in;return this.saveSession(refreshed);}
    catch {this.clearSession();return null;}
  }
  async request(path,{method='GET',body,prefer,authRequired=false}={}) {
    const session=await this.session();if(authRequired&&!session)throw new Error('Entre para editar a base.');
    const response=await fetch(`${this.url}/rest/v1/${path}`,{method,headers:{apikey:this.key,...(session?{Authorization:`Bearer ${session.access_token}`}:{ }),'Content-Type':'application/json',...(prefer?{Prefer:prefer}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    if(!response.ok){const result=await response.json().catch(()=>({}));throw new Error(result.message||'Não foi possível acessar a base compartilhada.');}
    if(response.status===204)return null;return response.json().catch(()=>null);
  }
  async initialize() {return this.load();}
  async load() {const [items,benchmarks]=await Promise.all([this.request('inventory?select=data&order=id.asc'),this.request('benchmarks?select=data&order=id.asc')]);return validateData({schemaVersion:3,items:items.map(row=>row.data),benchmarks:benchmarks.map(row=>row.data)});}
  async saveItem(item) {await this.request('inventory?on_conflict=id',{method:'POST',body:{id:item.id,data:item},prefer:'resolution=merge-duplicates',authRequired:true});return this.load();}
  async deleteItem(id) {await this.request(`inventory?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',authRequired:true});return this.load();}
  async saveBenchmark(item) {await this.request('benchmarks?on_conflict=id',{method:'POST',body:{id:item.id,data:item},prefer:'resolution=merge-duplicates',authRequired:true});return this.load();}
  async deleteBenchmark(id) {await this.request(`benchmarks?id=eq.${encodeURIComponent(id)}`,{method:'DELETE',authRequired:true});return this.load();}
  async replaceAll(data) {const valid=validateData(data);await this.request('rpc/replace_enxoval',{method:'POST',body:{p_items:valid.items,p_benchmarks:valid.benchmarks},authRequired:true});return this.load();}
}

export const repository=new SupabaseRepository(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
