const bcrypt = require("bcryptjs");
const db = require("./src/db");

async function createAdmin() {

    const email = "admin@example.com";
    const password = "admin123";

    const existing =
        db.prepare(`
            SELECT id
            FROM users
            WHERE email = ?
        `).get(email);

    if (existing) {

        console.log("Admin already exists.");
        return;
    }

    const hash =
        await bcrypt.hash(
            password,
            10
        );

    db.prepare(`
        INSERT INTO users
        (
            name,
            email,
            password_hash,
            role
        )
        VALUES (?, ?, ?, 'admin')
    `).run(
        "Administrator",
        email,
        hash
    );

    console.log("Admin created successfully.");
    console.log("Email:", email);
    console.log("Password:", password);
}

createAdmin();
console.log("================================");
console.log("ADMIN LOGIN DETAILS");
console.log("Email: admin@example.com");
console.log("Password: admin123");
console.log("================================");