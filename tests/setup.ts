// Ingestion/db modules construct a postgres client at import time. Unit tests
// inject withOrgTransaction and never query; a placeholder keeps imports alive.
if (!process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = "postgres://127.0.0.1:5432/cardograph_test";
}

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
