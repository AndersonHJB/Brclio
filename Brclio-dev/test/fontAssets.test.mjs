import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDirectory = join(projectRoot, 'public');
const fontUrl = '/fonts/HuiwenMincho.ttf';
const fontSha256 = '90bb5b835fd5841a46fa8fca4fe1c82aeb4b9c02be15eadc3effc60dad4fef58';
const huiwenDeclaration = /@font-face\s*\{(?=[^}]*font-family:\s*['"]Huiwen Mincho['"])(?=[^}]*src:\s*url\(['"]?\/fonts\/HuiwenMincho\.ttf['"]?\)\s*format\(['"]truetype['"]\))[^}]*\}/i;
const legacyFontSource = /https:\/\/hiesther\.com\/HuiwenMincho\.ttf|url\(['"]?HuiwenMincho\.ttf['"]?\)/i;

async function collectHtmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [entryPath] : [];
  }));
  return nestedFiles.flat();
}

test('serves one local Huiwen Mincho asset to every page that uses it', async () => {
  const fontFile = join(publicDirectory, 'fonts', 'HuiwenMincho.ttf');
  const fontStats = await stat(fontFile);
  assert.ok(fontStats.size > 0, 'HuiwenMincho.ttf should not be empty');
  const fontData = await readFile(fontFile);
  assert.equal(fontData.subarray(0, 4).toString('hex'), '00010000', 'font should have a TrueType signature');
  assert.equal(createHash('sha256').update(fontData).digest('hex'), fontSha256, 'font should match the supplied file');

  const htmlFiles = await collectHtmlFiles(publicDirectory);
  const pagesUsingHuiwen = [];

  for (const htmlFile of htmlFiles) {
    const source = await readFile(htmlFile, 'utf8');
    assert.doesNotMatch(source, legacyFontSource, `${htmlFile} must not use a missing Huiwen font path`);
    if (!source.includes("'Huiwen Mincho'")) continue;
    pagesUsingHuiwen.push(relative(publicDirectory, htmlFile));
    assert.match(source, huiwenDeclaration, `${htmlFile} must declare ${fontUrl}`);
  }

  assert.deepEqual(pagesUsingHuiwen.sort(), [
    'hero-playground.html',
    'tutorials/cola+ob自媒体分享/04-system.html',
    'tutorials/cola+ob自媒体分享/demo-design-skill-cards.html',
    'tutorials/cola+ob自媒体分享/demo-readme-tutorial.html',
    'tutorials/cola+ob自媒体分享/index.html',
    'tutorials/esther-design-system/demo-readme-cards.html',
    'tutorials/esther-design-system/index.html',
    'website-ver1.html',
  ]);
});
