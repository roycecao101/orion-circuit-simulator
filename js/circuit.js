// Connection and equivalent-value helpers. Storage values use µF / mH at the boundary.
export function equivalentResistance(resistances, topology){
 if(topology==='series')return resistances.reduce((a,b)=>a+b,0);
 return resistances.includes(0)?0:1/resistances.reduce((a,r)=>a+(Number.isFinite(r)?1/r:0),0);
}

export function equivalentStorage(values,kind,connection){
 if(!values.length)return 0;
 const si=values.map(v=>v*(kind==='capacitor'?1e-6:1e-3));
 const add=kind==='capacitor'?connection==='parallel':connection==='series';
 return add?si.reduce((a,b)=>a+b,0):1/si.reduce((a,b)=>a+1/b,0);
}

export function energyParameters(s){
 const lab=s.energyLab,rc=lab.mode==='rc',kind=rc?'capacitor':'inductor';
 const equivalent=equivalentStorage(rc?lab.capacitors:lab.inductors,kind,rc?lab.capacitorConnection:lab.inductorConnection);
 const resistance=lab.resistance+s.internalR+s.wireR;
 return {rc,kind,equivalent,resistance,emf:s.emf,tau:equivalent?(rc?resistance*equivalent:equivalent/resistance):0};
}

export function nodeVoltages(state,result){
 const r=result,n=state.loads.length,v={G:0,T:r.terminal};
 if(state.topology==='parallel'){v.A=Number.isFinite(r.current)?r.current*state.wireR/2:NaN;v.B=v.A+r.loadV;}
 else {let voltage=Number.isFinite(r.current)?r.current*state.wireR/2:NaN;v.N0=voltage;for(let i=0;i<n;i++){voltage+=r.loads[i].voltage;v['N'+(i+1)]=voltage;}}
 return v;
}
