// Component limits, defaults, and version 2 configuration validation. No DOM dependencies.
export const DEVICE_SPECS={
 opamp:{title:'Operational amplifier',description:'Explore closed-loop gain and rail clipping. Try increasing the input until the output reaches a supply rail.',fields:[['vin','Input voltage (V)',.5,-12,12],['rin','Input / ground resistor (Ω)',1000,100,1000000],['rf','Feedback resistor (Ω)',10000,100,1000000],['rail','Symmetric supply ± (V)',12,1,24],['load','Output load (Ω)',1000,100,1000000]],note:'Ideal op-amp with negative feedback and symmetric supply rails. Zero input current, rail-limited output, and unlimited output-current capability. No bandwidth, slew-rate, offset, or device-specific output-swing model.'},
 transistor:{title:'NPN transistor',description:'Drive a grounded-emitter transistor through a base resistor. Observe cutoff, active operation, and saturation.',fields:[['drive','Base drive (V)',3.3,0,5],['supply','Collector supply (V)',12,1,48],['rb','Base resistor (Ω)',10000,100,1000000],['rc','Collector resistor (Ω)',1000,10,100000],['beta','Forward current gain β',100,10,500]],note:'Piecewise DC NPN model: V_BE = 0.7 V when conducting and V_CE(sat) = 0.2 V. I_C is limited by the collector resistor. Real junction curves, temperature, leakage, breakdown, and switching delays are not modeled.'},
 transformer:{title:'Transformer',description:'Change the turns ratio to step an AC voltage up or down. Compare RMS currents and power on both sides.',fields:[['vp','Primary voltage (V RMS)',12,.1,240],['np','Primary turns',100,1,10000],['ns','Secondary turns',200,1,10000],['load','Secondary load (Ω)',100,1,100000],['frequency','AC frequency (Hz)',60,1,1000]],note:'Ideal transformer driven by a sinusoidal AC source into a resistive secondary load. No winding resistance, leakage flux, magnetizing current, core losses, or saturation. RMS power is conserved; this is not a DC transformer model.'}
};

export function defaultEnergyLab(){return {mode:'rc',resistance:470,capacitorConnection:'parallel',inductorConnection:'series',capacitors:[100],inductors:[100]};}

export function validateEnergyLab(raw){
 if(raw===undefined)return defaultEnergyLab();
 if(!raw||!['rc','rl'].includes(raw.mode)||typeof raw.resistance!=='number'||!Number.isFinite(raw.resistance)||raw.resistance<1||raw.resistance>100000)throw Error('Invalid RC/RL experiment settings.');
 for(const key of ['capacitorConnection','inductorConnection'])if(!['series','parallel'].includes(raw[key]))throw Error('Invalid energy-storage connection.');
 for(const key of ['capacitors','inductors'])if(!Array.isArray(raw[key])||raw[key].length>6||raw[key].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<.001||v>1000000))throw Error('Use up to six capacitors/inductors with values from 0.001 to 1,000,000.');
 return {mode:raw.mode,resistance:raw.resistance,capacitorConnection:raw.capacitorConnection,inductorConnection:raw.inductorConnection,capacitors:[...raw.capacitors],inductors:[...raw.inductors]};
}

export function defaultWorkbench(){return {active:'storage',experiments:[]};}

export function newExperiment(type,id){const spec=DEVICE_SPECS[type];return {id,type,...Object.fromEntries(spec.fields.map(([key,label,value])=>[key,value])),...(type==='opamp'?{configuration:'noninverting'}:{})};}

export function validateWorkbench(raw){
 if(raw===undefined)return defaultWorkbench();
 if(!raw||!['storage','devices'].includes(raw.active)||!Array.isArray(raw.experiments)||raw.experiments.length>6)throw Error('Invalid workbench configuration.');
 const ids=new Set(),experiments=raw.experiments.map(e=>{
  if(!e||typeof e.id!=='string'||!/^exp[0-9]{1,10}$/.test(e.id)||ids.has(e.id)||!Object.hasOwn(DEVICE_SPECS,e.type))throw Error('Invalid or duplicate experiment.');ids.add(e.id);
  const clean={id:e.id,type:e.type};for(const [key,label,value,min,max] of DEVICE_SPECS[e.type].fields){if(typeof e[key]!=='number'||!Number.isFinite(e[key])||e[key]<min||e[key]>max||(e.type==='transformer'&&['np','ns'].includes(key)&&!Number.isInteger(e[key])))throw Error('Invalid '+label+' in experiment.');clean[key]=e[key];}
  if(e.type==='opamp'){if(!['inverting','noninverting'].includes(e.configuration))throw Error('Invalid amplifier configuration.');clean.configuration=e.configuration;}return clean;
 });return {active:raw.active,experiments};
}

export function validate(raw){
 if(!raw||raw.version!==2||!['series','parallel'].includes(raw.topology)||typeof raw.protection!=='boolean')throw Error('Expected an Orion version 2 configuration.');
 const num=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
 if(!num(raw.emf,.5,48)||!num(raw.internalR,0,100)||!num(raw.wireR,0,100)||!num(raw.tripLimit,.001,100)||!Array.isArray(raw.loads)||raw.loads.length<1||raw.loads.length>6)throw Error('Source values or load count are outside supported limits.');
 const ids=new Set();const loads=raw.loads.map(l=>{if(!l||typeof l.id!=='string'||!/^[-a-zA-Z0-9_]{1,50}$/.test(l.id)||ids.has(l.id)||l.id==='source'||typeof l.name!=='string'||!l.name.trim()||l.name.length>36||!num(l.r,1,100000)||!num(l.target,.1,100)||!['normal','open','short'].includes(l.fault))throw Error('A load contains invalid values or duplicate identifiers.');ids.add(l.id);return {id:l.id,name:l.name,r:l.r,target:l.target,fault:l.fault};});
 return {version:2,topology:raw.topology,emf:raw.emf,internalR:raw.internalR,wireR:raw.wireR,protection:raw.protection,tripLimit:raw.tripLimit,loads,energyLab:validateEnergyLab(raw.energyLab),workbench:validateWorkbench(raw.workbench)};
}

export const defaults={version:2,topology:'series',emf:12,internalR:1,wireR:.4,protection:true,tripLimit:.15,loads:[{id:'life',name:'Life Support',r:420,target:4,fault:'normal'},{id:'comms',name:'Communications',r:300,target:3,fault:'normal'},{id:'engine',name:'Engine Grid',r:250,target:3.5,fault:'normal'}]};
defaults.energyLab=defaultEnergyLab();
defaults.workbench=defaultWorkbench();
