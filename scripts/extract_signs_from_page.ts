/**
 * Extract signs from local HTML snapshot and download images.
 *
 * Input HTML: src/lib/assets/page.htm
 * For each .card:
 *  - Find image URL inside .card-img-top (support <img> or CSS background-image)
 *  - Find name inside .card-text-red (same card/section)
 *  - Clean leading code numbers (e.g., "1044-10 – Nur für Schwerbehinderte" -> "Nur für Schwerbehinderte")
 *  - Keep non-leading numbers intact (e.g., "1004-31 Halt nach 100 m" -> "Halt nach 100 m")
 * Outputs:
 *  - Downloads images to static/signs/
 *  - Writes dataset to src/lib/generated-signs.ts
 */

import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';

const INPUT_HTML = path.resolve('src', 'lib', 'assets', 'page.htm');
const OUT_DIR = path.resolve('static', 'signs');
const DATA_OUT = path.resolve('src', 'lib', 'generated-signs.ts');
// No network access: operate only on local snapshot alongside page.htm

type Extracted = {
    id: string; // leading code if present, else slug
    rawTitle: string;
    cleanTitle: string;
    imgUrl: string; // absolute URL to download
    rawSrc: string; // original src attribute as-is (e.g., "page_files/xxx.png")
    fileName: string; // destination filename
    src: string; // "/signs/<fileName>"
};

// We keep the raw src (possibly URL-encoded) and resolve to local files

function extractBackgroundImage(style?: string | null): string | null {
    if (!style) return null;
    const m = style.match(/background-image\s*:\s*url\(([^)]+)\)/i);
    if (!m) return null;
    return m[1].replace(/^['"]|['"]$/g, '');
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

function extractLeadingCode(title: string): { code?: string; remainder: string } {
    // Capture sequences like 1044-10, 330.1, 101, optionally followed by dash/emdash and spaces
    const re = /^\s*([0-9][0-9\.-]*)\s*(?:[–-])?\s*(.*)$/u;
    const m = title.match(re);
    if (!m) return { remainder: title.trim() };
    const code = m[1];
    const remainder = m[2] ? m[2].trim() : '';
    return { code, remainder };
}

// Local copy instead of download: resolve "page_files/..." next to page.htm
function resolveLocalAsset(url: string): string | null {
    let u = url.trim();
    if (!u) return null;
    // Strip query/hash if any
    u = u.replace(/[?#].*$/, '');
    // Remove leading ./
    u = u.replace(/^\.\//, '');
    // Ignore absolute or protocol URLs entirely; we only accept relative paths
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('//') || u.startsWith('/')) return null;

    const assetsRoot = path.resolve('src', 'lib', 'assets');
    const tryPaths: string[] = [];

    // 1) as-is relative under assets (e.g., page_files/xxx.png)
    tryPaths.push(path.resolve(assetsRoot, u));

    // 2) decoded URL component (handles %C3%A4 -> ä etc.)
    try {
        const dec = decodeURIComponent(u);
        if (dec !== u) tryPaths.push(path.resolve(assetsRoot, dec));
    } catch {
        // ignore decode errors
    }

    // 3) basename lookup inside page_files (in case relative folder structure differs)
    const base = path.basename(u);
    tryPaths.push(path.resolve(assetsRoot, 'page_files', base));
    try {
        const decBase = decodeURIComponent(base);
        if (decBase !== base) tryPaths.push(path.resolve(assetsRoot, 'page_files', decBase));
    } catch {
        // ignore
    }

    for (const p of tryPaths) {
        if (existsSync(p)) return p;
    }
    return null;
}

async function main() {
    await mkdir(OUT_DIR, { recursive: true });
    const html = await readFile(INPUT_HTML, 'utf8');
    const $ = cheerio.load(html);

    const items: Extracted[] = [];

    $('.card').each((_, card) => {
        const $card = $(card);
        // Find image inside .card-img-top (could be <img> or a div)
        const imgTop = $card.find('img.card-img-top, .card-img-top').first();
        let imgUrl = '';
        let rawSrc = '';
        if (imgTop.length) {
            const src = imgTop.attr('src') || imgTop.attr('data-src');
            if (src) {
                rawSrc = src;
                imgUrl = src; // keep raw; no network lookups
            } else {
                const bg = extractBackgroundImage(imgTop.attr('style') || null);
                if (bg) {
                    rawSrc = bg;
                    imgUrl = bg;
                }
            }
        }
        if (!imgUrl) return; // skip if no image

        // Title inside the same card (page uses .card-title links)
        const titleEl = $card.find('.card-title, .card-text-red, .card-text').first();
        const rawTitle = titleEl.text().replace(/\s+/g, ' ').trim();
        if (!rawTitle) return;

        const { code, remainder } = extractLeadingCode(rawTitle);
        const cleanTitle = remainder || rawTitle; // fallback if not matched
        const id = code || slugify(cleanTitle);

        // pick extension from local/relative path without using URL()
        const cleanPath = (rawSrc || imgUrl).replace(/[?#].*$/, '');
        let decodedPath = cleanPath;
        try { decodedPath = decodeURIComponent(cleanPath); } catch {}
        const ext = path.extname(decodedPath) || '.png';
        const baseName = `${id}-${slugify(cleanTitle)}`;
        const fileName = `${baseName}${ext}`;
        const srcPath = `/signs/${fileName}`;

        items.push({ id, rawTitle, cleanTitle, imgUrl, rawSrc: rawSrc || '', fileName, src: srcPath });
    });

    // Deduplicate by id (first occurrence kept)
    const seen = new Set<string>();
    const unique: Extracted[] = [];
    for (const it of items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        unique.push(it);
    }

    // Copy/move images from local page_files
    for (const it of unique) {
        const localSrc = resolveLocalAsset(it.rawSrc || '') || resolveLocalAsset(it.imgUrl);
        if (!localSrc) {
            // eslint-disable-next-line no-console
            console.warn('skip remote', it.imgUrl);
            continue;
        }
        const dest = path.join(OUT_DIR, it.fileName);
        try {
            await copyFile(localSrc, dest);
            // eslint-disable-next-line no-console
            console.log('copied', localSrc, '->', dest);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.warn('failed copy', localSrc, e);
        }
    }

    // Generate dataset TS
    const dataset = unique.map(({ id, cleanTitle, src }) => ({ id, title: cleanTitle, aliases: [], src }));
    const banner = `// Auto-generated from local ${path.relative(process.cwd(), INPUT_HTML)}\n`;
    const content =
        banner +
        'export type TrafficSign = { id: string; title: string; aliases: string[]; src: string };\n' +
        'export const SIGNS: TrafficSign[] = ' + JSON.stringify(dataset, null, 2) + ';\n';
    await writeFile(DATA_OUT, content, 'utf8');

    // eslint-disable-next-line no-console
    console.log('Done. Extracted:', unique.length);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
});


