import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const native=createRequire(import.meta.url);
export function loadTs(file,cache=new Map()){
  const absolute=path.resolve(file);
  if(cache.has(absolute)) return cache.get(absolute);
  const exports={}; cache.set(absolute,exports);
  const code=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const resolve=(id)=>id.startsWith('.') ? loadTs(path.resolve(path.dirname(absolute),id.endsWith('.ts')?id:id+'.ts'),cache) : native(id);
  new Function('require','exports',code)(resolve,exports);
  return exports;
}
