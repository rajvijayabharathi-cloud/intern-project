const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "matching-engine.db");

const db = new Database(dbPath);

db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'intern'
            CHECK(role IN ('admin', 'intern')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        skills TEXT NOT NULL DEFAULT '[]',
        available_hours INTEGER NOT NULL DEFAULT 0,
        experience_level INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY(user_id)
            REFERENCES users(id)
            ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        required_skills TEXT NOT NULL DEFAULT '[]',
        required_hours INTEGER NOT NULL,
        complexity INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        intern_id INTEGER NOT NULL,
        score REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'allocated',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(task_id)
            REFERENCES tasks(id)
            ON DELETE CASCADE,
        FOREIGN KEY(intern_id)
            REFERENCES interns(id)
            ON DELETE CASCADE
    );
`);

module.exports = db;