import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import './build.js';

const destination=new URL('./_site/',import.meta.url);
mkdirSync(destination,{recursive:true});
for(const name of ['index.html','style.css','browser.js','kentällä text.png','kentällä app icon.png']) {
  copyFileSync(new URL(name,import.meta.url),new URL(name,destination));
}
writeFileSync(new URL('.nojekyll',destination),'');
console.log('Static website built in _site');
