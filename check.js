import fs from "fs";
import { getAllDorms } from "./parser.js";

const data = await getAllDorms();

fs.writeFileSync(
    "dorms.json",
    JSON.stringify(data, null, 2),
    "utf8"
);

console.log("Data aktualizována");