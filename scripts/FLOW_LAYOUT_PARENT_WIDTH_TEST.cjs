const fs=require('fs');
const path=require('path');
const file=path.join(process.cwd(),'src/ui/FlowLayout.tsx');
const src=fs.readFileSync(file,'utf8');
const fail=(msg)=>{console.error(`FLOW_LAYOUT_PARENT_WIDTH_TEST FAIL: ${msg}`);process.exit(1)};

if(/const\s+available\s*=\s*Math\.max\(0,width-32\)/.test(src)){
  fail('FlowItem still sizes itself from the device/window width instead of the measured parent FlowLayout width; nested 2-column layouts can overflow and overlap.');
}
if(!/onLayout=/.test(src)) fail('FlowLayout does not measure its own rendered width.');
if(!/createContext/.test(src)||!/useContext/.test(src)) fail('Measured parent width is not propagated to FlowItem.');
console.log('FLOW_LAYOUT_PARENT_WIDTH_TEST PASS');
