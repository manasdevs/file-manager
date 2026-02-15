import pc from "picocolors";

export function intro() {
  console.log();
  console.log(pc.bold(pc.cyan("  manas-fm")) + pc.dim(" — File Manager Setup"));
  console.log(pc.dim("  ─────────────────────────────────"));
  console.log();
}

export function outro() {
  console.log();
  console.log(pc.green("  ✓ Setup complete!"));
  console.log();
}

export function step(message: string) {
  console.log(pc.cyan("  ▸ ") + message);
}

export function success(message: string) {
  console.log(pc.green("  ✓ ") + message);
}

export function warn(message: string) {
  console.log(pc.yellow("  ⚠ ") + message);
}

export function error(message: string) {
  console.log(pc.red("  ✗ ") + message);
}

export function info(message: string) {
  console.log(pc.dim("  ℹ ") + message);
}

export function blank() {
  console.log();
}
