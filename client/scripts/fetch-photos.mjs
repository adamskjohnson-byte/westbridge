import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const projectRoot = path.resolve(process.cwd());
const publicDir = path.join(projectRoot, 'public');
const imagesDir = path.join(publicDir, 'images');
const cacheDir = path.join(projectRoot, 'scripts', '.cache');
const creditsFile = path.join(imagesDir, 'credits.json');
const apiBase = 'https://pixabay.com/api/';

const slots = [
  { file: 'products/checking.jpg', width: 800, height: 600, query: 'mobile banking phone', orientation: 'horizontal' },
  { file: 'products/savings.jpg', width: 800, height: 600, query: 'saving money planning', orientation: 'horizontal' },
  { file: 'products/credit-cards.jpg', width: 800, height: 600, query: 'contactless card payment', orientation: 'horizontal' },
  { file: 'products/loans.jpg', width: 800, height: 600, query: 'small business owner', orientation: 'horizontal' },
  { file: 'products/mortgages.jpg', width: 800, height: 600, query: 'family new home keys', orientation: 'horizontal' },
  { file: 'sections/support.jpg', width: 800, height: 1000, query: 'customer service headset', orientation: 'vertical' },
  { file: 'sections/security.jpg', width: 1200, height: 800, query: 'phone security login', orientation: 'horizontal' },
  { file: 'sections/cta-banner.jpg', width: 1920, height: 820, query: 'city skyline sunrise', orientation: 'horizontal' },
  { file: 'sections/branch.jpg', width: 1200, height: 800, query: 'bank interior', orientation: 'horizontal' },
  { file: 'blog/tip-1.jpg', width: 800, height: 450, query: 'budget calculator', orientation: 'horizontal' },
  { file: 'blog/tip-2.jpg', width: 800, height: 450, query: 'online security laptop', orientation: 'horizontal' },
  { file: 'blog/tip-3.jpg', width: 800, height: 450, query: 'savings coins jar', orientation: 'horizontal' },
  { file: 'about/team.jpg', width: 1200, height: 800, query: 'business team meeting', orientation: 'horizontal' },
  { file: 'about/headquarters.jpg', width: 1200, height: 800, query: 'modern office building', orientation: 'horizontal' },
];

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith('--')) continue;
  const key = arg.slice(2);
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) {
    args.set(key, next);
    i += 1;
  } else {
    args.set(key, 'true');
  }
}

const listOnly = args.has('list');
const force = args.has('force');
const onlyName = args.get('only');
const pickIndex = Math.max(1, Number(args.get('pick') ?? '1'));

function ensureDirectories() {
  fs.mkdirSync(imagesDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
}

function getTargetSlots() {
  if (!onlyName) return slots;
  return slots.filter((slot) => {
    const name = path.basename(slot.file, path.extname(slot.file));
    return name === onlyName || slot.file.includes(onlyName);
  });
}

function printMissingApiKey() {
  console.error('PIXABAY_API_KEY is missing. Get a free key at https://pixabay.com/api/docs/ and add it to client/.env.local.');
  process.exit(1);
}

function loadCredits() {
  if (!fs.existsSync(creditsFile)) return [];
  try {
    const raw = fs.readFileSync(creditsFile, 'utf8');
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeCredits(entries) {
  fs.writeFileSync(creditsFile, `${JSON.stringify(entries, null, 2)}\n`);
}

function readCache(cacheKey) {
  const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
  if (!fs.existsSync(cacheFile)) return null;
  try {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const ageMs = Date.now() - fs.statSync(cacheFile).mtimeMs;
    if (ageMs > 24 * 60 * 60 * 1000) {
      fs.unlinkSync(cacheFile);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCache(cacheKey, payload) {
  const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
  fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2));
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'westbridge-photo-fetcher/1.0',
    },
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after') ?? '60');
    console.error(`Pixabay rate limit reached. Wait ${retryAfter} seconds before retrying.`);
    process.exit(1);
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function buildSearchUrl(slot, apiKey) {
  const url = new URL(apiBase);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', slot.query);
  url.searchParams.set('image_type', 'photo');
  url.searchParams.set('orientation', slot.orientation);
  url.searchParams.set('safesearch', 'true');
  url.searchParams.set('min_width', String(Math.min(slot.width, 1280)));
  url.searchParams.set('per_page', '20');
  url.searchParams.set('order', 'popular');
  return url.toString();
}

async function searchSlot(slot, apiKey) {
  const cacheKey = `search-${slot.file.replace(/\W+/g, '-')}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const queryVariants = [slot.query];
  const firstTwoWords = slot.query.split(/\s+/).slice(0, 2).join(' ');
  if (firstTwoWords && firstTwoWords !== slot.query) queryVariants.push(firstTwoWords);

  for (let i = 0; i < queryVariants.length; i += 1) {
    const query = queryVariants[i];
    const slotWithQuery = { ...slot, query };
    const url = buildSearchUrl(slotWithQuery, apiKey);
    try {
      const payload = await fetchJson(url);
      if (Array.isArray(payload.hits) && payload.hits.length > 0) {
        writeCache(cacheKey, payload);
        return payload;
      }
    } catch (error) {
      console.warn(`fetch warning for ${slot.file}: ${error.message}`);
    }

    if (i < queryVariants.length - 1) {
      console.warn(`no result for ${slot.file}; retrying with a shorter query.`);
    }
  }

  return { hits: [] };
}

function resizeDimensions(sourceWidth, sourceHeight, targetWidth, targetHeight) {
  const maxWidth = sourceWidth > 0 ? Math.round(sourceWidth * 1.1) : targetWidth;
  const maxHeight = sourceHeight > 0 ? Math.round(sourceHeight * 1.1) : targetHeight;
  return {
    width: Math.min(targetWidth, maxWidth),
    height: Math.min(targetHeight, maxHeight),
  };
}

async function saveSlot(slot, hit) {
  const outputPath = path.join(imagesDir, slot.file);
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });

  const response = await fetch(hit.largeImageURL);
  if (!response.ok) {
    throw new Error(`Could not fetch image for ${slot.file}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const image = (await import('sharp')).default(buffer);
  const meta = await image.metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;

  if (sourceWidth < slot.width || sourceHeight < slot.height) {
    console.warn(`warning: ${slot.file} source image is smaller than the slot; scaling up by at most 10% only.`);
  }

  const adjusted = resizeDimensions(sourceWidth, sourceHeight, slot.width, slot.height);
  let finalBuffer = null;
  let quality = 82;

  while (quality >= 60) {
    finalBuffer = await (await import('sharp')).default(buffer)
      .resize({
        width: adjusted.width,
        height: adjusted.height,
        fit: 'cover',
        position: 'attention',
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    if (finalBuffer.length <= 220 * 1024) break;
    quality -= 2;
  }

  if (!finalBuffer) {
    finalBuffer = await (await import('sharp')).default(buffer)
      .resize({
        width: adjusted.width,
        height: adjusted.height,
        fit: 'cover',
        position: 'attention',
      })
      .jpeg({ quality: 60, progressive: true })
      .toBuffer();
  }

  fs.writeFileSync(outputPath, finalBuffer);
  return {
    file: slot.file,
    user: hit.user,
    pageURL: hit.pageURL,
    source: 'Pixabay',
    sizeKb: Number((finalBuffer.length / 1024).toFixed(1)),
  };
}

async function runSlot(slot) {
  const targetPath = path.join(imagesDir, slot.file);
  const exists = fs.existsSync(targetPath);
  if (exists && !force) {
    return { slot: slot.file, status: 'skipped', sizeKb: Number((fs.statSync(targetPath).size / 1024).toFixed(1)), photographer: '-' };
  }

  if (listOnly) {
    return {
      slot: slot.file,
      status: exists ? 'exists' : 'missing',
      sizeKb: exists ? Number((fs.statSync(targetPath).size / 1024).toFixed(1)) : 0,
      photographer: '-',
    };
  }

  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) printMissingApiKey();

  const payload = await searchSlot(slot, apiKey);
  const hits = Array.isArray(payload.hits) ? payload.hits : [];
  if (!hits.length) return { slot: slot.file, status: 'no result', sizeKb: 0, photographer: '-' };

  const chosenIndex = Math.min(Math.max(pickIndex - 1, 0), hits.length - 1);
  const hit = hits[chosenIndex] || hits[0];

  try {
    const saved = await saveSlot(slot, hit);
    return { slot: slot.file, status: 'saved', sizeKb: saved.sizeKb, photographer: saved.user };
  } catch (error) {
    console.error(`error: ${slot.file}: ${error.message}`);
    return { slot: slot.file, status: 'error', sizeKb: 0, photographer: '-' };
  }
}

async function main() {
  ensureDirectories();
  const selectedSlots = getTargetSlots();
  const apiKey = process.env.PIXABAY_API_KEY;

  if (listOnly) {
    const rows = selectedSlots.map((slot) => {
      const target = path.join(imagesDir, slot.file);
      return { slot: slot.file, status: fs.existsSync(target) ? 'exists' : 'missing' };
    });
    console.table(rows.map((row) => ({ slot: row.slot, status: row.status })));
    return;
  }

  if (!apiKey) printMissingApiKey();

  const credits = loadCredits();
  const results = [];
  for (const slot of selectedSlots) {
    await delay(180);
    const result = await runSlot(slot);
    results.push(result);

    if (result.status === 'saved') {
      const hit = await searchSlot(slot, apiKey);
      const chosenHit = Array.isArray(hit.hits) ? (hit.hits[Math.min(Math.max(pickIndex - 1, 0), hit.hits.length - 1)] || hit.hits[0]) : null;
      if (chosenHit) {
        const entry = { file: slot.file, user: chosenHit.user, pageURL: chosenHit.pageURL, source: 'Pixabay' };
        const index = credits.findIndex((item) => item.file === slot.file);
        if (index >= 0) credits[index] = entry; else credits.push(entry);
        writeCredits(credits);
      }
    }
  }

  console.table(results.map((row) => ({ slot: row.slot, status: row.status, size: `${row.sizeKb || 0} KB`, photographer: row.photographer })));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
