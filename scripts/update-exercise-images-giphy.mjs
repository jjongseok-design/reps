import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zsafusllrolzllwcyyjh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzYWZ1c2xscm9semxsd2N5eWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjYzOTEsImV4cCI6MjA5MDc0MjM5MX0.2POT3ABgGNhBs4Fyj_43X2QXm7rge2ZQL_GMoVbPqDQ'
)

const GIPHY_KEY = 'dbfxu1x0hnRVXavZ2FXtE6rGrbp8Wxke'

const nameMap = {
  '스쿼트': 'barbell squat exercise',
  '프론트 스쿼트': 'front squat exercise',
  '런지': 'lunge exercise',
  '워킹 런지': 'walking lunge exercise',
  '덤벨 런지': 'dumbbell lunge exercise',
  '레그 프레스': 'leg press exercise',
  '레그 익스텐션': 'leg extension exercise',
  '레그 컬': 'leg curl exercise',
  '씨티드 레그 컬': 'seated leg curl exercise',
  '힙 쓰러스트': 'hip thrust exercise',
  '힙 쓰러스트 머신': 'hip thrust machine exercise',
  '데드리프트': 'deadlift exercise',
  '루마니안 데드리프트': 'romanian deadlift exercise',
  '덤벨 데드리프트': 'dumbbell deadlift exercise',
  '불가리안 스플릿 스쿼트': 'bulgarian split squat exercise',
  '벤치프레스': 'bench press exercise',
  '인클라인 벤치프레스': 'incline bench press exercise',
  '디클라인 벤치프레스': 'decline bench press exercise',
  '덤벨 벤치프레스': 'dumbbell bench press exercise',
  '인클라인 덤벨 프레스': 'incline dumbbell press exercise',
  '딥스': 'dips exercise',
  '딥스 (가슴)': 'chest dips exercise',
  '덤벨 플라이': 'dumbbell fly exercise',
  '인클라인 덤벨 플라이': 'incline dumbbell fly exercise',
  '케이블 크로스오버': 'cable crossover exercise',
  '풀업': 'pull up exercise',
  '친업': 'chin up exercise',
  '랫풀다운': 'lat pulldown exercise',
  '바벨 로우': 'barbell row exercise',
  '원암 덤벨 로우': 'one arm dumbbell row exercise',
  '케이블 로우': 'cable row exercise',
  '티바 로우': 't bar row exercise',
  '하이퍼익스텐션': 'hyperextension exercise',
  '덤벨 숄더프레스': 'dumbbell shoulder press exercise',
  '바벨 숄더프레스': 'barbell shoulder press exercise',
  '오버헤드 프레스': 'overhead press exercise',
  '아놀드 프레스': 'arnold press exercise',
  '사이드 레터럴 레이즈': 'lateral raise exercise',
  '프론트 레이즈': 'front raise exercise',
  '리어 델트 플라이': 'rear delt fly exercise',
  '업라이트 로우': 'upright row exercise',
  '페이스 풀': 'face pull exercise',
  '바벨 컬': 'barbell curl exercise',
  '덤벨 컬': 'dumbbell curl exercise',
  '해머 컬': 'hammer curl exercise',
  '프리처 컬': 'preacher curl exercise',
  '케이블 컬': 'cable curl exercise',
  'EZ바 컬': 'ez bar curl exercise',
  '트라이셉스 푸시다운': 'tricep pushdown exercise',
  '스컬크러셔': 'skull crusher exercise',
  'EZ바 스컬크러셔': 'ez bar skull crusher exercise',
  '덤벨 킥백': 'tricep kickback exercise',
  '케이블 트라이셉스 킥백': 'cable tricep kickback exercise',
  '바벨 리버스 컬': 'reverse barbell curl exercise',
  '크런치': 'crunch exercise',
  '바이시클 크런치': 'bicycle crunch exercise',
  '레그 레이즈': 'leg raise exercise',
  '행잉 레그 레이즈': 'hanging leg raise exercise',
  '플랭크': 'plank exercise',
  '러시안 트위스트': 'russian twist exercise',
  '마운틴 클라이머': 'mountain climber exercise',
  '스탠딩 카프 레이즈': 'calf raise exercise',
  '케틀벨 스윙': 'kettlebell swing exercise',
  '버피': 'burpee exercise',
}

const searchGiphy = async (query) => {
  try {
    const res = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=1&rating=g`
    )
    const data = await res.json()
    if (data.data && data.data.length > 0) {
      return data.data[0].images.original.url
    }
  } catch (e) {
    console.error(`검색 실패: ${query}`, e.message)
  }
  return null
}

const run = async () => {
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name')

  console.log(`총 ${exercises.length}개 종목 처리 시작...`)

  for (const ex of exercises) {
    const query = nameMap[ex.name]
    if (!query) {
      console.log(`⏭️  ${ex.name} → 매핑 없음`)
      continue
    }

    const gifUrl = await searchGiphy(query)
    if (gifUrl) {
      const { error } = await supabase
        .from('exercises')
        .update({ image_url: gifUrl })
        .eq('id', ex.id)
      if (error) {
        console.log(`❌ DB 저장 실패: ${ex.name} - ${error.message}`)
      } else {
        console.log(`✅ ${ex.name} → ${gifUrl}`)
      }
    } else {
      console.log(`❌ ${ex.name} → GIF 없음`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log('완료!')
}

run()
