const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET = "supersecretkey"; // change later
const path = require("path");

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(cookieParser());

//temp startpoint to create a user, remove later
app.get("/create-user", async (req, res) => {
    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash("1234", 10);

    db.run(
        "INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)",
        ["admin", hash],
        () => res.send("User created: admin / 1234")
    );
});
// temp endpoint to create a user, remove later

// ✅ IMPORTANT for frontend connection
app.use(cors({
    origin: "https://cupboard-app.vercel.app",
    credentials: true
}));

// ================= DB =================
const db = new sqlite3.Database("./database.db", (err) => {
    if (err) console.error(err.message);
    else console.log("Connected to DB");
});

// Create tables if not exist
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        cabinet_type TEXT,
        data TEXT,
        last_modified TEXT
    )`);
});

// ================= AUTH =================

// LOGIN
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (!user) return res.status(401).send("Invalid user");

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).send("Wrong password");

        const token = jwt.sign({ id: user.id }, SECRET, { expiresIn: "7d" });

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        });
        res.json({ success: true });
    });
});

// CHECK LOGIN
app.get("/api/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json(null);

    try {
        const decoded = jwt.verify(token, SECRET);
        res.json({ userId: decoded.id });
    } catch {
        res.json(null);
    }
});

// LOGOUT
app.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
});

// ================= PROJECTS =================

// SAVE PROJECT
app.post("/api/projects", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).send("Not logged in");

    const decoded = jwt.verify(token, SECRET);
    const { cabinet_type, data } = req.body;

    db.run(
        `INSERT INTO projects (user_id, cabinet_type, data, last_modified)
         VALUES (?, ?, ?, datetime('now'))`,
        [decoded.id, cabinet_type, JSON.stringify(data)],
        function (err) {
            if (err) return res.status(500).send(err.message);
            res.json({ id: this.lastID });
        }
    );
});

// GET PROJECTS
app.get("/api/projects", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).send("Not logged in");

    const decoded = jwt.verify(token, SECRET);

    db.all(
        "SELECT * FROM projects WHERE user_id = ?",
        [decoded.id],
        (err, rows) => {
            res.json(rows);
        }
    );
});

// ================= START =================
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});