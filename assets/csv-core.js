(function (root) {
  'use strict';
  const MAX_ROWS = 50000;
  function number(value) {
    let s = String(value ?? '').trim().replace(/[\s\u00a0\u202f]/g, '');
    if (!s) return NaN;
    // A single dot/comma is a decimal separator, never a guessed thousands separator.
    if (s.includes(',') && s.includes('.')) {
      if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s=s.replace(/\./g,'').replace(',','.');
      else if (/^[+-]?\d{1,3}(,\d{3})+\.\d+$/.test(s)) s=s.replace(/,/g,'');
      else return NaN;
    } else s=s.replace(',','.');
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s) ? Number(s) : NaN;
  }
  function parse(text, options = {}, parser = root.Papa) {
    text = text.replace(/^\uFEFF/, '');
    let delimiter = options.delimiter || '';
    // Excel's optional separator declaration is metadata, not a coordinate record.
    const sep = text.match(/^sep=([;,\t|])\r?\n/i);
    if (sep) { text=text.slice(sep[0].length); if (!delimiter) delimiter=sep[1]; }
    const result = parser.parse(text, {delimiter, skipEmptyLines:'greedy', preview:MAX_ROWS+2, delimitersToGuess:[',',';','\t','|']});
    const quoteError=result.errors.find(e => e.type==='Quotes');
    if (quoteError) throw new Error('De CSV bevat niet-afgesloten of ongeldige aanhalingstekens. Controleer het bestand.');
    if (!result.data.length) throw new Error('Het bestand is leeg.');
    const hasHeader=options.header!==false;
    const width=result.data[0].length;
    if (width<2) throw new Error('Er zijn minder dan twee kolommen gevonden. Kies het juiste scheidingsteken.');
    if (width>150) throw new Error('Dit bestand heeft meer dan 150 kolommen. Exporteer alleen de benodigde kolommen.');
    const names = hasHeader ? result.data[0].map((s,i)=>String(s).trim()||`Kolom ${i+1}`) : result.data[0].map((_,i)=>`Kolom ${i+1}`);
    const counts=new Map();
    const columns=names.map(n=>{ const count=(counts.get(n)||0)+1; counts.set(n,count);return count===1?n:`${n} (${count})`; });
    const rows=hasHeader?result.data.slice(1):result.data;
    if (!rows.length) throw new Error('De CSV bevat kolomnamen, maar geen gegevens.');
    if (rows.length>MAX_ROWS || result.meta.truncated) throw new Error(`Gebruik maximaal ${MAX_ROWS.toLocaleString('nl-NL')} gegevensrijen per bestand. Splits dit bestand in kleinere bestanden.`);
    const normalized=names.map(n=>n.toLowerCase().replace(/[^a-z0-9]/g,''));
    const xNames=['x','rdx','xrd','xcoord','xcoordinaat','xcoordinate','easting'];
    const yNames=['y','rdy','yrd','ycoord','ycoordinaat','ycoordinate','northing'];
    let xIndex=normalized.findIndex(n=>xNames.includes(n));
    let yIndex=normalized.findIndex(n=>yNames.includes(n));
    if (!hasHeader) {xIndex=0;yIndex=1;}
    return {columns,rows,delimiter:result.meta.delimiter||delimiter,hasHeader,xIndex,yIndex};
  }
  function validate(parsed, xIndex, yIndex) {
    if (xIndex<0 || yIndex<0) return {points:[],errors:[],message:'Kies de kolommen voor X en Y.'};
    if (xIndex===yIndex) return {points:[],errors:[],message:'Kies twee verschillende kolommen voor X en Y.'};
    const points=[], errors=[];
    parsed.rows.forEach((values,i)=>{
      const row=i+(parsed.hasHeader?2:1), x=number(values[xIndex]),y=number(values[yIndex]);
      let reason='';
      if (values.length!==parsed.columns.length) reason='Aantal velden wijkt af van het aantal kolommen.';
      else if (!Number.isFinite(x)||!Number.isFinite(y)) reason='X of Y is leeg of geen geldig getal.';
      else if ((x< -50000 || x>350000 || y<250000 || y>650000) && x>=250000 && x<=650000 && y>=-50000 && y<=350000) reason='X en Y lijken omgewisseld. Controleer de kolomkeuze.';
      else if (Math.abs(x)<=180 && Math.abs(y)<=90) reason='Dit lijken lengte- en breedtegraden. RD-coördinaten in meters zijn nodig.';
      else if (x< -50000 || x>350000 || y<250000 || y>650000) reason='Buiten het ingestelde RD-bereik (X −50.000–350.000; Y 250.000–650.000 m).';
      if(reason)errors.push({row,reason,x:values[xIndex]??'',y:values[yIndex]??''});
      else points.push({row,x,y,values});
    });
    return {points,errors,message:points.length?'':'Er zijn geen geldige RD-punten gevonden.'};
  }
  const api={number,parse,validate,MAX_ROWS};
  if (typeof module!=='undefined' && module.exports) module.exports=api;
  else root.CSVCore=api;
})(typeof self!=='undefined'?self:globalThis);
