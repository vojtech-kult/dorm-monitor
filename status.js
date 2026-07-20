import fs from "fs";

const API_BASE = "https://discord.com/api/v10";
const STATE_FILE = "status-message-id.json";

function roomTotal(room) {
    return (
        (parseInt(room.men, 10) || 0) +
        (parseInt(room.women, 10) || 0) +
        (parseInt(room.unknown, 10) || 0)
    );
}

function buildEmbed(data, updatedAt) {
    let totalFree = 0;

    const fields = data.map((college) => {
        const free = (college.rooms || []).reduce(
            (sum, r) => sum + roomTotal(r),
            0
        );
        totalFree += free;

        return {
            name: college.collegeName,
            value: free > 0 ? `🟢 ${free} volných` : "⚪ 0 volných",
            inline: true
        };
    });

    return {
        title: "Stav kolejí UK",
        description:
            totalFree > 0
                ? `**${totalFree}** volných míst celkem`
                : "Aktuálně žádná volná místa.",
        color: totalFree > 0 ? 0x6fcf97 : 0x5b606d,
        fields,
        footer: { text: "Poslední kontrola" },
        timestamp: updatedAt
    };
}

function loadMessageId() {
    try {
        const raw = fs.readFileSync(STATE_FILE, "utf8");
        return JSON.parse(raw).messageId || null;
    } catch (err) {
        return null;
    }
}

function saveMessageId(messageId) {
    fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({ messageId }, null, 2),
        "utf8"
    );
}

async function createMessage(channelId, embed, botToken) {
    const response = await fetch(
        `${API_BASE}/channels/${channelId}/messages`,
        {
            method: "POST",
            headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ embeds: [embed] })
        }
    );

    if (!response.ok) {
        throw new Error(
            `Failed to create status message: ${response.status} ${await response.text()}`
        );
    }

    return response.json();
}

async function editMessage(channelId, messageId, embed, botToken) {
    return fetch(
        `${API_BASE}/channels/${channelId}/messages/${messageId}`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${botToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ embeds: [embed] })
        }
    );
}

/**
 * Creates the status message the first time, and edits it in place on every
 * subsequent run. The message ID is persisted in status-message-id.json,
 * which must be committed back to the repo alongside dorms.json.
 */
export async function upsertStatusMessage(data, updatedAt) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const channelId = process.env.DISCORD_STATUS_CHANNEL_ID;

    if (!botToken || !channelId) {
        console.log(
            "DISCORD_BOT_TOKEN or DISCORD_STATUS_CHANNEL_ID not set, skipping status message."
        );
        return;
    }

    const embed = buildEmbed(data, updatedAt);

    const existingId = loadMessageId();

    if (existingId) {
        const response = await editMessage(
            channelId,
            existingId,
            embed,
            botToken
        );

        if (response.ok) {
            console.log("Status message updated.");
            return;
        }

        // Message may have been deleted manually — fall through and recreate.
        console.log(
            `Could not edit existing status message (${response.status}), creating a new one.`
        );
    }

    const created = await createMessage(channelId, embed, botToken);
    saveMessageId(created.id);
    console.log("Status message created:", created.id);
}
