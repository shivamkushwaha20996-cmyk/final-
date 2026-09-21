import {MODEL_ORDER,RECORD_ORDER,CATEGORIES,CATEGORY_COLORS,createDefaultData} from "../data/models.js";
import {saveFile,getFile,deleteAllFiles,addAudit} from "./database.js";
import {toast,escapeHtml,formatBytes,downloadBlob,downloadText} from "./ui.js";

const STORAGE_KEY="MOBILE_RND_DB_DATA_V10";
const PREF_KEY="MOBILE_RND_PREFS_V3";
const AUTH_KEY="RND_AUTH_V3";
const MAX_FILE_SIZE=500*1024*1024;
const VSWR_KEY="H", HWC_KEY="T", LEGACY_VSWR_KEY="VSWR", LEGACY_HWC_KEY="HWC";
const LEGACY_RECORD_MAP={S:"A",B:"B",I:"C",P:"D",K:"E",L:"F",M:"G",T:"H",C:"I",E:"J",H:"K",F:"L",G:"M",Q:"N",J:"O",A:"P",D:"Q",N:"R",O:"S",R:"U",U:"T",VSWR:"H",HWC:"T"};
const LEGACY_KEYS_BY_NEW=Object.entries(LEGACY_RECORD_MAP).reduce((out,[oldKey,newKey])=>{if(oldKey!==newKey)(out[newKey]??=[]).push(oldKey);return out},{});
const ALLOWED=["pdf","xlsx","xls","zip","bin","dwg","csv","doc","docx","ppt","pptx"];
let data=loadData(), prefs=loadPrefs(), currentModel=MODEL_ORDER[0], activeCategory="all", query="", sortMode="default", favoritesOnly=false, recentlyViewed=JSON.parse(localStorage.getItem("MOBILE_RND_RECENT_V1")||"[]"), isAdmin=sessionStorage.getItem(AUTH_KEY)==="true", selectedFile=null;
let favorites=JSON.parse(localStorage.getItem("MOBILE_RND_FAVORITES_V1")||"[]");

function migrateRecordKeys(raw){
  if(!raw||typeof raw!=="object")return createDefaultData();
  for(const [modelKey,model] of Object.entries(raw)){
    const items=model?.items;
    if(!items||typeof items!=="object")continue;

    // v30 renumbered the records by category.  Detect the pre-v30 layout
    // before migrating so we never overwrite/delete records because the old
    // and new letters intentionally overlap (for example old A -> new P).
    const isLegacyLayout = items.A?.title === "Basic Model Details" ||
                           items.S?.title === "Block Diagram" ||
                           items.P?.title === "MIPI Table";

    if(isLegacyLayout){
      const migrated={};
      for(const [oldKey,newKey] of Object.entries(LEGACY_RECORD_MAP)){
        if(items[oldKey]) migrated[newKey]={...items[oldKey]};
      }
      // Preserve the legacy dynamically-created records if present.
      if(items[LEGACY_VSWR_KEY]) migrated[VSWR_KEY]={...items[LEGACY_VSWR_KEY]};
      if(items[LEGACY_HWC_KEY]) migrated[HWC_KEY]={...items[LEGACY_HWC_KEY]};
      model.items=migrated;
    }

    // Always normalize the three records whose role is fixed in v30.
    if(!model.items.H) model.items.H={title:"VSWR Graph",category:"RF & Wireless",icon:"fa-chart-line",tags:["VSWR","Return Loss","S-Parameter"],filename:"VSWR_Graph.pdf",size:"RF graph"};
    if(!model.items.T) model.items.T={title:"Hardware Checklist",category:"Specification",icon:"fa-clipboard-check",tags:["Hardware verification","Pre-S sign-off"],filename:"",size:""};
    if(!model.items.U) model.items.U={title:"Common",category:"Specification",icon:"fa-folder-tree",tags:["ECN Notices","Engineering Archive"],filename:"A576_Common_Archive.zip",size:"95.0 MB"};
    model.items.H.title="VSWR Graph";model.items.H.category="RF & Wireless";model.items.H.icon="fa-chart-line";model.items.H.tags=model.items.H.tags?.length?model.items.H.tags:["VSWR","Return Loss","S-Parameter"];
    model.items.T.title="Hardware Checklist";model.items.T.category="Specification";model.items.T.icon="fa-clipboard-check";
    model.items.U.title="Common";model.items.U.category="Specification";model.items.U.icon="fa-folder-tree";

    // Safety net for data created by an earlier broken migration: restore any
    // missing standard records from the current defaults while keeping all
    // existing user-specific metadata/files already attached to present keys.
    const defaults=createDefaultData()[modelKey]?.items||{};
    for(const key of RECORD_ORDER){
      if(!model.items[key] && defaults[key]) model.items[key]=structuredClone(defaults[key]);
    }
    // If a previous build left a partial record set, make the current A-U set
    // authoritative and persist the repaired set on the next save.
    model.items=Object.fromEntries(RECORD_ORDER.map(key=>[key,model.items[key]||structuredClone(defaults[key])]).filter(([,item])=>item));
  }
  return raw;
}
function loadData(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY));const repaired=raw?migrateRecordKeys(raw):createDefaultData();try{localStorage.setItem(STORAGE_KEY,JSON.stringify(repaired))}catch{}return repaired}catch{return createDefaultData()}}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}
function loadPrefs(){try{return {...{theme:"light",accent:"cyan",density:"comfortable",motion:true},...JSON.parse(localStorage.getItem(PREF_KEY))}}catch{return {theme:"light",accent:"cyan",density:"comfortable",motion:true}}}
function savePrefs(){localStorage.setItem(PREF_KEY,JSON.stringify(prefs))}
function currentItems(){ensureHardwareChecklist(currentModel);ensureVswrRecord(currentModel);return data[currentModel].items}
function itemText(k,item){return [k,item.title,item.category,item.filename,...(item.tags||[]),...(item.subItems||[]).flatMap(s=>[s.name,s.filename,s.size])].join(" ").toLowerCase()}
function markRecent(key){const id=`${currentModel}:${key}`;recentlyViewed=[id,...recentlyViewed.filter(x=>x!==id)].slice(0,8);localStorage.setItem("MOBILE_RND_RECENT_V1",JSON.stringify(recentlyViewed))}
function parseHash(){const m=location.hash.match(/^#record\/([^/]+)\/?([^/]*)$/);if(m&&MODEL_ORDER.includes(m[1])&&currentItemsFor(m[1])[m[2]]){currentModel=m[1];activeCategory="all";query="";renderAll();setTimeout(()=>focusRecord(m[2]),0)}}
function currentItemsFor(model){if(data[model]?.items){ensureHardwareChecklist(model);ensureVswrRecord(model)}return data[model]?.items||{}}
async function getStoredFile(model,key){
  const candidates=[key,...(LEGACY_KEYS_BY_NEW[key]||[])];
  for(const candidate of candidates){const found=await getFile(`${model}_${candidate}`);if(found)return found;}
  return null;
}

function ensureHardwareChecklist(model){const items=data[model]?.items;if(!items)return null;if(!items[HWC_KEY])items[HWC_KEY]={title:"Hardware Checklist",category:"Specification",icon:"fa-clipboard-check",tags:["Hardware verification","Pre-S sign-off"],filename:"",size:""};return items[HWC_KEY]}
function ensureVswrRecord(model){const items=data[model]?.items;if(!items)return null;if(!items[VSWR_KEY])items[VSWR_KEY]={title:"VSWR Graph",category:"RF & Wireless",icon:"fa-chart-line",tags:["VSWR","Return Loss","S-Parameter"],filename:"VSWR_Graph.pdf",size:"RF graph"};else {items[VSWR_KEY].title="VSWR Graph";items[VSWR_KEY].category="RF & Wireless";items[VSWR_KEY].icon="fa-chart-line";items[VSWR_KEY].tags=items[VSWR_KEY].tags?.length?items[VSWR_KEY].tags:["VSWR","Return Loss","S-Parameter"]}return items[VSWR_KEY]}
async function hydrateStoredFiles(){
  for(const model of MODEL_ORDER){
    const items=data[model]?.items||{};
    for(const key of RECORD_ORDER){
      const item=items[key];
      if(!item) continue;
      try{
        const stored=await getStoredFile(model,key);
        if(stored?.blob){
          item._uploaded=true;
          item.filename=stored.filename||item.filename||"";
          item.size=stored.size?formatBytes(stored.size):(item.size||"");
        }
      }catch(err){console.warn("Stored-file hydration failed",model,key,err)}
    }
  }
  saveData();
}

function init(){
  document.getElementById("uploadModel").innerHTML=MODEL_ORDER.map(m=>`<option value="${m}">${m} • ${escapeHtml(data[m].meta.name)}</option>`).join("");
  const last=localStorage.getItem("MOBILE_RND_LAST_MODEL_V1"); if(last&&MODEL_ORDER.includes(last))currentModel=last;
  document.getElementById("uploadModel").value=currentModel;
  const picker=document.getElementById("modelPickerInput");
  const pickerMenu=document.getElementById("modelPickerMenu");
  const pickerToggle=document.getElementById("modelPickerToggle");
  if(picker){
    picker.value=currentModel;
    picker.addEventListener("input",()=>renderModelPicker(picker.value));
    picker.addEventListener("focus",()=>{renderModelPicker(picker.value);openModelPicker()});
    picker.addEventListener("keydown",e=>{
      if(e.key==="Enter"){e.preventDefault();const m=findModel(picker.value);if(m){setModel(m);closeModelPicker()}else toast("Select a valid model.","error")}
      if(e.key==="Escape")closeModelPicker();
    });
  }
  if(pickerToggle) pickerToggle.addEventListener("click",()=>{renderModelPicker("");toggleModelPicker()});
  document.addEventListener("click",e=>{const b=e.target.closest("[data-open-upload],[data-upload-record]");if(b){const key=b.dataset.openUpload||b.dataset.uploadRecord;document.getElementById("uploadModel").value=currentModel;document.getElementById("uploadRecord").value=key;openModal("uploadModal")}});
document.addEventListener("click",e=>{if(!e.target.closest("#modelPickerWrap"))closeModelPicker()});
  const hw=document.getElementById("hardwareChecklistUploadBtn"); if(hw) hw.addEventListener("click",()=>openModal("uploadModal"));
  renderCategories();renderAll();bindEvents();applyPrefs();hydrateStoredFiles().then(()=>renderAll());if(localStorage.getItem("MOBILE_RND_SIDEBAR_V1")==="collapsed"){document.body.classList.add("sidebar-collapsed");document.getElementById("sidebarCollapseBtn").innerHTML='<i class="fa-solid fa-angles-right"></i>'}parseHash();
}
async function renderFileSummary(){
  const wrap=document.getElementById("fileSummaryBody");
  if(!wrap)return;
  const model=currentModel;
  const items=currentItems();
  const keys=RECORD_ORDER.filter(k=>items[k]);
  wrap.innerHTML='<tr><td colspan="10" class="summary-checking">Checking file status…</td></tr>';
  const rows=await Promise.all(keys.map(async k=>{
    const item=items[k];
    const stored=await getStoredFile(model,k);
    const fileName=stored?.filename||item.filename||"File not uploaded";
    return {k,item,fileName,present:!!stored};
  }));
  if(model!==currentModel)return;
  const half=Math.ceil(rows.length/2);
  const first=rows.slice(0,half), second=rows.slice(half);
  const cell=r=>`<td class="summary-cell" title="${escapeHtml(r.fileName)}"><div class="summary-cell-top"><strong>${escapeHtml(r.k)}</strong><span class="status-dot ${r.present?"present":"missing"}"></span></div><span class="summary-cell-title">${escapeHtml(r.item.title)}</span><span class="summary-cell-file">${escapeHtml(r.fileName)}</span></td>`;
  const pad=n=>Array.from({length:n},()=>'<td class="summary-empty"></td>').join("");
  const cols=Math.max(first.length,second.length);
  wrap.innerHTML=`<tr>${first.map(cell).join("")}${pad(cols-first.length)}</tr><tr>${second.map(cell).join("")}${pad(cols-second.length)}</tr>`;
}

function renderAll(){renderHero();renderModelNav();renderCategories();renderCards();renderFileSummary();populateUploadRecords();renderAuth();renderRecent();}
function renderHero(){const m=data[currentModel].meta;document.getElementById("activeModelCode").textContent=currentModel;document.getElementById("activeModelName").textContent=m.name;document.getElementById("modelStatus").innerHTML=`<i class="fa-solid fa-circle"></i> ${escapeHtml(m.status)}`;document.getElementById("metaAp").textContent=m.ap;document.getElementById("metaModem").textContent=m.modem;document.getElementById("metaSw").textContent=m.swVersion;document.getElementById("metaLead").textContent=m.leadKorea}
function renderModelNav(){return}
function renderCategories(){document.getElementById("categoryTabs").innerHTML=CATEGORIES.map(c=>`<button class="cat-btn ${activeCategory===c.key?"active":""}" data-cat="${escapeHtml(c.key)}"><i class="fa-solid ${escapeHtml(c.icon||"fa-folder")}"></i><span>${escapeHtml(c.label)}</span></button>`).join("")}
function filteredEntries(){ensureHardwareChecklist(currentModel);let keys=[...RECORD_ORDER];let arr=keys.map(k=>[k,currentItems()[k]]).filter(([,i])=>i).filter(([k,i])=>{const cat=activeCategory==="all"||i.category===activeCategory;const fav=!favoritesOnly||favorites.includes(`${currentModel}:${k}`);return cat&&fav&&(!query||itemText(k,i).includes(query.toLowerCase()))});if(sortMode==="title")arr.sort((a,b)=>a[1].title.localeCompare(b[1].title));if(sortMode==="category")arr.sort((a,b)=>a[1].category.localeCompare(b[1].category)||a[0].localeCompare(b[0]));if(sortMode==="favorite")arr.sort((a,b)=>Number(favorites.includes(`${currentModel}:${b[0]}`))-Number(favorites.includes(`${currentModel}:${a[0]}`)));return arr}
function renderCards(){const grid=document.getElementById("cardsGrid"),entries=filteredEntries();document.getElementById("recordCount").textContent=`${entries.length} records`;document.getElementById("activeFilters").classList.toggle("hidden",!(query||activeCategory!=="all"||favoritesOnly||sortMode!=="default"));document.getElementById("activeFilters").innerHTML=`${query?`<span class="filter-chip">Search: ${escapeHtml(query)}</span>`:""}${activeCategory!=="all"?`<span class="filter-chip">Category: ${escapeHtml(activeCategory)}</span>`:""}${favoritesOnly?`<span class="filter-chip">Favorites only</span>`:""}${sortMode!=="default"?`<span class="filter-chip">Sort: ${escapeHtml(sortMode)}</span>`:""}`;if(!entries.length){grid.innerHTML=`<div class="empty-state"><i class="fa-solid fa-filter-circle-xmark"></i><h3 class="font-bold mt-3">No records found</h3><p class="text-xs mt-1">Adjust the search or filters.</p><button class="btn btn-light mt-3" data-clear-filters>Clear filters</button></div>`;return}grid.innerHTML=entries.map(([k,i])=>renderCard(k,i)).join("")}
function renderCard(key,item){
const color=CATEGORY_COLORS[item.category]||CATEGORY_COLORS.Specification;
const tags=(item.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("");
const favKey=`${currentModel}:${key}`,isFav=favorites.includes(favKey);
const uploadRow=`<div class="file-row"><div class="min-w-0"><div class="file-name">No file uploaded</div><div class="file-size">Attach the engineering file for this record</div></div><button class="download-btn" style="background:${color}" data-open-upload="${escapeHtml(key)}"><i class="fa-solid fa-cloud-arrow-up"></i> UPLOAD</button></div>`;
let files;
if(key===HWC_KEY) files=item._uploaded&&item.filename?`<div class="file-row"><div class="min-w-0"><div class="file-name">${escapeHtml(item.filename)}</div><div class="file-size">${escapeHtml(item.size||"FILE")}</div></div><button class="download-btn" data-download="${currentModel}_${key}" data-filename="${escapeHtml(item.filename)}"><i class="fa-solid fa-download"></i> DOWNLOAD</button></div>`:`<div class="file-row"><div class="min-w-0"><div class="file-name">No checklist uploaded</div><div class="file-size">Upload the active model hardware checklist</div></div><button class="download-btn hw-upload-btn" data-hw-upload="1"><i class="fa-solid fa-cloud-arrow-up"></i> UPLOAD</button></div>`;
else if(item._uploaded&&item.filename) files=`<div class="file-row"><div class="min-w-0"><div class="file-name" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</div><div class="file-size">${escapeHtml(item.size||"FILE")}</div></div><button class="download-btn" style="background:${color}" data-download="${currentModel}_${key}" data-filename="${escapeHtml(item.filename)}"><i class="fa-solid fa-download"></i> DOWNLOAD</button></div>`;
else if(item.subItems?.length) files=item.subItems.map(s=>`<div class="file-row"><div class="min-w-0"><div class="file-name">${escapeHtml(s.name)}</div><div class="file-size">REFERENCE • ${escapeHtml(s.filename||s.size||"")}</div></div></div>`).join("");
else files=uploadRow;
return `<article id="record-${escapeHtml(key)}" class="record-card ${key===HWC_KEY?"hardware-checklist-record ":""}${isFav?"is-favorite":""}" data-record="${escapeHtml(key)}"><div class="record-stripe" style="background:${color}"></div><div class="record-body"><div><div class="record-header"><div class="record-title-wrap"><div class="record-icon" style="background:${color}"><i class="fa-solid ${escapeHtml(item.icon||"fa-file")}"></i></div><div class="min-w-0"><div class="record-key">RECORD ${escapeHtml(key)}</div><div class="record-title">${escapeHtml(item.title)}</div></div></div><div class="card-actions"><span class="category-label">${escapeHtml(item.category)}</span><button class="favorite-btn ${isFav?"active":""}" data-favorite="${escapeHtml(favKey)}" title="Favorite"><i class="fa-${isFav?"solid":"regular"} fa-star"></i></button></div></div><div class="tags">${tags||'<span class="tag">No additional metadata</span>'}</div></div><div class="file-area">${files}</div><div class="card-footer-actions"><button class="text-action" data-open-record="${escapeHtml(key)}"><i class="fa-solid fa-up-right-and-down-left-from-center"></i> Open</button><button class="text-action" data-copy-record="${escapeHtml(key)}"><i class="fa-regular fa-copy"></i> Copy</button><button class="text-action" data-upload-record="${escapeHtml(key)}"><i class="fa-solid fa-upload"></i> Upload</button></div></div></article>`}
function renderAuth(){const slot=document.getElementById("adminAuthSlot");slot.innerHTML=isAdmin?`<div class="flex gap-1"><button id="uploadBtn" class="btn btn-cyan"><i class="fa-solid fa-cloud-arrow-up"></i> Upload</button><button id="logoutBtn" class="header-icon-btn" title="Logout"><i class="fa-solid fa-right-from-bracket"></i></button></div>`:`<button id="loginBtn" class="btn btn-dark"><i class="fa-solid fa-lock"></i> Admin</button>`;document.getElementById(isAdmin?"uploadBtn":"loginBtn").addEventListener("click",()=>openModal(isAdmin?"uploadModal":"loginModal"));if(isAdmin)document.getElementById("logoutBtn").addEventListener("click",()=>{isAdmin=false;sessionStorage.removeItem(AUTH_KEY);renderAuth();toast("Admin session ended.","info")})}
function populateUploadRecords(){ensureHardwareChecklist(currentModel);document.getElementById("uploadRecord").innerHTML=RECORD_ORDER.filter(k=>currentItems()[k]).map(k=>`<option value="${k}">[${k}] ${escapeHtml(currentItems()[k].title)}</option>`).join("")}
function openModal(id){document.getElementById(id).classList.remove("hidden")}function closeModal(id){document.getElementById(id).classList.add("hidden")}
function findModel(value){const v=String(value||"").trim().toUpperCase();return MODEL_ORDER.find(m=>m===v)||MODEL_ORDER.find(m=>m.toUpperCase()===v)||null}
function renderModelPicker(filter=""){const menu=document.getElementById("modelPickerMenu");if(!menu)return;const q=String(filter||"").trim().toLowerCase();const matches=MODEL_ORDER.filter(m=>!q||m.toLowerCase().includes(q)||data[m].meta.name.toLowerCase().includes(q));menu.innerHTML=matches.length?matches.map(m=>`<button type="button" class="model-picker-option ${m===currentModel?"active":""}" data-picker-model="${m}" role="option" aria-selected="${m===currentModel}"><span class="model-picker-code">${m}</span><span class="model-picker-name">${escapeHtml(data[m].meta.name)}</span></button>`).join(""):`<div class="model-picker-empty">No model found</div>`;menu.querySelectorAll("[data-picker-model]").forEach(b=>b.addEventListener("click",()=>{setModel(b.dataset.pickerModel);closeModelPicker()}));}
function openModelPicker(){const m=document.getElementById("modelPickerMenu"),i=document.getElementById("modelPickerInput");if(m){m.classList.remove("hidden");i?.setAttribute("aria-expanded","true")}}
function closeModelPicker(){const m=document.getElementById("modelPickerMenu"),i=document.getElementById("modelPickerInput");if(m){m.classList.add("hidden");i?.setAttribute("aria-expanded","false")}}
function toggleModelPicker(){const m=document.getElementById("modelPickerMenu");if(m?.classList.contains("hidden"))openModelPicker();else closeModelPicker()}
function setModel(m){if(!MODEL_ORDER.includes(m))return;currentModel=m;localStorage.setItem("MOBILE_RND_LAST_MODEL_V1",m);document.getElementById("uploadModel").value=m;activeCategory="all";query="";favoritesOnly=false;sortMode="default";document.getElementById("searchInput").value="";document.getElementById("clearSearchBtn").classList.add("hidden");renderAll();const picker=document.getElementById("modelPickerInput");if(picker)picker.value=currentModel;renderModelPicker("");location.hash="";window.scrollTo({top:0,behavior:prefs.motion?"smooth":"auto"})}
function openRecord(key){markRecent(key);location.hash=`record/${currentModel}/${key}`;renderRecent();focusRecord(key)}
function focusRecord(key){const el=document.getElementById(`record-${key}`);if(el){el.scrollIntoView({behavior:prefs.motion?"smooth":"auto",block:"center"});el.classList.add("record-focus");setTimeout(()=>el.classList.remove("record-focus"),1200)}}
function renderRecent(){const wrap=document.getElementById("recentList");if(!wrap)return;const items=recentlyViewed.map(id=>{const [m,k]=id.split(":");const item=currentItemsFor(m)[k];return item?{m,k,item}:null}).filter(Boolean);wrap.innerHTML=items.length?items.map(x=>`<button class="recent-item" data-recent-model="${x.m}" data-recent-key="${x.k}"><span>${x.m} · ${x.k}</span><strong>${escapeHtml(x.item.title)}</strong></button>`).join(""):"<span class='help-text'>No recently viewed records.</span>"}
function bindEvents(){

  const summaryToggle=document.getElementById("fileSummaryToggle");
  const summaryBoard=document.querySelector(".file-summary-board");
  const summaryHidden=localStorage.getItem("MOBILE_RND_FILE_SUMMARY_HIDDEN_V1")==="1";
  if(summaryBoard&&summaryToggle){
    summaryBoard.classList.toggle("summary-hidden",summaryHidden);
    summaryToggle.setAttribute("aria-expanded",String(!summaryHidden));
    summaryToggle.innerHTML=`<i class="fa-solid fa-eye${summaryHidden?"":"-slash"}"></i> ${summaryHidden?"Show":"Hide"}`;
    summaryToggle.addEventListener("click",()=>{
      const hidden=summaryBoard.classList.toggle("summary-hidden");
      localStorage.setItem("MOBILE_RND_FILE_SUMMARY_HIDDEN_V1",hidden?"1":"0");
      summaryToggle.setAttribute("aria-expanded",String(!hidden));
      summaryToggle.innerHTML=`<i class="fa-solid fa-eye${hidden?"":"-slash"}"></i> ${hidden?"Show":"Hide"}`;
    });
  }

  document.getElementById("sidebarCollapseBtn").addEventListener("click",()=>{document.body.classList.toggle("sidebar-collapsed");const collapsed=document.body.classList.contains("sidebar-collapsed");localStorage.setItem("MOBILE_RND_SIDEBAR_V1",collapsed?"collapsed":"expanded");document.getElementById("sidebarCollapseBtn").innerHTML=`<i class="fa-solid fa-angles-${collapsed?"right":"left"}"></i>`});
  document.getElementById("searchInput").addEventListener("input",e=>{query=e.target.value.trim();document.getElementById("clearSearchBtn").classList.toggle("hidden",!query);renderCards()});
  document.getElementById("clearSearchBtn").addEventListener("click",()=>{query="";document.getElementById("searchInput").value="";document.getElementById("clearSearchBtn").classList.add("hidden");renderCards()});
  document.getElementById("categoryTabs").addEventListener("click",e=>{const b=e.target.closest("[data-cat]");if(b){activeCategory=b.dataset.cat;renderCategories();renderCards()}});
  document.getElementById("cardsGrid").addEventListener("click",e=>{const up=e.target.closest("[data-open-upload],[data-upload-record]");if(up){const key=up.dataset.openUpload||up.dataset.uploadRecord;document.getElementById("uploadModel").value=currentModel;document.getElementById("uploadRecord").value=key;openModal("uploadModal");return}const hw=e.target.closest("[data-hw-upload]");if(hw){document.getElementById("uploadRecord").value=HWC_KEY;openModal("uploadModal");return}const fav=e.target.closest("[data-favorite]");if(fav){toggleFavorite(fav.dataset.favorite);return}const d=e.target.closest("[data-download]");if(d){downloadRecord(d.dataset.download,d.dataset.filename);return}const o=e.target.closest("[data-open-record]");if(o){openRecord(o.dataset.openRecord);openPresentation(o.dataset.openRecord);return}const c=e.target.closest("[data-copy-record]");if(c){copyRecord(c.dataset.copyRecord);return}const l=e.target.closest("[data-link-record]");if(l){copyLink(l.dataset.linkRecord);return}const clr=e.target.closest("[data-clear-filters]");if(clr)clearFilters()});
  document.getElementById("copySpecsBtn").addEventListener("click",copySpecs);document.getElementById("exportJsonBtn").addEventListener("click",exportModel);document.getElementById("exportReportBtn").addEventListener("click",exportReport);document.getElementById("settingsBtn").addEventListener("click",()=>openModal("settingsModal"));document.getElementById("themeBtn").addEventListener("click",()=>{prefs.theme=prefs.theme==="dark"?"light":"dark";savePrefs();applyPrefs()});document.getElementById("fullscreenBtn").addEventListener("click",toggleFullscreen);
  document.getElementById("themeSelect").addEventListener("change",e=>{prefs.theme=e.target.value;savePrefs();applyPrefs()});document.getElementById("accentSelect").addEventListener("change",e=>{prefs.accent=e.target.value;savePrefs();applyPrefs()});document.getElementById("densitySelect").addEventListener("change",e=>{prefs.density=e.target.value;savePrefs();applyPrefs()});
  document.getElementById("settingsApplyBtn")?.addEventListener("click",()=>{savePrefs();applyPrefs();toast("Settings applied.","success")});document.getElementById("settingsOkBtn")?.addEventListener("click",()=>{savePrefs();applyPrefs();closeModal("settingsModal")});
  document.getElementById("sortSelect").addEventListener("change",e=>{sortMode=e.target.value;renderCards()});document.getElementById("favoritesToggle").addEventListener("click",()=>{favoritesOnly=!favoritesOnly;document.getElementById("favoritesToggle").classList.toggle("active",favoritesOnly);renderCards()});document.getElementById("clearFiltersBtn").addEventListener("click",clearFilters);
  document.getElementById("prevRecordBtn").addEventListener("click",()=>navigateRecord(-1));document.getElementById("nextRecordBtn").addEventListener("click",()=>navigateRecord(1));document.getElementById("presentationBtn").addEventListener("click",()=>{const k=filteredEntries()[0]?.[0];if(k)openPresentation(k)});
  document.getElementById("recentList").addEventListener("click",e=>{const b=e.target.closest("[data-recent-key]");if(b){setModel(b.dataset.recentModel);setTimeout(()=>openRecord(b.dataset.recentKey),50)}});
  document.querySelectorAll("[data-close]").forEach(b=>b.addEventListener("click",()=>closeModal(b.dataset.close)));document.querySelectorAll(".modal-backdrop").forEach(b=>b.addEventListener("click",()=>b.parentElement.classList.add("hidden")));
  document.getElementById("loginForm").addEventListener("submit",login);document.getElementById("uploadModel").addEventListener("change",e=>{currentModel=e.target.value;renderAll()});document.getElementById("dropZone").addEventListener("click",()=>document.getElementById("fileInput").click());document.getElementById("dropZone").addEventListener("dragover",e=>{e.preventDefault();document.getElementById("dropZone").classList.add("drag-active")});document.getElementById("dropZone").addEventListener("dragleave",()=>document.getElementById("dropZone").classList.remove("drag-active"));document.getElementById("dropZone").addEventListener("drop",e=>{e.preventDefault();document.getElementById("dropZone").classList.remove("drag-active");selectFile(e.dataTransfer.files[0])});document.getElementById("fileInput").addEventListener("change",e=>selectFile(e.target.files[0]));document.getElementById("uploadForm").addEventListener("submit",upload);
  document.getElementById("motionToggle").addEventListener("change",e=>{prefs.motion=e.target.checked;savePrefs();applyPrefs()});document.getElementById("backupBtn").addEventListener("click",()=>downloadText(JSON.stringify(data,null,2),`MobileRD_Backup_${dateStamp()}.json`));document.getElementById("resetBtn").addEventListener("click",resetData);
  document.addEventListener("keydown",e=>{const tag=document.activeElement?.tagName||"";const typing=/INPUT|TEXTAREA|SELECT/.test(tag);if(e.key==="Escape")document.querySelectorAll(".modal:not(.hidden)").forEach(m=>m.classList.add("hidden"));if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();document.getElementById("searchInput").focus()}if(e.key==="/"&&!typing){e.preventDefault();document.getElementById("searchInput").focus()}if(e.key.toLowerCase()==="f"&&!typing)toggleFullscreen();if(e.key.toLowerCase()==="p"&&!typing){e.preventDefault();document.getElementById("presentationBtn").click()}if((e.key==="ArrowLeft"||e.key==="ArrowRight")&&!typing&&!document.querySelector(".modal:not(.hidden)")){navigateRecord(e.key==="ArrowLeft"?-1:1)}});
}
function clearFilters(){query="";activeCategory="all";favoritesOnly=false;sortMode="default";document.getElementById("searchInput").value="";document.getElementById("sortSelect").value="default";document.getElementById("favoritesToggle").classList.remove("active");renderCategories();renderCards()}
function applyPrefs(){document.body.classList.toggle("no-motion",!prefs.motion);const resolvedTheme=prefs.theme==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):prefs.theme;document.body.dataset.theme=resolvedTheme;document.body.dataset.accent=prefs.accent;document.body.dataset.density=prefs.density;document.getElementById("themeSelect").value=prefs.theme;document.getElementById("accentSelect").value=prefs.accent;document.getElementById("densitySelect").value=prefs.density;document.getElementById("motionToggle").checked=prefs.motion;document.getElementById("themeIcon").className=`fa-solid fa-${resolvedTheme==="dark"?"sun":"moon"}`}
function toggleFavorite(id){favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];localStorage.setItem("MOBILE_RND_FAVORITES_V1",JSON.stringify(favorites));renderCards();toast(favorites.includes(id)?"Added to favorites.":"Removed from favorites.","info")}
async function toggleFullscreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{toast("Fullscreen is not available.","error")}}
function login(e){e.preventDefault();if(document.getElementById("passwordInput").value==="admin123"){isAdmin=true;sessionStorage.setItem(AUTH_KEY,"true");closeModal("loginModal");document.getElementById("passwordInput").value="";renderAuth();toast("Admin session authenticated.","success");addAudit("LOGIN")}else document.getElementById("loginError").classList.remove("hidden")}
function selectFile(file){if(!file)return;const ext=file.name.split(".").pop().toLowerCase();if(!ALLOWED.includes(ext)){toast(`File type .${ext} is not supported.`,"error");return}if(file.size>MAX_FILE_SIZE){toast("File exceeds the 500 MB application limit.","error");return}selectedFile=file;document.getElementById("fileName").textContent=`${file.name} (${formatBytes(file.size)})`;document.getElementById("uploadStatus").textContent="File ready for upload."}
async function upload(e){e.preventDefault();if(!selectedFile){toast("Please select a file first.","error");return}const model=document.getElementById("uploadModel").value,key=document.getElementById("uploadRecord").value,note=document.getElementById("uploadNote").value.trim(),item=key===HWC_KEY?ensureHardwareChecklist(model):(key===VSWR_KEY?ensureVswrRecord(model):data[model].items[key]),btn=document.getElementById("saveUploadBtn"),progressWrap=document.getElementById("uploadProgressWrap"),progress=document.getElementById("uploadProgress");btn.disabled=true;progressWrap.classList.remove("hidden");progress.style.width="20%";try{await saveFile(`${model}_${key}`,selectedFile);progress.style.width="70%";item.filename=selectedFile.name;item.size=formatBytes(selectedFile.size);item._uploaded=true;if(note)item.tags=[note];saveData();await addAudit("UPLOAD",{model,key,filename:selectedFile.name,size:selectedFile.size});progress.style.width="100%";renderAll();closeModal("uploadModal");toast(`${selectedFile.name} saved successfully.`,`success`);selectedFile=null;document.getElementById("uploadForm").reset();document.getElementById("uploadModel").value=currentModel;document.getElementById("fileName").textContent="Drop file here or click to browse"}catch{toast("Could not save the file to IndexedDB.","error")}finally{btn.disabled=false;setTimeout(()=>progressWrap.classList.add("hidden"),300)}}
async function downloadRecord(key,filename){
try{const [model,keyPart]=String(key).split("_");const record=await getStoredFile(model,keyPart);if(record?.blob){const ok=downloadBlob(record.blob,record.filename||filename);if(ok){await addAudit("DOWNLOAD",{key,filename:record.filename||filename});toast("Download started.","success");return}toast("Browser blocked the download. Please allow downloads for this site.","error");return}}catch(err){console.error("File download lookup failed",err)}
toast("No uploaded file is available for this record. Use Upload to attach the file first.","error")}
function recordData(key){return currentItems()[key]}
function copyRecord(key){const i=recordData(key);const text=`Record ${key}\nTitle: ${i.title}\nCategory: ${i.category}\nTags: ${(i.tags||[]).join(", ")}\nFile: ${i.filename||"—"}\nSize: ${i.size||"—"}`;navigator.clipboard.writeText(text);toast(`Record ${key} copied.`,`success`)}
function copyLink(key){const url=`${location.href.split("#")[0]}#record/${currentModel}/${key}`;navigator.clipboard.writeText(url);toast("Record link copied.","success")}
function copySpecs(){const m=data[currentModel].meta;navigator.clipboard.writeText(`Model: ${currentModel} (${m.name})\nProcessor: ${m.ap}\nModem/RF: ${m.modem}\nSW Build: ${m.swVersion}\nHQ Lead: ${m.leadKorea}\nStatus: ${m.status}`);toast("Model specification copied.","success")}
function exportModel(){downloadText(JSON.stringify(data[currentModel],null,2),`${currentModel}_Engineering_Master.json`);toast("Model JSON exported.","success")}
function exportReport(){const m=data[currentModel].meta,rows=filteredEntries().map(([k,i])=>`${k} | ${i.title} | ${i.category} | ${i.filename||`${i.subItems?.length||0} linked files`}`).join("\n");downloadText(`MOBILE R&D ENGINEERING REPORT\n================================\nModel: ${currentModel} - ${m.name}\nStatus: ${m.status}\nProcessor: ${m.ap}\nModem/RF: ${m.modem}\nSW Build: ${m.swVersion}\nHQ Lead: ${m.leadKorea}\n\nRECORDS\n-------\n${rows}\n\nGenerated: ${new Date().toISOString()}`,`${currentModel}_Engineering_Report.txt`,"text/plain");toast("Engineering report exported.","success")}
function openPresentation(key){const i=recordData(key);if(!i)return;document.getElementById("presentationContent").innerHTML=`<div class="presentation-code">${currentModel} · RECORD ${key}</div><h2>${escapeHtml(i.title)}</h2><div class="presentation-category">${escapeHtml(i.category)}</div><div class="presentation-tags">${(i.tags||[]).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join("")}</div><div class="presentation-file"><strong>File</strong><span>${escapeHtml(i.filename||"Linked record")}</span></div>`;openModal("presentationModal")}
function navigateRecord(delta){const arr=RECORD_ORDER.filter(k=>currentItems()[k]);const idx=arr.indexOf(location.hash.split("/").pop());const next=arr[Math.max(0,Math.min(arr.length-1,(idx<0?0:idx)+delta))];if(next)openRecord(next)}
async function resetData(){if(!confirm("Reset all local dashboard data and stored files? This cannot be undone."))return;data=createDefaultData();saveData();await deleteAllFiles();await addAudit("RESET");currentModel=MODEL_ORDER[0];activeCategory="all";query="";renderCategories();renderAll();closeModal("settingsModal");toast("Local data reset to default dataset.","success")}
function dateStamp(){return new Date().toISOString().slice(0,10).replaceAll("-","")}
init();

/* V10 animation enhancement: click ripple */
document.addEventListener('click',(event)=>{
  const target=event.target.closest('button,.btn,.cat-btn,.download-btn,.header-icon-btn,.file-row');
  if(!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect=target.getBoundingClientRect();
  const ripple=document.createElement('span');
  ripple.className='portal-click-ripple';
  ripple.style.left=(event.clientX-rect.left)+'px';
  ripple.style.top=(event.clientY-rect.top)+'px';
  if(getComputedStyle(target).position==='static') target.style.position='relative';
  target.style.overflow='hidden';
  target.appendChild(ripple);
  setTimeout(()=>ripple.remove(),420);
});
