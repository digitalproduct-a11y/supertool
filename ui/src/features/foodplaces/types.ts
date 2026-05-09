export interface FoodPlace {
  rank: number
  name: string
  rating: number
  review_count: number
  rating_label?: string
  operating_hours?: string
  address?: string
  photo_url?: string
  from_nearby?: boolean
}

export interface FoodPlacesRequest {
  food_keyword: string
  location: string
  brand: string
  watch_party: boolean
}

export interface FoodPlacesResponse {
  success?: boolean
  places: FoodPlace[]
  cover_title?: string
  caption?: string
  search_query?: string
  brand_voice_used?: string
  cached?: boolean
  cache_age_seconds?: number
  place_count?: number
  raw_returned?: number
  message?: string
}

export type FoodPlacesSlide =
  | { type: 'cover'; title: string; photoPublicId: string | null }
  | { type: 'place'; place: FoodPlace; photoPublicId: string | null }
