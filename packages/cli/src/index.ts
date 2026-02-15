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
  console.log(`
  Usage: npx add-manas-fm@latest [command]

  Commands:
    init     Set up manas-fm in your project (default)
    --help   Show this help message
    --version  Show version
  `);
}

function printVersion() {
  console.log("add-manas-fm CLI v1.0.0");
}

main();
