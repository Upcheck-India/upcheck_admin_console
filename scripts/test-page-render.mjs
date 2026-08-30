/**
 * Does the data room's server-side page render actually produce a page?
 *
 * This exists because it did not. The first version of page-render.js passed
 * pdf.js a *relative* standardFontDataUrl, and pdf.js's Node data factory
 * failed to read it — silently. No exception, no warning that stopped
 * anything: every glyph was skipped and the endpoint served a pristine blank
 * white PNG for every text page. Nothing else in the codebase would have
 * caught that, because the code "worked".
 *
 * So the assertion that matters here is not "a PNG came out". It is "the PNG
 * has ink on it".
 *
 * Runs without MongoDB. It builds a one-page PDF by hand and drives pdf.js,
 * @napi-rs/canvas and sharp exactly the way page-render.js does.
 *
 *   node scripts/test-page-render.mjs
 */
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createCanvas } from '@napi-rs/canvas';
import sharpMod from 'sharp';

const sharp = sharpMod.default || sharpMod;
const require_ = createRequire(import.meta.url);

// Resolved exactly as page-render.js resolves it: absolute, plain filesystem
// path, trailing separator. A file:// URL here renders blank.
const PDFJS_ROOT = path.dirname(require_.resolve('pdfjs-dist/package.json'));
const STANDARD_FONTS = path.join(PDFJS_ROOT, 'standard_fonts') + path.sep;
const CMAPS = path.join(PDFJS_ROOT, 'cmaps') + path.sep;

const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

/** A minimal, valid, text-only PDF. Text-only is the point: it is the case
 *  that breaks when font loading is wrong. */
const SAMPLE_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length 47>>stream
BT /F1 24 Tf 30 100 Td (Upcheck) Tj ET
endstream
endobj
trailer<</Size 6/Root 1 0 R>>`,
  'latin1',
);

let passed = 0;
function ok(label) {
  console.log('  ok ', label);
  passed += 1;
}

async function openSample() {
  return pdfjs.getDocument({
    data: new Uint8Array(SAMPLE_PDF),
    standardFontDataUrl: STANDARD_FONTS,
    cMapUrl: CMAPS,
    cMapPacked: true,
    useSystemFonts: false,
  }).promise;
}

/** Render one page the way getRenderedPage does, and return the PNG. */
async function renderSample(doc, width) {
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });

  const surface = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = surface.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, surface.width, surface.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return { png: surface.toBuffer('image/png'), width: surface.width, height: surface.height };
}

console.log('\nthe font data path (the bug this file exists for)');

const fs = await import('node:fs');
assert.ok(fs.existsSync(STANDARD_FONTS), `standard_fonts missing at ${STANDARD_FONTS}`);
ok('pdfjs-dist ships standard_fonts where we resolve it');
assert.ok(!STANDARD_FONTS.startsWith('file:'), 'must be a plain path, not a file:// URL');
assert.ok(STANDARD_FONTS.endsWith(path.sep), 'must end with a separator');
assert.ok(path.isAbsolute(STANDARD_FONTS), 'must be absolute, not relative to cwd');
ok('the path is absolute, plain, and separator-terminated');

console.log('\nrendering');

const doc = await openSample();
assert.strictEqual(doc.numPages, 1);
ok('the sample PDF opens and reports one page');

const rendered = await renderSample(doc, 900);
assert.strictEqual(rendered.png.subarray(1, 4).toString(), 'PNG');
assert.strictEqual(rendered.width, 900);
assert.strictEqual(rendered.height, 600);
ok('renders a 900x600 PNG at the requested width');

const stats = await sharp(rendered.png).stats();
const mean = stats.channels[0].mean;
assert.ok(
  mean < 254.9,
  `page rendered blank (mean luminance ${mean.toFixed(2)}) — the fonts did not load`,
);
ok(`the page has ink on it (mean luminance ${mean.toFixed(2)}, blank would be 255.00)`);

console.log('\nthe watermark composite');

const fontSize = Math.max(18, Math.round(rendered.width / 26));
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${rendered.width}" height="${rendered.height}">` +
    `<text x="40" y="120" font-family="sans-serif" font-size="${fontSize}" fill="#0f172a" ` +
    `fill-opacity="0.10" transform="rotate(-30 40 120)">reader@example.com</text></svg>`,
);
const marked = await sharp(rendered.png).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();

assert.strictEqual(marked.subarray(1, 4).toString(), 'PNG');
ok('the watermarked result is still a PNG');

const markedMean = (await sharp(marked).stats()).channels[0].mean;
assert.ok(markedMean < mean, 'the watermark darkened nothing — the composite did not apply');
ok(`the watermark is in the pixels (${mean.toFixed(2)} -> ${markedMean.toFixed(2)})`);

await doc.destroy();

console.log(`\n${passed} checks passed.\n`);
