import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const path of ['index.html','favicon.svg','.nojekyll','src','data']) await cp(path,`dist/${path}`,{recursive:true});
console.log('Static app built in dist/. No runtime dependencies.');
