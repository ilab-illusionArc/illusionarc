export default defineNuxtPlugin(() => {
    const root = document.getElementById('__nuxt')
    if (!root) return

    const syncInert = () => {
        const hidden = root.getAttribute('aria-hidden') === 'true'
        if (hidden) root.setAttribute('inert', '')
        else root.removeAttribute('inert')
    }

    // Observe aria-hidden changes
    const mo = new MutationObserver(() => syncInert())
    mo.observe(root, {
        attributes: true,
        attributeFilter: ['aria-hidden', 'data-aria-hidden']
    })

    // Initial sync
    syncInert()

    // Cleanup (no Vue lifecycle in plugins)
    const cleanup = () => mo.disconnect()

    // On full page unload
    window.addEventListener('beforeunload', cleanup, { once: true })

    // HMR cleanup in dev
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyImportMeta = import.meta as any
    if (anyImportMeta?.hot) {
        anyImportMeta.hot.dispose(() => cleanup())
    }
})
