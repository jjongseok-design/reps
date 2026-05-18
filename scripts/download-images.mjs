import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const OUT_DIR = 'exercise-images-backup';

const { data: exercises, error } = await supabase
  .from('exercises')
  .select('id, name, image_url')
  .not('image_url', 'is', null);

if (error) { console.error('DB 조회 실패:', error.message); process.exit(1); }

if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR);

console.log(`총 ${exercises.length}개 이미지 다운로드 시작...\n`);

let success = 0, failed = 0;

for (const ex of exercises) {
  try {
    const res = await fetch(ex.image_url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = ex.image_url.split('.').pop().split('?')[0] || 'jpg';
    const safeName = ex.name.replace(/[\\/:*?"<>|]/g, '_');
    const filePath = path.join(OUT_DIR, `${safeName}.${ext}`);

    await writeFile(filePath, buffer);
    success++;
    process.stdout.write(`\r진행: ${success + failed}/${exercises.length} — ${ex.name}`);
  } catch (err) {
    failed++;
    console.log(`\n❌ ${ex.name}: ${err.message}`);
  }
}

console.log(`\n\n완료 — 성공: ${success}개 / 실패: ${failed}개`);
console.log(`저장 위치: ${path.resolve(OUT_DIR)}`);
