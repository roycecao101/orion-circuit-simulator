import { DEVICE_SPECS } from './components.js';
import { calculateDevice, energyResponse } from './simulator.js';
export const fmt=(n,d=4)=>Number.isFinite(n)?n.toFixed(d):n===Infinity?'∞':'—';
export function labNumber(n){if(n===0)return '0';return Math.abs(n)<.001||Math.abs(n)>=10000?n.toExponential(3):Number(n.toPrecision(5)).toString();}

// app.js supplies live state and the meter callback; no import back to app.js.
export function createRenderer(context){
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
let paths=[],phase=0,lastTime=0,nextProbe='red';
function elem(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}

function drawCircuit(){
 const n=context.state.loads.length,h=Math.max(390,160+n*76),w=800;
 $('circuit').setAttribute('viewBox',`0 0 ${w} ${h}`);
 const g=$('drawing');g.replaceChildren();paths=[];
 const add=(tag,a,t)=>{const e=elem(tag,a,t);g.append(e);return e;};
 const wire=(x1,y1,x2,y2)=>add('line',{x1,y1,x2,y2,class:'wire'});
 const label=(x,y,t,small=false)=>add('text',{x,y,class:small?'svg-small':'svg-label','text-anchor':'middle'},t);
 const node=(x,y,key)=>{const color=$('redProbe').value===key?'#f87171':$('blackProbe').value===key?'#facc15':'#e0f2fe';const e=add('circle',{cx:x,cy:y,r:6,class:'node',fill:color,style:`fill:${color}`,tabindex:0,role:'button','aria-label':`Measure at node ${key}`});const choose=()=>{$(nextProbe==='red'?'redProbe':'blackProbe').value=key;nextProbe=nextProbe==='red'?'black':'red';context.updateMeter();drawCircuit();};e.addEventListener('click',choose);e.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();choose();}});label(x,y-13,key,true);};
 const resistor=(x1,y,x2,l,i)=>{const mid=(x1+x2)/2;wire(x1,y,mid-28,y);wire(mid+28,y,x2,y);
  if(l.fault==='open'){add('circle',{cx:mid-16,cy:y,r:4,class:'component'});add('circle',{cx:mid+16,cy:y,r:4,class:'component'});wire(mid-28,y,mid-16,y);wire(mid+16,y,mid+28,y);}
  else if(l.fault==='short')wire(mid-28,y,mid+28,y);
  else add('rect',{x:mid-28,y:y-10,width:56,height:20,rx:3,class:'component'});
  label(mid,y-27,`R${i+1} · ${l.name.length>19?l.name.slice(0,17)+'…':l.name}`);label(mid,y+30,`${l.fault==='normal'?l.r+' Ω':l.fault.toUpperCase()} · ${fmt(context.result.loads[i].voltage,2)} V`,true);
 };
 const top=85,bottom=h-60;
 wire(80,top,80,(top+bottom)/2-25);wire(80,(top+bottom)/2+25,80,bottom);
 add('line',{x1:55,y1:(top+bottom)/2-25,x2:105,y2:(top+bottom)/2-25,class:'component'});add('line',{x1:66,y1:(top+bottom)/2+25,x2:94,y2:(top+bottom)/2+25,class:'component'});label(80,(top+bottom)/2+5,`${context.state.emf} V`);label(80,bottom+32,'REACTOR');
 wire(80,top,110,top);add('rect',{x:110,y:top-10,width:60,height:20,rx:3,class:'component'});label(140,top-24,`r ${context.state.internalR} Ω`,true);wire(170,top,225,top);
 add('line',{x1:225,y1:top,x2:280,y2:context.closed?top:top-24,class:'component'});wire(280,top,290,top);label(250,top-36,context.tripped?'TRIPPED':'BREAKER',true);
 wire(290,top,330,top);add('rect',{x:330,y:top-10,width:60,height:20,rx:3,class:'component'});label(360,top-24,`wire ${fmt(context.state.wireR/2,2)} Ω`,true);wire(390,top,450,top);
 wire(80,bottom,270,bottom);add('rect',{x:270,y:bottom-10,width:60,height:20,rx:3,class:'component'});label(300,bottom+30,`return wire ${fmt(context.state.wireR/2,2)} Ω`,true);node(110,bottom,'G');node(195,top,'T');
 if(context.state.topology==='series'){
  wire(450,top,745,top);wire(745,top,745,140);
  const points=[[80,top],[745,top],[745,140]];
  for(let i=0;i<n;i++){
   const y=140+i*76,start=i%2===0?745:450,end=i%2===0?450:745,index=n-1-i;
   resistor(450,y,745,context.state.loads[index],index);node(start,y,'N'+(n-i));
   points.push([end,y]);
   if(i<n-1){wire(end,y,end,y+76);points.push([end,y+76]);}
   else {node(end,y,'N0');wire(end,y,end,bottom);wire(end,bottom,330,bottom);points.push([end,bottom],[80,bottom],[80,top]);}
  }
  paths.push({points,current:context.result.current,active:context.closed&&!context.result.idealShort&&context.result.current>0});
 }else{
  const right=745;wire(450,top,right,top);wire(right,top,right,bottom);wire(450,top,450,bottom);wire(330,bottom,450,bottom);node(right,top,'B');node(450,bottom,'A');
  for(let i=0;i<n;i++){const y=140+i*76;resistor(450,y,right,context.state.loads[i],i);paths.push({points:[[right,y],[450,y]],current:context.result.loads[i].current,active:context.closed&&context.state.loads[i].fault!=='open'&&Number.isFinite(context.result.loads[i].current)&&context.result.loads[i].current>0});}
  const pushFlow=(points,current)=>paths.push({points,current,active:context.closed&&!context.result.idealShort&&Number.isFinite(current)&&current>0});
  pushFlow([[80,top],[right,top],[right,140]],context.result.current);
  for(let i=0;i<n-1;i++){
   const y=140+i*76;
   const upper=context.result.loads.slice(0,i+1).reduce((sum,l)=>sum+l.current,0),lower=context.result.loads.slice(i+1).reduce((sum,l)=>sum+l.current,0);
   pushFlow([[right,y],[right,y+76]],lower);pushFlow([[450,y],[450,y+76]],upper);
  }
  pushFlow([[450,140+(n-1)*76],[450,bottom],[80,bottom],[80,top]],context.result.current);

 }
 $('particles').replaceChildren();for(const path of paths){path.length=0;path.segments=[];for(let j=1;j<path.points.length;j++){const a=path.points[j-1],b=path.points[j],length=Math.hypot(b[0]-a[0],b[1]-a[1]);path.segments.push({a,b,length});path.length+=length;}path.circles=[];if(path.active)for(let i=0;i<Math.max(3,Math.floor(path.length/55));i++){const c=elem('circle',{r:3,class:'particle'});$('particles').append(c);path.circles.push(c);}}
}

function animate(time){const dt=lastTime?Math.min((time-lastTime)/1000,.05):0;lastTime=time;if(!context.paused&&!matchMedia('(prefers-reduced-motion: reduce)').matches)phase+=dt;const sign=$('flow').value==='electron'?-1:1;for(const p of paths){const speed=30+Math.min(p.current*1100,180);for(let i=0;i<p.circles.length;i++){let d=((sign*phase*speed+i*p.length/p.circles.length)%p.length+p.length)%p.length;for(const s of p.segments){if(d<=s.length){const t=d/s.length;p.circles[i].setAttribute('cx',s.a[0]+(s.b[0]-s.a[0])*t);p.circles[i].setAttribute('cy',s.a[1]+(s.b[1]-s.a[1])*t);break;}d-=s.length;}}}requestAnimationFrame(animate);}

function drawEnergyCircuit(p){
 const svg=$('energyCircuit');svg.replaceChildren();
 const add=(tag,a,t)=>{const e=elem(tag,a,t);svg.append(e);return e;};
 const wire=(x1,y1,x2,y2)=>add('line',{x1,y1,x2,y2,class:'wire'}),text=(x,y,t)=>add('text',{x,y,class:'svg-small','text-anchor':'middle'},t);
 wire(80,65,250,65);add('rect',{x:250,y:55,width:100,height:20,rx:3,class:'component'});wire(350,65,520,65);wire(520,65,520,112);wire(520,158,520,205);wire(520,205,80,205);wire(80,205,80,160);wire(80,110,80,65);
 add('circle',{cx:80,cy:135,r:25,class:'component'});text(80,139,context.energyRuntime.sourceOn?context.state.emf+' V':'0 V');
 text(300,43,`R total = ${labNumber(p.resistance)} Ω`);text(300,94,`test ${context.state.energyLab.resistance} + internal ${context.state.internalR} + wire ${context.state.wireR} Ω`);
 if(p.rc){add('line',{x1:494,y1:122,x2:546,y2:122,class:'component'});add('line',{x1:494,y1:148,x2:546,y2:148,class:'component'});wire(520,112,520,122);wire(520,148,520,158);}
 else {add('path',{d:'M520 112 Q490 112 490 120 Q490 128 520 128 Q490 128 490 136 Q490 144 520 144 Q490 144 490 151 Q490 158 520 158',class:'component',style:'fill:none'});}
 text(402,139,p.rc?'C equivalent':'L equivalent');text(402,158,labNumber(p.equivalent*(p.rc?1e6:1e3))+(p.rc?' µF':' mH'));
 text(230,230,context.energyRuntime.sourceOn?'Source ON · energy builds up':'Source OFF · closed decay loop');text(80,87,context.energyRuntime.sourceOn?'+':'');
 svg.setAttribute('aria-label',`${p.rc?'RC':'RL'} test circuit with ${p.resistance} ohms total resistance and ${labNumber(p.equivalent)} ${p.rc?'farads':'henries'} equivalent storage`);
}

function drawEnergyPlot(id,p,property){
 const svg=$(id);svg.replaceChildren();
 const add=(tag,a,t)=>{const e=elem(tag,a,t);svg.append(e);return e;};
 const current=property==='current',scale=current?p.emf/p.resistance:p.emf,color=current?'#facc15':'#67e8f9';
 const x=q=>84+q/5*492,y=v=>115-v/scale*65;
 add('text',{x:18,y:22,class:'svg-label'},current?'Bank current (A)':'Bank voltage (V)');
 for(const n of [-1,0,1]){const v=n*scale;add('line',{x1:84,y1:y(v),x2:576,y2:y(v),stroke:'#28415b','stroke-width':1});add('text',{x:76,y:y(v)+4,class:'svg-small','text-anchor':'end'},labNumber(v));}
 for(let q=0;q<=5;q++){add('text',{x:x(q),y:207,class:'svg-small','text-anchor':'middle'},q+'τ');}
 if(p.equivalent){let d='';for(let k=0;k<=160;k++){const q=k/32,v=energyResponse(p,context.energyRuntime.initial,context.energyRuntime.sourceOn,q)[property];d+=(k?' L':'M')+x(q).toFixed(2)+' '+y(v).toFixed(2);}add('path',{d,stroke:color,'stroke-width':2.5,fill:'none'});
 const r=energyResponse(p,context.energyRuntime.initial,context.energyRuntime.sourceOn,context.energyRuntime.q);add('line',{x1:x(context.energyRuntime.q),y1:40,x2:x(context.energyRuntime.q),y2:194,stroke:'#e6f4ff','stroke-dasharray':'4 4'});add('circle',{cx:x(context.energyRuntime.q),cy:y(r[property]),r:4,fill:color});}
 svg.setAttribute('aria-label',`${current?'Bank current in amperes':'Bank voltage in volts'} versus time from zero to five time constants`);
}

function drawDeviceDiagram(e,r){
 const svg=$('deviceDiagram-'+e.id);svg.replaceChildren();svg.setAttribute('aria-label',DEVICE_SPECS[e.type].title+' experiment circuit');
 const a=(tag,attr,t)=>{const el=elem(tag,attr,t);svg.append(el);return el;};
 const line=(x1,y1,x2,y2)=>a('line',{x1,y1,x2,y2,class:'wire'}),text=(x,y,t)=>a('text',{x,y,class:'svg-small','text-anchor':'middle'},t),ground=(x,y)=>{line(x,y,x,y+10);for(let i=0;i<3;i++)a('line',{x1:x-12+i*4,y1:y+10+i*5,x2:x+12-i*4,y2:y+10+i*5,class:'component'});};
 const resistor=(x,y,w,h,label)=>{a('rect',{x,y,width:w,height:h,class:'component',rx:2});text(x+w/2,y-10,label);};
 if(e.type==='opamp'){
  const inv=e.configuration==='inverting';
  a('path',{d:'M280 90 L280 230 L410 160 Z',class:'component'});text(295,133,inv?'−':'+');text(295,193,inv?'+':'−');line(410,160,550,160);text(510,140,'Vout '+labNumber(r.vout)+' V');
  if(inv){line(450,160,450,60);line(450,60,360,60);resistor(300,50,60,20,'Rf '+e.rf+' Ω');line(300,60,230,60);line(230,60,230,130);line(230,130,280,130);line(35,130,100,130);resistor(100,120,90,20,'Rin '+e.rin+' Ω');line(190,130,230,130);line(280,190,230,190);line(230,190,230,270);ground(230,270);text(46,112,'Vin '+e.vin+' V');}
  else {line(450,160,450,260);line(450,260,360,260);resistor(300,250,60,20,'Rf '+e.rf+' Ω');line(300,260,230,260);line(230,260,230,190);line(230,190,280,190);line(35,130,280,130);text(74,111,'Vin '+e.vin+' V');line(230,190,190,190);line(190,190,190,205);resistor(180,205,20,40,'Rg');line(190,245,190,270);ground(190,270);text(147,241,e.rin+' Ω');}
  line(340,122,340,88);text(381,88,'+'+e.rail+' V');line(340,198,340,220);text(381,220,'−'+e.rail+' V');line(510,160,510,210);resistor(500,210,20,40,'Rload');line(510,250,510,270);ground(510,270);text(570,241,e.load+' Ω');
 }else if(e.type==='transistor'){
  line(320,40,320,65);resistor(310,65,20,45,'Rc '+e.rc+' Ω');line(320,110,320,150);text(384,42,'Vcc '+e.supply+' V');a('circle',{cx:290,cy:185,r:48,class:'component',style:'fill:none'});a('line',{x1:274,y1:160,x2:274,y2:210,class:'component'});line(274,170,320,150);line(274,200,320,230);line(320,230,320,270);ground(320,270);line(40,185,100,185);resistor(100,175,85,20,'Rb '+e.rb+' Ω');line(185,185,274,185);text(64,223,'Drive '+e.drive+' V');text(367,162,'C');text(253,153,'B');text(351,241,'E');a('path',{d:'M304 207 L315 227 L293 221 Z',fill:'#e6f4ff'});text(459,189,'Vce '+labNumber(r.vce)+' V');text(459,215,r.status);
 }else{
  a('circle',{cx:85,cy:160,r:34,class:'component'});text(85,165,'~ AC');line(85,126,85,70);line(85,70,245,70);line(245,70,245,110);line(85,194,85,260);line(85,260,245,260);line(245,260,245,210);
  let coil='M245 110';for(let j=0;j<4;j++){const y=110+j*25;coil+=` C285 ${y} 285 ${y+25} 245 ${y+25}`;}a('path',{d:coil,class:'component',style:'fill:none'});a('line',{x1:300,y1:95,x2:300,y2:225,class:'component'});a('line',{x1:312,y1:95,x2:312,y2:225,class:'component'});
  coil='M365 110';for(let j=0;j<4;j++){const y=110+j*25;coil+=` C325 ${y} 325 ${y+25} 365 ${y+25}`;}a('path',{d:coil,class:'component',style:'fill:none'});line(365,110,365,70);line(365,70,535,70);line(365,210,365,260);line(365,260,535,260);line(535,70,535,125);resistor(525,125,20,70,'Rload');line(535,195,535,260);text(156,45,e.vp+' V RMS · '+e.frequency+' Hz');text(240,293,'Np '+e.np);text(370,293,'Ns '+e.ns);text(454,45,labNumber(r.vs)+' V RMS');text(580,170,e.load+' Ω');
 }
}

function drawDevicePlot(e,r){
 const svg=$('devicePlot-'+e.id);svg.replaceChildren();const a=(tag,attr,t)=>{const el=elem(tag,attr,t);svg.append(el);return el;};
 let xmin,xmax,ymin,ymax,xlabel,ylabel,curves,marker;
 if(e.type==='opamp'){const span=Math.max(1,Math.abs(e.vin)*1.2,e.rail/Math.max(1,Math.abs(r.gain))*1.2);xmin=-span;xmax=span;ymin=-e.rail*1.1;ymax=e.rail*1.1;xlabel='Input voltage (V)';ylabel='Output voltage (V)';curves=[{color:'#67e8f9',f:x=>calculateDevice({...e,vin:x}).vout}];marker=[e.vin,r.vout];}
 else if(e.type==='transistor'){xmin=0;xmax=5;ymin=0;ymax=r.limit*1.1;xlabel='Base drive (V)';ylabel='Collector current (A)';curves=[{color:'#67e8f9',f:x=>calculateDevice({...e,drive:x}).ic}];marker=[e.drive,r.ic];}
 else {xmin=0;xmax=2/e.frequency;ymax=Math.SQRT2*Math.max(e.vp,r.vs)*1.1;ymin=-ymax;xlabel='Time (s) · primary cyan / secondary yellow';ylabel='Instantaneous voltage (V)';curves=[{color:'#67e8f9',f:t=>Math.SQRT2*e.vp*Math.sin(2*Math.PI*e.frequency*t)},{color:'#facc15',f:t=>Math.SQRT2*r.vs*Math.sin(2*Math.PI*e.frequency*t)}];}
 const X=x=>85+(x-xmin)/(xmax-xmin)*490,Y=y=>225-(y-ymin)/(ymax-ymin)*175;
 a('text',{x:18,y:25,class:'svg-label'},ylabel);a('text',{x:330,y:286,class:'svg-small','text-anchor':'middle'},xlabel);
 for(let j=0;j<=4;j++){const y=ymin+(ymax-ymin)*j/4,x=xmin+(xmax-xmin)*j/4;a('line',{x1:85,y1:Y(y),x2:575,y2:Y(y),stroke:'#28415b'});a('text',{x:77,y:Y(y)+4,class:'svg-small','text-anchor':'end'},Number(y.toPrecision(3)).toString());a('text',{x:X(x),y:250,class:'svg-small','text-anchor':'middle'},Number(x.toPrecision(3)).toString());}
 if(ymin<0)a('line',{x1:85,y1:Y(0),x2:575,y2:Y(0),stroke:'#67839e'});
 for(const curve of curves){let d='';for(let j=0;j<=200;j++){const x=xmin+(xmax-xmin)*j/200;d+=(j?'L':'M')+X(x).toFixed(2)+' '+Y(curve.f(x)).toFixed(2)+' ';}a('path',{d,stroke:curve.color,'stroke-width':2.5,fill:'none'});}
 if(marker)a('circle',{cx:X(marker[0]),cy:Y(marker[1]),r:5,fill:'#facc15'});
 svg.setAttribute('aria-label',ylabel+' versus '+xlabel+(marker?'; yellow marker shows selected input':''));
}
return {drawCircuit,animate,drawEnergyCircuit,drawEnergyPlot,drawDeviceDiagram,drawDevicePlot};
}
