const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const [dir,pub]=process.argv.slice(2);
(async()=>{const b=await chromium.launch();
let css=fs.readFileSync(path.join(pub,'fonts/fonts.css'),'utf8').replace(/url\("\/fonts\/([^"]+)"\)/g,(m,f)=>`url("data:font/woff2;base64,${fs.readFileSync(path.join(pub,'fonts',f)).toString('base64')}")`);
for(const n of ['wochen','zeilen','spalten']){
 const svg=fs.readFileSync(`${dir}/${n}.svg`,'utf8');const vb=svg.match(/viewBox="0 0 (\d+) (\d+)"/);const w=+vb[1],h=+vb[2];const sc=2400/Math.max(w,h);
 const p=await b.newPage({viewport:{width:Math.round(w*sc),height:Math.round(h*sc)}});
 await p.setContent(`<style>${css} html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
 await p.screenshot({path:`${dir}/${n}.png`});console.log(n,w,h);await p.close();}
await b.close()})();
