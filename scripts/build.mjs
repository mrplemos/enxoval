import {mkdir,cp,rm} from 'node:fs/promises';

await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const path of ['index.html','login.html','favicon.svg','.nojekyll']) {
  await cp(path,`dist/${path}`);
}
await cp('src','dist/src',{recursive:true,filter:source=>![
  'supabase-config.js','netlify-data-service.js'
].some(name=>source.endsWith('/'+name))});
console.log('Public Netlify distribution built; no private backup or seed data included.');
