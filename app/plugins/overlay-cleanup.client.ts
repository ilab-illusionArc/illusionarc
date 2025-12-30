export default defineNuxtPlugin(() => {
    const router = useRouter()

    router.beforeEach(() => {
        // Close any native <dialog> if you ever use it
        document.querySelectorAll('dialog[open]').forEach((d: any) => d.close?.())

        // Blur focused element before route switches (prevents "focused inside aria-hidden")
        const el = document.activeElement as HTMLElement | null
        el?.blur?.()
    })
})
