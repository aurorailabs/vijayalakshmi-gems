import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import app from "./app.js";
import { migrate } from "./db.js";
import { dressWindows } from "./merchandising.js";
import { seed } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) process.env[match[1].trim()] = match[2].trim();
  }
}

migrate();
seed();
dressWindows();

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Vijayalakshmi Gems API listening on http://localhost:${port}`);
});
