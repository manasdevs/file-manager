/**
 * Generate the Next.js catch-all API route handler.
 */
export function generateApiRoute(isTypeScript: boolean, aliasImport: string): string {
  const lines: string[] = [];

  lines.push(`import { toNextJsHandler } from "manas-fm";`);
  lines.push(`import { getFileManager } from "${aliasImport}";`);
  lines.push(``);
  lines.push(`export const { GET, POST } = toNextJsHandler(getFileManager());`);
  lines.push(``);

  return lines.join("\n");
}
