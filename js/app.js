// Sole owner of configuration, breaker state, playback state, and UI event handling.
import { defaults, DEVICE_SPECS, newExperiment, validate } from './components.js';
import { energyParameters, nodeVoltages } from './circuit.js';
import { calculateCircuit, energyResponse, calculateDevice } from './simulator.js';
import { createRenderer, fmt, labNumber } from './canvas.js';

'use strict';
const $=id=>document.getElementById(id),STORAGE_KEY='orion-circuit-v2';
const copy=o=>JSON.parse(JSON.stringify(o));

let state=copy(defaults),closed=false,tripped=false,result,paused=false,idCounter=0;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const say=s=>{$('notice').textContent=s};

function makeControls(){
 $('sourceControls').innerHTML=[['emf','Reactor EMF (V)',.5,48,.5],['internalR','Internal resistance (Ω)',0,100,.1],['wireR','Total wire resistance (Ω)',0,100,.1]].map(([id,label,min,max,step])=>`<div class="control"><div class="row"><label for="${id}Number">${label}</label><input id="${id}Number" type="number" required min="${min}" max="${max}" step="${step}" value="${state[id]}" data-source="${id}"></div><input aria-label="${label} slider" id="${id}Range" type="range" min="${min}" max="${max}" step="${step}" value="${state[id]}" data-source="${id}"></div>`).join('');
 $('topology').value=state.topology;$('protection').checked=state.protection;$('tripLimit').value=state.tripLimit;
 $('loads').innerHTML=state.loads.map((l,i)=>`<div class="load" data-id="${l.id}"><div class="load-header"><span class="load-title">R${i+1}</span><span id="badge-${l.id}" class="badge bad">OFFLINE</span><button data-remove="${l.id}" aria-label="Remove ${escapeHTML(l.name)}" ${state.loads.length===1?'disabled':''}>Remove</button></div><input type="text" aria-label="R${i+1} name" value="${escapeHTML(l.name)}" maxlength="36" data-load="${l.id}" data-key="name"><div class="load-controls"><label>Resistance (Ω)<input type="number" min="1" max="100000" step="1" value="${l.r}" data-load="${l.id}" data-key="r"></label><label>Target voltage (V)<input type="number" min="0.1" max="100" step="0.1" value="${l.target}" data-load="${l.id}" data-key="target"></label></div><input type="range" aria-label="${escapeHTML(l.name)} resistance slider" min="1" max="${Math.max(1500,l.r)}" step="1" value="${l.r}" data-load="${l.id}" data-key="r"><div class="row"><label class="muted">Fault <select aria-label="${escapeHTML(l.name)} fault" data-load="${l.id}" data-key="fault"><option value="normal" ${l.fault==='normal'?'selected':''}>Normal</option><option value="open" ${l.fault==='open'?'selected':''}>Open circuit</option><option value="short" ${l.fault==='short'?'selected':''}>Short circuit</option></select></label></div><div class="readings"><div><small>Current</small><b id="i-${l.id}"></b></div><div><small>Voltage</small><b id="v-${l.id}"></b></div><div><small>Power</small><b id="p-${l.id}"></b></div></div><div class="bar"><div id="bar-${l.id}" class="fill"></div></div></div>`).join('');
 $('addLoad').disabled=state.loads.length>=6;
}

function meterOptions(){const voltages=nodeVoltages(state,result),nodes=Object.keys(voltages);for(const [id,fallback] of [['redProbe',state.topology==='series'?'N'+state.loads.length:'B'],['blackProbe','G']]){const prev=$(id).value;$(id).innerHTML=nodes.map(n=>`<option value="${n}">${n}${n==='G'?' · reference':n==='T'?' · source terminal':''}</option>`).join('');$(id).value=nodes.includes(prev)?prev:fallback;}const prev=$('meterComponent').value;$('meterComponent').innerHTML='<option value="source">Supply / common wire</option>'+state.loads.map((l,i)=>`<option value="${l.id}">R${i+1} · ${escapeHTML(l.name)}</option>`).join('');if([...$('meterComponent').options].some(o=>o.value===prev))$('meterComponent').value=prev;}
function updateMeter(){const voltage=$('meterMode').value==='voltage';$('redField').hidden=!voltage;$('blackField').hidden=!voltage;$('componentField').hidden=voltage;let value;if(voltage){const nodes=nodeVoltages(state,result);value=nodes[$('redProbe').value]-nodes[$('blackProbe').value];}else {value=$('meterComponent').value==='source'?result.current:result.loads.find(l=>l.id===$('meterComponent').value)?.current;} $('meterValue').textContent=fmt(value,4)+(voltage?' V':' A');$('meterHelp').textContent=voltage?'Click labeled circuit nodes to alternate red and black probes. Red minus black gives signed voltage. Readings assume an ideal meter.':'Select a component for its calculated current. — indicates an undefined current split between multiple ideal shorts.';}
function update(){
 result=calculateCircuit(state,closed);
 if(closed&&state.protection&&(result.idealShort||result.current>state.tripLimit)){closed=false;tripped=true;result=calculateCircuit(state,false);}
 const r=result;
 $('breaker').textContent=closed?'Disengage main breaker':tripped?'Reset & engage breaker':'Engage main breaker';$('breaker').className=(closed?'danger':'primary')+' wide';$('breakerReason').textContent=tripped?'Overcurrent trip. Reduce current or adjust the threshold before re-engaging.':r.idealShort?'Ideal short circuit: current is unbounded in this model.':'';
 const all=r.loads.every(l=>l.status==='ONLINE');$('banner').textContent=tripped?'BREAKER TRIPPED':!closed?'POWER OFFLINE':r.idealShort?'IDEAL SHORT CIRCUIT':all?'STATION STABLE':'POWER BALANCING / FAULT';$('banner').className=closed&&all?'good':closed||tripped?'warn':'bad';$('topologyHint').textContent=state.topology==='series'?'Same current · shared voltage':'Same load voltage · branch currents add';
 $('metrics').innerHTML=[['EMF',fmt(state.emf,1)+' V'],['Terminal voltage',fmt(r.terminal,2)+' V'],['Total resistance',fmt(r.rt,2)+' Ω'],['Supply current',fmt(r.current)+' A'],['Load power',fmt(r.loadPower)+' W'],['Battery loss',fmt(r.batteryLoss)+' W'],['Wire loss',fmt(r.wireLoss)+' W'],['Efficiency',r.inputPower===0?'—':fmt(r.efficiency,1)+'%']].map(([label,value])=>`<div class="metric"><small>${label}</small><b>${value}</b></div>`).join('');
 for(const l of r.loads){const b=$('badge-'+l.id);b.textContent=l.status;b.className='badge '+(l.status==='ONLINE'?'good':l.status==='LIMITED'?'warn':'bad');$('i-'+l.id).textContent=fmt(l.current)+' A';$('v-'+l.id).textContent=fmt(l.voltage,2)+' V';$('p-'+l.id).textContent=fmt(l.power)+' W';$('bar-'+l.id).style.width=Math.min(100,Math.max(0,Number.isFinite(l.voltage)?100*l.voltage/l.target:0))+'%';}
 const eq=state.topology==='series'?`R_load = ${r.loads.map(l=>fmt(l.resistance,1)).join(' + ')} = ${fmt(r.req,2)} Ω`:`R_load = 1 / Σ(1/R_branch) = ${fmt(r.req,2)} Ω`;
 $('equations').innerHTML=[eq,`R_total = r_internal + R_wire + R_load = ${fmt(r.rt,2)} Ω`,`I_supply = ${closed?fmt(state.emf,2)+' / '+fmt(r.rt,2):'0 (breaker open)'} = ${fmt(r.current)} A`,`V_terminal = ${fmt(state.emf,2)} − ${fmt(r.current)} × ${fmt(state.internalR,2)} = ${fmt(r.terminal,3)} V`,...r.loads.map((l,i)=>`R${i+1}: V = ${fmt(l.voltage,3)} V; I = ${fmt(l.current)} A; P = ${fmt(l.power)} W`),`P_source = EMF × I = ${fmt(r.inputPower)} W`,`Power balance: source ${fmt(r.inputPower)} = loads ${fmt(r.loadPower)} + internal ${fmt(r.batteryLoss)} + wires ${fmt(r.wireLoss)} W`,`Efficiency = P_load / P_source × 100 = ${r.inputPower===0?'undefined (no delivered power)':fmt(r.efficiency,2)+'%'}`].map(t=>`<div>${escapeHTML(t)}</div>`).join('');
 meterOptions();updateMeter();drawCircuit();$('challengeResult').textContent='';syncEnergyLab();
}
function restore(config){state=copy(config);closed=false;tripped=false;$('challengeResult').textContent='';makeControls();update();syncEnergyLab(true);syncWorkbench();}

$('sourceControls').addEventListener('input',e=>{const key=e.target.dataset.source;if(!key)return;const value=+e.target.value;if(e.target.value===''||!e.target.checkValidity())return;state[key]=value;$(key+'Number').value=value;$(key+'Range').value=value;update();});
$('sourceControls').addEventListener('change',e=>{const key=e.target.dataset.source;if(key&&!e.target.checkValidity()){e.target.value=state[key];say('Enter a source value within the displayed limits.');}});
$('loads').addEventListener('input',e=>{const {load,key}=e.target.dataset;if(!load)return;const l=state.loads.find(l=>l.id===load);if(key==='name'){if(!e.target.value.trim())return;l.name=e.target.value.slice(0,36);}else if(key==='fault')l.fault=e.target.value;else {if(e.target.value===''||!e.target.checkValidity())return;l[key]=+e.target.value;if(key==='r')for(const el of $('loads').querySelectorAll(`[data-load="${load}"][data-key="r"]`)){if(el.type==='range')el.max=Math.max(1500,l.r);el.value=l.r;}}update();});
$('loads').addEventListener('change',e=>{const {load,key}=e.target.dataset;if(load&&key){const l=state.loads.find(l=>l.id===load);if(e.target.value===''||!e.target.checkValidity()){e.target.value=l[key];say('Enter a value within the displayed limits.');}}});
$('loads').addEventListener('click',e=>{const id=e.target.dataset.remove;if(id&&state.loads.length>1){state.loads=state.loads.filter(l=>l.id!==id);makeControls();update();}});
$('addLoad').addEventListener('click',()=>{if(state.loads.length>=6)return;let id;do{id='load'+(++idCounter)}while(state.loads.some(l=>l.id===id));state.loads.push({id,name:'Auxiliary Load',r:500,target:3,fault:'normal'});makeControls();update();});
$('topology').addEventListener('change',()=>{state.topology=$('topology').value;update();});
$('breaker').addEventListener('click',()=>{closed=!closed;tripped=false;update();});
$('protection').addEventListener('change',()=>{state.protection=$('protection').checked;update();});
$('tripLimit').addEventListener('change',()=>{if(!$('tripLimit').checkValidity()||!$('tripLimit').value){$('tripLimit').value=state.tripLimit;return;}state.tripLimit=+$('tripLimit').value;update();});
$('reset').addEventListener('click',()=>{restore(defaults);$('preset').value='default';say('Default station restored.');});
$('applyPreset').addEventListener('click',()=>{const s=copy(defaults),preset=$('preset').value;if(preset==='balanced'){s.emf=12;s.loads[2].r=350;}if(preset==='weak'){s.emf=6;s.internalR=25;}if(preset==='wire')s.wireR=100;if(preset==='overload'){s.topology='parallel';s.loads.forEach(l=>l.r=10);s.tripLimit=.15;}restore(s);say('Scenario loaded. Engage the breaker to run it.');});
$('save').addEventListener('click',()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));say('Configuration saved in this browser.');}catch(e){say('Browser storage is unavailable. Use Export JSON instead.');}});
$('load').addEventListener('click',()=>{try{const raw=localStorage.getItem(STORAGE_KEY);if(!raw){say('No saved configuration yet.');return;}restore(validate(JSON.parse(raw)));say('Saved configuration loaded with the breaker open.');}catch(e){say('Could not load: '+e.message);}});
$('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='orion-circuit.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Configuration exported.');});
$('import').addEventListener('click',()=>$('fileInput').click());
$('fileInput').addEventListener('change',async()=>{const file=$('fileInput').files[0];if(!file)return;try{if(file.size>100000)throw Error('Configuration file is too large.');restore(validate(JSON.parse(await file.text())));say('Configuration imported with the breaker open.');}catch(e){say('Could not import: '+e.message);}finally{$('fileInput').value='';}});
for(const id of ['meterMode','redProbe','blackProbe','meterComponent'])$(id).addEventListener('change',()=>{updateMeter();drawCircuit();});
$('pause').addEventListener('click',()=>{paused=!paused;$('pause').textContent=paused?'Resume animation':'Pause animation';});
const hints={balance:'Adjust the source and load resistances. Each normal load needs at least 85% of its target voltage. Keep wire and internal losses small.',parallel:'Switch to parallel, keep every load normal and online, and limit the supply current to 0.10 A.',fault:'Use parallel mode and set exactly one load to an open fault. Keep at least two loads; all remaining loads must be normal and ONLINE.'};
function challengeHint(){$('challengeHint').textContent=hints[$('challenge').value];$('challengeResult').textContent='';}
$('challenge').addEventListener('change',challengeHint);
$('checkChallenge').addEventListener('click',()=>{const mode=$('challenge').value,normal=result.loads.every(l=>l.fault==='normal'&&l.status==='ONLINE');let pass=closed&&!result.idealShort;if(mode==='balance')pass=pass&&normal&&result.efficiency>=95;if(mode==='parallel')pass=pass&&state.topology==='parallel'&&normal&&result.current<=.1;if(mode==='fault')pass=pass&&state.topology==='parallel'&&state.loads.length>=2&&result.loads.filter(l=>l.fault==='open').length===1&&result.loads.filter(l=>l.fault!=='open').every(l=>l.fault==='normal'&&l.status==='ONLINE');$('challengeResult').textContent=pass?'MISSION COMPLETE — all conditions met.':'Goal not met yet. '+(!closed?'Engage the breaker. ':hints[mode]);$('challengeResult').className='challenge-result '+(pass?'good':'warn');});

// First-order RC/RL lab. Analytical step responses avoid timestep instability.
const energyRuntime={running:false,sourceOn:true,initial:0,q:0,key:'',lastFrame:0};

function energyKey(){return JSON.stringify([state.emf,state.internalR,state.wireR,state.energyLab]);}
function resetEnergyRuntime(){energyRuntime.running=false;energyRuntime.sourceOn=true;energyRuntime.initial=0;energyRuntime.q=0;energyRuntime.lastFrame=0;}
function syncEnergyLab(force=false){
 const key=energyKey();if(!force&&energyRuntime.key===key)return;
 energyRuntime.key=key;resetEnergyRuntime();buildEnergyControls();renderEnergy();
}
function buildEnergyControls(){
 const lab=state.energyLab;$('energyMode').value=lab.mode;$('energyResistance').value=lab.resistance;
 for(const kind of ['capacitor','inductor']){
  const key=kind+'s',values=lab[key],prefix=kind==='capacitor'?'C':'L',unit=kind==='capacitor'?'µF':'mH';
  $(kind+'Connection').value=lab[kind+'Connection'];$('add'+(kind==='capacitor'?'Capacitor':'Inductor')).disabled=values.length>=6;
  $(kind+'List').innerHTML=values.length?values.map((v,i)=>`<div class="energy-component"><div class="row"><label for="${kind}Value${i}">${prefix}${i+1} (${unit})</label><input id="${kind}Value${i}" type="number" required min="0.001" max="1000000" step="any" value="${v}" data-energy-kind="${kind}" data-energy-index="${i}"><button data-energy-remove="${kind}" data-energy-index="${i}" aria-label="Remove ${prefix}${i+1}">Remove</button></div><div id="${kind}Reading${i}" class="hint"></div></div>`).join(''):'<p class="muted">No components yet. Add one to run this experiment.</p>';
 }
}

function renderEnergy(){
 const lab=state.energyLab,p=energyParameters(state),r=energyResponse(p,energyRuntime.initial,energyRuntime.sourceOn,energyRuntime.q),valid=p.equivalent>0;
 $('energyRun').disabled=!valid;$('energyStep').disabled=!valid;$('energySwitch').disabled=!valid;
 $('energyRun').textContent=energyRuntime.running?'Pause transient':energyRuntime.q>=5?'Replay transient':'Start / resume transient';
 $('energySwitch').textContent=energyRuntime.sourceOn?(p.rc?'Source OFF · discharge':'Source OFF · current decay'):'Source ON · energize';
 $('energyStatus').textContent=!valid?'Add a '+p.kind+' to begin.':energyRuntime.running?'Running':energyRuntime.q>=5?'5τ reached · 99.3% of transition complete':energyRuntime.q===0?'Ready · zero elapsed time':'Paused';
 $('energyMetrics').innerHTML=[['Equivalent '+(p.rc?'capacitance':'inductance'),labNumber(p.equivalent*(p.rc?1e6:1e3))+(p.rc?' µF':' mH')],['Time constant τ',valid?labNumber(p.tau)+' s':'—'],['Elapsed since switch',valid?labNumber(energyRuntime.q*p.tau)+' s':'—'],['Bank voltage',labNumber(r.voltage)+' V'],['Bank current',labNumber(r.current)+' A'],['Stored energy',labNumber(r.energy)+' J']].map(([k,v])=>`<div class="metric"><small>${k}</small><b>${v}</b></div>`).join('');
 const formula=p.rc?'τ = R_total × C_eq; V_C = V_final + (V_initial − V_final)e^(−t/τ); I = (V_source − V_C) / R_total; W = ½C_eq V_C²':'τ = L_eq / R_total; I_L = I_final + (I_initial − I_final)e^(−t/τ); V_L = V_source − I_L R_total; W = ½L_eq I_L²';
 $('energyFormula').textContent=formula;
 for(const kind of ['capacitor','inductor']){
  const active=(kind==='capacitor')===p.rc;
  lab[kind+'s'].forEach((value,i)=>{const e=$(kind+'Reading'+i);if(!active||!valid){e.textContent='Select '+(kind==='capacitor'?'RC':'RL')+' mode for component readings.';return;}
   const si=value*(p.rc?1e-6:1e-3),connection=lab[kind+'Connection'];
   const voltage=p.rc?(connection==='parallel'?r.voltage:r.voltage*p.equivalent/si):(connection==='series'?r.voltage*si/p.equivalent:r.voltage);
   const current=p.rc?(connection==='series'?r.current:r.current*si/p.equivalent):(connection==='series'?r.current:r.current*p.equivalent/si);
   const energy=.5*si*(p.rc?voltage*voltage:current*current);
   e.textContent=labNumber(voltage)+' V · '+labNumber(current)+' A · '+labNumber(energy)+' J';
  });
 }
 drawEnergyCircuit(p);drawEnergyPlot('energyVoltagePlot',p,'voltage');drawEnergyPlot('energyCurrentPlot',p,'current');
}
function advanceEnergy(q){energyRuntime.q=Math.min(5,energyRuntime.q+q);if(energyRuntime.q>=5)energyRuntime.running=false;renderEnergy();}
function energyFrame(time){
 if(energyRuntime.running){if(energyRuntime.lastFrame){const dt=Math.min((time-energyRuntime.lastFrame)/1000,.1);advanceEnergy(dt*Number($('energySpeed').value));}energyRuntime.lastFrame=time;}
 else energyRuntime.lastFrame=0;
 requestAnimationFrame(energyFrame);
}
$('openEnergyLab').addEventListener('click',()=>$('energyLab').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
$('energyMode').addEventListener('change',()=>{state.energyLab.mode=$('energyMode').value;syncEnergyLab();});
$('energyResistance').addEventListener('change',()=>{const input=$('energyResistance');if(input.value&&input.checkValidity()){state.energyLab.resistance=Number(input.value);syncEnergyLab();}else input.value=state.energyLab.resistance;});
for(const kind of ['capacitor','inductor']){
 $(kind+'Connection').addEventListener('change',()=>{state.energyLab[kind+'Connection']=$(kind+'Connection').value;syncEnergyLab();});
 $('add'+(kind==='capacitor'?'Capacitor':'Inductor')).addEventListener('click',()=>{if(state.energyLab[kind+'s'].length>=6)return;state.energyLab[kind+'s'].push(100);state.energyLab.mode=kind==='capacitor'?'rc':'rl';syncEnergyLab();});
 $(kind+'List').addEventListener('change',e=>{if(e.target.dataset.energyKind!==kind)return;const i=Number(e.target.dataset.energyIndex);if(e.target.value&&e.target.checkValidity()){state.energyLab[kind+'s'][i]=Number(e.target.value);syncEnergyLab();}else e.target.value=state.energyLab[kind+'s'][i];});
 $(kind+'List').addEventListener('click',e=>{if(e.target.dataset.energyRemove!==kind)return;state.energyLab[kind+'s'].splice(Number(e.target.dataset.energyIndex),1);syncEnergyLab();});
}
$('energyRun').addEventListener('click',()=>{if(energyRuntime.q>=5){resetEnergyRuntime();}energyRuntime.running=!energyRuntime.running;energyRuntime.lastFrame=0;renderEnergy();});
$('energyStep').addEventListener('click',()=>{energyRuntime.running=false;advanceEnergy(.25);});
$('energyReset').addEventListener('click',()=>{resetEnergyRuntime();renderEnergy();});
$('energySwitch').addEventListener('click',()=>{const p=energyParameters(state);energyRuntime.initial=energyResponse(p,energyRuntime.initial,energyRuntime.sourceOn,energyRuntime.q).value;energyRuntime.sourceOn=!energyRuntime.sourceOn;energyRuntime.q=0;energyRuntime.lastFrame=0;renderEnergy();});

// Device experiments are independent analytical models, persisted with the station configuration.

function deviceMetrics(e,r){
 if(e.type==='opamp')return [['Closed-loop gain',labNumber(r.gain)+' V/V'],['Ideal output',labNumber(r.ideal)+' V'],['Actual output',labNumber(r.vout)+' V'],['Load current',labNumber(r.loadCurrent)+' A'],['Load power',labNumber(r.power)+' W'],['Supply rails','±'+e.rail+' V']];
 if(e.type==='transistor')return [['Base current I_B',labNumber(r.ib)+' A'],['Collector current I_C',labNumber(r.ic)+' A'],['Emitter current I_E',labNumber(r.ie)+' A'],['V_CE',labNumber(r.vce)+' V'],['Transistor power',labNumber(r.power)+' W'],['Collector limit',labNumber(r.limit)+' A']];
 return [['Turns ratio N_s/N_p',labNumber(r.ratio)],['Secondary voltage',labNumber(r.vs)+' V RMS'],['Primary current',labNumber(r.ip)+' A RMS'],['Secondary current',labNumber(r.is)+' A RMS'],['Input / output power',labNumber(r.power)+' W'],['Reflected load',labNumber(r.reflected)+' Ω']];
}
function deviceFormula(e,r){
 if(e.type==='opamp')return `Gain = ${e.configuration==='inverting'?'−R_f/R_in':'1 + R_f/R_g'} = ${labNumber(r.gain)}; V_out = clamp(gain × V_in, −V_rail, +V_rail); I_load = V_out/R_load.`;
 if(e.type==='transistor')return 'I_B = max(0, (V_drive − 0.7)/R_B); I_C = min(βI_B, (V_CC − 0.2)/R_C); V_CE = V_CC − I_C R_C; P_Q = V_CE I_C + 0.7 I_B.';
 return 'V_s/V_p = N_s/N_p; I_p/I_s = N_s/N_p; P_in = P_out = V_s I_s; R_reflected = R_load (N_p/N_s)².';
}
function syncWorkbench(){
 const b=state.workbench,storage=b.active==='storage';$('storageExperiments').hidden=!storage;$('deviceExperiments').hidden=storage;
 $('showStorage').setAttribute('aria-pressed',storage);$('showDevices').setAttribute('aria-pressed',!storage);
 if(!storage){energyRuntime.running=false;renderEnergy();}
 $('experimentCount').textContent=b.experiments.length+' / 6 cards';$('addExperiment').disabled=b.experiments.length>=6;
 $('experimentCards').innerHTML=b.experiments.map((e,index)=>{
  const spec=DEVICE_SPECS[e.type];return `<article class="device-card" data-experiment-card="${e.id}"><div class="load-header"><div><span class="eyebrow">Experiment ${index+1}</span><h3>${spec.title}</h3></div><button data-remove-experiment="${e.id}" aria-label="Remove ${spec.title} experiment ${index+1}">Remove</button></div><p class="muted">${spec.description}</p><div class="device-controls">${e.type==='opamp'?`<label>Amplifier configuration<select data-experiment="${e.id}" data-field="configuration"><option value="noninverting" ${e.configuration==='noninverting'?'selected':''}>Non-inverting</option><option value="inverting" ${e.configuration==='inverting'?'selected':''}>Inverting</option></select></label>`:''}${spec.fields.map(([key,label,value,min,max])=>`<label>${label}<input type="number" required step="${e.type==='transformer'&&['np','ns'].includes(key)?'1':'any'}" min="${min}" max="${max}" value="${e[key]}" data-experiment="${e.id}" data-field="${key}"></label>`).join('')}</div><div class="device-result-head"><strong id="deviceStatus-${e.id}"></strong><span class="hint">Updates as you adjust values</span></div><div class="device-visuals"><div class="device-schematic"><svg id="deviceDiagram-${e.id}" viewBox="0 0 640 320" role="img"></svg></div><svg id="devicePlot-${e.id}" class="lab-chart" viewBox="0 0 600 300" role="img"></svg></div><p class="hint">On small screens, scroll the circuit diagram sideways to inspect all connections.</p><div class="device-metrics" id="deviceMetrics-${e.id}"></div><p id="deviceFormula-${e.id}" class="equations lab-formula"></p><details><summary>Model assumptions &amp; what to try</summary><p class="muted pad">${spec.note}</p></details></article>`;
 }).join('');$('deviceEmpty').hidden=b.experiments.length>0;
 for(const e of b.experiments)renderDevice(e);
}
function renderDevice(e){const r=calculateDevice(e),status=$('deviceStatus-'+e.id);status.textContent=r.status;status.className=r.status==='OUTPUT CLIPPED'||r.status==='SATURATION'?'warn':r.status==='CUTOFF'?'muted':'good';$('deviceMetrics-'+e.id).innerHTML=deviceMetrics(e,r).map(([label,value])=>`<div class="metric"><small>${label}</small><b>${value}</b></div>`).join('');$('deviceFormula-'+e.id).textContent=deviceFormula(e,r);drawDeviceDiagram(e,r);drawDevicePlot(e,r);}

$('showStorage').addEventListener('click',()=>{state.workbench.active='storage';syncWorkbench();});
$('showDevices').addEventListener('click',()=>{state.workbench.active='devices';syncWorkbench();});
$('addExperiment').addEventListener('click',()=>{const b=state.workbench;if(b.experiments.length>=6)return;let n=1;while(b.experiments.some(e=>e.id==='exp'+n))n++;b.experiments.push(newExperiment($('experimentType').value,'exp'+n));b.active='devices';syncWorkbench();});
$('experimentCards').addEventListener('click',event=>{const id=event.target.dataset.removeExperiment;if(!id)return;state.workbench.experiments=state.workbench.experiments.filter(e=>e.id!==id);syncWorkbench();});
$('experimentCards').addEventListener('input',event=>{const {experiment,field}=event.target.dataset;if(!experiment||!field)return;const e=state.workbench.experiments.find(e=>e.id===experiment);if(field==='configuration')e.configuration=event.target.value;else {if(!event.target.value||!event.target.checkValidity())return;e[field]=Number(event.target.value);}renderDevice(e);});
$('experimentCards').addEventListener('change',event=>{const {experiment,field}=event.target.dataset;if(!experiment||!field)return;const e=state.workbench.experiments.find(e=>e.id===experiment);if(!event.target.value||!event.target.checkValidity())event.target.value=e[field];});

const {drawCircuit,animate,drawEnergyCircuit,drawEnergyPlot,drawDeviceDiagram,drawDevicePlot}=createRenderer({
 get state(){return state;},get result(){return result;},get closed(){return closed;},
 get paused(){return paused;},get tripped(){return tripped;},get energyRuntime(){return energyRuntime;},updateMeter
});

makeControls();update();challengeHint();requestAnimationFrame(animate);requestAnimationFrame(energyFrame);syncWorkbench();
