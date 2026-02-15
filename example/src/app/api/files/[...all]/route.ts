import { toNextJsHandler } from "manas-fm";
import { getFileManager } from "@/lib/file-manager";

export const { GET, POST } = toNextJsHandler(getFileManager());
