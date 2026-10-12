import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const types=['architecture','workflow','sequence','dataflow','lifecycle'];
const examples={'architecture':'web-app.architecture','workflow':'agent-tool-call.workflow','sequence':'cache-miss-request.sequence','dataflow':'product-analytics.dataflow','lifecycle':'agent-run.lifecycle'};
const [mode,arg]=process.argv.slice(2);
function rejectUnsafe(value){
 if (!value || typeof value!=='object') return;
 if(Array.isArray(value)){value.forEach(rejectUnsafe);return;}
 for(const [key,item] of Object.entries(value)){
  if(['repository','sources','brand','brandPackages','brandPackage','href','url','image','src','translations'].includes(key))throw new Error(`Use Vox citation IDs instead of external resources or repository metadata (${key}).`);
  rejectUnsafe(item);
 }
}
try {
 if(mode==='schema'){
  if(!types.includes(arg))throw new Error('Unknown diagram type');
  const schema=JSON.parse(fs.readFileSync(path.join(root,'schemas',arg+'.schema.json'),'utf8'));
  const common=JSON.parse(fs.readFileSync(path.join(root,'schemas/common.schema.json'),'utf8'));
  const example=JSON.parse(fs.readFileSync(path.join(root,'examples',examples[arg]+'.json'),'utf8'));
  console.log(JSON.stringify({schema,common,example,rules:'Examples describe construction, not facts about the user project. Do not copy their content. Evidence must use issued Vox read_source IDs; repository, sources, remote images and brand URLs are not accepted. meta.output is supplied by Vox.'}));
 }else if(mode==='render'){
  const diagram=JSON.parse(fs.readFileSync(arg,'utf8'));
  rejectUnsafe(diagram);
  if(!types.includes(diagram.diagram_type))throw new Error('Unknown diagram type');
  if(!diagram.meta || typeof diagram.meta!=='object')throw new Error('Provide diagram meta including title.');
  diagram.meta.output='diagram.html';
  diagram.meta.animation='none';
  if(JSON.stringify(diagram).length>100000)throw new Error('Diagram exceeds 100 KB');
  const input=path.join(path.dirname(arg),'render-input.json');
  const output=path.join(path.dirname(arg),'artifact.html');
  fs.writeFileSync(input,JSON.stringify(diagram),{mode:0o600});
  const result=spawnSync(process.execPath,[path.join(root,'renderers',diagram.diagram_type,'render-'+diagram.diagram_type+'.mjs'),input,output],{encoding:'utf8',timeout:15000,maxBuffer:64000,env:{PATH:'/usr/bin:/bin',ARCHIFY_DIAGNOSTIC_FORMAT:'json'}});
  if(result.status!==0)throw new Error((result.stderr||result.error?.message||'Diagram validation failed').slice(0,6000));
  const html=fs.readFileSync(output,'utf8');
  const container=html.indexOf('<div class="diagram-container"');
  const start=html.indexOf('<svg',container);
  if(container<0||start<0)throw new Error('Missing diagram SVG');
  const pattern=/<svg(?=[\s>])|<\/svg>/g;pattern.lastIndex=start;let depth=0,end=-1;
  for(let match; (match=pattern.exec(html));){depth+=match[0].startsWith('</')?-1:1;if(depth===0){end=pattern.lastIndex;break;}}
  if(end<0)throw new Error('Incomplete diagram SVG');
  const svg=html.slice(start,end);
  const dimensions=svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  if(dimensions.length!==4||dimensions.some(n=>!Number.isFinite(n))||dimensions[2]<=0||dimensions[3]<=0||dimensions[2]>16000||dimensions[3]>16000)throw new Error('Diagram dimensions exceed the canvas limit');
  const css=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n').replace(/:root\b/g,':host').replace(/\bhtml\b/g,':host');
  const itemKey={architecture:'components',workflow:'nodes',sequence:'participants',dataflow:'nodes',lifecycle:'states'}[diagram.diagram_type];
  const edgeKey={architecture:'connections',workflow:'edges',sequence:'messages',dataflow:'flows',lifecycle:'transitions'}[diagram.diagram_type];
  console.log(JSON.stringify({diagram,svg,css,width:dimensions[2],height:dimensions[3],receipt:{renderer:'Archify 3.0.1',diagram_type:diagram.diagram_type,schema_valid:true,composition_valid:true,node_count:diagram[itemKey].length,connection_count:(diagram[edgeKey]||[]).length}}));
 }else throw new Error('Unknown renderer operation');
}catch(e){console.error(e.message);process.exit(1);}
