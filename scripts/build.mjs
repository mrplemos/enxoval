import {mkdir,cp,rm,readFile,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const path of ['index.html','favicon.svg','.nojekyll','src','data']) await cp(path,`dist/${path}`,{recursive:true});

const [html,css,favicon,inventory,benchmarks,config,domain,repository,app]=await Promise.all([
  readFile('index.html','utf8'),readFile('src/styles.css','utf8'),readFile('favicon.svg','utf8'),
  readFile('data/inventory.json','utf8'),readFile('data/benchmarks.json','utf8'),
  readFile('src/supabase-config.js','utf8'),readFile('src/domain.js','utf8'),readFile('src/repository.js','utf8'),readFile('src/app.js','utf8'),
]);
const seed=`globalThis.__ENXOVAL_SEED__={items:${inventory},benchmarks:${benchmarks}};`;
const bundle=[
  config.replace(/^export /gm,''),
  domain.replace(/^export /gm,''),
  repository.replace(/^import .*$/gm,'').replace(/^export /gm,''),
  app.replace(/^import .*$/gm,''),
].join('\n');
const faviconUrl=`data:image/svg+xml,${encodeURIComponent(favicon)}`;
const standalone=html
  .replace('<link rel="icon" href="./favicon.svg" type="image/svg+xml">',`<link rel="icon" href="${faviconUrl}" type="image/svg+xml">`)
  .replace('<link rel="stylesheet" href="./src/styles.css">',`<style>${css}</style>`)
  .replace('<script type="module" src="./src/app.js"></script>',`<script>${seed}\n${bundle}</script>`);
await writeFile('enxoval-compartilhar.html',standalone);
await writeFile('dist/enxoval-compartilhar.html',standalone);
console.log('Static app built in dist/ and enxoval-compartilhar.html generated for direct sharing.');
