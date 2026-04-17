const express = require("express");
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
    const hash = await bcrypt.hash("1234", 10);

    await pool.query(
        "INSERT INTO users (username, password_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        ["admin", hash]
    );

    res.send("User created");
});
// temp endpoint to create a user, remove later

// ✅ IMPORTANT for frontend connection
app.use(cors({
    origin: "https://cupboard-app.vercel.app",
    credentials: true
}));

const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});
// ================= DB =================

app.get("/setup-admin", async (req, res) => {
    const existing = await pool.query(
        "SELECT * FROM users WHERE is_admin = TRUE"
    );

    if (existing.rows.length > 0) {
        return res.send("Admin already exists");
    }

    const hash = await bcrypt.hash("admin123", 10);

    await pool.query(
        "INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, TRUE)",
        ["admin", hash]
    );

    res.send("Admin created");
});

// Create tables if not exist
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE,
            password_hash TEXT
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            cabinet_type TEXT,
            data JSONB,
            last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log("Postgres tables ready");
}

initDB();

// ================= AUTH =================

// CHECK IF ADMIN
async function requireAdmin(req, res) {
    const token = req.cookies.token;
    if (!token) return null;

    try {
        const decoded = jwt.verify(token, SECRET);

        const result = await pool.query(
            "SELECT * FROM users WHERE id = $1",
            [decoded.id]
        );

        const user = result.rows[0];

        if (!user || !user.is_admin) return null;

        return user;
    } catch {
        return null;
    }
}

// GET ALL USERS (ADMIN ONLY)
app.get("/api/admin/users", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return res.status(403).send("Forbidden");

    const result = await pool.query("SELECT id, username, is_admin FROM users");
    res.json(result.rows);
});

// CREATE USERS
app.post("/api/admin/users", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return res.status(403).send("Forbidden");

    const { username, password, is_admin } = req.body;
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
        "INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, $3)",
        [username, hash, is_admin || false]
    );

    res.json({ success: true });
});

// UPDATE USER
app.put("/api/admin/users/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return res.status(403).send("Forbidden");

    const { id } = req.params;
    const { password, is_admin } = req.body;

    if (password) {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            "UPDATE users SET password_hash = $1, is_admin = $2 WHERE id = $3",
            [hash, is_admin, id]
        );
    } else {
        await pool.query(
            "UPDATE users SET is_admin = $1 WHERE id = $2",
            [is_admin, id]
        );
    }

    res.json({ success: true });
});

// DELETE USER
app.delete("/api/admin/users/:id", async (req, res) => {
    const admin = await requireAdmin(req, res);
    if (!admin) return res.status(403).send("Forbidden");

    const { id } = req.params;

    await pool.query("DELETE FROM users WHERE id = $1", [id]);

    res.json({ success: true });
});

// LOGIN
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;

    const result = await pool.query(
        "SELECT * FROM users WHERE username = $1",
        [username]
    );

    const user = result.rows[0];
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
    res.clearCookie("token", {
        httpOnly: true,
        secure: true,
        sameSite: "None"
    });

    res.json({ success: true });
});

// ================= PROJECTS =================

// SAVE PROJECT
app.post("/api/projects", async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).send("Not logged in");

    const decoded = jwt.verify(token, SECRET);
    const { cabinet_type, data } = req.body;

    const result = await pool.query(
        `INSERT INTO projects (user_id, cabinet_type, data)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [decoded.id, cabinet_type, data]
    );

    res.json({ id: result.rows[0].id });
});

// GET PROJECTS
app.get("/api/projects", async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).send("Not logged in");

    const decoded = jwt.verify(token, SECRET);

    const result = await pool.query(
        "SELECT * FROM projects WHERE user_id = $1",
        [decoded.id]
    );

    res.json(result.rows);
});

// ================= START =================
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});