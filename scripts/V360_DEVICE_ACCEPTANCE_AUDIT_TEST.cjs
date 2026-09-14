const assert=require('assert');
const audit=require('./V360_DEVICE_ACCEPTANCE_AUDIT.cjs');
const manifest=require('./V360_DEVICE_ACCEPTANCE_MANIFEST.cjs');

function testValidateManifestRejectsMalformedInput(){
  const malformed={
    version:'3.6.0',
    areas:['system'],
    items:[
      {id:'dup',area:'system',title:'A',verification:'device',surface:'app',staticHooks:[],deviceSteps:[],expected:'ok',evidence:'photo'},
      {id:'dup',area:'unknown',title:'',verification:'wrong',surface:'',staticHooks:'bad',deviceSteps:[],expected:'',evidence:''},
    ],
  };
  const errors=audit.validateManifest(malformed);
  assert(errors.some(x=>x.includes('duplicate id')),'duplicate IDs must be rejected');
  assert(errors.some(x=>x.includes('unknown area')),'unknown areas must be rejected');
  assert(errors.some(x=>x.includes('verification')),'invalid verification must be rejected');
  assert(errors.some(x=>x.includes('deviceSteps')),'missing device steps must be rejected');
}

function testStaticHookFileAndContains(){
  assert.deepStrictEqual(audit.checkStaticHook({type:'file',path:'package.json'}).pass,true);
  assert.deepStrictEqual(audit.checkStaticHook({type:'contains',path:'package.json',text:'"version": "3.6.0"'}).pass,true);
  assert.deepStrictEqual(audit.checkStaticHook({type:'contains',path:'package.json',text:'__definitely_missing__'}).pass,false);
}

function testEvaluateItemPreservesHookShape(){
  const item={
    id:'system.test',
    area:'system',
    title:'System test',
    verification:'hybrid',
    surface:'app',
    staticHooks:[{type:'file',path:'package.json'}],
    deviceSteps:['Open app'],
    expected:'App opens',
    evidence:'Screenshot',
  };
  const evaluated=audit.evaluateItem(item);
  assert.strictEqual(evaluated.staticHooks.length,1);
  assert.strictEqual(evaluated.staticHooks[0].type,'file');
  assert.strictEqual(evaluated.staticHooks[0].path,'package.json');
  assert.strictEqual(evaluated.staticHooks[0].pass,true);
}

function testOverlayManifestHooksResolve(){
  for(const id of ['overlay.lifecycle','overlay.effect-fallback']){
    const item=manifest.items.find(x=>x.id===id);
    assert(item,`${id} must exist in the acceptance manifest`);
    const evaluated=audit.evaluateItem(item);
    assert.strictEqual(evaluated.staticPass,true,`${id} static hooks must resolve to existing native sources`);
  }
}

testValidateManifestRejectsMalformedInput();
testStaticHookFileAndContains();
testEvaluateItemPreservesHookShape();
testOverlayManifestHooksResolve();
console.log('V360_DEVICE_ACCEPTANCE_AUDIT_TEST: PASS');
