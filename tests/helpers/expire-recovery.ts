import { execFileSync } from "node:child_process";

// Age only a disposable Auth fixture instead of shortening every token's TTL
// or sleeping until expiry. No database RPC/test backdoor is added to the app.
function runLocalAuthFixture(userId: string, assignment: string) {
  const database = new URL(process.env.LOCAL_DATABASE_URL!);
  if (process.env.RUN_DEMO_E2E !== "true" || database.protocol !== "postgresql:"
    || !["127.0.0.1", "localhost", "[::1]"].includes(database.hostname)
    || !/^[0-9a-f-]{36}$/.test(userId)) throw new Error("Only an isolated Auth fixture may be expired.");
  execFileSync("docker", ["run", "--rm", "--interactive", "--network", "host", "--env", "PGPASSWORD",
    "postgres:17.6", "psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-v", `fixture_id=${userId}`,
    "--host", database.hostname, "--port", database.port, "--username", decodeURIComponent(database.username),
    "--dbname", database.pathname.slice(1)], {
    env: { ...process.env, PGPASSWORD: decodeURIComponent(database.password) },
    input: `update auth.users set ${assignment} where id=:'fixture_id'::uuid and email like '%@example.test';\n`,
    stdio: ["pipe", "pipe", "pipe"], timeout: 30_000,
  });
}

export function expireLocalRecovery(userId: string) {
  runLocalAuthFixture(userId, "recovery_sent_at=now()-interval '2 hours'");
}

export function setLegacyLocalPassword(userId: string) {
  // Known disposable fixture value simulates the previous six-character policy.
  runLocalAuthFixture(userId, "encrypted_password=extensions.crypt('old123',extensions.gen_salt('bf'))");
}
