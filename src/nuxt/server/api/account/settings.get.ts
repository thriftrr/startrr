// The signed-in person's settings as this app sees them, and where each
// comes from (shared/types/settings.ts). `managed`: they live in Authrr,
// so each can be for every app or just this one.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { settings: await settingsOf(event, user.id), managed: authrrEnabled() }
})
