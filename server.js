const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");

const db = require("./src/db");

const app = express();

const PORT = process.env.PORT || 5000;

const JWT_SECRET =
    process.env.JWT_SECRET || "intern-project-secret";


// ===============================
// MIDDLEWARE
// ===============================

app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(cors());

app.use(express.json());

app.use(
    rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 300
    })
);

app.use(express.static(
    path.join(__dirname, "public")
));


// ===============================
// HELPERS
// ===============================

function cleanSkills(value) {

    if (Array.isArray(value)) {
        return value
            .map(skill =>
                String(skill)
                    .trim()
                    .toLowerCase()
            )
            .filter(Boolean);
    }

    return String(value || "")
        .split(",")
        .map(skill =>
            skill.trim().toLowerCase()
        )
        .filter(Boolean);
}


function createToken(user) {

    return jwt.sign(
        {
            id: user.id,
            name: user.name,
            role: user.role
        },
        JWT_SECRET,
        {
            expiresIn: "8h"
        }
    );
}


function authenticate(role = null) {

    return (req, res, next) => {

        const header =
            req.headers.authorization || "";

        if (!header.startsWith("Bearer ")) {

            return res.status(401).json({
                error: "Login required"
            });
        }

        const token =
            header.substring(7);

        try {

            const user =
                jwt.verify(
                    token,
                    JWT_SECRET
                );

            if (
                role &&
                user.role !== role
            ) {

                return res.status(403).json({
                    error: "Admin permission required"
                });
            }

            req.user = user;

            next();

        } catch {

            return res.status(401).json({
                error: "Invalid or expired login"
            });
        }
    };
}


// ===============================
// REGISTER
// ===============================

app.post(
    "/api/auth/register",
    async (req, res) => {

        try {

            const {
                name,
                email,
                password
            } = req.body;

            if (
                !name ||
                !email ||
                !password
            ) {

                return res.status(400).json({
                    error:
                        "Name, email and password are required"
                });
            }

            if (password.length < 6) {

                return res.status(400).json({
                    error:
                        "Password must contain at least 6 characters"
                });
            }

            const cleanEmail =
                email.trim().toLowerCase();

            const existing =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                `).get(cleanEmail);

            if (existing) {

                return res.status(409).json({
                    error:
                        "Email already registered"
                });
            }

            const passwordHash =
                await bcrypt.hash(
                    password,
                    10
                );

            const result =
                db.prepare(`
                    INSERT INTO users
                    (
                        name,
                        email,
                        password_hash,
                        role
                    )
                    VALUES (?, ?, ?, 'intern')
                `).run(
                    name.trim(),
                    cleanEmail,
                    passwordHash
                );

            const user = {
                id: result.lastInsertRowid,
                name: name.trim(),
                email: cleanEmail,
                role: "intern"
            };

            res.status(201).json({
                token: createToken(user),
                user
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Registration failed"
            });
        }
    }
);


// ===============================
// LOGIN
// ===============================

app.post(
    "/api/auth/login",
    async (req, res) => {

        try {

            const email =
                String(
                    req.body.email || ""
                )
                .trim()
                .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (
                !user ||
                !(await bcrypt.compare(
                    password,
                    user.password_hash
                ))
            ) {

                return res.status(401).json({
                    error:
                        "Invalid email or password"
                });
            }

            const safeUser = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };

            res.json({
                token: createToken(safeUser),
                user: safeUser
            });

        } catch (error) {

            console.error(error);

            res.status(500).json({
                error: "Login failed"
            });
        }
    }
);


// ===============================
// DASHBOARD
// ===============================

app.get(
    "/api/dashboard",
    authenticate(),
    (req, res) => {

        if (req.user.role === "admin") {

            const interns =
                db.prepare(
                    "SELECT COUNT(*) count FROM interns"
                ).get().count;

            const tasks =
                db.prepare(
                    "SELECT COUNT(*) count FROM tasks"
                ).get().count;

            const allocations =
                db.prepare(
                    "SELECT COUNT(*) count FROM allocations"
                ).get().count;

            const hours =
                db.prepare(`
                    SELECT COALESCE(
                        SUM(available_hours), 0
                    ) hours
                    FROM interns
                `).get().hours;

            return res.json({
                interns,
                tasks,
                allocations,
                availableHours: hours
            });
        }

        const profile =
            db.prepare(`
                SELECT *
                FROM interns
                WHERE user_id = ?
            `).get(req.user.id);

        let allocationCount = 0;

        if (profile) {

            allocationCount =
                db.prepare(`
                    SELECT COUNT(*) count
                    FROM allocations
                    WHERE intern_id = ?
                `).get(profile.id).count;
        }

        res.json({
            interns: db.prepare("SELECT COUNT(*) AS count FROM interns").get().count,
            tasks: db.prepare(
                "SELECT COUNT(*) count FROM tasks"
            ).get().count,
            allocations: allocationCount,
            availableHours:
                profile
                    ? profile.available_hours
                    : 0
        });
    }
);


// ===============================
// INTERN PROFILE
// ===============================

app.post(
    "/api/interns",
    authenticate("intern"),
    (req, res) => {

        const {
            skills,
            available_hours,
            experience_level
        } = req.body;

        const hours =
            Number(available_hours);

        const experience =
            Number(experience_level);

        if (
            hours < 0 ||
            hours > 40
        ) {

            return res.status(400).json({
                error:
                    "Available hours must be between 0 and 40"
            });
        }

        if (
            experience < 1 ||
            experience > 5
        ) {

            return res.status(400).json({
                error:
                    "Experience must be between 1 and 5"
            });
        }

        const skillList =
            cleanSkills(skills);

        const existing =
            db.prepare(`
                SELECT id
                FROM interns
                WHERE user_id = ?
            `).get(req.user.id);

        if (existing) {

            db.prepare(`
                UPDATE interns
                SET
                    skills = ?,
                    available_hours = ?,
                    experience_level = ?
                WHERE user_id = ?
            `).run(
                JSON.stringify(skillList),
                hours,
                experience,
                req.user.id
            );

            return res.json({
                message:
                    "Profile updated successfully"
            });
        }

        db.prepare(`
            INSERT INTO interns
            (
                user_id,
                skills,
                available_hours,
                experience_level
            )
            VALUES (?, ?, ?, ?)
        `).run(
            req.user.id,
            JSON.stringify(skillList),
            hours,
            experience
        );

        res.json({
            message:
                "Profile created successfully"
        });
    }
);


// ===============================
// GET TASKS
// ===============================

app.get(
    "/api/tasks",
    authenticate(),
    (req, res) => {

        const tasks =
            db.prepare(`
                SELECT *
                FROM tasks
                ORDER BY id DESC
            `).all();

        res.json(
            tasks.map(task => ({
                ...task,
                required_skills:
                    JSON.parse(
                        task.required_skills
                    )
            }))
        );
    }
);


// ===============================
// CREATE TASK
// ADMIN ONLY
// ===============================

app.post(
    "/api/tasks",
    authenticate("admin"),
    (req, res) => {

        const {
            title,
            description,
            required_skills,
            required_hours,
            complexity
        } = req.body;

        const hours =
            Number(required_hours);

        const level =
            Number(complexity);

        const skills =
            cleanSkills(required_skills);

        if (
            !title ||
            skills.length === 0 ||
            hours <= 0
        ) {

            return res.status(400).json({
                error:
                    "Title, skills and hours are required"
            });
        }

        if (
            level < 1 ||
            level > 5
        ) {

            return res.status(400).json({
                error:
                    "Complexity must be 1 to 5"
            });
        }

        const result =
            db.prepare(`
                INSERT INTO tasks
                (
                    title,
                    description,
                    required_skills,
                    required_hours,
                    complexity
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                title.trim(),
                description || "",
                JSON.stringify(skills),
                hours,
                level
            );

        res.json({
            message:
                "Task created successfully",
            id: result.lastInsertRowid
        });
    }
);


// ===============================
// DELETE TASK
// ADMIN ONLY
// ===============================

app.delete(
    "/api/tasks/:id",
    authenticate("admin"),
    (req, res) => {

        const id =
            Number(req.params.id);

        const result =
            db.prepare(`
                DELETE FROM tasks
                WHERE id = ?
            `).run(id);

        if (result.changes === 0) {

            return res.status(404).json({
                error: "Task not found"
            });
        }

        res.json({
            message:
                "Task deleted successfully"
        });
    }
);


// ===============================
// MATCHING ALGORITHM
// ===============================

function calculateMatch(
    intern,
    task
) {

    const internSkills =
        new Set(
            cleanSkills(
                JSON.parse(intern.skills)
            )
        );

    const requiredSkills =
        cleanSkills(
            JSON.parse(
                task.required_skills
            )
        );

    const matchedSkills =
        requiredSkills.filter(
            skill =>
                internSkills.has(skill)
        );

    const skillScore =
        requiredSkills.length
            ? (
                matchedSkills.length /
                requiredSkills.length
            ) * 60
            : 0;

    const availabilityScore =
        Math.min(
            (
                Number(intern.available_hours) /
                Number(task.required_hours)
            ),
            1
        ) * 20;

    const complexityScore =
        Math.min(
            (
                Number(intern.experience_level) /
                Number(task.complexity)
            ),
            1
        ) * 20;

    return {
        total:
            Number(
                (
                    skillScore +
                    availabilityScore +
                    complexityScore
                ).toFixed(2)
            ),

        skillScore:
            Number(skillScore.toFixed(2)),

        availabilityScore:
            Number(
                availabilityScore.toFixed(2)
            ),

        complexityScore:
            Number(
                complexityScore.toFixed(2)
            ),

        matchedSkills
    };
}


// ===============================
// FIND MATCHES
// ===============================

app.get(
    "/api/matches/:taskId",
    authenticate(),
    (req, res) => {

        const task =
            db.prepare(`
                SELECT *
                FROM tasks
                WHERE id = ?
            `).get(
                Number(req.params.taskId)
            );

        if (!task) {

            return res.status(404).json({
                error: "Task not found"
            });
        }

        const interns =
            db.prepare(`
                SELECT
                    i.*,
                    u.name,
                    u.email
                FROM interns i
                JOIN users u
                    ON u.id = i.user_id
            `).all();

        const recommendations =
            interns
                .map(intern => ({
                    intern,
                    match:
                        calculateMatch(
                            intern,
                            task
                        )
                }))
                .sort(
                    (a, b) =>
                        b.match.total -
                        a.match.total
                );

        res.json({
            task: {
                ...task,
                required_skills:
                    JSON.parse(
                        task.required_skills
                    )
            },
            recommendations
        });
    }
);

// ===============================
// ALLOCATE INTERN
// ===============================

app.post(
    "/api/allocations",
    authenticate("admin"),
    (req, res) => {

        try {

            const {
                task_id,
                intern_id
            } = req.body;


            // =========================
            // VALIDATE IDs
            // =========================

            const taskId = Number(task_id);
            const internId = Number(intern_id);

            if (!taskId || !internId) {

                return res.status(400).json({
                    error: "Task ID and Intern ID are required"
                });

            }


            // =========================
            // CHECK TASK
            // =========================

            const task =
                db.prepare(`
                    SELECT *
                    FROM tasks
                    WHERE id = ?
                `).get(taskId);


            if (!task) {

                return res.status(404).json({
                    error: "Task not found"
                });

            }


            // =========================
            // CHECK INTERN
            // =========================

            const intern =
                db.prepare(`
                    SELECT *
                    FROM interns
                    WHERE id = ?
                `).get(internId);


            if (!intern) {

                return res.status(404).json({
                    error: "Intern not found"
                });

            }


            // =========================
            // DUPLICATE CHECK
            // =========================
            // Same intern + same task
            // cannot be allocated twice.

            const existing =
                db.prepare(`
                    SELECT id
                    FROM allocations
                    WHERE task_id = ?
                    AND intern_id = ?
                `).get(
                    taskId,
                    internId
                );


            if (existing) {

                return res.status(409).json({
                    error:
                        "This intern is already allocated to this task."
                });

            }


            // =========================
            // CHECK WHETHER TASK
            // IS ALREADY ALLOCATED
            // =========================
            // One task can have only
            // one intern.

            const taskAlreadyAllocated =
                db.prepare(`
                    SELECT
                        a.id,
                        u.name AS intern_name
                    FROM allocations a

                    JOIN interns i
                        ON i.id = a.intern_id

                    JOIN users u
                        ON u.id = i.user_id

                    WHERE a.task_id = ?
                `).get(taskId);


            if (taskAlreadyAllocated) {

                return res.status(409).json({

                    error:
                        `This task is already allocated to ${taskAlreadyAllocated.intern_name}.`

                });

            }


            // =========================
            // CALCULATE MATCH SCORE
            // =========================

            const match =
                calculateMatch(
                    intern,
                    task
                );


            // =========================
            // CREATE ALLOCATION
            // =========================

            const result =
                db.prepare(`
                    INSERT INTO allocations
                    (
                        task_id,
                        intern_id,
                        score,
                        status
                    )

                    VALUES (?, ?, ?, ?)
                `).run(

                    taskId,

                    internId,

                    match.total,

                    "allocated"

                );


            // =========================
            // SUCCESS
            // =========================

            res.status(201).json({

                message:
                    "Intern allocated successfully",

                allocationId:
                    result.lastInsertRowid,

                score:
                    match.total

            });


        } catch (error) {

            console.error(
                "Allocation error:",
                error
            );

            res.status(500).json({
                error:
                    "Failed to allocate intern"
            });

        }

    }
);

// ===============================
// GET ALLOCATIONS
// ===============================

app.get(
    "/api/allocations",
    authenticate(),
    (req, res) => {

        let query;
        let params = [];

        if (req.user.role === "admin") {

            query = `
                SELECT
                    a.id,
                    a.score,
                    a.status,
                    t.title task_title,
                    u.name intern_name
                FROM allocations a
                JOIN tasks t
                    ON t.id = a.task_id
                JOIN interns i
                    ON i.id = a.intern_id
                JOIN users u
                    ON u.id = i.user_id
                ORDER BY a.id DESC
            `;

        } else {

            query = `
                SELECT
                    a.id,
                    a.score,
                    a.status,
                    t.title task_title,
                    u.name intern_name
                FROM allocations a
                JOIN tasks t
                    ON t.id = a.task_id
                JOIN interns i
                    ON i.id = a.intern_id
                JOIN users u
                    ON u.id = i.user_id
                WHERE i.user_id = ?
                ORDER BY a.id DESC
            `;

            params = [req.user.id];
        }

        const allocations =
            db.prepare(query).all(...params);

        res.json(allocations);
    }
);


// ===============================
// DELETE INTERN
// ADMIN ONLY
// ===============================

app.delete(
    "/api/interns/:id",
    authenticate("admin"),
    (req, res) => {

        const intern =
            db.prepare(`
                SELECT *
                FROM interns
                WHERE id = ?
            `).get(
                Number(req.params.id)
            );

        if (!intern) {

            return res.status(404).json({
                error: "Intern not found"
            });
        }

        db.prepare(`
            DELETE FROM interns
            WHERE id = ?
        `).run(intern.id);

        db.prepare(`
            DELETE FROM users
            WHERE id = ?
            AND role = 'intern'
        `).run(intern.user_id);

        res.json({
            message:
                "Intern deleted successfully"
        });
    }
);


// ===============================
// START SERVER
// ===============================

app.listen(
    PORT,
    () => {

        console.log(
            `Server running at http://localhost:${PORT}`
        );
    }
);