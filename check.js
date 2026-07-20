import fs from "fs";
import { getAllDorms } from "./parser.js";
import { notifyAvailability } from "./notify.js";


const data = await getAllDorms();


try {
    await notifyAvailability(data);
} catch (err) {
    console.error("Notification error:", err.message);
}


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
