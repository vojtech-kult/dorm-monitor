import fs from "fs";
import { getAllDorms } from "./parser.js";
import { notifyAvailability } from "./notify.js";
import { upsertStatusMessage } from "./status.js";


const data = await getAllDorms();

const updatedAt = new Date().toISOString();


try {
    await notifyAvailability(data);
} catch (err) {
    console.error("Notification error:", err.message);
}


try {
    await upsertStatusMessage(data, updatedAt);
} catch (err) {
    console.error("Status message error:", err.message);
}


const output = {
    updatedAt,
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
