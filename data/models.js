export const MODEL_ORDER = ["A576","A376","A076","A075","A085","S741"];
export const RECORD_ORDER = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U"];

export const CATEGORIES = [
  { key:"all", label:"All", icon:"fa-layer-group" },
  { key:"Block Diagram", label:"Block Diagram", icon:"fa-diagram-project" },
  { key:"Schematics", label:"Circuit & SOC", icon:"fa-microchip" },
  { key:"RF & Wireless", label:"RF & Antenna", icon:"fa-tower-broadcast" },
  { key:"Process & Tech", label:"Process & OPST", icon:"fa-gears" },
  { key:"Defect summary & SW process", label:"Defect summary & SW process", icon:"fa-shield-halved" },
  { key:"Key Parts", label:"Key Parts", icon:"fa-cubes" },
  { key:"Specification", label:"Specification", icon:"fa-clipboard-list" }
];

export const CATEGORY_COLORS = {
  "Block Diagram":"#7c3aed",
  "Schematics":"#2563eb",
  "RF & Wireless":"#059669",
  "Process & Tech":"#d97706",
  "Defect summary & SW process":"#4f46e5",
  "Key Parts":"#9333ea",
  "Specification":"#475569"
};

const base = {
  A:{title:"Block Diagram",category:"Block Diagram",icon:"fa-sitemap",tags:["AP Block Diagram","RF Block Diagram"],subItems:[
    {name:"AP Block Diagram",filename:"A576_AP_Block_Diagram.pdf",size:"21.4 MB"},
    {name:"RF Block Diagram",filename:"A576_RF_Block_Diagram.pdf",size:"28.7 MB"}]},
  B:{title:"Circuit Diagram",category:"Schematics",icon:"fa-diagram-project",tags:["Schematic","Main PBA","SUB PBA"],subItems:[
    {name:"Main PBA",filename:"A576_Main_PBA_Schematic.pdf",size:"68.5 MB"},
    {name:"SUB PBA",filename:"A576_Sub_PBA_Audio_Charge.pdf",size:"18.2 MB"}]},
  C:{title:"SOC Table",category:"Schematics",icon:"fa-microchip",tags:["Battery Percentage vs Voltage"],filename:"A576_SOC_Pin_Table.xlsx",size:"28.3 MB"},
  D:{title:"MIPI Table",category:"Schematics",icon:"fa-bars-staggered",tags:[],filename:"A576_MIPI_Config.xlsx",size:"12.7 MB"},
  E:{title:"RF Port Map",category:"RF & Wireless",icon:"fa-network-wired",tags:["RF Port Mapping"],filename:"A576_RF_Port_Mapping.pdf",size:"58.0 MB"},
  F:{title:"Antenna Structure",category:"RF & Wireless",icon:"fa-tower-broadcast",tags:["MIMO LTE NR 2G WCDMA"],filename:"A576_Antenna_3D_Layout.dwg",size:"84.2 MB"},
  G:{title:"Main and Roaming Bands Details",category:"RF & Wireless",icon:"fa-earth-americas",tags:["5G NR","LTE FDD/TDD","Global Bands"],filename:"A576_Bands_Master.xlsx",size:"9.2 MB"},
  H:{title:"VSWR Graph",category:"RF & Wireless",icon:"fa-chart-line",tags:["VSWR","Return Loss","S-Parameter"],filename:"VSWR_Graph.pdf",size:"RF graph"},
  I:{title:"Process Flow Chart",category:"Process & Tech",icon:"fa-arrows-split-up-and-left",tags:["Workflow","Assembly Nodes"],subItems:[
    {name:"Sub Assembly",filename:"A576_Sub_Assembly_Flow.xlsx",size:"8.4 MB"},
    {name:"Main Line",filename:"A576_Main_Line_SOP.xlsx",size:"14.1 MB"}]},
  J:{title:"New Technology Introduced",category:"Process & Tech",icon:"fa-wand-magic-sparkles",tags:["Antenna Type","Graphite Layer","PMIC"],filename:"A576_New_Tech_Brief.pdf",size:"22.6 MB"},
  K:{title:"OPST Sheet",category:"Process & Tech",icon:"fa-clipboard-check",tags:["Open Short Test"],filename:"A576_OPST_Master.xlsx",size:"11.5 MB"},
  L:{title:"Base Model Defect History",category:"Defect summary & SW process",icon:"fa-bug",tags:["Predecessor Failures","Defect Log"],filename:"A576_Base_Defects_RCA.xlsx",size:"31.2 MB"},
  M:{title:"Other Subsidiary Defect Details",category:"Defect summary & SW process",icon:"fa-triangle-exclamation",tags:["Korea Office / SEVT / SEV Dev Stage Defects"],filename:"A576_Subsidiary_Defects.xlsx",size:"19.7 MB"},
  N:{title:"SW Log Process",category:"Defect summary & SW process",icon:"fa-terminal",tags:["Modem CP Dump","Kernel Panic","UART Guide"],filename:"A576_SW_Log_Guide.pdf",size:"17.4 MB"},
  O:{title:"Key Parts Details",category:"Key Parts",icon:"fa-puzzle-piece",tags:["Vendor Specs","Datasheets"],subItems:[
    {name:"Display",filename:"A576_Display_Spec.pdf",size:"54.2 MB"},
    {name:"Camera",filename:"A576_Camera_OIS_Spec.pdf",size:"62.8 MB"},
    {name:"Speaker",filename:"A576_Speaker_Data.pdf",size:"14.6 MB"},
    {name:"Battery",filename:"A576_Battery_Cert.pdf",size:"21.3 MB"},
    {name:"Front",filename:"A576_Front_Glass.pdf",size:"16.7 MB"},
    {name:"Sensor",filename:"A576_6Axis_Sensor.pdf",size:"18.9 MB"}]},
  P:{title:"Basic Model Details",category:"Specification",icon:"fa-circle-info",tags:["Dimensions","Battery Spec"],filename:"A576_Basic_Spec.pdf",size:"12.4 MB"},
  Q:{title:"Common and Exclusive Part Details",category:"Specification",icon:"fa-cubes",tags:["BOM Compare","Exclusive Part"],filename:"A576_Part_Matrix.xlsx",size:"15.8 MB"},
  R:{title:"Work Specification",category:"Specification",icon:"fa-file-lines",tags:["Assembly Method","Testing Method"],filename:"A576_Work_Specification.pdf",size:"14.8 MB"},
  S:{title:"Korea Member Details",category:"Specification",icon:"fa-id-card",tags:["Korea Member Stage Wise"],filename:"A576_Korea_HQ_Roster.xlsx",size:"4.1 MB"},
  T:{title:"Hardware Checklist",category:"Specification",icon:"fa-clipboard-check",tags:["Hardware verification","Pre-S sign-off"],filename:"",size:""},
  U:{title:"Common",category:"Specification",icon:"fa-folder-tree",tags:["ECN Notices","Engineering Archive"],filename:"A576_Common_Archive.zip",size:"95.0 MB"}
};

const meta = {
  A576:{name:"Galaxy A576",ap:"Exynos 1480 (4nm)",modem:"Sub-6GHz / MIMO 4x4",status:"Mass Production",leadKorea:"HQ R&D Team",swVersion:"A576XXU1AXB2"},
  A376:{name:"Galaxy A376",ap:"Exynos 1380 (5nm)",modem:"Sub-6GHz / MIMO 4x4",status:"Development",leadKorea:"HQ R&D Team",swVersion:"A376XXU0AWA1"},
  A076:{name:"Galaxy A076",ap:"Mobile Platform",modem:"LTE / 5G",status:"Development",leadKorea:"HQ R&D Team",swVersion:"A076XXU0AWA1"},
  A075:{name:"Galaxy A075",ap:"Mobile Platform",modem:"LTE / 5G",status:"Development",leadKorea:"HQ R&D Team",swVersion:"A075XXU0AWA1"},
  A085:{name:"Galaxy A085",ap:"Mobile Platform",modem:"LTE / 5G",status:"Development",leadKorea:"HQ R&D Team",swVersion:"A085XXU0AWA1"},
  S741:{name:"Galaxy S741",ap:"Mobile Platform",modem:"Sub-6GHz / MIMO",status:"Development",leadKorea:"HQ R&D Team",swVersion:"S741XXU0AWA1"}
};

export function createDefaultData(){
  const out={};
  for(const model of MODEL_ORDER){
    const items=structuredClone(base);
    if(model!=="A576"){
      for(const item of Object.values(items)){
        if(item.filename) item.filename=item.filename.replaceAll("A576",model);
        item.subItems?.forEach(s=>s.filename=s.filename.replaceAll("A576",model));
      }
    }
    out[model]={meta:structuredClone(meta[model]),items};
  }
  return out;
}
