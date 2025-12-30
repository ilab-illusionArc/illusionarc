export default defineNuxtPlugin(() => {
    const router = useRouter()

    const reduce =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    let io: IntersectionObserver | null = null

    const ensureObserver = () => {
        if (io || reduce) return
        io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        ;(e.target as HTMLElement).classList.add('revealed')
                        io?.unobserve(e.target)
                    }
                }
            },
            // a bit more forgiving so it reveals immediately
            { threshold: 0.01, rootMargin: '80px 0px 80px 0px' }
        )
    }

    const scan = () => {
        const els = Array.from(
            document.querySelectorAll<HTMLElement>('[data-reveal]')
        )

        if (reduce) {
            els.forEach((el) => el.classList.add('revealed'))
            return
        }

        ensureObserver()
        els.forEach((el) => {
            if (!el.classList.contains('revealed')) io?.observe(el)
        })
    }

    const runScanSoon = () => {
        // double rAF ensures DOM + layout have settled after navigation
        requestAnimationFrame(() => requestAnimationFrame(scan))
    }

    const failsafeShowAll = () => {
        // If anything is still hidden after a moment, reveal it
        document
            .querySelectorAll<HTMLElement>('[data-reveal]:not(.revealed)')
            .forEach((el) => el.classList.add('revealed'))
    }

    onNuxtReady(() => {
        document.documentElement.classList.add('reveal-ready')

        // initial
        runScanSoon()
        setTimeout(runScanSoon, 50)
        setTimeout(failsafeShowAll, 800)

        // every navigation
        router.afterEach(() => {
            runScanSoon()
            setTimeout(runScanSoon, 50)
            setTimeout(failsafeShowAll, 800)
        })
    })
})
