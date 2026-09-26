// Full class names (not built dynamically) so Tailwind can see them.
export const VARIANT_COLORS = {
  green: {
    top: 'border-t-mint',
    selected: 'border-mint shadow-mint/25',
    text: 'text-mint',
    dot: 'bg-mint',
    button: 'bg-mint text-midnight hover:brightness-110',
  },
  violet: {
    top: 'border-t-violet-400',
    selected: 'border-violet-400 shadow-violet-500/30',
    text: 'text-violet-300',
    dot: 'bg-violet-400',
    button: 'bg-violet-500 text-white hover:brightness-110',
  },
  blue: {
    top: 'border-t-sky-400',
    selected: 'border-sky-400 shadow-sky-400/25',
    text: 'text-sky-300',
    dot: 'bg-sky-400',
    button: 'bg-sky-400 text-midnight hover:brightness-110',
  },
}

export const colorsFor = (color) => VARIANT_COLORS[color] || VARIANT_COLORS.violet
