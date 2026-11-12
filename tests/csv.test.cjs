const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const root=path.resolve(__dirname,'..');
const webroot=fs.existsSync(path.join(root,'dist'))?path.join(root,'dist'):root;
const core=require(path.join(webroot,'assets/csv-core.js'));
const Papa=require(path.join(webroot,'vendor/papaparse.min.js'));
const parse=(text,options)=>core.parse(text,options,Papa);
test('Minimal X/Y CSV and real RD origin remain unchanged',()=>{
 const p=parse('X,Y\n155000,463000\n121500,487000');
 const v=core.validate(p,p.xIndex,p.yIndex);
 assert.equal(v.points.length,2);assert.equal(v.errors.length,0);
 assert.equal(v.points[0].x,155000);assert.equal(v.points[0].y,463000);
});
test('Dutch Excel format, BOM, separator directive, quoted attribute and decimal commas',()=>{
 const p=parse('\ufeffsep=;\r\nNaam; RD_X ;RD_Y\r\n"Glas; \\"object\\"";155000,25;463000,75'.replace(/\\"/g,'""'));
 assert.equal(p.xIndex,1);assert.equal(p.yIndex,2);
 const v=core.validate(p,p.xIndex,p.yIndex);assert.equal(v.points.length,1);assert.equal(v.points[0].x,155000.25);
});
test('Tab delimiters and headerless files',()=>{
 const p=parse('155000\t463000\n121500\t487000',{header:false});
 assert.equal(p.xIndex,0);assert.equal(core.validate(p,0,1).points.length,2);
});
test('Quotes, line breaks and HTML remain literal attribute data',()=>{
 const p=parse('X,Y,Naam\n155000,463000,"<img src=x onerror=alert(1)>"\n121500,487000,"regel 1\nregel 2"');
 assert.equal(p.rows.length,2);assert.equal(p.rows[0][2],'<img src=x onerror=alert(1)>');
 assert.equal(p.rows[1][2],'regel 1\nregel 2');
});
test('Malformed rows, missing, swapped and geographic coordinates are explicitly rejected',()=>{
 const p=parse('X;Y;Naam\n155000;463000;ok\n;463000;leeg\n463000;155000;omgedraaid\n5.4;52.1;graden\n155000;463000;extra;veld\n155000;abc;tekst');
 const v=core.validate(p,0,1);assert.equal(v.points.length,1);assert.equal(v.errors.length,5);
 assert.match(v.errors[1].reason,/omgewisseld/);assert.match(v.errors[2].reason,/breedtegraden/);
});
test('Zero easting is valid and overlapping ranges are not falsely marked swapped',()=>{
 const p=parse('X;Y\n0;463000\n260000;300000');assert.equal(core.validate(p,0,1).points.length,2);
});
test('Number parsing does not silently guess thousands separators',()=>{
 assert.equal(core.number('155000,25'),155000.25);assert.equal(core.number('155 000,25'),155000.25);
 assert.equal(core.number('155.000,25'),155000.25);assert.equal(core.number('155,000.25'),155000.25);
 for(const v of ['',null,'abc','Infinity','1,2,3','155000m'])assert.ok(Number.isNaN(core.number(v)),v);
});
test('Unknown headers require explicit mapping; duplicated names remain distinct',()=>{
 const p=parse('east;north;Naam;Naam\n155000;463000;a;b');
 assert.equal(p.xIndex,-1);assert.equal(core.validate(p,-1,-1).points.length,0);assert.equal(p.columns[3],'Naam (2)');
 assert.equal(core.validate(p,0,0).points.length,0);assert.equal(core.validate(p,0,1).points.length,1);
});
test('Empty, malformed quotes and oversized CSV files fail without silent truncation',()=>{
 assert.throws(()=>parse(''),/leeg/);assert.throws(()=>parse('X;Y'),/geen gegevens/);
 assert.throws(()=>parse('X;Y\n"155000;463000'),/aanhalingstekens/);
 const rows='155000;463000\n'.repeat(50000);assert.equal(parse('X;Y\n'+rows).rows.length,50000);
 assert.throws(()=>parse('X;Y\n'+rows+'155000;463000'),/maximaal/);
});
test('All invalid data gives no importable points',()=>{
 const v=core.validate(parse('X;Y\n;\n999999;999999'),0,1);assert.equal(v.points.length,0);assert.ok(v.message);
});
test('Error report protects spreadsheet formulas',()=>{
 const csv=Papa.unparse([{X:'=1+1',Y:'@SUM(A1)',Reden:'invalid'}],{escapeFormulae:true});
 assert.ok(csv.includes("'=1+1"));assert.ok(csv.includes("'@SUM(A1)"));
});
