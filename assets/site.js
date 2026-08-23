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
    // Custom cursor (desktop / mouse only)
    // =============================================
    var cursorDot = document.querySelector('.cursor-dot');
    var cursorRing = document.querySelector('.cursor-ring');
    var hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    if (hasFinePointer && cursorDot && cursorRing) {
        var ringX = 0, ringY = 0, targetX = 0, targetY = 0;

        window.addEventListener('mousemove', function (e) {
            targetX = e.clientX;
            targetY = e.clientY;
            cursorDot.style.transform = 'translate(' + targetX + 'px,' + targetY + 'px) translate(-50%,-50%)';
        });

        function animateRing() {
            ringX += (targetX - ringX) * 0.18;
            ringY += (targetY - ringY) * 0.18;
            cursorRing.style.transform = 'translate(' + ringX + 'px,' + ringY + 'px) translate(-50%,-50%)';
            requestAnimationFrame(animateRing);
        }
        requestAnimationFrame(animateRing);

        document.querySelectorAll('a, button, .work-item, input, textarea').forEach(function (el) {
            el.addEventListener('mouseenter', function () { cursorRing.classList.add('is-active'); });
            el.addEventListener('mouseleave', function () { cursorRing.classList.remove('is-active'); });
        });
    } else if (cursorDot && cursorRing) {
        cursorDot.style.display = 'none';
        cursorRing.style.display = 'none';
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
    var contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();
            alert('Thank you for your message! We will get back to you soon.');
            contactForm.reset();
        });
    }

})();
