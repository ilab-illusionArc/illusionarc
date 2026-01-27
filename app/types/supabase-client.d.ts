import type { Database } from './supabase'

declare module '#supabase' {
  interface SupabaseClientOptions {
    Database: Database
  }
}

export {}
