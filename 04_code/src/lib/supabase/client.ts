/**
 * ERE SOLAR BOT — Client Supabase
 * Deux clients : côté navigateur (anon) et côté serveur (service role)
 */

import { createClient } from '@supabase/supabase-js'
import type { Prospect, CalculSolaire, OutreachContact, OutreachCampagne, Microsite } from '@/types'

// Types de la base de données
export interface Database {
  public: {
    Tables: {
      prospects: {
        Row: Prospect
        Insert: Omit<Prospect, 'id' | 'created_at'>
        Update: Partial<Omit<Prospect, 'id' | 'created_at'>>
      }
      calculs_solaires: {
        Row: CalculSolaire
        Insert: Omit<CalculSolaire, 'id' | 'created_at'>
        Update: Partial<Omit<CalculSolaire, 'id' | 'created_at'>>
      }
      outreach_contacts: {
        Row: OutreachContact
        Insert: Omit<OutreachContact, 'id' | 'created_at'>
        Update: Partial<Omit<OutreachContact, 'id' | 'created_at'>>
      }
    }
  }
}

// Client navigateur (clé publique anon)
export function createBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Variables Supabase manquantes : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY requis')
  }

  return createClient<Database>(url, key)
}

// Client serveur (service role — NE PAS exposer côté client)
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Variables Supabase manquantes : SUPABASE_SERVICE_ROLE_KEY requis')
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
