import styles from "ansi-styles";

// Helper to apply styles
const style = {
  cyan: (text: string) => `${styles.cyan.open}${text}${styles.cyan.close}`,
  green: (text: string) => `${styles.green.open}${text}${styles.green.close}`,
  yellow: (text: string) => `${styles.yellow.open}${text}${styles.yellow.close}`,
  red: (text: string) => `${styles.red.open}${text}${styles.red.close}`,
  magenta: (text: string) => `${styles.magenta.open}${text}${styles.magenta.close}`,
  blue: (text: string) => `${styles.blue.open}${text}${styles.blue.close}`,
  bold: (text: string) => `${styles.bold.open}${text}${styles.bold.close}`,
  dim: (text: string) => `${styles.dim.open}${text}${styles.dim.close}`,
  italic: (text: string) => `${styles.italic.open}${text}${styles.italic.close}`,
  underline: (text: string) => `${styles.underline.open}${text}${styles.underline.close}`,
  bgCyan: (text: string) => `${styles.bgCyan.open}${text}${styles.bgCyan.close}`,
  bgGreen: (text: string) => `${styles.bgGreen.open}${text}${styles.bgGreen.close}`,
  bgMagenta: (text: string) => `${styles.bgMagenta.open}${text}${styles.bgMagenta.close}`,
  black: (text: string) => `${styles.black.open}${text}${styles.black.close}`,
};

export function intro() {
  console.log();
  console.log(style.cyan("  ╭─────────────────────────────────────────╮"));
  console.log(style.cyan("  │") + "  " + style.bold(style.magenta("✨ manas-fm")) + " " + style.dim("File Manager Setup") + "  " + style.cyan("│"));
  console.log(style.cyan("  ╰─────────────────────────────────────────╯"));
  console.log();
}

export function outro() {
  console.log();
  console.log(style.green("  ┌────────────────────────────────────┐"));
  console.log(style.green("  │") + "  " + style.bold(style.green("✨ Setup Complete!")) + "            " + style.green("│"));
  console.log(style.green("  └────────────────────────────────────┘"));
  console.log();
}

export function step(message: string) {
  console.log(style.cyan("  ▸") + " " + style.bold(message));
}

export function success(message: string) {
  console.log(style.green("  ✓") + " " + style.green(message));
}

export function warn(message: string) {
  console.log(style.yellow("  ⚠") + "  " + style.yellow(message));
}

export function error(message: string) {
  console.log(style.red("  ✗") + "  " + style.bold(style.red(message)));
}

export function info(message: string) {
  console.log(style.dim("  ℹ") + "  " + style.dim(message));
}

export function highlight(message: string) {
  console.log("  " + style.bgMagenta(style.black(" " + message + " ")));
}

export function section(title: string) {
  console.log();
  console.log(style.bold(style.blue("  ━━━ ")) + style.bold(style.cyan(title)) + style.bold(style.blue(" ━━━")));
  console.log();
}

export function code(text: string) {
  return style.bgCyan(style.black(" " + text + " "));
}

export function blank() {
  console.log();
}
