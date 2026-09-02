import { addComponent, addServerHandler, createResolver, defineNuxtModule, extendPages } from '@nuxt/kit'

// The feedback feature — floating button, admin inbox, API, notification
// email — as a self-contained local module. NUXT_FEATURE_FEEDBACK=0 at build
// time leaves all of it (and TipTap / markdown-it) out of the bundle; the
// layout's <FeedbackFab /> then resolves to an empty stub.
export default defineNuxtModule({
  meta: { name: 'feedback' },
  setup (_options, nuxt) {
    const enabled = (process.env.NUXT_FEATURE_FEEDBACK ?? '1') !== '0'
    const { resolve } = createResolver(import.meta.url)

    // Lets the sidebar hide the inbox link when the feature is out.
    nuxt.options.runtimeConfig.public.feedback = enabled

    if (!enabled) {
      addComponent({ name: 'FeedbackFab', filePath: resolve('runtime/components/FeedbackOff.vue') })
      return
    }

    addComponent({ name: 'FeedbackFab', filePath: resolve('runtime/components/FeedbackFab.vue') })
    addComponent({ name: 'FeedbackEditor', filePath: resolve('runtime/components/FeedbackEditor.vue') })

    extendPages((pages) => {
      pages.push({ name: 'admin-feedback', path: '/admin/feedback', file: resolve('runtime/pages/admin/feedback.vue') })
    })

    addServerHandler({ route: '/api/feedback', method: 'get', handler: resolve('runtime/server/api/list.get') })
    addServerHandler({ route: '/api/feedback', method: 'post', handler: resolve('runtime/server/api/create.post') })
    addServerHandler({ route: '/api/feedback/:id', method: 'patch', handler: resolve('runtime/server/api/resolve.patch') })
    addServerHandler({ route: '/api/feedback/:id', method: 'delete', handler: resolve('runtime/server/api/remove.delete') })
  }
})
