/**
 * Sends DMs to server members holding specific roles, using a Discord bot token.
 *
 * Requires:
 *  - DISCORD_BOT_TOKEN   (bot's token, with "Server Members Intent" enabled)
 *  - DISCORD_GUILD_ID    (the server/guild ID)
 *  - DISCORD_ROLE_ALL_ID           (role ID for "All notifications")
 *  - DISCORD_ROLE_AVAILABLE_ID     (role ID for "Available notifications only")
 */

const API_BASE = "https://discord.com/api/v10";

function authHeaders(botToken) {
    return {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json"
    };
}

async function fetchAllMembers(guildId, botToken) {
    const members = [];
    let after = "0";

    while (true) {
        const response = await fetch(
            `${API_BASE}/guilds/${guildId}/members?limit=1000&after=${after}`,
            { headers: authHeaders(botToken) }
        );

        if (!response.ok) {
            const text = await response.text();
            throw new Error(
                `Failed to fetch guild members: ${response.status} ${text}`
            );
        }

        const batch = await response.json();
        members.push(...batch);

        if (batch.length < 1000) break;

        after = batch[batch.length - 1].user.id;
    }

    return members;
}

function membersWithRole(members, roleId) {
    return members.filter((m) => (m.roles || []).includes(roleId));
}

async function openDmChannel(userId, botToken) {
    const response = await fetch(`${API_BASE}/users/@me/channels`, {
        method: "POST",
        headers: authHeaders(botToken),
        body: JSON.stringify({ recipient_id: userId })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Failed to open DM channel for ${userId}: ${response.status} ${text}`
        );
    }

    const channel = await response.json();
    return channel.id;
}

async function sendChannelMessage(channelId, content, botToken) {
    const response = await fetch(
        `${API_BASE}/channels/${channelId}/messages`,
        {
            method: "POST",
            headers: authHeaders(botToken),
            body: JSON.stringify({ content })
        }
    );

    if (!response.ok) {
        const text = await response.text();
        throw new Error(
            `Failed to send message to channel ${channelId}: ${response.status} ${text}`
        );
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendDmToUser(userId, content, botToken) {
    const channelId = await openDmChannel(userId, botToken);
    await sendChannelMessage(channelId, content, botToken);
}

/**
 * Sends `content` as a DM to every member holding `roleId`.
 * Failures for individual users (e.g. DMs disabled) are logged and skipped,
 * not thrown, so one bad recipient doesn't stop the rest.
 */
export async function sendDmsToRole(members, roleId, content, botToken, roleLabel) {
    const recipients = membersWithRole(members, roleId);

    console.log(`Sending DM to ${recipients.length} member(s) with role "${roleLabel}".`);

    for (const member of recipients) {
        try {
            await sendDmToUser(member.user.id, content, botToken);
        } catch (err) {
            console.error(
                `Could not DM ${member.user.username} (${member.user.id}):`,
                err.message
            );
        }

        // Small delay to stay well clear of Discord's rate limits.
        await sleep(300);
    }
}

export async function getGuildMembers(guildId, botToken) {
    return fetchAllMembers(guildId, botToken);
}
