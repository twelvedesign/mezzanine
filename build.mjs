// Inlines css/ and js/ into a single page body for hosting as a Claude artifact.
// Usage: node build.mjs  ->  dist/mezzanine.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const head = html.split('<!-- page:start -->')[1].split('<!-- head:end -->')[0];
let body = html.split('<!-- body:start -->')[1].split('<!-- body:end -->')[0];

const css = readFileSync('css/style.css', 'utf8');
const headOut = head.replace('<link rel="stylesheet" href="css/style.css">', `<style>\n${css}\n</style>`);

body = body.replace(/<script src="(js\/[\w.]+)"><\/script>/g, (_, src) => `<script>\n${readFileSync(src, 'utf8')}\n</script>`);

mkdirSync('dist', { recursive: true });
// Song links copied inside the artifact open the public site, which needs no claude.ai sign-in.
const LINK = 'https://twelvedesign.github.io/mezzanine/';
writeFileSync('dist/mezzanine.html', `${headOut.trim()}\n<script>window.MZ_ARTIFACT = true; window.MZ_LINK = '${LINK}';</script>\n${body.trim()}\n`);
console.log('wrote dist/mezzanine.html');
