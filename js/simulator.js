// Pure analytical teaching models; inputs and outputs contain no DOM objects.
import { equivalentResistance } from './circuit.js';

export function calculateCircuit(s,on){
 const resistances=s.loads.map(l=>l.fault==='open'?Infinity:l.fault==='short'?0:l.r);
 const req=equivalentResistance(resistances,s.topology);
 const sourceR=s.internalR+s.wireR,rt=sourceR+req,idealShort=on&&rt===0;
 const current=on?(rt===0?Infinity:Number.isFinite(rt)?s.emf/rt:0):0;
 const active=on&&!idealShort,terminal=idealShort?NaN:s.emf-current*s.internalR;
 const loadV=active?(Number.isFinite(req)?current*req:s.emf):0;
 const loads=s.loads.map((l,i)=>{
  let c=0,v=0;
  if(active){
   if(s.topology==='series'){c=current;v=Number.isFinite(resistances[i])?c*resistances[i]:resistances.filter(r=>r===Infinity).length===1?s.emf:NaN;}
   else {v=loadV;c=resistances[i]===0?NaN:Number.isFinite(resistances[i])?v/resistances[i]:0;}
  }
  const power=l.fault==='normal'?c*c*l.r:0;
  let status=!on?'OFFLINE':idealShort?'IDEAL SHORT':l.fault==='open'?'OPEN FAULT':l.fault==='short'?'SHORTED':v>=.85*l.target?'ONLINE':v>=.55*l.target?'LIMITED':'CRITICAL';
  return {...l,resistance:resistances[i],current:c,voltage:v,power,status};
 });
 // A zero-ohm parallel branch takes all finite supply current; the split is undefined for multiple shorts.
 const shortLoads=loads.filter(l=>l.fault==='short');
 if(active&&s.topology==='parallel'&&shortLoads.length){for(const l of shortLoads)l.current=shortLoads.length===1?current:NaN;}
 const loadPower=loads.reduce((p,l)=>p+l.power,0),batteryLoss=idealShort?NaN:current*current*s.internalR,wireLoss=idealShort?NaN:current*current*s.wireR,inputPower=s.emf*current;
 return {req,rt,current,terminal,loadV,loads,loadPower,batteryLoss,wireLoss,inputPower,efficiency:inputPower>0&&Number.isFinite(inputPower)?100*loadPower/inputPower:0,idealShort};
}

export function energyResponse(p,initial,sourceOn,q){
 if(!p.equivalent)return {value:0,voltage:0,current:0,energy:0,target:0};
 const target=sourceOn?(p.rc?p.emf:p.emf/p.resistance):0;
 const value=target+(initial-target)*Math.exp(-Math.max(0,q));
 const voltage=p.rc?value:(sourceOn?p.emf:0)-value*p.resistance;
 const current=p.rc?((sourceOn?p.emf:0)-value)/p.resistance:value;
 return {value,voltage,current,energy:.5*p.equivalent*value*value,target};
}

export function calculateDevice(e){
 if(e.type==='opamp'){
  const gain=e.configuration==='inverting'?-e.rf/e.rin:1+e.rf/e.rin,ideal=gain*e.vin,vout=Math.max(-e.rail,Math.min(e.rail,ideal));
  return {gain,ideal,vout,loadCurrent:vout/e.load,power:vout*vout/e.load,status:Math.abs(ideal)>=e.rail?'OUTPUT CLIPPED':'LINEAR OPERATION'};
 }
 if(e.type==='transistor'){
  const ib=Math.max(0,(e.drive-.7)/e.rb),limit=(e.supply-.2)/e.rc,ic=Math.min(e.beta*ib,limit),vce=e.supply-ic*e.rc;
  return {ib,ic,vce,ie:ib+ic,power:vce*ic+.7*ib,limit,status:ib===0?'CUTOFF':e.beta*ib>=limit?'SATURATION':'FORWARD ACTIVE'};
 }
 const ratio=e.ns/e.np,vs=e.vp*ratio,is=vs/e.load,ip=is*ratio;
 return {ratio,vs,is,ip,power:vs*is,inputPower:e.vp*ip,reflected:e.load/(ratio*ratio),status:ratio>1?'STEP-UP':ratio<1?'STEP-DOWN':'1:1 ISOLATION'};
}
