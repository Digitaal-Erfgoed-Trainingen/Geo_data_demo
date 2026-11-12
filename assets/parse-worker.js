importScripts('../vendor/papaparse.min.js','csv-core.js');
self.onmessage=({data})=>{
  try { self.postMessage({id:data.id,result:CSVCore.parse(data.text,data.options)}); }
  catch(error){ self.postMessage({id:data.id,error:error.message}); }
};
