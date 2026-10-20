/* Digital Switch local template behaviour. Libraries: GSAP 3.13 (ScrollTrigger,
   SplitText, all free), Lenis smooth scroll. Degrades to a plain, fully visible
   page if the libraries don't load. */
(function () {
    var root = document.documentElement;
    var nav = document.querySelector('.nav');
    var toggle = document.getElementById('navToggle');

    if (toggle) {
        toggle.addEventListener('click', function () { nav.classList.toggle('open'); });
        document.querySelectorAll('.nav-links a').forEach(function (a) {
            a.addEventListener('click', function () { nav.classList.remove('open'); });
        });
    }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!window.gsap || !window.ScrollTrigger || reduce) { root.classList.remove('js'); return; }
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('anim-ready');

    var desktop = window.matchMedia('(min-width: 901px)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    // Smooth scroll
    if (window.Lenis) {
        var lenis = new Lenis({ lerp: 0.1 });
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
        gsap.ticker.lagSmoothing(0);
        document.querySelectorAll('a[href^="#"]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                var el = document.querySelector(a.getAttribute('href'));
                if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -70 }); }
            });
        });
    }

    // Headings: line-by-line mask reveal
    var splitOK = !!window.SplitText;
    if (splitOK) gsap.registerPlugin(SplitText);
    document.querySelectorAll('.split').forEach(function (el, i) {
        var targets = el;
        if (splitOK) {
            var s = new SplitText(el, { type: 'lines', linesClass: 'line' });
            s.lines.forEach(function (l) { l.innerHTML = '<span class="line-inner" style="display:inline-block">' + l.innerHTML + '</span>'; });
            targets = el.querySelectorAll('.line-inner');
        }
        var inHero = !!el.closest('.hero');
        gsap.from(targets, {
            yPercent: 110, opacity: splitOK ? 1 : 0, duration: 1.1, ease: 'power4.out', stagger: 0.09,
            delay: inHero ? 0.2 : 0,
            scrollTrigger: inHero ? null : { trigger: el, start: 'top 85%' }
        });
    });

    // Fade/slide-ups and cards
    ScrollTrigger.batch('.reveal-up', {
        start: 'top 88%',
        onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }); }
    });
    ScrollTrigger.batch('.reveal-card', {
        start: 'top 88%',
        onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12 }); }
    });

    // Image curtain reveal
    document.querySelectorAll('.clip-reveal').forEach(function (el) {
        gsap.to(el, { clipPath: 'inset(0% 0 0 0)', duration: 1.4, ease: 'power4.inOut',
            scrollTrigger: { trigger: el, start: 'top 80%' } });
        gsap.fromTo(el.querySelector('img'), { scale: 1.25 }, { scale: 1, duration: 1.8, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 80%' } });
    });

    // Hero parallax + slow zoom-out
    var heroImg = document.querySelector('.hero-media img');
    if (heroImg) {
        gsap.fromTo(heroImg, { scale: 1.18 }, { scale: 1.05, duration: 2.4, ease: 'power2.out' });
        gsap.to('.hero-media', { yPercent: 18, ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    }

    // Work: pinned horizontal scroll on desktop
    var work = document.querySelector('.work');
    var track = document.querySelector('.work-track');
    if (desktop && work && track) {
        work.classList.add('is-pinned');
        var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
        gsap.to(track, { x: function () { return -dist(); }, ease: 'none',
            scrollTrigger: { trigger: work, start: 'top top', end: function () { return '+=' + dist(); },
                pin: true, scrub: 0.6, invalidateOnRefresh: true } });
    }

    // Steps: line draws as you scroll, dots light up
    var line = document.querySelector('.steps-line span');
    if (line) {
        var prop = desktop ? 'scaleX' : 'scaleY';
        var from = {}; from[prop] = 0; var to = { ease: 'none', scrollTrigger: { trigger: '.steps', start: 'top 75%', end: 'bottom 60%', scrub: true } };
        to[prop] = 1;
        gsap.fromTo(line, from, to);
        document.querySelectorAll('.step').forEach(function (st) {
            ScrollTrigger.create({ trigger: st, start: 'top 70%', onEnter: function () { st.classList.add('is-on'); },
                onLeaveBack: function () { st.classList.remove('is-on'); } });
            gsap.from(st, { opacity: 0, y: 24, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: st, start: 'top 85%' } });
        });
    }

    // Magnetic buttons (mouse only)
    if (finePointer) {
        document.querySelectorAll('.magnetic').forEach(function (b) {
            b.addEventListener('mousemove', function (e) {
                var r = b.getBoundingClientRect();
                gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.4, ease: 'power3.out' });
            });
            b.addEventListener('mouseleave', function () { gsap.to(b, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' }); });
        });
    }

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
