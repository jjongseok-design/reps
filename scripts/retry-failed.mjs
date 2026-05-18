import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readFile, writeFile } from 'fs/promises';

const CLOUDINARY_FOLDER = 'exercise-images';
const GIPHY_KEY = 'dbfxu1x0hnRVXavZ2FXtE6rGrbp8Wxke';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

cloudinary.config({
  cloud_name: 'deuxlqtop',
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// GIPHY rate limit 대응 — GitHub free-exercise-db JPG 직접 사용
const RETRY_TARGETS = [
  {
    id: '605587ef-4f01-4e0f-b6f8-482df28a1f1b',
    name: '시티드 레그 컬',
    directUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Seated_Leg_Curl/0.jpg',
  },
  {
    id: 'efcc8313-5011-405e-8111-04cedac4c683',
    name: '랫풀다운',
    directUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Wide-Grip_Lat_Pulldown/0.jpg',
  },
];

// GIPHY에서 결과 여러 개 받아 10MB 이하인 GIF 반환
// original → downsized_large(≤8MB) → downsized(≤2MB) 순으로 시도
async function searchGiphyUnderLimit(query) {
  const url =
    `https://api.giphy.com/v1/gifs/search` +
    `?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=10&rating=g`;
  const res = await fetch(url);
  const data = await res.json();

  const candidates = data.data ?? [];

  // 1순위: original 중 10MB 이하
  for (const gif of candidates) {
    const size = parseInt(gif.images.original.size ?? '0', 10);
    if (size > 0 && size <= MAX_BYTES) return gif.images.original.url;
  }

  // 2순위: downsized_large (GIPHY 보장 ≤8MB)
  for (const gif of candidates) {
    if (gif.images.downsized_large?.url) return gif.images.downsized_large.url;
  }

  // 3순위: downsized (GIPHY 보장 ≤2MB)
  for (const gif of candidates) {
    if (gif.images.downsized?.url) return gif.images.downsized.url;
  }

  throw new Error('적합한 GIF를 찾지 못했습니다.');
}

async function uploadToCloudinary(id, sourceUrl) {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const isJpg = sourceUrl.endsWith('.jpg') || sourceUrl.endsWith('.jpeg');

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        public_id: `${CLOUDINARY_FOLDER}/${id}`,
        overwrite: true,
        resource_type: 'image',
        ...(isJpg ? {} : { format: 'gif' }),
      },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    ).end(buffer);
  });
}

async function main() {
  const results = JSON.parse(await readFile('migration-result.json', 'utf-8'));
  const sqlLines = ['-- 실패 항목 재시도 결과', `-- 생성: ${new Date().toISOString()}`, ''];

  for (const { id, name, directUrl } of RETRY_TARGETS) {
    try {
      process.stdout.write(`${name} 재시도 중 ... `);
      const cloudinaryUrl = await uploadToCloudinary(id, directUrl);
      results[id] = { name, cloudinaryUrl, status: 'success' };
      sqlLines.push(`UPDATE exercises SET image_url = '${cloudinaryUrl}' WHERE id = '${id}';`);
      console.log('완료');
    } catch (err) {
      results[id].error = err.message;
      console.log(`실패 — ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  await writeFile('migration-result.json', JSON.stringify(results, null, 2), 'utf-8');

  // 기존 SQL 파일에 추가
  const existingSql = await readFile('update-image-urls.sql', 'utf-8');
  await writeFile('update-image-urls.sql', existingSql + '\n' + sqlLines.join('\n') + '\n', 'utf-8');

  console.log('\nupdate-image-urls.sql 업데이트 완료');
}

main().catch((err) => { console.error(err.message); process.exit(1); });
