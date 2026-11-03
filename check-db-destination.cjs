const fs = require("fs");

const envPath = ".env";
if (!fs.existsSync(envPath)) {
  console.log("No .env file found in the project root.");
  process.exit(1);
}

const line = fs.readFileSync(envPath, "utf8")
  .split(/\r?\n/)
  .find(line => /^\s*(export\s+)?DATABASE_URL\s*=/.test(line));

if (!line) {
  console.log("DATABASE_URL was not found in .env.");
  process.exit(1);
}

const value = line.replace(/^\s*(export\s+)?DATABASE_URL\s*=\s*/, "")
  .replace(/^(['"])(.*)\1\s*$/, "$2");

try {
  const url = new URL(value);
  console.log("Database host:", url.hostname);
  console.log("Database name:", decodeURIComponent(url.pathname.slice(1)) || "(not specified)");
  console.log("Connection scheme:", url.protocol.replace(":", ""));
} catch {
  console.log("DATABASE_URL is not a standard URL. Destination could not be verified.");
}
