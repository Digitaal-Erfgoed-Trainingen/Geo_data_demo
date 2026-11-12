(() => {
  'use strict';
  const $=id=>document.getElementById(id), C=window.ATLAS_CATALOG;
  const fmt=n=>n.toLocaleString('nl-NL');
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const icon=name=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg');const u=document.createElementNS(s.namespaceURI,'use');u.setAttribute('href',`#i-${name}`);s.append(u);return s;};
  const button=(label,cls,action)=>{const b=el('button',cls,label);b.type='button';if(action)b.addEventListener('click',action);return b;};
  let toastTimer;
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
  if(!window.ol||!window.proj4||!window.Papa||!C){toast('De kaartbestanden konden niet worden geladen. Controleer of alle bestanden uit het pakket zijn gepubliceerd.');return;}
  const RD='EPSG:28992';
  proj4.defs(RD,C.projection);
  const rdProjection=new ol.proj.Projection({code:RD,units:'m',extent:[-285401.92,22598.08,595401.92,903401.92]});
  ol.proj.addProjection(rdProjection);
  for(const code of ['EPSG:4326','EPSG:3857'])ol.proj.addCoordinateTransforms(code,RD,c=>proj4(code,RD,c),c=>proj4(RD,code,c));
  const nlExtent=[-7000,302000,290000,618000];
  const view=new ol.View({projection:RD,center:[145000,463000],resolution:600,minResolution:.15,maxResolution:4500,enableRotation:false});
  const map=new ol.Map({target:'map',view,controls:[new ol.control.ScaleLine({units:'metric'}),new ol.control.Attribution({collapsible:false})]});
  const rasterLayers=new Map(),activeOverlays=new Set(),ownLayers=[];
  let baseId='topografie-grijs-blauw-brt-achtergrondkaart-1', layerSeq=0;
  const baseIds=new Set();
  function collectLayers(nodeId,set){const n=C.tree[nodeId];if(!n)return;if(n.layer)set.add(n.layer);for(const ch of n.children||[])collectLayers(ch,set);}
  for(const id of C.tree[C.root].children||[])if(C.tree[id].title==='Achtergrondkaart')collectLayers(id,baseIds);
  let warningTimer,warningLayerId;
  function watchSource(source,item){
    let errors=0;
    source.on('tileloaderror',()=>{errors++;if(errors<4||(!activeOverlays.has(item.id)&&baseId!==item.id))return;clearTimeout(warningTimer);warningLayerId=item.id;$('tile-warning').textContent=`De kaartdienst voor “${item.title}” reageert niet goed. Je eigen punten blijven beschikbaar. Probeer een andere laag of ondergrond.`;$('tile-warning').hidden=false;warningTimer=setTimeout(()=>$('tile-warning').hidden=true,14000);});
    source.on('tileloadend',()=>{errors=0;if(warningLayerId===item.id){$('tile-warning').hidden=true;warningLayerId=null;}});
  }
  function raster(id){
    if(rasterLayers.has(id))return rasterLayers.get(id);
    const item=C.layers[id];if(!item?.supported)return null;
    const provider=item.url.includes('achtergrondkaart')?'Kadaster / PDOK':item.url.includes('luchtfoto')?'Beeldmateriaal / PDOK':'PDOK';
    const attribution=item.url.includes('pdok.nl')?`Bron: <a href="https://www.pdok.nl/" target="_blank" rel="noopener">${provider}</a>`:'Bronnen: <a href="https://rce.webgis.nl/nl/map/erfgoedatlas" target="_blank" rel="noopener">RCE Erfgoedatlas en bronhouders</a>';
    let source;
    if(item.type==='WMTS'){
      const grid=new ol.tilegrid.WMTS({extent:ol.proj.get(item.projection).getExtent(),origins:item.matrices.map(m=>m.origin),resolutions:item.matrices.map(m=>m.resolution),matrixIds:item.matrices.map(m=>m.id),tileSizes:item.matrices.map(m=>m.size)});
      source=new ol.source.WMTS({url:item.template||item.url,requestEncoding:item.template?'REST':'KVP',layer:item.name,matrixSet:item.matrixSet,projection:item.projection,style:item.style||'default',format:item.format||'image/png',tileGrid:grid,wrapX:false,attributions:attribution});
    }else{
      source=new ol.source.TileWMS({url:item.url,projection:item.projection,params:{LAYERS:item.name,STYLES:item.style,FORMAT:'image/png',TRANSPARENT:true,VERSION:item.version},wrapX:false,attributions:attribution,transition:150});
    }
    const layer=new ol.layer.Tile({source,opacity:item.opacity,visible:false});
    layer.set('catalogId',id);
    if(item.minResolution>0)layer.setMinResolution(item.minResolution);
    if(item.maxResolution>0)layer.setMaxResolution(item.maxResolution);
    watchSource(source,item);rasterLayers.set(id,layer);map.addLayer(layer);return layer;
  }
  function setBase(id){
    if(!C.layers[id]?.supported)return;
    rasterLayers.get(baseId)?.setVisible(false);baseId=id;
    const layer=raster(id);layer.setVisible(true);layer.setOpacity(1);layer.setZIndex(0);
    document.querySelectorAll('[data-basemap]').forEach(b=>{const active=b.dataset.basemap===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    syncChecks();updateLegend();
  }
  function toggleOverlay(id,on){
    if(baseIds.has(id)){if(on)setBase(id);return;}
    const layer=raster(id);if(!layer)return;
    layer.setVisible(on);layer.setZIndex(10+activeOverlays.size);
    if(on)activeOverlays.add(id);else activeOverlays.delete(id);
    syncChecks();updateLegend();updateStatus();
  }
  function syncChecks(){document.querySelectorAll('[data-layer-id]').forEach(input=>{const id=input.dataset.layerId;input.checked=baseIds.has(id)?baseId===id:activeOverlays.has(id);input.closest('.layer-row')?.classList.toggle('selected',input.checked);});}
  function descendantCount(id){const n=C.tree[id];if(!n)return 0;return n.layer?1:(n.children||[]).reduce((s,k)=>s+descendantCount(k),0);}
  function treeNode(id,search=''){
    const n=C.tree[id];if(!n||n.visibleInViewerTree===false)return null;
    if(n.layer){
      const item=C.layers[n.layer];if(!item)return null;
      if(search&&!`${n.title} ${item.title}`.toLowerCase().includes(search))return null;
      const row=el('div','layer-row'+(!item.supported?' unsupported':''));
      const label=el('label');const input=document.createElement('input');input.type=baseIds.has(item.id)?'radio':'checkbox';if(input.type==='radio')input.name='catalog-basemap';input.disabled=!item.supported;input.dataset.layerId=item.id;input.setAttribute('aria-label',n.title||item.title);
      input.addEventListener('change',()=>toggleOverlay(item.id,input.checked));
      const name=el('span','layer-name',n.title||item.title);
      if(!item.supported)name.append(el('small','', 'Bekijk in de RCE Erfgoedatlas'));
      label.append(input,name);const info=button('ⓘ','layer-info',()=>showLayerInfo(item));info.setAttribute('aria-label',`Informatie over ${n.title}`);row.append(label,info);return row;
    }
    const children=(n.children||[]).map(k=>treeNode(k,search)).filter(Boolean);if(!children.length)return null;
    const group=el('details','catalog-group');if(search)group.open=true;
    const summary=el('summary','',n.title);summary.append(el('span','group-count',String(search?children.length:descendantCount(id))));group.append(summary,...children);return group;
  }
  function renderCatalog(){
    const query=$('layer-search').value.trim().toLowerCase();$('catalog-tree').replaceChildren();
    for(const id of C.tree[C.root].children||[]){const n=treeNode(id,query);if(n)$('catalog-tree').append(n);}
    if(!$('catalog-tree').childElementCount)$('catalog-tree').append(el('p','empty-state','Geen kaartlagen gevonden. Probeer een andere zoekterm.'));
    syncChecks();
  }
  $('catalog-count').textContent=`${C.supportedCount} kaartlagen · ${C.totalCount} catalogusitems`;
  $('layer-search').addEventListener('input',renderCatalog);
  $('clear-overlays').onclick=()=>{for(const id of [...activeOverlays])toggleOverlay(id,false);toast('Erfgoedlagen uitgezet.');};
  document.querySelectorAll('[data-basemap]').forEach(b=>b.onclick=()=>setBase(b.dataset.basemap));
  function setTab(name){for(const n of ['catalog','own']){const active=name===n;$(`tab-${n}`).classList.toggle('active',active);$(`tab-${n}`).setAttribute('aria-selected',String(active));$(`tab-${n}`).tabIndex=active?0:-1;$(`${n}-panel`).hidden=!active;}}
  for(const name of ['catalog','own']){$(`tab-${name}`).onclick=()=>setTab(name);$(`tab-${name}`).onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const other=name==='own'?'catalog':'own';setTab(other);$(`tab-${other}`).focus();}};}
  function setSidebar(open){$('sidebar').classList.toggle('closed',!open);$('sidebar').inert=!open&&matchMedia('(max-width:760px)').matches;$('sidebar-toggle').setAttribute('aria-expanded',String(open));}
  $('sidebar-toggle').onclick=()=>setSidebar($('sidebar').classList.contains('closed'));
  if(matchMedia('(max-width:760px)').matches)setSidebar(false);
  matchMedia('(max-width:760px)').addEventListener('change',e=>setSidebar(!e.matches));
  function fit(extent,maxZoom){view.fit(extent,{padding:[85,75,125,50],duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:450,maxZoom:maxZoom??18});}
  $('zoom-in').onclick=()=>view.animate({zoom:view.getZoom()+1,duration:180});
  $('zoom-out').onclick=()=>view.animate({zoom:view.getZoom()-1,duration:180});
  $('zoom-nl').onclick=()=>fit(nlExtent);
  map.on('pointermove',e=>{if(e.dragging)return;$('rd-position').textContent=`X ${fmt(Math.round(e.coordinate[0]))}  ·  Y ${fmt(Math.round(e.coordinate[1]))}  |  RD`;
    map.getTargetElement().style.cursor=map.hasFeatureAtPixel(e.pixel,{layerFilter:l=>Boolean(l.get('ownId')),hitTolerance:5})?'pointer':'';
  });
  function updateStatus(){const n=ownLayers.reduce((a,b)=>a+b.points.length,0);$('map-message').textContent=n?`${fmt(n)} eigen punten · ${ownLayers.length} tijdelijke ${ownLayers.length===1?'laag':'lagen'} · ${activeOverlays.size} ${activeOverlays.size===1?'erfgoedlaag':'erfgoedlagen'}`:'Verken het erfgoed. Voeg je eigen verhaal toe.';}
  function safeLink(url,label){const a=el('a','',label);a.href=url;a.target='_blank';a.rel='noopener';return a;}
  function showInfo(title,nodes){$('info-title').textContent=title;$('info-content').replaceChildren(...nodes);if(!$('info-dialog').open)$('info-dialog').showModal();}
  function showAbout(){
    const p=el('p','','Deze zelfstandige atlas combineert openbare erfgoedkaarten met je eigen locaties. De vormgeving en kaartcatalogus zijn gebaseerd op de RCE Erfgoedatlas. Dit is een afzonderlijke toepassing, geen officiële RCE-publicatie.');
    const h=el('h3','','Je CSV blijft tijdelijk');
    const p2=el('p','','Je CSV wordt alleen in het geheugen van deze browser verwerkt. Het bestand en de attributen worden niet geüpload of opgeslagen. Verwijder een laag, herlaad de pagina of sluit het tabblad om de gegevens te wissen. Kaartdiensten ontvangen wel verzoeken voor het bekeken kaartgebied. Een ingevoerde plaats- of adreszoekopdracht gaat naar PDOK.');
    const h2=el('h3','','Bestandsformaat');
    const p3=el('p','','Gebruik X en Y in RD New (EPSG:28992), in meters. Een komma, puntkomma of tab als scheidingsteken wordt herkend. Decimale komma’s werken bij puntkomma’s of tussen aanhalingstekens. Gebruik geen duizendtalscheiding. Extra kolommen verschijnen bij een klik op een punt en in de datatabel. Maximaal 20 MB en 50.000 rijen per bestand; maximaal 100.000 punten tegelijk.');
    const h3=el('h3','','Kaartlagen en actualiteit');
    const p4=el('p','',`De catalogus van ${C.updated} bevat ${C.supportedCount} rasterlagen. ${C.totalCount-C.supportedCount} overige catalogusitems verwijzen naar de oorspronkelijke viewer. Kaartbeelden worden live bij de bronhouder opgevraagd. De beschikbaarheid, schaalgrenzen en actualiteit verschillen per laag.`);
    const p5=el('p','','Klik op ⓘ naast een kaartlaag voor de bronverwijzingen. Bij geautomatiseerde vernieuwing kan de catalogus worden bijgewerkt met het meegeleverde script.');
    showInfo('Over deze atlas',[p,h,p2,h2,p3,h3,p4,p5,safeLink(C.source,'Open de oorspronkelijke RCE Erfgoedatlas ↗')]);
  }
  $('about-button').onclick=showAbout;$('privacy-button').onclick=showAbout;$('close-info').onclick=()=>$('info-dialog').close();
  function showLayerInfo(item){
    const nodes=[el('p','',item.supported?'Deze kaartlaag wordt rechtstreeks bij de bronhouder opgevraagd. Gebruik de onderstaande links voor de toelichting, actualiteit en gebruiksvoorwaarden.':item.reason)];
    if(item.maxResolution>0)nodes.push(el('p','',`Deze laag is pas zichtbaar bij een kaartresolutie kleiner dan ${item.maxResolution.toFixed(1)} meter per beeldschermpixel. Zoom verder in als de kaart leeg blijft.`));
    if(item.url)nodes.push(el('p','',`Kaartdienst: ${new URL(item.url).hostname} · ${item.type}`));
    const list=el('ul');for(const [i,u] of (item.links||[]).entries()){const li=el('li');li.append(safeLink(u,`Bronverwijzing ${i+1} — ${new URL(u).hostname}`));list.append(li);}if(list.childElementCount)nodes.push(list);
    nodes.push(safeLink(C.source,'Bekijk in de RCE Erfgoedatlas ↗'));showInfo(item.title,nodes);
  }
  function updateLegend(){
    const target=$('legend-content');target.replaceChildren();
    for(const own of ownLayers.filter(x=>x.layer.getVisible())){const row=el('div','legend-item');const title=el('strong');const dot=el('span','legend-dot');dot.style.backgroundColor=own.color;title.append(dot,document.createTextNode(own.name));row.append(title,el('span','',`${fmt(own.points.length)} punten${own.cluster?' · aantallen bij groepen':''}`));target.append(row);}
    for(const id of activeOverlays){const item=C.layers[id],layer=rasterLayers.get(id);const row=el('div','legend-item');row.append(el('strong','',item.title));
      const label=el('label','opacity-control','Dekking');const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.value=Math.round(layer.getOpacity()*100);slider.setAttribute('aria-label',`Dekking ${item.title}`);slider.oninput=()=>layer.setOpacity(Number(slider.value)/100);label.append(slider);row.append(label);
      if(item.type==='WMS'){let url=item.legend;if(!url){const u=new URL(item.url);u.searchParams.set('SERVICE','WMS');u.searchParams.set('REQUEST','GetLegendGraphic');u.searchParams.set('VERSION','1.0.0');u.searchParams.set('FORMAT','image/png');u.searchParams.set('LAYER',item.name);if(item.style)u.searchParams.set('STYLE',item.style);url=u.href;}const img=el('img');img.alt=`Legenda ${item.title}`;img.loading='lazy';img.src=url;img.onerror=()=>{img.replaceWith(el('small','','Legenda niet beschikbaar bij deze bron.'));};row.append(img);}
      if(!layer.isVisible(view))row.append(el('p','small-note','Deze laag is op dit schaalniveau niet zichtbaar.'));
      target.append(row);
    }
    if(!target.childElementCount)target.append(el('p','small-note','Zet een erfgoedlaag aan of voeg een CSV toe om de legenda te bekijken.'));
  }
  $('legend-button').onclick=()=>{updateLegend();$('legend-panel').hidden=!$('legend-panel').hidden;};$('close-legend').onclick=()=>$('legend-panel').hidden=true;
  $('close-feature').onclick=()=>{$('feature-panel').hidden=true;selectionSource.clear();};
  let featureRequest=0;
  const selectionSource=new ol.source.Vector();
  map.addLayer(new ol.layer.Vector({source:selectionSource,zIndex:20000,style:new ol.style.Style({image:new ol.style.Circle({radius:12,stroke:new ol.style.Stroke({color:'#15445d',width:2}),fill:new ol.style.Fill({color:'#ffb61255'})})})}));
  function propertiesTable(entries){const table=el('table','property-table');for(const [k,v] of entries){const tr=el('tr');tr.append(el('th','',k),el('td','',typeof v==='object'?JSON.stringify(v):String(v??'')));table.append(tr);}return table;}
  function showPoint(own,point){
    featureRequest++;$('feature-title').textContent=own.name;$('feature-content').replaceChildren(el('p','feature-meta',`CSV-record ${point.row} · X ${fmt(point.x)} / Y ${fmt(point.y)}`),propertiesTable(own.columns.map((k,i)=>[k,point.values[i]])));$('feature-panel').hidden=false;
    selectionSource.clear();selectionSource.addFeature(new ol.Feature(new ol.geom.Point([point.x,point.y])));
  }
  map.on('singleclick',async e=>{
    let hit;map.forEachFeatureAtPixel(e.pixel,(feature,layer)=>{if(layer?.get('ownId')){hit={feature,layer};return true;}},{hitTolerance:7});
    if(hit){const own=ownLayers.find(l=>l.id===hit.layer.get('ownId'));const members=hit.feature.get('features')||[hit.feature];
      if(members.length>1){const ext=ol.extent.createEmpty();members.forEach(f=>ol.extent.extend(ext,f.getGeometry().getExtent()));if(ol.extent.getWidth(ext)+ol.extent.getHeight(ext)<1||view.getResolution()<1){openTable(own,members.map(f=>f.get('recordIndex')));toast(`${members.length} punten op vrijwel dezelfde locatie. Selecteer een rij in de tabel.`);}else fit(ext);return;}
      showPoint(own,own.points[members[0].get('recordIndex')]);return;
    }
    selectionSource.clear();
    const candidates=[...activeOverlays].reverse().filter(id=>C.layers[id].featureInfoJson&&rasterLayers.get(id).isVisible(view)).slice(0,4);
    if(!candidates.length){$('feature-panel').hidden=true;return;}
    const request=++featureRequest;$('feature-title').textContent='Informatie op deze plek';$('feature-content').replaceChildren(el('p','small-note','Gegevens bij de bron ophalen…'));$('feature-panel').hidden=false;
    const results=await Promise.allSettled(candidates.map(async id=>{const source=rasterLayers.get(id).getSource();const url=source.getFeatureInfoUrl(e.coordinate,view.getResolution(),RD,{INFO_FORMAT:'application/json',FEATURE_COUNT:5});if(!url)return null;const response=await fetch(url,{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Bron niet bereikbaar');const data=await response.json();return {id,features:data.features||[]};}));
    if(request!==featureRequest)return;
    const nodes=[];let failures=0;for(const result of results){if(result.status==='rejected'){failures++;continue;}if(!result.value)continue;for(const feature of result.value.features){nodes.push(el('h3','',C.layers[result.value.id].title),propertiesTable(Object.entries(feature.properties||{})));}}
    if(!nodes.length)nodes.push(el('p','small-note',failures?'Geen informatie ontvangen. De bron kan het ophalen vanuit deze website beperken. Gebruik ⓘ bij de laag voor de oorspronkelijke bron.':'Op deze plek zijn geen objectgegevens gevonden in de actieve lagen.'));
    else if(failures)nodes.push(el('p','small-note','Niet alle actieve bronnen konden worden bevraagd.'));
    $('feature-content').replaceChildren(...nodes);
  });
  // CSV files never leave the browser. Parsing takes place in a local worker.
  const palette=['#c95636','#01689b','#6e5ca0','#2f836e','#ac7400','#ba4776'];
  const fileQueue=[];let importing=false,current=null,parsed=null,validation=null,parseVersion=0,parseWorker;
  function decode(buffer){const b=new Uint8Array(buffer);if(b[0]===255&&b[1]===254)return {text:new TextDecoder('utf-16le').decode(buffer),encoding:'UTF-16 LE'};if(b[0]===254&&b[1]===255)return {text:new TextDecoder('utf-16be').decode(buffer),encoding:'UTF-16 BE'};try{return {text:new TextDecoder('utf-8',{fatal:true}).decode(buffer),encoding:'UTF-8'};}catch{return {text:new TextDecoder('windows-1252').decode(buffer),encoding:'Windows-1252'};}}
  function parseAsync(text,options){
    const id=++parseVersion;
    if(parseWorker)parseWorker.terminate();
    return new Promise((resolve,reject)=>{try{parseWorker=new Worker('assets/parse-worker.js');parseWorker.onmessage=({data})=>{if(data.id!==parseVersion)return;data.error?reject(Error(data.error)):resolve(data.result);parseWorker.terminate();parseWorker=null;};parseWorker.onerror=()=>{parseWorker?.terminate();parseWorker=null;try{resolve(CSVCore.parse(text,options));}catch(e){reject(e);}};parseWorker.postMessage({id,text,options});}catch{try{resolve(CSVCore.parse(text,options));}catch(e){reject(e);}}});
  }
  function queueFiles(files){for(const f of files){if(!/\.(csv|tsv|txt)$/i.test(f.name)){toast(`“${f.name}” is geen CSV-, TSV- of tekstbestand.`);continue;}if(f.size>20*1024*1024){toast(`“${f.name}” is groter dan 20 MB. Splits het bestand.`);continue;}fileQueue.push(f);}nextFile();}
  async function nextFile(){if(importing||!fileQueue.length)return;importing=true;const file=fileQueue.shift();try{const d=decode(await file.arrayBuffer());current={file,...d};$('import-filename').textContent=file.name;$('import-filemeta').textContent=`${(file.size/1024).toLocaleString('nl-NL',{maximumFractionDigits:0})} kB · ${d.encoding}`;$('delimiter-select').value='';$('has-header').checked=true;$('layer-name').value=file.name.replace(/\.[^.]+$/,'').slice(0,100);$('layer-color').value=palette[ownLayers.length%palette.length];$('import-dialog').showModal();await reparse();}catch(e){toast(e.message);if($('import-dialog').open)$('import-dialog').close();else{importing=false;nextFile();}}}
  async function reparse(){
    $('confirm-import').disabled=true;$('csv-preview').replaceChildren();$('import-validation').className='validation';$('import-validation').textContent='Bestand lezen…';$('download-errors').hidden=true;parsed=null;validation=null;
    const delimiter=$('delimiter-select').value;
    try{const result=await parseAsync(current.text,{delimiter:delimiter==='tab'?'\t':delimiter,header:$('has-header').checked});if(!$('import-dialog').open)return;parsed=result;
      for(const [target,chosen] of [['x-column',result.xIndex],['y-column',result.yIndex]]){const select=$(target);select.replaceChildren(new Option('Kies een kolom…','-1'));result.columns.forEach((name,i)=>select.add(new Option(name,String(i))));select.value=String(chosen);}
      $('import-filemeta').textContent=`${fmt(result.rows.length)} rijen · ${result.columns.length} kolommen · ${current.encoding} · ${result.delimiter==='\t'?'tab':result.delimiter===';'?'puntkomma':'komma'}`;
      validateImport();
    }catch(e){$('import-validation').className='validation error';$('import-validation').textContent=e.message;$('x-column').replaceChildren();$('y-column').replaceChildren();}
  }
  function validateImport(){
    if(!parsed)return;const x=Number($('x-column').value),y=Number($('y-column').value);validation=CSVCore.validate(parsed,x,y);
    const target=$('import-validation'),n=validation.points.length,bad=validation.errors.length;
    target.className='validation'+(!n?' error':bad?' warning':'');
    target.replaceChildren(el('strong','',n?`${fmt(n)} geldige ${n===1?'locatie':'locaties'}`:validation.message));
    if(bad)target.append(el('div','',`${fmt(bad)} ${bad===1?'rij wordt':'rijen worden'} overgeslagen. ${validation.errors[0].reason}`));
    else if(n)target.append(el('div','','Klaar om als tijdelijke laag toe te voegen.'));
    $('download-errors').hidden=!bad;$('confirm-import').disabled=!n;
    $('confirm-import').textContent=n?`${fmt(n)} punten toevoegen`:'Toevoegen aan de kaart';
    const table=el('table'),head=el('tr');parsed.columns.forEach((name,i)=>head.append(el('th',i===x||i===y?'selected-column':'',name)));const th=el('thead');th.append(head);const tb=el('tbody');for(const row of parsed.rows.slice(0,5)){const tr=el('tr');parsed.columns.forEach((_,i)=>{const td=el('td',i===x||i===y?'selected-column':'',row[i]??'');td.title=row[i]??'';tr.append(td);});tb.append(tr);}table.append(th,tb);$('csv-preview').replaceChildren(table);
  }
  $('delimiter-select').onchange=reparse;$('has-header').onchange=reparse;$('x-column').onchange=validateImport;$('y-column').onchange=validateImport;
  $('swap-columns').onclick=()=>{const x=$('x-column').value;$('x-column').value=$('y-column').value;$('y-column').value=x;validateImport();};
  $('download-errors').onclick=()=>{if(!validation)return;const csv=Papa.unparse(validation.errors.map(e=>({'CSV-record':e.row,Reden:e.reason,X:e.x,Y:e.y})),{delimiter:';',escapeFormulae:true});download(csv,'overgeslagen-rijen.csv','text/csv;charset=utf-8');};
  function download(content,name,type){const url=URL.createObjectURL(new Blob(['\ufeff',content],{type}));const a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  for(const id of ['choose-file','header-import'])$(id).onclick=()=>$('csv-file').click();
  $('csv-file').onchange=e=>{queueFiles(e.target.files);e.target.value='';};
  for(const id of ['cancel-import','cancel-import-x'])$(id).onclick=()=>$('import-dialog').close();
  $('import-dialog').addEventListener('close',()=>{parseVersion++;parseWorker?.terminate();parseWorker=null;current=null;parsed=null;validation=null;importing=false;setTimeout(nextFile,0);});
  let dragDepth=0;
  document.addEventListener('dragenter',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();dragDepth++;$('drop-overlay').hidden=false;}});
  document.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
  document.addEventListener('dragleave',()=>{dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('drop-overlay').hidden=true;});
  document.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop-overlay').hidden=true;queueFiles(e.dataTransfer.files);});
  window.addEventListener('blur',()=>{dragDepth=0;$('drop-overlay').hidden=true;});
  $('demo-button').onclick=async()=>{try{const r=await fetch('voorbeeld-rd.csv');if(!r.ok)throw Error();queueFiles([new File([await r.text()],'voorbeeld-rd.csv',{type:'text/csv'})]);}catch{toast('Het voorbeeld kon niet worden geopend. Download de voorbeeld-CSV en kies het bestand.');}};
  function styleFor(own){const cache=new Map();return feature=>{const count=feature.get('features')?.length||1,key=String(count);if(!cache.has(key))cache.set(key,new ol.style.Style({image:new ol.style.Circle({radius:count>1?Math.min(22,12+Math.log2(count)*1.5):6.5,fill:new ol.style.Fill({color:own.color}),stroke:new ol.style.Stroke({color:'#ffffff',width:2})}),text:count>1?new ol.style.Text({text:count>999?`${(count/1000).toFixed(1)}k`:String(count),font:'bold 12px Arial',fill:new ol.style.Fill({color:'#fff'})}):undefined}));return cache.get(key);};}
  function setClustering(own,on){own.cluster=on;if(own.clusterSource){own.clusterSource.setSource(null);own.clusterSource=null;}if(on){own.clusterSource=new ol.source.Cluster({distance:35,source:own.source});own.layer.setSource(own.clusterSource);}else own.layer.setSource(own.source);own.layer.setStyle(styleFor(own));updateLegend();}
  $('confirm-import').onclick=()=>{
    if(!validation?.points.length)return;
    if(ownLayers.reduce((a,b)=>a+b.points.length,0)+validation.points.length>100000){toast('Maximaal 100.000 punten tegelijk. Verwijder eerst een tijdelijke laag.');return;}
    const own={id:`csv-${++layerSeq}`,name:$('layer-name').value.trim()||current.file.name,color:$('layer-color').value,columns:parsed.columns,points:validation.points,skipped:validation.errors.length,fileName:current.file.name,cluster:false};
    const features=own.points.map((p,i)=>new ol.Feature({geometry:new ol.geom.Point([p.x,p.y]),recordIndex:i}));own.source=new ol.source.Vector({features,wrapX:false});own.layer=new ol.layer.Vector({source:own.source,zIndex:1000+layerSeq,style:styleFor(own)});own.layer.set('ownId',own.id);map.addLayer(own.layer);ownLayers.push(own);if(features.length>5000)setClustering(own,true);renderOwnLayers();updateLegend();updateStatus();setTab('own');fit(own.source.getExtent(),17);
    toast(`${fmt(own.points.length)} punten toegevoegd${own.skipped?`; ${fmt(own.skipped)} rijen overgeslagen`:''}.`);$('import-dialog').close();if(matchMedia('(max-width:760px)').matches)setSidebar(false);
  };
  function renderOwnLayers(){
    $('own-count').textContent=ownLayers.length;$('own-empty').hidden=Boolean(ownLayers.length);const container=$('own-layers');container.replaceChildren();
    for(const own of ownLayers){const card=el('article','own-layer');card.style.setProperty('--layer-color',own.color);const head=el('div','own-layer-head');const label=el('label'),check=document.createElement('input');check.type='checkbox';check.checked=own.layer.getVisible();check.onchange=()=>{own.layer.setVisible(check.checked);if(!check.checked){selectionSource.clear();$('feature-panel').hidden=true;}updateLegend();};label.append(check,document.createTextNode(own.name));
      const remove=button('','icon-button',()=>{map.removeLayer(own.layer);own.clusterSource?.setSource(null);own.source.clear();ownLayers.splice(ownLayers.indexOf(own),1);selectionSource.clear();$('feature-panel').hidden=true;if(tableOwn===own){$('table-dialog').close();tableOwn=null;}renderOwnLayers();updateLegend();updateStatus();toast('Tijdelijke laag verwijderd.');});remove.append(icon('trash'));remove.setAttribute('aria-label',`Verwijder ${own.name}`);head.append(label,remove);
      const tools=el('div','own-layer-tools');tools.append(button('Zoom naar laag','secondary-button',()=>fit(own.source.getExtent(),17)),button('Tabel','secondary-button',()=>openTable(own)));
      const color=document.createElement('input');color.type='color';color.className='own-layer-color';color.value=own.color;color.setAttribute('aria-label',`Kleur van ${own.name}`);color.oninput=()=>{own.color=color.value;card.style.setProperty('--layer-color',color.value);own.layer.setStyle(styleFor(own));updateLegend();};tools.append(color);
      const clusterLabel=el('label','cluster-label'),clusterCheck=document.createElement('input');clusterCheck.type='checkbox';clusterCheck.checked=own.cluster;clusterCheck.onchange=()=>setClustering(own,clusterCheck.checked);clusterLabel.append(clusterCheck,document.createTextNode('Punten dicht bij elkaar groeperen'));
      card.append(head,el('p','',`${fmt(own.points.length)} punten · tijdelijk${own.skipped?` · ${fmt(own.skipped)} overgeslagen`:''}`),tools,clusterLabel);container.append(card);
    }
  }
  let tableOwn=null,tablePage=0,tableSubset=null,tableRows=[];
  function openTable(own,subset=null){tableOwn=own;tableSubset=subset;tablePage=0;$('table-filter').value='';$('table-title').textContent=own.name;filterTable();if(!$('table-dialog').open)$('table-dialog').showModal();}
  function filterTable(){if(!tableOwn)return;const q=$('table-filter').value.toLowerCase();tableRows=(tableSubset||tableOwn.points.map((_,i)=>i)).filter(i=>!q||tableOwn.points[i].values.some(v=>String(v).toLowerCase().includes(q)));tablePage=0;renderTable();}
  function renderTable(){
    if(!tableOwn)return;const table=el('table'),thead=el('thead'),tr=el('tr');tr.append(el('th','','Kaart'),el('th','','Record'));tableOwn.columns.forEach(c=>tr.append(el('th','',c)));thead.append(tr);const body=el('tbody');
    for(const i of tableRows.slice(tablePage*50,(tablePage+1)*50)){const p=tableOwn.points[i],row=el('tr'),td=el('td');td.append(button('Bekijk','zoom-row',()=>{view.animate({center:[p.x,p.y],resolution:Math.min(view.getResolution(),5),duration:350});showPoint(tableOwn,p);$('table-dialog').close();if(matchMedia('(max-width:760px)').matches)setSidebar(false);}));row.append(td,el('td','',String(p.row)));for(const value of p.values){const cell=el('td','',value);cell.title=value;row.append(cell);}body.append(row);}
    table.append(thead,body);$('data-table').replaceChildren(table);$('table-count').textContent=`${fmt(tableRows.length)} ${tableRows.length===1?'punt':'punten'}`;$('table-page').textContent=`Pagina ${tablePage+1} van ${Math.max(1,Math.ceil(tableRows.length/50))}`;$('table-prev').disabled=tablePage===0;$('table-next').disabled=(tablePage+1)*50>=tableRows.length;
  }
  $('table-filter').oninput=filterTable;$('table-prev').onclick=()=>{tablePage--;renderTable();};$('table-next').onclick=()=>{tablePage++;renderTable();};$('close-table').onclick=()=>$('table-dialog').close();
  $('table-dialog').addEventListener('close',()=>{tableSubset=null;tableRows=[];tableOwn=null;});
  // Search is explicit: no keystrokes or CSV contents are sent to PDOK.
  let searchController;
  $('place-search').onsubmit=async e=>{e.preventDefault();const q=$('place-input').value.trim();if(q.length<2){toast('Voer minimaal twee tekens in.');return;}searchController?.abort();searchController=new AbortController();const results=$('place-results');results.hidden=false;results.replaceChildren(el('p','','Zoeken…'));
    try{const url=new URL('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free');url.searchParams.set('q',q);url.searchParams.set('rows','5');url.searchParams.set('fl','weergavenaam,centroide_rd');const r=await fetch(url,{signal:searchController.signal});if(!r.ok)throw Error();const data=await r.json();results.replaceChildren();
      for(const doc of data.response.docs||[]){const xy=doc.centroide_rd?.match(/POINT\s*\(\s*([\d.-]+)\s+([\d.-]+)\s*\)/);if(!xy)continue;results.append(button(doc.weergavenaam,'',()=>{view.animate({center:[Number(xy[1]),Number(xy[2])],resolution:5,duration:400});results.hidden=true;}));}
      if(!results.childElementCount)results.append(el('p','','Geen locaties gevonden.'));
    }catch(error){if(error.name!=='AbortError')results.replaceChildren(el('p','','Zoeken is nu niet beschikbaar. Je kunt de kaart gewoon blijven gebruiken.'));}
  };
  document.addEventListener('click',e=>{if(!e.target.closest('.map-search-wrap'))$('place-results').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('place-results').hidden=true;$('drop-overlay').hidden=true;dragDepth=0;if(!document.querySelector('dialog[open]')){$('feature-panel').hidden=true;$('legend-panel').hidden=true;selectionSource.clear();}}});
  renderCatalog();renderOwnLayers();setBase(baseId);fit(nlExtent);updateStatus();
})();
