/**
 * Purz Preset Manager Module
 * Built-in preset definitions for the Interactive Filter.
 */

const PRESETS = {
    // --- FILM & CINEMATIC ---
    "cinematic_teal_orange": {
        name: "Cinematic Teal & Orange",
        category: "Film",
        layers: [
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: 0.1 }, opacity: 0.7 },
            { effect: "shadows", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.05 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.3, softness: 0.4 }, opacity: 0.6 }
        ]
    },
    "film_noir": {
        name: "Film Noir",
        category: "Film",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.4 }, opacity: 1.0 },
            { effect: "blacks", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.5, softness: 0.3 }, opacity: 0.8 },
            { effect: "grain", params: { amount: 0.08, size: 100 }, opacity: 0.5 }
        ]
    },
    "vintage_film": {
        name: "Vintage Film",
        category: "Film",
        layers: [
            { effect: "sepia", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "grain", params: { amount: 0.12, size: 80 }, opacity: 0.7 },
            { effect: "vignette", params: { amount: 0.4, softness: 0.5 }, opacity: 0.5 }
        ]
    },
    "blockbuster": {
        name: "Blockbuster",
        category: "Film",
        layers: [
            { effect: "contrast", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.3 }, opacity: 0.8 },
            { effect: "shadows", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.25, softness: 0.5 }, opacity: 0.5 }
        ]
    },
    "faded_film": {
        name: "Faded Film",
        category: "Film",
        layers: [
            { effect: "blacks", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: 0.05 }, opacity: 0.6 },
            { effect: "grain", params: { amount: 0.06, size: 120 }, opacity: 0.6 }
        ]
    },

    // --- PORTRAIT ---
    "portrait_soft": {
        name: "Soft Portrait",
        category: "Portrait",
        layers: [
            { effect: "clarity", params: { amount: -0.2 }, opacity: 0.6 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.2, softness: 0.6 }, opacity: 0.4 }
        ]
    },
    "portrait_dramatic": {
        name: "Dramatic Portrait",
        category: "Portrait",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.25 }, opacity: 0.7 },
            { effect: "shadows", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.35, softness: 0.4 }, opacity: 0.6 }
        ]
    },
    "portrait_warm": {
        name: "Warm Portrait",
        category: "Portrait",
        layers: [
            { effect: "temperature", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "exposure", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.15, softness: 0.5 }, opacity: 0.4 }
        ]
    },

    // --- LANDSCAPE ---
    "landscape_vivid": {
        name: "Vivid Landscape",
        category: "Landscape",
        layers: [
            { effect: "vibrance", params: { amount: 0.35 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.3 }, opacity: 0.8 },
            { effect: "dehaze", params: { amount: 0.2 }, opacity: 0.7 },
            { effect: "highlights", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "shadows", params: { amount: 0.15 }, opacity: 1.0 }
        ]
    },
    "landscape_moody": {
        name: "Moody Landscape",
        category: "Landscape",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.25 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: -0.1 }, opacity: 0.8 },
            { effect: "vignette", params: { amount: 0.3, softness: 0.4 }, opacity: 0.6 },
            { effect: "clarity", params: { amount: 0.2 }, opacity: 0.7 }
        ]
    },
    "golden_hour": {
        name: "Golden Hour",
        category: "Landscape",
        layers: [
            { effect: "temperature", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "exposure", params: { amount: 0.15 }, opacity: 0.8 },
            { effect: "highlights", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "vibrance", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.2, softness: 0.6 }, opacity: 0.4 }
        ]
    },
    "blue_hour": {
        name: "Blue Hour",
        category: "Landscape",
        layers: [
            { effect: "temperature", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "tint", params: { amount: 0.05 }, opacity: 0.6 },
            { effect: "contrast", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "shadows", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.1 }, opacity: 0.8 }
        ]
    },

    // --- BLACK & WHITE ---
    "bw_high_contrast": {
        name: "B&W High Contrast",
        category: "Black & White",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.4 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.2 }, opacity: 0.8 }
        ]
    },
    "bw_soft": {
        name: "B&W Soft",
        category: "Black & White",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "blacks", params: { amount: 0.05 }, opacity: 1.0 },
            { effect: "grain", params: { amount: 0.04, size: 150 }, opacity: 0.5 }
        ]
    },
    "bw_dramatic": {
        name: "B&W Dramatic",
        category: "Black & White",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.35 }, opacity: 1.0 },
            { effect: "clarity", params: { amount: 0.3 }, opacity: 0.8 },
            { effect: "vignette", params: { amount: 0.4, softness: 0.35 }, opacity: 0.7 }
        ]
    },

    // --- MOOD & STYLE ---
    "dreamy": {
        name: "Dreamy",
        category: "Mood",
        layers: [
            { effect: "blur", params: { amount: 1.5 }, opacity: 0.3 },
            { effect: "highlights", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 }
        ]
    },
    "dark_moody": {
        name: "Dark & Moody",
        category: "Mood",
        layers: [
            { effect: "exposure", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.3 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.45, softness: 0.35 }, opacity: 0.7 }
        ]
    },
    "light_airy": {
        name: "Light & Airy",
        category: "Mood",
        layers: [
            { effect: "exposure", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.1 }, opacity: 1.0 }
        ]
    },
    "cyberpunk": {
        name: "Cyberpunk",
        category: "Mood",
        layers: [
            { effect: "contrast", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "tint", params: { amount: 0.15 }, opacity: 0.6 },
            { effect: "chromatic", params: { amount: 3 }, opacity: 0.4 },
            { effect: "vignette", params: { amount: 0.35, softness: 0.3 }, opacity: 0.6 }
        ]
    },
    "retro_80s": {
        name: "Retro 80s",
        category: "Mood",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "tint", params: { amount: 0.1 }, opacity: 0.5 },
            { effect: "grain", params: { amount: 0.08, size: 100 }, opacity: 0.5 },
            { effect: "vignette", params: { amount: 0.25, softness: 0.5 }, opacity: 0.5 }
        ]
    },

    // --- CREATIVE ---
    "duotone_blue": {
        name: "Duotone Blue",
        category: "Creative",
        layers: [
            { effect: "duotone", params: { shadowR: 0.0, shadowG: 0.1, shadowB: 0.3, highlightR: 0.9, highlightG: 0.95, highlightB: 1.0 }, opacity: 1.0 }
        ]
    },
    "duotone_warm": {
        name: "Duotone Warm",
        category: "Creative",
        layers: [
            { effect: "duotone", params: { shadowR: 0.2, shadowG: 0.05, shadowB: 0.0, highlightR: 1.0, highlightG: 0.95, highlightB: 0.8 }, opacity: 1.0 }
        ]
    },
    "cross_process": {
        name: "Cross Process",
        category: "Creative",
        layers: [
            { effect: "curves", params: { shadows: 0.1, midtones: -0.05, highlights: 0.1 }, opacity: 1.0 },
            { effect: "channelMixer", params: { redShift: 0.05, greenShift: -0.05, blueShift: 0.1 }, opacity: 0.7 },
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.2 }, opacity: 1.0 }
        ]
    },
    "lomo": {
        name: "Lomo",
        category: "Creative",
        layers: [
            { effect: "contrast", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.5, softness: 0.3 }, opacity: 0.8 },
            { effect: "grain", params: { amount: 0.06, size: 100 }, opacity: 0.5 }
        ]
    },
    "sketch_effect": {
        name: "Sketch",
        category: "Creative",
        layers: [
            { effect: "sketch", params: { amount: 4.0 }, opacity: 1.0 }
        ]
    },

    // --- CINEMATIC (New) ---
    "cinematic_blockbuster": {
        name: "Blockbuster Cinema",
        category: "Cinematic",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "splitTone", params: { shadowHue: 0.55, shadowSat: 0.25, highlightHue: 0.08, highlightSat: 0.2, balance: 0.1 }, opacity: 0.8 },
            { effect: "anamorphic", params: { squeeze: 1.0, flareStrength: 0.2, aberration: 0.002 }, opacity: 0.6 },
            { effect: "lensVignette", params: { amount: 0.6, falloff: 2.5, roundness: 1.2 }, opacity: 0.7 }
        ]
    },
    "cinematic_noir_modern": {
        name: "Modern Noir",
        category: "Cinematic",
        layers: [
            { effect: "desaturate", params: { amount: 0.85 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.35 }, opacity: 1.0 },
            { effect: "toneCurve", params: { contrast: 0.2, pivot: 0.4 }, opacity: 0.8 },
            { effect: "grain", params: { amount: 0.06, size: 80 }, opacity: 0.5 },
            { effect: "lensVignette", params: { amount: 0.8, falloff: 2, roundness: 1 }, opacity: 0.8 }
        ]
    },
    "cinematic_scifi": {
        name: "Sci-Fi Blue",
        category: "Cinematic",
        layers: [
            { effect: "temperature", params: { amount: -0.2 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.25 }, opacity: 1.0 },
            { effect: "colorLookup", params: { intensity: 0.5, warmth: -0.3, tealOrange: 0.4 }, opacity: 0.7 },
            { effect: "chromatic", params: { amount: 0.15 }, opacity: 0.4 },
            { effect: "crtScanlines", params: { intensity: 0.15, density: 300, curvature: 0.1 }, opacity: 0.3 }
        ]
    },
    "cinematic_horror": {
        name: "Horror Atmosphere",
        category: "Cinematic",
        layers: [
            { effect: "exposure", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.4 }, opacity: 1.0 },
            { effect: "gradientMap", params: { shadowR: 0.1, shadowG: 0.05, shadowB: 0.1, midR: 0.3, midG: 0.25, midB: 0.3, highlightR: 0.9, highlightG: 0.85, highlightB: 0.8 }, opacity: 0.4 },
            { effect: "lensVignette", params: { amount: 1.2, falloff: 1.8, roundness: 1 }, opacity: 0.9 }
        ]
    },

    // --- VINTAGE (New) ---
    "vintage_kodachrome": {
        name: "Kodachrome Style",
        category: "Vintage",
        layers: [
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "vibrancePro", params: { vibrance: 0.3, protectSkin: 0.6, satBoost: 0.15 }, opacity: 0.9 },
            { effect: "rgbCurves", params: { redLift: 0.02, redGamma: 0, redGain: 0.05, greenLift: 0, greenGamma: 0, greenGain: 0, blueLift: -0.03, blueGamma: 0, blueGain: -0.05 }, opacity: 0.7 },
            { effect: "grain", params: { amount: 0.05, size: 100 }, opacity: 0.5 }
        ]
    },
    "vintage_polaroid": {
        name: "Polaroid Memories",
        category: "Vintage",
        layers: [
            { effect: "fade", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "temperature", params: { amount: 0.1 }, opacity: 0.8 },
            { effect: "contrast", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: -0.15 }, opacity: 1.0 },
            { effect: "vignette", params: { amount: 0.3, softness: 0.5 }, opacity: 0.6 },
            { effect: "grain", params: { amount: 0.08, size: 120 }, opacity: 0.6 }
        ]
    },
    "vintage_70s": {
        name: "70s Warm",
        category: "Vintage",
        layers: [
            { effect: "crossProcess", params: { amount: 0.4 }, opacity: 0.6 },
            { effect: "temperature", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "fade", params: { amount: 0.15 }, opacity: 1.0 },
            { effect: "contrast", params: { amount: -0.05 }, opacity: 1.0 },
            { effect: "lightLeak", params: { intensity: 0.3, position: 0.2, color: 0.7 }, opacity: 0.5 },
            { effect: "grain", params: { amount: 0.1, size: 80 }, opacity: 0.6 }
        ]
    },
    "vintage_daguerreotype": {
        name: "Daguerreotype",
        category: "Vintage",
        layers: [
            { effect: "desaturate", params: { amount: 1.0 }, opacity: 1.0 },
            { effect: "sepia", params: { amount: 0.4 }, opacity: 0.7 },
            { effect: "contrast", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "lensVignette", params: { amount: 0.9, falloff: 1.5, roundness: 0.8 }, opacity: 0.8 },
            { effect: "scratch", params: { density: 0.2, intensity: 0.3 }, opacity: 0.5 },
            { effect: "dust", params: { density: 0.2, size: 1.2 }, opacity: 0.4 }
        ]
    },

    // --- STYLIZED (New) ---
    "stylized_neon_nights": {
        name: "Neon Nights",
        category: "Stylized",
        layers: [
            { effect: "contrast", params: { amount: 0.4 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.5 }, opacity: 1.0 },
            { effect: "splitTone", params: { shadowHue: 0.75, shadowSat: 0.4, highlightHue: 0.95, highlightSat: 0.3, balance: -0.2 }, opacity: 0.7 },
            { effect: "chromatic", params: { amount: 0.3 }, opacity: 0.5 },
            { effect: "vignette", params: { amount: 0.4, softness: 0.3 }, opacity: 0.7 }
        ]
    },
    "stylized_anime": {
        name: "Anime Style",
        category: "Stylized",
        layers: [
            { effect: "contrast", params: { amount: 0.2 }, opacity: 1.0 },
            { effect: "saturation", params: { amount: 0.3 }, opacity: 1.0 },
            { effect: "posterize", params: { levels: 12 }, opacity: 0.4 },
            { effect: "edgeDetect", params: { amount: 0.8 }, opacity: 0.15 }
        ]
    },
    "stylized_watercolor_dream": {
        name: "Watercolor Dream",
        category: "Stylized",
        layers: [
            { effect: "watercolor", params: { wetness: 0.6, granulation: 0.4 }, opacity: 0.8 },
            { effect: "saturation", params: { amount: -0.1 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.15 }, opacity: 1.0 }
        ]
    },
    "stylized_comic": {
        name: "Comic Panel",
        category: "Stylized",
        layers: [
            { effect: "comicBook", params: { edgeThickness: 2.5, colorLevels: 6 }, opacity: 0.9 },
            { effect: "contrast", params: { amount: 0.15 }, opacity: 1.0 }
        ]
    },

    // --- PHOTO ENHANCEMENT (New) ---
    "enhance_portrait_pro": {
        name: "Portrait Pro",
        category: "Enhancement",
        layers: [
            { effect: "surfaceBlur", params: { radius: 3, threshold: 0.12 }, opacity: 0.4 },
            { effect: "smartSharpen", params: { amount: 0.8, radius: 1, threshold: 0.05 }, opacity: 0.6 },
            { effect: "vibrancePro", params: { vibrance: 0.15, protectSkin: 0.8, satBoost: 0 }, opacity: 1.0 },
            { effect: "highlights", params: { amount: 0.1 }, opacity: 1.0 },
            { effect: "shadows", params: { amount: 0.05 }, opacity: 1.0 }
        ]
    },
    "enhance_landscape_hdr": {
        name: "Landscape HDR",
        category: "Enhancement",
        layers: [
            { effect: "hdrTone", params: { strength: 0.6, detail: 0.5 }, opacity: 0.8 },
            { effect: "localContrast", params: { amount: 0.3, radius: 8 }, opacity: 0.7 },
            { effect: "vibrancePro", params: { vibrance: 0.25, protectSkin: 0.3, satBoost: 0.1 }, opacity: 1.0 },
            { effect: "dehaze", params: { amount: 0.2 }, opacity: 0.7 }
        ]
    },
    "enhance_detail_pop": {
        name: "Detail Pop",
        category: "Enhancement",
        layers: [
            { effect: "microContrast", params: { amount: 0.8, radius: 4 }, opacity: 0.7 },
            { effect: "textureEnhance", params: { strength: 0.6, scale: 8 }, opacity: 0.5 },
            { effect: "clarity", params: { amount: 0.4 }, opacity: 0.8 },
            { effect: "contrast", params: { amount: 0.1 }, opacity: 1.0 }
        ]
    },
    "enhance_auto_fix": {
        name: "Auto Enhance",
        category: "Enhancement",
        layers: [
            { effect: "autoContrast", params: { amount: 0.6 }, opacity: 0.8 },
            { effect: "shadowRecovery", params: { amount: 0.4, range: 0.3 }, opacity: 0.7 },
            { effect: "highlightRecovery", params: { amount: 0.3, range: 0.8 }, opacity: 0.7 },
            { effect: "vibrancePro", params: { vibrance: 0.1, protectSkin: 0.5, satBoost: 0 }, opacity: 1.0 }
        ]
    }
};

export { PRESETS };
