import { validateData } from './domain.js';
/** Storage contract used by the UI: load(), saveItem(item), deleteItem(id),
 * saveBenchmark(benchmark), deleteBenchmark(id), replaceAll(data).
 * All return promises. Mutations resolve only after durable commit.
 * Implement the same contract in a remote adapter to change the backend.
 */
export class IndexedDBRepository {
  constructor(name='enxoval-v1') { this.name=name; }
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
  async replaceAllWithRollback(data) {
    const valid=validateData(data),db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');
      let result,failure;
      const req=store.get('current');
      req.onsuccess=()=>{try{const current=validateData(req.result);store.put(current,'restore-point');store.put(valid,'current');result=valid;}catch(e){failure=e;tx.abort();}};
      tx.oncomplete=()=>resolve(structuredClone(result));
      tx.onerror=()=>reject(failure||tx.error);
      tx.onabort=()=>reject(failure||tx.error||new Error('Não foi possível restaurar o backup.'));
    });
  }
  async hasRestorePoint() {
    const db=await this.open();
    return new Promise((resolve,reject)=>{const req=db.transaction('state','readonly').objectStore('state').get('restore-point');req.onsuccess=()=>resolve(Boolean(req.result));req.onerror=()=>reject(req.error);});
  }
  async restorePrevious() {
    const db=await this.open();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');
      let result,failure,current,previous;
      const currentReq=store.get('current'),previousReq=store.get('restore-point');
      const swap=()=>{if(currentReq.readyState!=='done'||previousReq.readyState!=='done')return;try{if(!previous)throw new Error('Não há uma restauração anterior para desfazer.');const validPrevious=validateData(previous),validCurrent=validateData(current);store.put(validPrevious,'current');store.put(validCurrent,'restore-point');result=validPrevious;}catch(e){failure=e;tx.abort();}};
      currentReq.onsuccess=()=>{current=currentReq.result;swap();};
      previousReq.onsuccess=()=>{previous=previousReq.result;swap();};
      tx.oncomplete=()=>resolve(structuredClone(result));
      tx.onerror=()=>reject(failure||tx.error);
      tx.onabort=()=>reject(failure||tx.error||new Error('Não foi possível desfazer a restauração.'));
    });
  }
}
export const repository=new IndexedDBRepository();
