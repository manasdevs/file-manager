import { runInit } from "./commands/init.js";
import { intro, outro, error } from "./utils/logger.js";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "init";

  intro();

  try {
    switch (command) {
      case "init":
        await runInit();
        break;
      case "--help":
      case "-h":
        printHelp();
        break;
      case "--version":
      case "-v":
        printVersion();
        break;
      default:
        error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof Error && err.message === "PROMPT_CANCELLED") {
      error("\nSetup cancelled.");
      process.exit(0);
    }
    error(err instanceof Error ? err.message : "An unexpected error occurred");
    process.exit(1);
  }
}

function printHelp() {
  const { cyan, bold, dim, green, magenta } = getStyles();
  console.log();
  console.log(cyan("  ╭────────────────────────────────────────╮"));
  console.log(cyan("  │") + "  " + bold(magenta("manas-fm CLI")) + " - Help           " + cyan("│"));
  console.log(cyan("  ╰────────────────────────────────────────╯"));
  console.log();
  console.log(bold("  Usage:"));
  console.log("    " + green("npx add-manas-fm@latest") + " " + dim("[command]"));
  console.log();
  console.log(bold("  Commands:"));
  console.log("    " + cyan("init") + "       " + dim("Set up manas-fm (default)"));
  console.log("    " + cyan("--help") + "     " + dim("Show this help message"));
  console.log("    " + cyan("--version") + "  " + dim("Show version"));
  console.log();
}

function printVersion() {
  const { cyan, bold, magenta } = getStyles();
  console.log();
  console.log("  " + bold(magenta("✨ add-manas-fm")) + " " + cyan("v1.0.0"));
  console.log();
}

function getStyles() {
  return {
    cyan: (text: string) => `\x1b[36m${text}\x1b[39m`,
    green: (text: string) => `\x1b[32m${text}\x1b[39m`,
    magenta: (text: string) => `\x1b[35m${text}\x1b[39m`,
    bold: (text: string) => `\x1b[1m${text}\x1b[22m`,
    dim: (text: string) => `\x1b[2m${text}\x1b[22m`,
  };
}

main();
