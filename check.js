import fs from "fs";
import { getAllDorms } from "./parser.js";


const data = await getAllDorms();


const output = {
    updatedAt: new Date().toISOString(),
    data
};


fs.writeFileSync(
    "dorms.json",
    JSON.stringify(output, null, 2),
    "utf8"
);


console.log(
    "Aktualizováno:",
    output.updatedAt
);