import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, newExperiment, validate } from '../js/components.js';
import { equivalentResistance, equivalentStorage, energyParameters, nodeVoltages } from '../js/circuit.js';
import { calculateCircuit, energyResponse, calculateDevice } from '../js/simulator.js';
const copy=x=>structuredClone(x);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<=1e-10*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);

test('series/parallel equivalents, open branches, shorts, and storage units',()=>{
 near(equivalentResistance([100,200],'series'),300);
 near(equivalentResistance([100,200],'parallel'),200/3);
 assert.equal(equivalentResistance([Infinity,Infinity],'parallel'),Infinity);
 assert.equal(equivalentResistance([100,0],'parallel'),0);
 assert.equal(equivalentResistance([100,Infinity],'series'),Infinity);
 for(const [kind,unit,add] of [['capacitor',1e-6,'parallel'],['inductor',1e-3,'series']]){
  near(equivalentStorage([100,200],kind,add),300*unit);
  near(equivalentStorage([100,200],kind,add==='series'?'parallel':'series'),200/3*unit);
  assert.equal(equivalentStorage([],kind,add),0);
 }
});
for(const topology of ['series','parallel'])test(`${topology}: Ohm's law, power balance, meter nodes and breaker open`,()=>{
 const s={...copy(defaults),topology},r=calculateCircuit(s,true);
 near(r.inputPower,r.loadPower+r.batteryLoss+r.wireLoss);
 near(r.current,s.emf/r.rt);
 for(const l of r.loads){near(l.voltage,l.current*l.r);near(l.power,l.voltage*l.current);}
 const nodes=nodeVoltages(s,r);near(nodes.T,s.emf-r.current*s.internalR);
 if(topology==='parallel'){near(nodes.B-nodes.A,r.loadV);near(r.current,r.loads.reduce((a,l)=>a+l.current,0));}
 else near(nodes.N3-nodes.N0,r.loadV);
 const off=calculateCircuit(s,false);assert.equal(off.current,0);assert.equal(off.loadPower,0);assert.ok(off.loads.every(l=>l.status==='OFFLINE'));
});
test('faults: open isolation, finite short current, multiple shorts and ideal short',()=>{
 const s=copy(defaults);s.topology='parallel';s.loads[0].fault='open';
 let r=calculateCircuit(s,true);assert.equal(r.loads[0].current,0);assert.ok(r.loads[1].current>0);
 s.loads[0].fault='short';r=calculateCircuit(s,true);near(r.current,s.emf/(s.internalR+s.wireR));near(r.loads[0].current,r.current);
 s.loads[1].fault='short';assert.ok(Number.isNaN(calculateCircuit(s,true).loads[0].current));
 s.internalR=0;s.wireR=0;r=calculateCircuit(s,true);assert.equal(r.idealShort,true);assert.equal(r.current,Infinity);
 s.topology='series';s.loads[0].fault='open';assert.equal(calculateCircuit(s,true).current,0);
});
for(const mode of ['rc','rl'])test(`${mode}: time constant, step response, switching continuity and energy`,()=>{
 const s=copy(defaults);s.energyLab.mode=mode;const p=energyParameters(s),rc=mode==='rc';
 near(p.tau,rc?p.resistance*p.equivalent:p.equivalent/p.resistance);
 const start=energyResponse(p,0,true,0),one=energyResponse(p,0,true,1),end=energyResponse(p,0,true,50);
 assert.equal(start.value,0);near(one.value,one.target*(1-Math.exp(-1)));near(end.value,end.target);
 near(one.energy,.5*p.equivalent*one.value**2);
 const switched=energyResponse(p,one.value,false,0);near(switched.value,one.value);
 near(energyResponse(p,one.value,false,1).value,one.value/Math.E);
 if(rc){near(start.current,p.emf/p.resistance);assert.ok(switched.current<0);}else{near(start.voltage,p.emf);assert.ok(switched.voltage<0);}
 s.energyLab[rc?'capacitors':'inductors']=[];assert.equal(energyParameters(s).tau,0);assert.equal(energyResponse(energyParameters(s),0,true,1).energy,0);
});
test('op-amp gain, signed load current, both rail clips and clipping boundary',()=>{
 const e=newExperiment('opamp','exp1');let r=calculateDevice(e);near(r.gain,11);near(r.vout,5.5);assert.equal(r.status,'LINEAR OPERATION');
 e.vin=2;assert.equal(calculateDevice(e).vout,12);assert.equal(calculateDevice(e).status,'OUTPUT CLIPPED');
 e.vin=-2;assert.equal(calculateDevice(e).vout,-12);
 e.configuration='inverting';e.vin=.5;r=calculateDevice(e);near(r.gain,-10);near(r.vout,-5);near(r.loadCurrent,-.005);near(r.power,.025);
 e.vin=1.2;assert.equal(calculateDevice(e).status,'OUTPUT CLIPPED');
});
test('NPN cutoff, forward active and saturation',()=>{
 const e=newExperiment('transistor','exp1');e.drive=.7;let r=calculateDevice(e);assert.equal(r.status,'CUTOFF');assert.equal(r.ic,0);near(r.vce,e.supply);
 e.drive=.8;r=calculateDevice(e);assert.equal(r.status,'FORWARD ACTIVE');near(r.ic,e.beta*r.ib);near(r.ie,r.ib+r.ic);
 e.drive=5;e.rb=100;r=calculateDevice(e);assert.equal(r.status,'SATURATION');near(r.vce,.2);near(r.ic,(e.supply-.2)/e.rc);
});
test('transformer step up/down/isolation ratios, reflected load and conserved RMS power',()=>{
 for(const ns of [50,100,200]){const e={...newExperiment('transformer','exp1'),ns},r=calculateDevice(e);near(r.vs/e.vp,ns/e.np);near(r.ip/r.is,ns/e.np);near(r.inputPower,r.power);near(r.reflected,e.load/(ns/e.np)**2);assert.equal(r.status,ns>100?'STEP-UP':ns<100?'STEP-DOWN':'1:1 ISOLATION');}
});
test('configuration round trip and legacy v2 saves without optional labs',()=>{
 const s=copy(defaults);s.workbench.experiments=['opamp','transistor','transformer'].map((type,i)=>newExperiment(type,'exp'+i));
 assert.deepEqual(validate(JSON.parse(JSON.stringify(s))),s);
 delete s.energyLab;delete s.workbench;const clean=validate(s);assert.deepEqual(clean.energyLab,defaults.energyLab);assert.deepEqual(clean.workbench,defaults.workbench);
 clean.energyLab.capacitors.push(200);assert.deepEqual(defaults.energyLab.capacitors,[100]);
});
test('invalid imported source/load/storage/device configurations are rejected',()=>{
 const cases=[s=>s.version=1,s=>s.topology='mixed',s=>s.protection='true',s=>s.emf=Infinity,s=>s.wireR=-1,s=>s.tripLimit=0,s=>s.loads=[],s=>s.loads[0].r=0,s=>s.loads[0].name=' ',s=>s.loads[0].fault='broken',s=>s.loads[0].id='source',s=>s.loads[1].id=s.loads[0].id,s=>s.energyLab=null,s=>s.energyLab.capacitors=[NaN],s=>s.energyLab.inductors=Array(7).fill(1),s=>s.energyLab.capacitorConnection='mixed',s=>s.workbench.active='bad',s=>s.workbench.experiments=[{id:'exp1',type:'unknown'}],s=>{const e=newExperiment('transformer','exp1');e.np=1.5;s.workbench.experiments=[e];},s=>{const e=newExperiment('opamp','exp1');e.configuration='buffer';s.workbench.experiments=[e];},s=>{const e=newExperiment('transistor','exp1');s.workbench.experiments=[e,e];}];
 for(const mutate of cases){const s=copy(defaults);mutate(s);assert.throws(()=>validate(s));}
 for(const raw of [null,{},[], 'bad'])assert.throws(()=>validate(raw));
});
