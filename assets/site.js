/* ==========================================================================
   Lead Mockup Template, main script
   Handles: nav, parallax backgrounds, scroll-driven reveals (GSAP),
   smooth scroll (Lenis), contact form.
   Fluid ripple canvas is initialized separately in fluid-init.js (ES module).
   ========================================================================== */

(function () {
    'use strict';

    var nav = document.getElementById('templatemo-nav');
    var navToggle = document.getElementById('navToggle');
    var navLinks = document.getElementById('navLinks');
    var navItems = document.querySelectorAll('.nav-links a');
    var sections = document.querySelectorAll('.parallax-section, .work-section');
    var parallaxBgs = document.querySelectorAll('.parallax-bg');

    var isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
                   || window.innerWidth <= 768;

    // =============================================
    // Tap-to-call: sticky "Call" button on phones, built from the page's
    // first tel: link so every lead page gets it without template edits.
    // =============================================
    var telLink = document.querySelector('a[href^="tel:"]');
    if (telLink && !document.querySelector('.call-fab')) {
        var fab = document.createElement('a');
        fab.className = 'call-fab';
        fab.href = telLink.getAttribute('href');
        fab.textContent = 'Call ' + telLink.textContent.trim();
        document.body.appendChild(fab);
    }

    // =============================================
    // Lenis smooth scroll
    // =============================================
    var lenis = null;
    if (window.Lenis && !isMobile) {
        lenis = new Lenis({
            duration: 1.1,
            easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
            smoothWheel: true
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }
        requestAnimationFrame(raf);

        // Keep ScrollTrigger in sync with Lenis-driven scroll
        if (window.ScrollTrigger) {
            lenis.on('scroll', ScrollTrigger.update);
        }
    }

    // =============================================
    // Parallax Engine
    // =============================================
    var ticking = false;

    function updateParallax() {
        if (isMobile) return;

        var windowHeight = window.innerHeight;

        parallaxBgs.forEach(function (bg) {
            var section = bg.parentElement;
            var rect = section.getBoundingClientRect();

            if (rect.bottom < -300 || rect.top > windowHeight + 300) {
                return;
            }

            var speed = parseFloat(bg.getAttribute('data-speed')) || 0.5;
            var sectionCenterY = rect.top + rect.height / 2;
            var viewportCenterY = windowHeight / 2;
            var offset = sectionCenterY - viewportCenterY;
            var totalTravel = windowHeight + rect.height;
            var normalized = offset / (totalTravel / 2);
            normalized = Math.max(-1, Math.min(1, normalized));
            var maxShift = windowHeight * speed;
            var translateY = normalized * maxShift;

            bg.style.transform = 'translate3d(0,' + translateY.toFixed(1) + 'px,0)';
        });

        ticking = false;
    }

    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }

    if (!isMobile) {
        window.addEventListener('scroll', onScroll, { passive: true });
        updateParallax();
    }

    window.addEventListener('resize', function () {
        isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            updateParallax();
        } else {
            parallaxBgs.forEach(function (bg) {
                bg.style.transform = 'translate3d(0,0,0)';
            });
        }
    });

    // --- Navigation Scroll Effect ---
    function handleNavScroll() {
        if (window.scrollY > 80) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });
    handleNavScroll();

    // --- Mobile Toggle ---
    navToggle.addEventListener('click', function () {
        navToggle.classList.toggle('active');
        navLinks.classList.toggle('open');
    });

    navItems.forEach(function (link) {
        link.addEventListener('click', function (e) {
            navToggle.classList.remove('active');
            navLinks.classList.remove('open');
            if (lenis) {
                var targetId = link.getAttribute('href');
                var targetEl = document.querySelector(targetId);
                if (targetEl) {
                    e.preventDefault();
                    lenis.scrollTo(targetEl);
                }
            }
        });
    });

    // --- Active Link on Scroll ---
    function updateActiveLink() {
        var scrollPos = window.scrollY + window.innerHeight / 3;

        sections.forEach(function (section) {
            var top = section.offsetTop;
            var height = section.offsetHeight;
            var id = section.getAttribute('id');

            if (scrollPos >= top && scrollPos < top + height) {
                navItems.forEach(function (link) {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveLink, { passive: true });
    updateActiveLink();

    // =============================================
    // Scroll Reveal, GSAP ScrollTrigger (falls back to a simple
    // IntersectionObserver if GSAP failed to load, e.g. offline)
    // =============================================
    var revealTargets = document.querySelectorAll('.section-content:not(#home .section-content), .work-item');
    revealTargets.forEach(function (el) { el.classList.add('reveal'); });

    if (window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);

        // Hero: a one-time page-load sequence rather than a scroll reveal,
        // since it's already on screen when the page opens. SplitText
        // (free as of GSAP's 2025 licensing change) breaks the headline
        // into characters for a considered entrance instead of a plain fade.
        if (window.SplitText) {
            gsap.registerPlugin(SplitText);
            var heroTitle = document.querySelector('#home .hero-title');
            if (heroTitle) {
                var split = new SplitText(heroTitle, { type: 'chars' });
                gsap.set(heroTitle, { opacity: 1 });
                var heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
                heroTl
                    .from(split.chars, { opacity: 0, y: 28, duration: 0.7, stagger: 0.025 })
                    .from('#home .eyebrow', { opacity: 0, y: 12, duration: 0.6 }, '-=0.5')
                    .from('#home .section-subtitle', { opacity: 0, y: 12, duration: 0.6 }, '-=0.45')
                    .from('#home .btn-scroll', { opacity: 0, y: 12, duration: 0.6 }, '-=0.4');
            }
        }

        document.querySelectorAll('.section-content:not(#home .section-content)').forEach(function (el) {
            gsap.to(el, {
                opacity: 1,
                y: 0,
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 82%',
                    toggleActions: 'play none none reverse'
                }
            });
        });

        gsap.to('.work-item', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            stagger: 0.12,
            scrollTrigger: {
                trigger: '.work-grid',
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            }
        });
    } else if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('reveal-visible');
                }
            });
        }, { threshold: 0.15 });
        revealTargets.forEach(function (el) { io.observe(el); });
    } else {
        revealTargets.forEach(function (el) { el.classList.add('reveal-visible'); });
    }

    // --- Contact Form ---
    // No backend on static hosting: open the visitor's email app with the
    // message pre-filled to the business address shown on the page, instead
    // of pretending the message was sent. Live client sites swap this for
    // the email form service at fulfilment.
    var contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var mail = document.querySelector('a[href^="mailto:"]');
            var to = mail ? mail.getAttribute('href').replace('mailto:', '') : '';
            var f = contactForm.querySelectorAll('input, textarea');
            var name = f[0] ? f[0].value : '', from = f[1] ? f[1].value : '', msg = f[2] ? f[2].value : '';
            var body = msg + '\n\n' + name + (from ? ' (' + from + ')' : '');
            window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent('Quote request from ' + (name || 'website')) + '&body=' + encodeURIComponent(body);
            if (!contactForm.querySelector('.form-note')) {
                var note = document.createElement('p');
                note.className = 'form-note';
                note.textContent = 'Your email app should open with your message ready to send. If it does not, call or email us using the details below.';
                contactForm.appendChild(note);
            }
        });
    }

})();
