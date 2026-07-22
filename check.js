import fs from "fs";
import { getAllDorms } from "./parser.js";
import { notifyAvailability } from "./notify.js";
import { upsertStatusMessage } from "./status.js";


const data = await getAllDorms();

// ============================================================
// 🧪 TEST OVERRIDE — REMOVE THIS BLOCK BEFORE REAL USE 🧪
// Simulates free spots on Budeč (3) and Kajetánka (2) so the
// notification/DM/status-message flow can be tested end-to-end.
// ============================================================

//for (const college of data) {
//    if (college.id === "380942") { // Kolej Budeč
//        if (college.rooms[0]) college.rooms[0].men = "3";
//    }
//    if (college.id === "380946") { // Kolej Kajetánka
//        if (college.rooms[0]) college.rooms[0].women = "2";
//    }
//}

// ============================================================
// 🧪 END TEST OVERRIDE 🧪
// ============================================================

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
