// Hero "water" ripple, reacts to cursor / touch, using webgl-fluid-enhanced
// (MIT licensed, https://github.com/michaelbrusegard/WebGL-Fluid-Enhanced),
// itself a continuation of Pavel Dobryakov's original WebGL Fluid Simulation.
// Loaded only on desktop (see site.css .hero-canvas mobile rule + the
// matchMedia guard below) to keep mobile fast and battery-friendly.

import webGLFluidEnhanced from 'webgl-fluid-enhanced';

var canvas = document.getElementById('hero-fluid');
var isSmallScreen = window.matchMedia('(max-width: 768px)').matches;

if (canvas && !isSmallScreen) {
    webGLFluidEnhanced.simulation(canvas, {
        // Brand palette: amber + steel-blue, matching --accent / --steel in site.css
        COLOR_PALETTE: ['#e2a13a', '#3d5872', '#6f8ba3', '#f4c97a'],
        TRANSPARENT: true,
        HOVER: true,
        TRIGGER: 'hover',
        SIM_RESOLUTION: 128,
        DYE_RESOLUTION: 720,
        DENSITY_DISSIPATION: 2.2,
        VELOCITY_DISSIPATION: 1.4,
        SPLAT_RADIUS: 0.18,
        SPLAT_FORCE: 4000,
        CURL: 12,
        BLOOM: false,
        SUNRAYS: false,
        IMMEDIATE: false
    });
}
