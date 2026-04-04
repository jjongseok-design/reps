export interface Exercise {
  id: string
  name: string
  category: 'legs' | 'chest' | 'back' | 'shoulder' | 'arm' | 'core' | 'cardio'
  calories_per_kg_rep: number
  measure_type?: 'reps' | 'time'
}

export interface WorkoutSession {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  total_volume_kg: number
  total_calories: number
  notes: string | null
  created_at: string
}

export interface WorkoutSet {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  weight_kg: number
  reps: number
  e1rm: number
  created_at: string
  exercise?: Exercise
}
