export default defineNuxtPlugin(() => {
    const router = useRouter()

    const bar = document.createElement('div')
    bar.id = 'route-progress'
    document.body.appendChild(bar)

    let t: number | null = null

    const start = () => {
        bar.classList.add('on')
        bar.style.transform = 'scaleX(0.12)'
        if (t) window.clearTimeout(t)
        t = window.setTimeout(() => {
            bar.style.transform = 'scaleX(0.72)'
        }, 120)
    }

    const done = () => {
        bar.style.transform = 'scaleX(1)'
        window.setTimeout(() => bar.classList.remove('on'), 140)
    }

    router.beforeEach(() => start())
    router.afterEach(() => done())
})
