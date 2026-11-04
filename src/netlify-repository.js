import {validateData} from './domain.js';

// Client adapter for Netlify Functions + Blobs. This module does not contain
// credentials or access the Blob store directly: the server checks permissions.
export class NetlifyRepository {
  constructor({fetchImpl}={}) {
    // Browser Window.fetch requires the Window as its receiver (Safari in particular).
    // Bind the native method before storing it on this repository instance.
    this.fetchImpl=fetchImpl??globalThis.fetch.bind(globalThis);
    this.version=null;
    this.user=null;
    this.initialized=false;
  }

  getSignedInUser() { return this.user; }

  async request(path,options={}) {
    const response=await this.fetchImpl(path,{
      credentials:'same-origin',
      cache:'no-store',
      ...options
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok) {
      const error=new Error(result.error||'Não foi possível acessar os dados do enxoval.');
      error.status=response.status;
      throw error;
    }
    return result;
  }

  identity() {
    const client=globalThis.__enxovalIdentity;
    if(!client)throw new Error('O módulo de login ainda não foi carregado. Atualize a página e tente novamente.');
    return client;
  }

  async signIn(email,password) {
    // Auth mutations run in the browser, matching invitation and recovery flows.
    // The Identity library owns session cookies and token refresh state.
    await this.identity().login(email,password);
    let status;
    try {
      status=await this.request('/api/enxoval-auth');
      if(!status.editor)throw new Error('Esta conta não tem permissão para editar o enxoval.');
    } catch(error) {
      await this.identity().logout().catch(()=>{});
      throw error;
    }
    this.user=status.user;
    return status;
  }

  async signOut() {
    try {
      await this.identity().logout();
    } finally {
      this.user=null;
      this.version=null;
    }
  }

  async initialize() {return this.load();}

  async load() {
    const response=await this.request('/api/enxoval-data');
    this.version=response.version??null;
    this.user=response.editor?(response.user||{email:'Administrador'}):null;
    this.initialized=!!response.initialized;
    return validateData(response.data);
  }

  async mutate(action,payload) {
    const response=await this.request('/api/enxoval-data',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action,payload,expectedVersion:this.version})
    });
    this.version=response.version??null;
    this.initialized=true;
    return validateData(response.data);
  }

  async saveItem(item) {return this.mutate('saveItem',{item});}
  async deleteItem(id) {return this.mutate('deleteItem',{id});}
  async saveBenchmark(benchmark) {return this.mutate('saveBenchmark',{benchmark});}
  async deleteBenchmark(id) {return this.mutate('deleteBenchmark',{id});}
  async replaceAll(data) {return this.mutate('replaceAll',{data:validateData(data)});}
}
