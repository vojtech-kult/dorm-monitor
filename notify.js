import fs from "fs";
import { getGuildMembers, sendDmToUser } from "./dm.js";

function roomTotal(room) {
    return (
        (parseInt(room.men, 10) || 0) +
        (parseInt(room.women, 10) || 0) +
        (parseInt(room.unknown, 10) || 0)
    );
}

function loadDormRoles() {
    try {
        return JSON.parse(fs.readFileSync("dorm-roles.json", "utf8"));
    } catch (err) {
        console.log("dorm-roles.json not found or invalid, no role mentions/filtering will be used.");
        return {};
    }
}

/**
 * Returns per-college status: [{ id, collegeName, total }], for every
 * college in the scan, regardless of whether it has free spots.
 */
function getCollegeStatus(data) {
    return data.map((college) => ({
        id: college.id,
        collegeName: college.collegeName,
        total: (college.rooms || []).reduce((sum, r) => sum + roomTotal(r), 0)
    }));
}

async function postToDiscord(webhookUrl, content) {
    const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Discord webhook failed: ${response.status} ${text}`);
    }
}

function buildChannelContent(collegeStatus, dormRoles) {
    const available = collegeStatus.filter((c) => c.total > 0);

    if (available.length === 0) {
        return "**Koleje UK:** Žádná nová místa se neuvolnila.\nDetailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/";
    }

    return available
        .map((c) => {
            const roleId = dormRoles[c.id];
            const mention = roleId ? `<@&${roleId}> ` : "";
            return `${mention}Nová místa (${c.total}) na koleji ${c.collegeName}!\nDetailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/`;
        })
        .join("\n");
}

function getSubscribedCollegeIds(member, dormRoles, allDormsRoleId, allCollegeIds) {
    const memberRoles = member.roles || [];

    if (allDormsRoleId && memberRoles.includes(allDormsRoleId)) {
        return allCollegeIds;
    }

    return allCollegeIds.filter((id) => {
        const roleId = dormRoles[id];
        return roleId && memberRoles.includes(roleId);
    });
}

/**
 * Builds one combined message for a member, based on their subscribed
 * college IDs and whether they're an "all updates" or "available only" user.
 * Returns null if there's nothing worth sending this run.
 */
function buildPersonalMessage(subscribedIds, collegeStatus, mode) {
    const relevant = collegeStatus.filter((c) => subscribedIds.includes(c.id));

    if (relevant.length === 0) return null;

    if (mode === "all") {
        const lines = relevant.map((c) =>
            c.total > 0
                ? `**Koleje UK:** Nová místa (${c.total}) na koleji ${c.collegeName}!\nDetailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/`
                : `**Koleje UK:** Žádná volná místa na koleji ${c.collegeName}.\nDetailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/`
        );
        return lines.join("\n");
    }

    // mode === "available"
    const withSpots = relevant.filter((c) => c.total > 0);
    if (withSpots.length === 0) return null;

    return withSpots
        .map((c) => `Nová místa (${c.total}) na koleji ${c.collegeName}!`)
        .join("\n");
}

export async function notifyAvailability(data) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const roleAllId = process.env.DISCORD_ROLE_ALL_ID;
    const roleAvailableId = process.env.DISCORD_ROLE_AVAILABLE_ID;
    const roleAllDormsId = process.env.DISCORD_ROLE_ALL_DORMS_ID;

    const dormRoles = loadDormRoles();
    const collegeStatus = getCollegeStatus(data);
    const allCollegeIds = collegeStatus.map((c) => c.id);

    // --- Channel webhook: mentions dorm roles with free spots ---
    const channelContent = buildChannelContent(collegeStatus, dormRoles);
    console.log("Channel notification:", channelContent);

    if (webhookUrl) {
        await postToDiscord(webhookUrl, channelContent);
    } else {
        console.log("DISCORD_WEBHOOK_URL not set, skipping channel message.");
    }

    // --- Personalized DMs ---
    if (!botToken || !guildId) {
        console.log("DISCORD_BOT_TOKEN or DISCORD_GUILD_ID not set, skipping DMs.");
        return;
    }

    const members = await getGuildMembers(guildId, botToken);

    for (const member of members) {
        const memberRoles = member.roles || [];

        let mode = null;
        if (roleAllId && memberRoles.includes(roleAllId)) mode = "all";
        else if (roleAvailableId && memberRoles.includes(roleAvailableId)) mode = "available";

        if (!mode) continue; // not subscribed to DMs at all

        const subscribedIds = getSubscribedCollegeIds(
            member,
            dormRoles,
            roleAllDormsId,
            allCollegeIds
        );

        if (subscribedIds.length === 0) continue; // no dorm roles picked

        const content = buildPersonalMessage(subscribedIds, collegeStatus, mode);

        if (!content) continue; // nothing to report this run for this user

        try {
            await sendDmToUser(member.user.id, content, botToken);
        } catch (err) {
            console.error(
                `Could not DM ${member.user.username} (${member.user.id}):`,
                err.message
            );
        }

        // Stay well clear of Discord's rate limits.
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
}
