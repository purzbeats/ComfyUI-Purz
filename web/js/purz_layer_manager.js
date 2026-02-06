/**
 * Purz Layer Manager Module
 * Effect picker, undo/redo system, and layout utilities.
 */

import { EFFECTS, CustomShaderLoader } from "./purz_filter_engine.js";

// ============================================================================
// EFFECT PICKER (Search + Favorites + Recently Used)
// ============================================================================

const EffectPicker = {
    _favorites: null,
    _recent: null,

    getFavorites() {
        if (!this._favorites) {
            try {
                this._favorites = new Set(JSON.parse(localStorage.getItem("purz_favorites") || "[]"));
            } catch { this._favorites = new Set(); }
        }
        return this._favorites;
    },

    saveFavorites() {
        localStorage.setItem("purz_favorites", JSON.stringify([...this.getFavorites()]));
    },

    toggleFavorite(key) {
        const favs = this.getFavorites();
        if (favs.has(key)) favs.delete(key);
        else favs.add(key);
        this.saveFavorites();
    },

    isFavorite(key) {
        return this.getFavorites().has(key);
    },

    getRecent() {
        if (!this._recent) {
            try {
                this._recent = JSON.parse(localStorage.getItem("purz_recent_effects") || "[]");
            } catch { this._recent = []; }
        }
        return this._recent;
    },

    addRecent(key) {
        const recent = this.getRecent();
        const idx = recent.indexOf(key);
        if (idx !== -1) recent.splice(idx, 1);
        recent.unshift(key);
        if (recent.length > 10) recent.length = 10;
        this._recent = recent;
        localStorage.setItem("purz_recent_effects", JSON.stringify(recent));
    },

    /**
     * Fuzzy match: checks if all chars in query appear in name in order.
     * Returns a score (lower = better match). -1 means no match.
     */
    fuzzyMatch(name, query) {
        const lower = name.toLowerCase();
        const q = query.toLowerCase();
        let qi = 0;
        let score = 0;
        let lastMatchIdx = -1;
        for (let i = 0; i < lower.length && qi < q.length; i++) {
            if (lower[i] === q[qi]) {
                // Bonus for consecutive matches and word starts
                score += (i === lastMatchIdx + 1) ? 0 : 10;
                if (i === 0 || name[i - 1] === ' ') score -= 5; // word boundary bonus
                lastMatchIdx = i;
                qi++;
            }
        }
        return qi === q.length ? score : -1;
    },

    /**
     * Open effect picker panel inside a container element.
     * @param {HTMLElement} parentEl - container to append picker to
     * @param {Object} allEffects - merged effects object
     * @param {string} currentEffect - currently selected effect key
     * @param {function} onSelect - callback(effectKey) when effect is chosen
     * @param {function} onClose - callback when picker is closed
     */
    open(parentEl, allEffects, currentEffect, onSelect, onClose) {
        // Create overlay panel
        const picker = document.createElement("div");
        picker.className = "purz-effect-picker";

        // Header with search
        const header = document.createElement("div");
        header.className = "purz-effect-picker-header";
        const searchInput = document.createElement("input");
        searchInput.className = "purz-effect-search";
        searchInput.type = "text";
        searchInput.placeholder = "Search effects...";
        header.appendChild(searchInput);
        const closeBtn = document.createElement("button");
        closeBtn.className = "purz-effect-picker-close";
        closeBtn.textContent = "\u00D7";
        closeBtn.addEventListener("click", () => { picker.remove(); onClose(); });
        header.appendChild(closeBtn);
        picker.appendChild(header);

        // List container
        const listEl = document.createElement("div");
        listEl.className = "purz-effect-picker-list";
        picker.appendChild(listEl);

        let highlightedIndex = -1;
        let visibleItems = [];

        const renderList = (query) => {
            listEl.innerHTML = "";
            visibleItems = [];
            highlightedIndex = -1;

            // Collect all effect entries with match scores
            const entries = [];
            for (const [key, effect] of Object.entries(allEffects)) {
                if (query) {
                    const score = this.fuzzyMatch(effect.name, query);
                    if (score === -1) continue;
                    entries.push({ key, effect, score });
                } else {
                    entries.push({ key, effect, score: 0 });
                }
            }

            if (query) {
                // Sort by match score when searching
                entries.sort((a, b) => a.score - b.score);
                for (const { key, effect } of entries) {
                    const item = createItem(key, effect);
                    listEl.appendChild(item);
                    visibleItems.push({ el: item, key });
                }
            } else {
                // Show sections: Favorites, Recently Used, then categories
                const favs = this.getFavorites();
                const recent = this.getRecent();

                // Favorites section
                const favEntries = entries.filter(e => favs.has(e.key));
                if (favEntries.length > 0) {
                    const section = createSection("Favorites", favEntries);
                    listEl.appendChild(section.el);
                    visibleItems.push(...section.items);
                }

                // Recently Used section
                const recentEntries = recent
                    .map(key => entries.find(e => e.key === key))
                    .filter(Boolean);
                if (recentEntries.length > 0) {
                    const section = createSection("Recently Used", recentEntries);
                    listEl.appendChild(section.el);
                    visibleItems.push(...section.items);
                }

                // Category sections
                const categoryOrder = ["Basic", "Color", "Tone", "Detail", "Effects", "Artistic", "Creative", "Lens", "Custom"];
                const byCategory = {};
                for (const entry of entries) {
                    const cat = entry.effect.category || "Other";
                    if (!byCategory[cat]) byCategory[cat] = [];
                    byCategory[cat].push(entry);
                }
                const sortedCats = Object.keys(byCategory).sort((a, b) => {
                    const ai = categoryOrder.indexOf(a);
                    const bi = categoryOrder.indexOf(b);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
                for (const cat of sortedCats) {
                    const section = createSection(cat, byCategory[cat], true);
                    listEl.appendChild(section.el);
                    visibleItems.push(...section.items);
                }
            }

            // Highlight current effect
            for (let i = 0; i < visibleItems.length; i++) {
                if (visibleItems[i].key === currentEffect) {
                    visibleItems[i].el.classList.add("selected");
                }
            }
        };

        const createItem = (key, effect) => {
            const item = document.createElement("div");
            item.className = "purz-effect-item";

            const favBtn = document.createElement("button");
            favBtn.className = `purz-effect-fav-btn ${this.isFavorite(key) ? "favorited" : ""}`;
            favBtn.textContent = this.isFavorite(key) ? "\u2605" : "\u2606";
            favBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleFavorite(key);
                favBtn.className = `purz-effect-fav-btn ${this.isFavorite(key) ? "favorited" : ""}`;
                favBtn.textContent = this.isFavorite(key) ? "\u2605" : "\u2606";
            });
            item.appendChild(favBtn);

            const nameSpan = document.createElement("span");
            nameSpan.className = "purz-effect-item-name";
            nameSpan.textContent = effect.name;
            item.appendChild(nameSpan);

            const catSpan = document.createElement("span");
            catSpan.className = "purz-effect-item-cat";
            catSpan.textContent = effect.category || "";
            item.appendChild(catSpan);

            item.addEventListener("click", () => {
                this.addRecent(key);
                picker.remove();
                onSelect(key);
            });

            return item;
        };

        const createSection = (title, entries, collapsible = false) => {
            const section = document.createElement("div");
            section.className = "purz-effect-section";

            const titleEl = document.createElement("div");
            titleEl.className = "purz-effect-section-title";

            const arrow = document.createElement("span");
            arrow.className = "purz-effect-section-arrow";
            arrow.textContent = "\u25BC";
            titleEl.appendChild(arrow);

            const titleText = document.createTextNode(` ${title}`);
            titleEl.appendChild(titleText);
            section.appendChild(titleEl);

            const itemsContainer = document.createElement("div");
            itemsContainer.className = "purz-effect-section-items";

            const items = [];
            for (const { key, effect } of entries) {
                const item = createItem(key, effect);
                itemsContainer.appendChild(item);
                items.push({ el: item, key });
            }
            section.appendChild(itemsContainer);

            titleEl.addEventListener("click", () => {
                arrow.classList.toggle("collapsed");
                itemsContainer.classList.toggle("collapsed");
            });

            return { el: section, items };
        };

        const updateHighlight = () => {
            visibleItems.forEach((v, i) => {
                v.el.classList.toggle("highlighted", i === highlightedIndex);
            });
            if (highlightedIndex >= 0 && visibleItems[highlightedIndex]) {
                visibleItems[highlightedIndex].el.scrollIntoView({ block: "nearest" });
            }
        };

        searchInput.addEventListener("input", () => {
            renderList(searchInput.value.trim());
        });

        searchInput.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                highlightedIndex = Math.min(highlightedIndex + 1, visibleItems.length - 1);
                updateHighlight();
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                highlightedIndex = Math.max(highlightedIndex - 1, 0);
                updateHighlight();
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (highlightedIndex >= 0 && visibleItems[highlightedIndex]) {
                    const key = visibleItems[highlightedIndex].key;
                    this.addRecent(key);
                    picker.remove();
                    onSelect(key);
                }
            } else if (e.key === "Escape") {
                picker.remove();
                onClose();
            }
        });

        // Stop all events from propagating to the node
        picker.addEventListener("pointerdown", (e) => e.stopPropagation(), true);
        picker.addEventListener("mousedown", (e) => e.stopPropagation(), true);

        renderList("");
        parentEl.appendChild(picker);
        searchInput.focus();
    }
};

// ============================================================================
// UNDO/REDO SYSTEM
// ============================================================================

class UndoManager {
    constructor(maxStates = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxStates = maxStates;
        this._debounceTimer = null;
    }

    /**
     * Push current state onto undo stack. Clears redo stack.
     */
    pushState(layers) {
        const snapshot = JSON.parse(JSON.stringify(layers));
        this.undoStack.push(snapshot);
        if (this.undoStack.length > this.maxStates) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    /**
     * Push state with debounce (for slider drags).
     * Returns immediately; snapshot happens after idle period.
     */
    pushStateDebounced(layers, delay = 300) {
        if (this._debounceTimer) clearTimeout(this._debounceTimer);
        this._debounceTimer = setTimeout(() => {
            this.pushState(layers);
            this._debounceTimer = null;
        }, delay);
    }

    /**
     * Undo: returns the previous state, or null if nothing to undo.
     */
    undo(currentLayers) {
        if (this.undoStack.length === 0) return null;
        // Save current state to redo stack
        this.redoStack.push(JSON.parse(JSON.stringify(currentLayers)));
        return this.undoStack.pop();
    }

    /**
     * Redo: returns the next state, or null if nothing to redo.
     */
    redo(currentLayers) {
        if (this.redoStack.length === 0) return null;
        // Save current state to undo stack
        this.undoStack.push(JSON.parse(JSON.stringify(currentLayers)));
        return this.redoStack.pop();
    }

    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }
}

// ============================================================================
// LAYOUT UTILITIES
// ============================================================================

function fitHeight(node, widget) {
    if (!node) return;

    // Calculate height directly from widget state
    let height = 500; // Base height
    if (widget) {
        const size = widget.computeSize(node.size[0]);
        height = size[1] + 40; // Buffer for node title bar and chrome

        // Set explicit height on container to match computed size
        if (widget.container) {
            widget.container.style.height = size[1] + "px";
        }
    }

    node.setSize([node.size[0], height]);
    node?.graph?.setDirtyCanvas(true);
}

export { EffectPicker, UndoManager, fitHeight };
