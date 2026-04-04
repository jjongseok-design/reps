import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://zsafusllrolzllwcyyjh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzYWZ1c2xscm9semxsd2N5eWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTE2NjM5MSwiZXhwIjoyMDkwNzQyMzkxfQ.fEWczp3FhnReuXXkXQp5-Ud1B1HPG_hqXksOay-I7yw'
)

const BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises'

// 한국어 → 영어 매핑
const nameMap = {
  '풀업': 'Pullups',
  '친업': 'Chin-Up',
  '워킹 런지': 'Barbell_Walking_Lunge',
  '덤벨 런지': 'Dumbbell_Lunges',
  '레그 컬': 'Lying_Leg_Curls',
  '크런치': 'Crunches',
  '딥스': 'Dips_-_Chest_Version',
  '딥스 (가슴)': 'Dips_-_Chest_Version',
  '레그 익스텐션': 'Leg_Extensions',
  '오버헤드 프레스': 'Standing_Military_Press',
  '덤벨 숄더프레스': 'Dumbbell_Shoulder_Press',
  '덤벨 컬': 'Dumbbell_Alternate_Bicep_Curl',
  '해머 컬': 'Hammer_Curls',
  '프리처 컬': 'Preacher_Curl',
  '스컬크러셔': 'Lying_Triceps_Press',
  'EZ바 컬': 'EZ-Bar_Curl',
  'EZ바 스컬크러셔': 'EZ-Bar_Skullcrusher',
  '케이블 로우': 'Seated_Cable_Rows',
  '원암 덤벨 로우': 'One-Arm_Dumbbell_Row',
  '프론트 레이즈': 'Front_Plate_Raise',
  '케이블 크로스오버': 'Cable_Crossover',
  '덤벨 플라이': 'Dumbbell_Fly',
  '마운틴 클라이머': 'Mountain_Climbers',
  '레그 레이즈': 'Leg_Raises',
  '러시안 트위스트': 'Russian_Twist',
  '덤벨 킥백': 'Tricep_Dumbbell_Kickback',
  '케이블 트라이셉스 킥백': 'Cable_Lying_Triceps_Extension',
  '바벨 리버스 컬': 'Reverse_Barbell_Curl',
  '덤벨 해머 컬 (교차)': 'Cross_Body_Hammer_Curl',
  '케이블 해머 컬': 'Hammer_Curls',
  '글루트 브릿지': 'Barbell_Glute_Bridge',
  '스텝업': 'Barbell_Step_Ups',
  '굿모닝': 'Good_Morning',
  '배틀로프': 'Battling_Ropes',
  '케틀벨 스윙': 'One-Arm_Kettlebell_Swings',
  '박스 점프': 'Front_Box_Jump',
  '스쿼트': 'Barbell_Full_Squat',
  '프론트 스쿼트': 'Barbell_Front_Squat',
  '런지': 'Barbell_Lunge',
  '레그 프레스': 'Leg_Press',
  '힙 쓰러스트': 'Barbell_Hip_Thrust',
  '데드리프트': 'Barbell_Deadlift',
  '루마니안 데드리프트': 'Romanian_Deadlift',
  '벤치프레스': 'Barbell_Bench_Press_-_Medium_Grip',
  '인클라인 벤치프레스': 'Barbell_Incline_Bench_Press_-_Medium_Grip',
  '덤벨 벤치프레스': 'Dumbbell_Bench_Press',
  '인클라인 덤벨 프레스': 'Dumbbell_Incline_Bench_Press',
  '랫풀다운': 'Wide-Grip_Lat_Pulldown',
  '바벨 로우': 'Bent_Over_Barbell_Row',
  '바벨 숄더프레스': 'Barbell_Shoulder_Press',
  '사이드 레터럴 레이즈': 'Side_Lateral_Raise',
  '바벨 컬': 'Barbell_Curl',
  '트라이셉스 푸시다운': 'Triceps_Pushdown',
  '플랭크': 'Plank',
  '스쿼트 (스미스머신)': 'Decline_Smith_Press',
  '힙 쓰러스트 머신': 'Barbell_Hip_Thrust',
  '벤트오버레터럴': 'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench',
  '디클라인 덤벨 프레스': 'Decline_Dumbbell_Bench_Press',
  '머신 체스트 프레스': 'Leverage_Chest_Press',
  '스트랩 풀업': 'Pullups',
  '클로즈그립 랫풀다운': 'Close-Grip_Front_Lat_Pulldown',
  '머신 로우': 'Seated_Cable_Rows',
  '비하인드넥 프레스': 'Neck_Press',
  '덤벨 프론트 레이즈': 'Front_Dumbbell_Raise',
  '케이블 프론트 레이즈': 'Front_Raise_And_Pullover',
  '사이드 런지': 'Crossover_Reverse_Lunge',
  '도너키 카프 레이즈': 'Donkey_Calf_Raises',
  '레그 익스텐션 (단다리)': 'Leg_Extensions',
  '드래곤 플래그': 'Hanging_Leg_Raise',
  '브이업': 'Jackknife_Sit-Up',
  '토 터치': 'Crunches',
  '덤벨 사이드 밴드': 'Dumbbell_Side_Bend',
  '케이블 우드찹': 'Cable_Russian_Twists',
  '데드버그': 'Dead_Bug',
  '머신 숄더프레스': 'Machine_Shoulder_Military_Press',
  '레그 프레스 (내로우)': 'Narrow_Stance_Leg_Press',
  '케이블 플라이': 'Flat_Bench_Cable_Flyes',
  '밴드 페이스풀': 'Face_Pull',
  '덤벨 데드리프트': 'Romanian_Deadlift',
}

const run = async () => {
  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name')

  console.log(`총 ${exercises.length}개 종목 처리 시작...`)

  for (const ex of exercises) {
    const mapped = nameMap[ex.name]
    if (!mapped) {
      console.log(`⏭️  ${ex.name} → 매핑 없음`)
      continue
    }

    const gifUrl = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${mapped}/0.jpg`

    // URL 유효성 확인
    const res = await fetch(gifUrl)
    if (res.ok) {
      const { error } = await supabase
        .from('exercises')
        .update({ image_url: gifUrl })
        .eq('id', ex.id)
      if (error) {
        console.log(`❌ ${ex.name} → DB 오류: ${error.message}`)
      } else {
        console.log(`✅ ${ex.name}`)
      }
    } else {
      console.log(`❌ ${ex.name} → URL 없음 (${res.status})`)
    }

    await new Promise(r => setTimeout(r, 200))
  }

  console.log('완료!')
}

run()
