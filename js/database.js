const DB_NAME="MobileRD_Master_DB";
const DB_VERSION=3;
const FILE_STORE="files";
const LEGACY_FILE_STORE="heavy_files";
const LOG_STORE="audit";

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      const tx=e.target.transaction;
      if(!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
      if(!db.objectStoreNames.contains(LOG_STORE)) db.createObjectStore(LOG_STORE,{keyPath:"id",autoIncrement:true});

      // Older portal builds stored binaries in `heavy_files`. Migrate them
      // into the current `files` store so an existing laptop does not lose
      // access to previously uploaded engineering documents.
      if(db.objectStoreNames.contains(LEGACY_FILE_STORE)) {
        const oldStore=tx.objectStore(LEGACY_FILE_STORE);
        const newStore=tx.objectStore(FILE_STORE);
        oldStore.openCursor().onsuccess=event=>{
          const cursor=event.target.result;
          if(!cursor)return;
          if(cursor.value?.blob)newStore.put(cursor.value,cursor.primaryKey);
          cursor.continue();
        };
      }
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

export async function saveFile(key,file){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FILE_STORE,"readwrite");
    tx.objectStore(FILE_STORE).put({blob:file,filename:file.name,size:file.size,type:file.type,updatedAt:new Date().toISOString()},key);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}

export async function getFile(key){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FILE_STORE,"readonly");
    const req=tx.objectStore(FILE_STORE).get(key);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  });
}

export async function deleteAllFiles(){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(FILE_STORE,"readwrite");
    tx.objectStore(FILE_STORE).clear();
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
}

export async function addAudit(action,details={}){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(LOG_STORE,"readwrite");
    tx.objectStore(LOG_STORE).add({action,details,at:new Date().toISOString()});
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
}

export async function getAuditLogs(limit=100){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(LOG_STORE,"readonly");
    const req=tx.objectStore(LOG_STORE).getAll();
    req.onsuccess=()=>resolve(req.result.reverse().slice(0,limit));
    req.onerror=()=>reject(req.error);
  });
}
