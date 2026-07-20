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

    if (!webhookUrl) {
        console.log("DISCORD_WEBHOOK_URL not set, skipping notification.");
        return;
    }

    const available = getAvailableColleges(data);

    let content;

    if (available.length === 0) {
        content = "**Žádná nová místa se neuvolnila.** \n Detailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/";
    } else {
        content = available
            .map(
                (c) =>
                    `@everyone **Nová místa (${c.total}) na koleji ${c.collegeName}!** \n Detailní přehled: https://vojtech-kult.github.io/dorm-monitor-website/`
            )
            .join("\n");
    }

    console.log("Sending Discord notification:", content);

    await postToDiscord(webhookUrl, content);
}
