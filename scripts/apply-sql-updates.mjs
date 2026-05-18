import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';

const supabase = createClient(
  'https://zsafusllrolzllwcyyjh.supabase.co',
  process.env.SUPABASE_SERVICE_KEY
);

const sql = await readFile('update-image-urls.sql', 'utf-8');

const updates = sql
  .split('\n')
  .filter((line) => line.startsWith('UPDATE exercises'))
  .map((line) => {
    const urlMatch = line.match(/image_url = '([^']+)'/);
    const idMatch = line.match(/id = '([^']+)'/);
    return { id: idMatch[1], imageUrl: urlMatch[1] };
  });

console.log(`총 ${updates.length}개 업데이트 시작...\n`);

let success = 0;
let failed = 0;

for (const { id, imageUrl } of updates) {
  const { error } = await supabase
    .from('exercises')
    .update({ image_url: imageUrl })
    .eq('id', id);

  if (error) {
    console.error(`❌ ${id}: ${error.message}`);
    failed++;
  } else {
    success++;
    process.stdout.write(`\r진행: ${success + failed}/${updates.length}`);
  }
}

console.log(`\n\n완료 — 성공: ${success}개 / 실패: ${failed}개`);
