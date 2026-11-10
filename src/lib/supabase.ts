import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** false tant que les variables VITE_SUPABASE_* ne sont pas renseignées. */
export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'https://non-configure.supabase.co', anonKey || 'non-configure')

/** URL publique d'une photo de la galerie (bucket public « creations »). */
export function creationPhotoUrl(path: string): string {
  return supabase.storage.from('creations').getPublicUrl(path).data.publicUrl
}

/** URL temporaire (1 h) pour un fichier privé : image de référence ou ticket. */
export async function signedUrl(bucket: 'references' | 'receipts', path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
