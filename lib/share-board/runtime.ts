import "server-only";
import { createNeonShareBoardRepository } from "./neon-repository";
import { createShareBoardService } from "./service";

export function getShareBoardService() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the Share Board.");
  }

  return createShareBoardService({
    repository: createNeonShareBoardRepository(connectionString)
  });
}
