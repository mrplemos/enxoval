import {mkdir,cp,rm} from 'node:fs/promises';
import {build} from 'esbuild';

await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const path of ['index.html','login.html','identity-setup.html','favicon.svg','.nojekyll']) {
  await cp(path,`dist/${path}`);
}
await cp('src','dist/src',{recursive:true,filter:source=>![
  'supabase-config.js','netlify-data-service.js'
].some(name=>source.endsWith('/'+name))});
await build({entryPoints:['src/identity-setup.js'],bundle:true,platform:'browser',format:'iife',target:['es2020'],outfile:'dist/identity-setup.js',minify:true,legalComments:'none'});
console.log('Public Netlify distribution built with bundled Identity callback; no private backup or seed data included.');
