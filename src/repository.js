import { validateData } from './domain.js';
/** Storage contract used by the UI: load(), saveItem(item), deleteItem(id),
 * saveBenchmark(benchmark), deleteBenchmark(id), replaceAll(data).
 * All return promises. Mutations resolve only after durable commit.
 * Implement the same contract in a remote adapter to change the backend.
 */
export class IndexedDBRepository {
  constructor(name='enxoval-v2') { this.name=name; }
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
export const repository=new IndexedDBRepository();
