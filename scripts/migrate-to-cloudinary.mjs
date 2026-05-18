import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import { readFile, writeFile } from 'fs/promises';

// ── 설정 ──────────────────────────────────────────────────────────────────────
const CLOUDINARY_FOLDER = 'exercise-images';
const CSV_PATH = 'exercises-export.csv';
const RESULT_PATH = 'migration-result.json';
const SQL_PATH = 'update-image-urls.sql';
const GIPHY_KEY = 'dbfxu1x0hnRVXavZ2FXtE6rGrbp8Wxke';

const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error('필수 환경변수가 없습니다. .env 파일을 확인하세요:');
  console.error('  CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET');
  process.exit(1);
}

cloudinary.config({
  cloud_name: 'deuxlqtop',
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

// ── 운동명 → GIPHY 검색어 매핑 (100개 전체) ───────────────────────────────────
const GIPHY_MAP = {
  // 가슴
  '벤치프레스':                    'barbell bench press exercise',
  '덤벨 벤치프레스':               'dumbbell bench press exercise',
  '인클라인 벤치프레스':           'incline bench press exercise',
  '인클라인 덤벨 벤치프레스':      'incline dumbbell press exercise',
  '인클라인 덤벨 플라이':          'incline dumbbell fly exercise',
  '덤벨 플라이':                   'dumbbell fly exercise',
  '덤벨 풀오버':                   'dumbbell pullover exercise',
  '딥스':                          'chest dips exercise',
  '펙덱 플라이 머신':              'pec deck fly machine exercise',
  '디클라인 덤벨 플라이':          'decline dumbbell fly exercise',
  '디클라인 체스트 프레스 머신':   'decline chest press machine exercise',
  '인클라인 케이블 플라이':        'incline cable fly exercise',
  '스미스머신 벤치프레스':         'smith machine bench press exercise',
  '스미스머신 인클라인 벤치프레스':'smith machine incline bench press exercise',
  '체스트 프레스 머신':            'chest press machine exercise',
  '시티드 딥스 머신':              'seated dip machine exercise',
  '해머 벤치프레스':               'hammer strength chest press exercise',
  '어시스트 딥스 머신':            'assisted dip machine exercise',
  '바벨 플로어 프레스':            'barbell floor press exercise',
  '푸시업':                        'push up exercise',
  '인클라인 푸시업':               'incline push up exercise',
  '힌두 푸시업':                   'hindu push up exercise',
  '클랩 푸시업':                   'clap push up exercise',
  '아처 푸시업':                   'archer push up exercise',
  // 하체
  '바벨 백스쿼트':                 'barbell back squat exercise',
  '프론트 스쿼트':                 'front squat exercise',
  '바벨 박스 스쿼트':              'box squat exercise',
  '바벨 점프 스쿼트':              'jump squat exercise',
  '바벨 레터럴 런지':              'lateral lunge exercise',
  '바벨 스플릿 스쿼트':           'barbell split squat exercise',
  '덤벨 스쿼트':                   'dumbbell squat exercise',
  '덤벨 스모 스쿼트':             'dumbbell sumo squat exercise',
  '덤벨 고블릿 스쿼트':           'goblet squat exercise',
  '케틀벨 스모 스쿼트':           'kettlebell sumo squat exercise',
  '피스톨 스쿼트':                 'pistol squat exercise',
  '바벨 오버헤드 스쿼트':         'overhead squat exercise',
  '정지 데드리프트':               'pause deadlift exercise',
  '스티프 레그 데드리프트':        'stiff leg deadlift exercise',
  '덤벨 스티프 레그 데드리프트':   'dumbbell stiff leg deadlift exercise',
  '스미스머신 데드리프트':         'smith machine deadlift exercise',
  '데피싯 데드리프트':             'deficit deadlift exercise',
  '바벨 원레그 데드리프트':        'single leg deadlift exercise',
  '시티드 레그 컬':                'seated leg curl exercise',
  '글루트 브릿지':                 'glute bridge exercise',
  '라잉 힙 어브덕션':              'lying hip abduction exercise',
  '케이블 풀 스루':                'cable pull through exercise',
  '맨몸 카프 레이즈':              'bodyweight calf raise exercise',
  '덤벨 런지':                     'dumbbell lunge exercise',
  // 등
  '풀업':                          'pull up exercise',
  '인버티드 로우':                 'inverted row exercise',
  '랫풀다운':                      'lat pulldown exercise',
  '언더그립 랫풀다운':             'underhand lat pulldown exercise',
  '맥그립 랫풀다운':               'neutral grip lat pulldown exercise',
  '어시스트 풀업 머신':            'assisted pull up machine exercise',
  '덤벨 로우':                     'dumbbell row exercise',
  '시티드 로우 머신':              'seated row machine exercise',
  '플로어 시티드 케이블 로우':     'seated cable row exercise',
  '백 익스텐션':                   'back extension exercise',
  '굿모닝 엑서사이즈':             'good morning exercise',
  // 이두
  '이지바 컬':                     'ez bar curl exercise',
  '이지바 리스트 컬':              'wrist curl exercise',
  '이지바 프리쳐 컬':              'ez bar preacher curl exercise',
  '덤벨 프리쳐 컬':               'dumbbell preacher curl exercise',
  '암 컬 머신':                    'arm curl machine exercise',
  '케이블 해머컬':                 'cable hammer curl exercise',
  '리버스 바벨 컬':                'reverse barbell curl exercise',
  '리버스 덤벨 리스트 컬':         'reverse wrist curl exercise',
  // 삼두
  '스컬 크러셔':                   'skull crusher exercise',
  '덤벨 트라이셉 익스텐션':        'dumbbell tricep extension exercise',
  '케이블 푸시 다운':              'cable tricep pushdown exercise',
  '케이블 라잉 트라이셉 익스텐션': 'cable lying tricep extension exercise',
  '트라이셉 익스텐션 머신':        'tricep extension machine exercise',
  '벤치 딥스':                     'bench dips exercise',
  // 복근/코어
  '플랭크':                        'plank exercise',
  '할로우 락':                     'hollow rock exercise',
  '할로우 포지션':                 'hollow body hold exercise',
  '덤벨 사이드 벤드':              'dumbbell side bend exercise',
  '복근 롤아웃':                   'ab wheel rollout exercise',
  '복근 에어 바이크':              'bicycle crunch exercise',
  '행잉 니 레이즈':                'hanging knee raise exercise',
  '복근 크런치 머신':              'crunch machine exercise',
  '레그 레이즈':                   'leg raise exercise',
  '힐 터치':                       'heel touch crunch exercise',
  '필라테스 잭나이프':             'jackknife exercise',
  '리버스 크런치':                 'reverse crunch exercise',
  // 올림픽/파워
  '행 클린':                       'hang clean exercise',
  '행 스내치':                     'hang snatch exercise',
  '클린 & 저크':                   'clean and jerk exercise',
  '스내치':                        'snatch exercise',
  '스내치 하이풀':                 'snatch high pull exercise',
  '케틀벨 스내치':                 'kettlebell snatch exercise',
  '스모 데드리프트 하이풀':        'sumo deadlift high pull exercise',
  // 유산소/기능성
  '달리기':                        'running exercise',
  '스텝밀':                        'stairmill exercise',
  '하이니 스킵':                   'high knee skip exercise',
  '박스 점프':                     'box jump exercise',
  '버피':                          'burpee exercise',
  '점핑 잭':                       'jumping jack exercise',
  '링 머슬업':                     'ring muscle up exercise',
  '덤벨 쓰러스터':                 'dumbbell thruster exercise',
};

// ── CSV 파싱 ──────────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split('\n').slice(1);
  return lines
    .map((line) => {
      const parts = line.trim().split(',');
      const id = parts[0];
      const urlIdx = parts.findIndex((p) => p.startsWith('https://'));
      const name = parts.slice(1, urlIdx).join(',');
      return { id, name };
    })
    .filter((r) => r.id && r.name);
}

// ── GIPHY에서 GIF URL 검색 ────────────────────────────────────────────────────
async function searchGiphy(query) {
  const url =
    `https://api.giphy.com/v1/gifs/search` +
    `?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=1&rating=g`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GIPHY API 오류 (${res.status})`);
  const data = await res.json();
  if (!data.data?.length) throw new Error(`결과 없음: "${query}"`);
  return data.data[0].images.original.url;
}

// ── GIF URL 다운로드 후 Cloudinary 업로드 ────────────────────────────────────
async function uploadToCloudinary(id, gifUrl) {
  const publicId = `${CLOUDINARY_FOLDER}/${id}`;
  const res = await fetch(gifUrl);
  if (!res.ok) throw new Error(`다운로드 실패 (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { public_id: publicId, overwrite: true, resource_type: 'image', format: 'gif' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

// ── SQL 파일 생성 ─────────────────────────────────────────────────────────────
function buildSql(updates) {
  const lines = [
    '-- Supabase SQL Editor에서 실행하세요.',
    `-- 생성: ${new Date().toISOString()}`,
    '',
  ];
  for (const { id, cloudinaryUrl } of updates) {
    lines.push(`UPDATE exercises SET image_url = '${cloudinaryUrl}' WHERE id = '${id}';`);
  }
  return lines.join('\n') + '\n';
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n[1/3] ${CSV_PATH} 읽는 중...`);
  const csv = await readFile(CSV_PATH, 'utf-8');
  const exercises = parseCsv(csv);
  console.log(`      → ${exercises.length}개 항목 파싱 완료\n`);

  const results = {};
  const succeeded = [];
  const failed = [];

  console.log('[2/3] GIPHY 검색 → Cloudinary 업로드 중...\n');

  for (let i = 0; i < exercises.length; i++) {
    const { id, name } = exercises[i];
    const progress = `[${i + 1}/${exercises.length}]`;

    try {
      process.stdout.write(`${progress} ${name} ... `);

      const query = GIPHY_MAP[name];
      if (!query) throw new Error(`GIPHY_MAP에 매핑 없음`);

      const gifUrl = await searchGiphy(query);
      const cloudinaryUrl = await uploadToCloudinary(id, gifUrl);

      results[id] = { name, cloudinaryUrl, status: 'success' };
      succeeded.push({ id, cloudinaryUrl });
      console.log('완료');
    } catch (err) {
      results[id] = { name, status: 'failed', error: err.message };
      failed.push({ id, name, error: err.message });
      console.log(`실패 — ${err.message}`);
    }

    // GIPHY rate limit 방지
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log(`\n[3/3] 결과 파일 저장 중...`);
  await writeFile(RESULT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`      → ${RESULT_PATH} 저장`);

  if (succeeded.length > 0) {
    await writeFile(SQL_PATH, buildSql(succeeded), 'utf-8');
    console.log(`      → ${SQL_PATH} 저장 (${succeeded.length}개 UPDATE 구문)`);
  }

  console.log('\n' + '─'.repeat(50));
  console.log('마이그레이션 완료');
  console.log(`  성공: ${succeeded.length}개`);
  console.log(`  실패: ${failed.length}개`);
  if (failed.length > 0) {
    console.log('\n실패 목록:');
    failed.forEach(({ name, error }) => console.log(`  - ${name}: ${error}`));
  }
  if (succeeded.length > 0) {
    console.log(`\n다음 단계: Supabase SQL Editor에서 ${SQL_PATH}를 실행하세요.`);
  }
  console.log('─'.repeat(50));
}

main().catch((err) => {
  console.error('\n스크립트 오류:', err.message);
  process.exit(1);
});
