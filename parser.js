import * as cheerio from "cheerio";

const collegeIds = [
    "380942",
    "380952",
    "380944",
    "380939",
    "380946",
    "380958",
    "380961",
    "380945",
    "380950",
    "380943",
    "380951",
    "380948"
];


async function getCollege(id) {

    const url = `https://rehos.cuni.cz/crpp/eshop/collegeDetail/${id}`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    const $ = cheerio.load(html);


    const collegeName = $("h1").first().text().trim();


    const table = $("table.form").first();

    if (table.length === 0) {
        // A 200-status error/maintenance page (e.g. a proxy error page) has
        // no room table at all — treat this the same as a failed fetch,
        // rather than returning a fake college with 0 rooms.
        throw new Error(
            `Unexpected page content (no room table found), title: "${collegeName}"`
        );
    }

    const rooms = [];


    table.find("tbody tr").each((i, el) => {

        const cells = [];

        $(el).find("td").each((j, td) => {
            cells.push(
                $(td).text().trim()
            );
        });


        if (cells.length >= 9) {

            rooms.push({
                name: cells[0],
                price: cells[2] || "",
                men: cells[4] || "",
                women: cells[6] || "",
                unknown: cells[8] || ""
            });

        }

    });


    return {
        id,
        collegeName,
        rooms
    };

}



export async function getAllDorms() {

    const results = [];


    for (const id of collegeIds) {

        try {

            const college = await getCollege(id);
            results.push(college);

        } catch (err) {

            console.error(
                "Chyba u koleje",
                id,
                err.message
            );

        }

    }


    return results;

}
