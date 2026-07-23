import fs from "fs";
import { getGuildMembers, sendDmToUser } from "./dm.js";

const WEBSITE_LINK = "https://vojtech-kult.github.io/dorm-monitor-website/";

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

/**
 * Builds a single combined sentence out of a list of colleges, e.g.:
 * "<@&123> Nová místa (3) na koleji Budeč, Nová místa (5) na koleji Otava.
 *  Žádná volná místa na koleji Hostivař, Kajetánka."
 *
 * - `available`: colleges with free spots (each gets its own count, and a
 *   role mention if `mentions` is true and a role is mapped for it).
 * - `unavailable`: colleges with none, grouped into one comma-joined clause.
 */
function buildSummarySentence(colleges, { mentions = false, dormRoles = {} } = {}) {
    const available = colleges.filter((c) => c.total > 0);
    const unavailable = colleges.filter((c) => c.total === 0);

    const parts = [];

    if (available.length > 0) {
        const availableText = available
            .map((c) => {
                const roleId = dormRoles[c.id];
                const mention = mentions && roleId ? `<@&${roleId}> ` : "";
                return `${mention}Nová místa (${c.total}) na koleji ${c.collegeName}`;
            })
            .join(", ");
        parts.push(`${availableText}.`);
    }

    if (unavailable.length > 0) {
        const names = unavailable.map((c) => c.collegeName).join(", ");
        parts.push(`Žádná volná místa na koleji ${names}.`);
    }

    return parts.join(" ");
}

function buildChannelContent(collegeStatus, dormRoles) {
    const available = collegeStatus.filter((c) => c.total > 0);

    if (available.length === 0) {
        return `**Koleje UK:** Žádná nová místa se neuvolnila.\nDetailní přehled: ${WEBSITE_LINK}`;
    }

    const sentence = buildSummarySentence(available, { mentions: true, dormRoles });
    return `**Koleje UK:** ${sentence}\nDetailní přehled: ${WEBSITE_LINK}`;
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
 * Builds one combined DM message for a member, based on their subscribed
 * college IDs and whether they're an "all updates" or "available only" user.
 * Returns null if there's nothing worth sending this run.
 */
function buildPersonalMessage(subscribedIds, collegeStatus, mode) {
    const relevant = collegeStatus.filter((c) => subscribedIds.includes(c.id));

    if (relevant.length === 0) return null;

    if (mode === "all") {
        const sentence = buildSummarySentence(relevant);
        return `**Koleje UK:** ${sentence}\nDetailní přehled: ${WEBSITE_LINK}`;
    }

    // mode === "available"
    const withSpots = relevant.filter((c) => c.total > 0);
    if (withSpots.length === 0) return null;

    const sentence = buildSummarySentence(withSpots);
    return `**Koleje UK:** ${sentence}\nDetailní přehled: ${WEBSITE_LINK}`;
}

export async function notifySourcesDown() {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    const content =
        "⚠️ **Koleje UK:** Weby kolejí jsou momentálně nedostupné, kontrola se opakuje příští hodinu.";

    console.log("Channel notification:", content);

    if (webhookUrl) {
        await postToDiscord(webhookUrl, content);
    } else {
        console.log("DISCORD_WEBHOOK_URL not set, skipping channel message.");
    }
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
