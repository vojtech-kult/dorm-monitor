import fs from "fs";

/**
 * Run this ONCE locally (node setup-roles-message.js) to post the
 * role-picker message. Re-run it any time you want to repost it
 * (e.g. after adding a new dorm to dorm-roles.json) — it always creates
 * a new message, it does not edit an existing one.
 *
 * Required env vars (set them in your shell before running, or a .env
 * loader of your choice):
 *   DISCORD_BOT_TOKEN
 *   DISCORD_ROLES_CHANNEL_ID   (channel to post the picker message in)
 *   DISCORD_ROLE_ALL_ID
 *   DISCORD_ROLE_AVAILABLE_ID
 *   DISCORD_ROLE_ALL_DORMS_ID
 */

const API_BASE = "https://discord.com/api/v10";

const botToken = process.env.DISCORD_BOT_TOKEN;
const channelId = process.env.DISCORD_ROLES_CHANNEL_ID;
const roleAllId = process.env.DISCORD_ROLE_ALL_ID;
const roleAvailableId = process.env.DISCORD_ROLE_AVAILABLE_ID;
const roleAllDormsId = process.env.DISCORD_ROLE_ALL_DORMS_ID;

if (!botToken || !channelId || !roleAllId || !roleAvailableId || !roleAllDormsId) {
    console.error("Missing one or more required env vars. See comments at top of this file.");
    process.exit(1);
}

const dormRoles = JSON.parse(fs.readFileSync("dorm-roles.json", "utf8"));
const dormsData = JSON.parse(fs.readFileSync("dorms.json", "utf8"));

// Build id -> collegeName lookup from the latest scan.
const nameById = {};
for (const college of dormsData.data || []) {
    nameById[college.id] = college.collegeName;
}

const frequencySelect = {
    type: 1,
    components: [
        {
            type: 3, // string select
            custom_id: "select_frequency",
            placeholder: "Vyber typ oznámení",
            min_values: 1,
            max_values: 1,
            options: [
                { label: "Všechna oznámení", value: roleAllId, description: "Zpráva po každé kontrole" },
                { label: "Pouze volná místa", value: roleAvailableId, description: "Zpráva jen když se něco uvolní" },
                { label: "Žádná oznámení", value: "none", description: "Zruší obě předchozí volby" }
            ]
        }
    ]
};

const dormOptions = Object.entries(dormRoles)
    .filter(([, roleId]) => roleId && !roleId.startsWith("PUT_ROLE_ID_HERE"))
    .map(([collegeId, roleId]) => ({
        label: nameById[collegeId] || collegeId,
        value: roleId
    }));

dormOptions.push({ label: "Všechny koleje", value: roleAllDormsId, description: "Dostávej info o všech kolejích" });

const dormSelect = {
    type: 1,
    components: [
        {
            type: 3,
            custom_id: "select_dorm_roles",
            placeholder: "Vyber koleje (lze více najednou)",
            min_values: 0,
            max_values: dormOptions.length,
            options: dormOptions
        }
    ]
};

const body = {
    content:
        "**Nastavení oznámení o kolejích**\n\n" +
        "Vyber, jak často chceš dostávat zprávy, a které koleje tě zajímají. " +
        "Výběr můžeš kdykoliv změnit — stačí vybrat znovu.",
    components: [frequencySelect, dormSelect]
};

const response = await fetch(`${API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
});

if (!response.ok) {
    console.error("Failed to post role message:", response.status, await response.text());
    process.exit(1);
}

console.log("Role-picker message posted successfully.");
