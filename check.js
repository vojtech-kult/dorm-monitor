import fs from "fs";
import { getAllDorms } from "./parser.js";
import { notifyAvailability, notifySourcesDown } from "./notify.js";
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

// An empty result means every single college fetch failed — almost always
// the source website being down/unreachable, not "zero rooms everywhere".
const sourcesDown = data.length === 0;

if (sourcesDown) {
    console.log("No colleges returned any data — treating source website as down.");

    try {
        await notifySourcesDown();
    } catch (err) {
        console.error("Notification error:", err.message);
    }

    // Keep the last known good data instead of overwriting it with nothing,
    // but still record that this check happened and that the source was down.
    let previousData = [];
    try {
        const previousOutput = JSON.parse(fs.readFileSync("dorms.json", "utf8"));
        previousData = previousOutput.data || [];
    } catch (err) {
        console.log("No previous dorms.json to fall back on.");
    }

    try {
        await upsertStatusMessage(previousData, updatedAt, { sourcesDown: true });
    } catch (err) {
        console.error("Status message error:", err.message);
    }

    const output = {
        updatedAt,
        sourcesDown: true,
        data: previousData
    };

    fs.writeFileSync("dorms.json", JSON.stringify(output, null, 2), "utf8");

    console.log("Aktualizováno (weby nedostupné):", output.updatedAt);
} else {
    try {
        await notifyAvailability(data);
    } catch (err) {
        console.error("Notification error:", err.message);
    }

    try {
        await upsertStatusMessage(data, updatedAt, { sourcesDown: false });
    } catch (err) {
        console.error("Status message error:", err.message);
    }

    const output = {
        updatedAt,
        sourcesDown: false,
        data
    };

    fs.writeFileSync("dorms.json", JSON.stringify(output, null, 2), "utf8");

    console.log("Aktualizováno:", output.updatedAt);
}
