import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import {loadTs} from './load-ts.mjs';

const require = createRequire(import.meta.url);
export function loadPageModel() {
  const engine = {};
  const code = fs.readFileSync(new URL('../../app/bazi-engine.ts', import.meta.url), 'utf8');
  new Function('require', 'exports', ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(require, engine);
  const page = fs.readFileSync(new URL('../../app/page.tsx', import.meta.url), 'utf8');
  const source = page.split('export default function Home()')[0].replace(/^import .*;\r?$/gm, '');
  const context = { ...engine, ...loadTs('app/analysis/index.ts'), ...loadTs('app/analysis/facts.ts'), console, window: {} };
  vm.createContext(context);
  vm.runInContext(ts.transpileModule(source + '\nglobalThis.model = {buildAnalysis, buildLuck, buildPersonalitySummary, buildLifeReadings, getAstrolabe, buildZiweiPalaceDetail, pairMeaning, starPairMeanings, selectedAnnualYears};', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
  return { ...context.model, ...engine };
}
