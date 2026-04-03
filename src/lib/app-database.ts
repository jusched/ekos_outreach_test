import { createAppDatabase } from "@/src/db/client";
import { getAppConfig } from "@/src/lib/config";

declare global {
  var __salesAgentDatabase: ReturnType<typeof createAppDatabase> | undefined;
}

export function getAppDatabase() {
  if (!global.__salesAgentDatabase) {
    const config = getAppConfig();
    global.__salesAgentDatabase = createAppDatabase({
      filename: config.databaseFile,
      appSecret: config.appSecret,
    });
  }

  return global.__salesAgentDatabase;
}
