// 디자인 시스템 토큰을 Tailwind에서 쓰게 해 주는 프리셋 (값은 CSS 변수를 가리키므로 테마를 바꾸면 같이 바뀐다)
// 사용법: tailwind.config의 presets: [require('경로/DesignSystem/themes/tailwind-preset.js')]
/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // 배경과 면
        bg: 'var(--bg)',
        'bg-subtle': 'var(--bg-subtle)',
        surface: { DEFAULT: 'var(--surface)', hover: 'var(--surface-hover)', raised: 'var(--surface-raised)' },
        // 테두리 (border-line, border-line-strong)
        line: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        // 글자 (text-fg, text-fg-body, text-fg-muted)
        fg: { DEFAULT: 'var(--fg)', body: 'var(--fg-body)', muted: 'var(--fg-muted)', faint: 'var(--fg-faint)' },
        // 포인트: bg-accent text-accent-fg / text-accent-text / bg-accent-soft / border-accent-border
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          fg: 'var(--accent-fg)',
          text: 'var(--accent-text)',
          soft: 'var(--accent-soft)',
          border: 'var(--accent-border)',
        },
        success: { DEFAULT: 'var(--success)', soft: 'var(--success-soft)' },
        warning: { DEFAULT: 'var(--warning)', soft: 'var(--warning-soft)' },
        danger: { DEFAULT: 'var(--danger)', soft: 'var(--danger-soft)' },
        info: { DEFAULT: 'var(--info)', soft: 'var(--info-soft)' },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        control: 'var(--radius-control)',
        card: 'var(--radius-card)',
        hero: 'var(--radius-hero)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      transitionTimingFunction: { premium: 'var(--ease-premium)' },
      transitionDuration: { premium: '500ms', reveal: '800ms', hero: '900ms' },
      maxWidth: { 'ds-sm': 'var(--container-sm)', 'ds-md': 'var(--container-md)', 'ds-lg': 'var(--container-lg)', 'ds-xl': 'var(--container-xl)' },
    },
  },
}
