// A minimal DOM harness checks module wiring and handlers, not browser layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('application initializes and controls render, animate, save/load and import/export',async()=>{
 const elements=new Map(),frames=[],storage=new Map();let exported;
 class Element {
  constructor(tag='div'){this.tagName=tag;this.children=[];this.listeners={};this.attributes={};this.dataset={};this.style={};this.value='';this.options=[];this.files=[];}
  setAttribute(k,v){this.attributes[k]=String(v);}
  append(e){this.children.push(e);}
  replaceChildren(){this.children=[];}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
  async fire(type,event={}){for(const fn of this.listeners[type]??=[])await fn({target:this,...event});}
  click(){if(this.tagName==='a')exported=this;else return this.fire('click');}
  checkValidity(){return true;}
  querySelectorAll(){return [];}
  scrollIntoView(){}
  set innerHTML(html){this.html=html;scan(html);this.options=[...html.matchAll(/<option value="([^"]*)"/g)].map(m=>({value:m[1]}));if(this.options.length&&!this.options.some(o=>o.value===this.value))this.value=this.options[0].value;}
  get innerHTML(){return this.html??'';}
 }
 function scan(html){for(const m of html.matchAll(/<(\w+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const el=new Element(m[1]);el.value=/\bvalue="([^"]*)"/.exec(m[2])?.[1]??'';el.checked=/\bchecked\b/.test(m[2]);elements.set(m[3],el);}}
 scan(await readFile(new URL('../index.html',import.meta.url),'utf8'));
 Object.assign(globalThis,{
  document:{getElementById:id=>{assert.ok(elements.has(id),'missing element '+id);return elements.get(id);},createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)},
  localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)},
  matchMedia:()=>({matches:false}),requestAnimationFrame:fn=>frames.push(fn)
 });
 const $=id=>elements.get(id);
 // Static select defaults normally come from HTML parsing.
 for(const [id,value] of Object.entries({flow:'conventional',meterMode:'voltage',challenge:'balance',energySpeed:'.5',experimentType:'opamp',preset:'default'}))$(id).value=value;
 await import('../js/app.js');
 assert.equal($('banner').textContent,'POWER OFFLINE');assert.ok($('drawing').children.length>0);assert.ok($('energyVoltagePlot').children.length>0);
 await $('breaker').click();assert.notEqual($('banner').textContent,'POWER OFFLINE');assert.ok($('particles').children.length>0);
 const first=$('particles').children[0];for(const time of [100,200])for(const frame of frames.splice(0))frame(time);assert.ok(Number.isFinite(+first.attributes.cx));
 await $('pause').click();assert.equal($('pause').textContent,'Resume animation');
 $('topology').value='parallel';await $('topology').fire('change');assert.ok($('topologyHint').textContent.includes('branch'));
 $('preset').value='overload';await $('applyPreset').click();await $('breaker').click();assert.equal($('banner').textContent,'BREAKER TRIPPED');
 await $('reset').click();await $('addLoad').click();assert.ok($('loads').innerHTML.includes('Auxiliary Load'));
 for(const type of ['opamp','transistor','transformer']){$('experimentType').value=type;await $('addExperiment').click();}
 for(const id of ['exp1','exp2','exp3']){assert.ok($('deviceDiagram-'+id).children.length>0);assert.ok($('devicePlot-'+id).children.length>0);}
 await $('save').click();const saved=JSON.parse(storage.get('orion-circuit-v2'));assert.equal(saved.workbench.experiments.length,3);assert.equal(saved.loads.length,4);
 await $('reset').click();await $('load').click();assert.equal($('banner').textContent,'POWER OFFLINE');assert.ok($('experimentCount').textContent.startsWith('3'));
 await $('export').click();assert.equal(exported.download,'orion-circuit.json');
 $('fileInput').files=[{size:1,text:async()=>JSON.stringify(saved)}];await $('fileInput').fire('change');assert.match($('notice').textContent,/imported/);
 $('fileInput').files=[{size:1,text:async()=>'{}'}];await $('fileInput').fire('change');assert.match($('notice').textContent,/Could not import/);
 await $('showStorage').click();await $('energyStep').click();assert.equal($('energyStatus').textContent,'Paused');await $('energySwitch').click();assert.match($('energySwitch').textContent,/Source ON/);
 $('energyMode').value='rl';await $('energyMode').fire('change');await $('energyRun').click();for(const time of [300,400])for(const frame of frames.splice(0))frame(time);assert.equal($('energyStatus').textContent,'Running');
 await $('checkChallenge').click();assert.match($('challengeResult').textContent,/Goal not met/);
});
