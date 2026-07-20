/**
 * Sends a Discord notification on every run, summarizing current availability.
 *
 * For each college with at least one free spot (summed across all room types),
 * a line is sent: "@everyone Nová místa (X) na koleji Y!"
 * If no colleges have any free spots, sends "Žádná nová místa se neuvolnila."
 *
 * This fires every run regardless of whether the spots were already free
 * on the previous run.
 */

import { getGuildMembers, sendDmsToRole } from "./dm.js";

function roomTotal(room) {
    return (
        (parseInt(room.men, 10) || 0) +
        (parseInt(room.women, 10) || 0) +
        (parseInt(room.unknown, 10) || 0)
    );
}

function getAvailableColleges(data) {
    const available = [];

    for (const college of data) {
        const total = (college.rooms || []).reduce(
            (sum, room) => sum + roomTotal(room),
            0
        );

        if (total > 0) {
            available.push({
                collegeName: college.collegeName,
                total
            });
        }
    }

    return available;
}

async function postToDiscord(webhookUrl, content) {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Discord webhook failed: ${response.status} ${text}`
        );
    }
}

export async function notifyAvailability(data) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const roleAllId = process.env.DISCORD_ROLE_ALL_ID;
    const roleAvailableId = process.env.DISCORD_ROLE_AVAILABLE_ID;

    const available = getAvailableColleges(data);

    let content;

    if (available.length === 0) {
        content = "**Koleje UK:** Žádná nová místa se neuvolnila.\nDetailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/";
    } else {
        content = available
            .map(
                (c) =>
                    `@everyone **Nová místa (${c.total}) na koleji ${c.collegeName}!**\nDetailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/`
            )
            .join("\n");
    }

    console.log("Notification content:", content);

    // Channel webhook — same behavior as before.
    if (webhookUrl) {
        await postToDiscord(webhookUrl, content);
    } else {
        console.log("DISCORD_WEBHOOK_URL not set, skipping channel message.");
    }

    // Role-based DMs.
    if (!botToken || !guildId) {
        console.log(
            "DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not set, skipping DMs."
        );
        return;
    }

    const members = await getGuildMembers(guildId, botToken);

    // "All notifications" role: gets every message, same as the webhook.
    if (roleAllId) {
        await sendDmsToRole(members, roleAllId, content, botToken, "All notifications");
    }

    // "Available notifications only" role: only DM'd when spots were found.
    if (roleAvailableId && available.length > 0) {
        await sendDmsToRole(
            members,
            roleAvailableId,
            content,
            botToken,
            "Available notifications only"
        );
    }
}
