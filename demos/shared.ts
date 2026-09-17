const ORANGE = "\x1b[38;2;251;146;60m"
const MUTED = "\x1b[2m"
const RESET = "\x1b[0m"

const color = Boolean(process.stdout.isTTY && !process.env.NO_COLOR)

export function demoHeader(title: string, description: string) {
  const heading = color ? `${ORANGE}olwibaDX demo — ${title}${RESET}` : `olwibaDX demo — ${title}`
  const note = color ? `${MUTED}${description}${RESET}` : description
  process.stdout.write(`${heading}\n${note}\n\n`)
}

export function success(message: string) {
  process.stdout.write(`${color ? "\x1b[32m" : ""}✓ ${message}${color ? RESET : ""}\n`)
}
