import type { Config } from "tailwindcss";

/**
 * Claude / Anthropic design system.
 * Источник: DESIGN-claude.md
 *
 * Палитра:
 *   parchment  #f5f4ed  — основной фон
 *   ivory      #faf9f5  — карточки
 *   terracotta #c96442  — акцент, действия
 *   near-black #141413  — текст
 *   olive-gray #5e5d59  — второстепенный текст, иконки
 *   subtle     #ebe8df  — границы, ring shadows
 *   warm-white #ffffff  — чистый белый там, где нужно
 *
 * Типографика:
 *   serif — Anthropic Serif 500 (заголовки, hero)
 *   sans  — системный (UI: кнопки, формы, таблицы)
 *
 * Радиусы: 8 / 12 / 16 / 24 / 32
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Основные (дизайн-токены)
        parchment: "#f5f4ed",
        ivory: "#faf9f5",
        "near-black": "#141413",
        charcoal: "#4d4c48",
        "olive-gray": {
          DEFAULT: "#5e5d59",
          light: "#87867f",
        },
        olive: "#5e5d59",
        stone: "#87867f",
        "border-cream": "#f0eee6",
        "border-warm": "#e8e6dc",
        "warm-sand": "#e8e6dc",
        subtle: "#ebe8df",

        // Акценты
        terracotta: {
          DEFAULT: "#c96442",
          hover: "#b45736",
          active: "#9f4a2c",
          soft: "#f4dacf",
        },
        crimson: "#b53333",
        moss: "#3f6b3d",
        "focus-blue": "#3898ec",

        // Tonal chip backgrounds (для utility-классов)
        "tone-good-bg": "rgba(63,107,61,0.10)",
        "tone-warn-bg": "rgba(201,100,66,0.10)",
        "tone-bad-bg": "rgba(181,51,51,0.10)",

        // statuses (legacy)
        status: {
          conducted: "#3f6b3d",
          penalty: "#b53333",
          "cancelled-teacher": "#87867f",
          "cancelled-student": "#c96442",
        },
      },
      fontFamily: {
        serif: [
          "var(--font-serif)",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        // line-height 1.6 для всего text
        xs: ["0.75rem", { lineHeight: "1.6" }],
        sm: ["0.875rem", { lineHeight: "1.6" }],
        base: ["1rem", { lineHeight: "1.6" }],
        lg: ["1.125rem", { lineHeight: "1.55" }],
        xl: ["1.25rem", { lineHeight: "1.5" }],
        "2xl": ["1.5rem", { lineHeight: "1.4" }],
        "3xl": ["1.875rem", { lineHeight: "1.3" }],
        "4xl": ["2.5rem", { lineHeight: "1.2" }],
      },
      borderRadius: {
        sm: "0.5rem",   // 8
        DEFAULT: "0.75rem", // 12
        md: "1rem",     // 16
        lg: "1.5rem",   // 24
        xl: "2rem",     // 32
      },
      boxShadow: {
        // Claude-style ring shadow (0 0 0 1px вместо толстых теней)
        ring: "0 0 0 1px rgba(20, 20, 19, 0.08)",
        "ring-strong": "0 0 0 1px rgba(20, 20, 19, 0.16)",
        // Для lifted карточек — очень мягкая тень + ring
        lift: "0 1px 3px rgba(20, 20, 19, 0.04), 0 0 0 1px rgba(20, 20, 19, 0.06)",
        "lift-md": "0 4px 12px rgba(20, 20, 19, 0.06), 0 0 0 1px rgba(20, 20, 19, 0.06)",
        focus: "0 0 0 3px rgba(201, 100, 66, 0.25)",
      },
      spacing: {
        18: "4.5rem",
      },
      maxWidth: {
        prose: "65ch",
      },
    },
  },
  plugins: [],
} satisfies Config;
