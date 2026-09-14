const ts=require('typescript');const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('src/v3/formulaEngine.ts','utf8');const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const m={exports:{}};vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`,{module:m,exports:m.exports,Math,Error,Number,Set});const f=m.exports.evaluateFormula;
const eq=(a,b)=>{if(Math.abs(a-b)>1e-9)throw new Error(`${a} != ${b}`)};
eq(f('[總市值]-[總成本]',{'總市值':20659,'總成本':20505}),154);eq(f('SUM(1,4,5)',{}),10);eq(f('IF(5>2,ROUND(1.236,2),0)',{}),1.24);eq(f('FLOOR(1.99)+FLOOR(4.04)',{}),5);console.log('FORMULA_ENGINE_V342_TEST: PASS');
