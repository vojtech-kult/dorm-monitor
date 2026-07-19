import express from "express";
import { getAllDorms } from "./parser.js";


const app = express();

const PORT = process.env.PORT || 3000;


app.get("/", (req, res) => {

    res.send("Dorm monitor běží 🚀");

});


app.get("/api/dorms", async (req, res) => {

    try {

        const data = await getAllDorms();

        res.json(data);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: err.message
        });

    }

});


app.listen(PORT, () => {

    console.log(
        `Server běží na portu ${PORT}`
    );

});