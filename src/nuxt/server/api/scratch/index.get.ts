import type { ScratchNote } from '#shared/types/scratch'

// Example feature: a per-user scratchpad in KV. Small on purpose — it shows
// the shape of an authenticated read (requireUser + a namespaced key) that
// every real feature starts from. Delete the scratch/ folder,
// shared/types/scratch.ts, and app/pages/scratch.vue when you no longer
// need the example.
export default defineEventHandler(async (event): Promise<ScratchNote> => {
  const user = await requireUser(event)
  const note = await kv.get<ScratchNote>(`scratch:${user.id}`)
  return note ?? { text: '', updatedAt: null }
})
