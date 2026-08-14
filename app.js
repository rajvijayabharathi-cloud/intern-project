let token =
    localStorage.getItem("matchingToken");

let currentUser =
    JSON.parse(
        localStorage.getItem("matchingUser")
        || "null"
    );


// ===============================
// SHORTCUT
// ===============================

const $ = id =>
    document.getElementById(id);


// ===============================
// MESSAGE
// ===============================

function showMessage(text) {

    const message = $("message");

    message.textContent = text;
    message.style.display = "block";

    setTimeout(() => {
        message.style.display = "none";
    }, 2500);
}


// ===============================
// API
// ===============================

async function api(
    url,
    options = {}
) {

    options.headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {

        options.headers.Authorization =
            `Bearer ${token}`;
    }

    const response =
        await fetch(url, options);

    const data =
        await response
            .json()
            .catch(() => ({}));

    if (!response.ok) {

        throw new Error(
            data.error ||
            "Something went wrong"
        );
    }

    return data;
}


// ===============================
// LOGIN
// ===============================

$("loginForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                const data =
                    await api(
                        "/api/auth/login",
                        {
                            method: "POST",

                            body:
                                JSON.stringify({
                                    email:
                                        $("loginEmail")
                                            .value,

                                    password:
                                        $("loginPassword")
                                            .value
                                })
                        }
                    );

                loginSuccess(data);

            } catch (error) {

                showMessage(
                    error.message
                );
            }
        }
    );


// ===============================
// REGISTER
// ===============================

$("registerForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                const data =
                    await api(
                        "/api/auth/register",
                        {
                            method: "POST",

                            body:
                                JSON.stringify({
                                    name:
                                        $("registerName")
                                            .value,

                                    email:
                                        $("registerEmail")
                                            .value,

                                    password:
                                        $("registerPassword")
                                            .value
                                })
                        }
                    );

                loginSuccess(data);

            } catch (error) {

                showMessage(
                    error.message
                );
            }
        }
    );


// ===============================
// LOGIN SUCCESS
// ===============================

function loginSuccess(data) {

    token = data.token;
    currentUser = data.user;

    localStorage.setItem(
        "matchingToken",
        token
    );

    localStorage.setItem(
        "matchingUser",
        JSON.stringify(currentUser)
    );

    showApp();

    showMessage(
        "Login successful"
    );

    loadEverything();
}


// ===============================
// SHOW APP
// ===============================

function showApp() {

    $("authSection")
        .classList
        .add("hidden");

    $("appSection")
        .classList
        .remove("hidden");

    $("logoutBtn")
        .classList
        .remove("hidden");

    $("userName")
        .textContent =
        currentUser.name;

    $("userRole")
        .textContent =
        currentUser.role;

    setupRole();
}

// ======================================
// ROLE CONTROL
// ======================================

function setupRole() {

    const adminSection =
        $("adminTaskSection");

    const internProfileSection =
        $("internProfileSection");


    if (
        currentUser &&
        currentUser.role === "admin"
    ) {

        // ADMIN
        adminSection
            .classList
            .remove("hidden");

        internProfileSection
            .classList
            .add("hidden");

    } else {

        // INTERN
        adminSection
            .classList
            .add("hidden");

        internProfileSection
            .classList
            .remove("hidden");

    }

}


// ===============================
// LOGOUT
// ===============================

$("logoutBtn")
    .addEventListener(
        "click",
        () => {

            localStorage.removeItem(
                "matchingToken"
            );

            localStorage.removeItem(
                "matchingUser"
            );

            location.reload();
        }
    );


// ===============================
// INTERN PROFILE
// ===============================

$("internForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                await api(
                    "/api/interns",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({
                                skills:
                                    $("internSkills")
                                        .value,

                                available_hours:
                                    Number(
                                        $("internHours")
                                            .value
                                    ),

                                experience_level:
                                    Number(
                                        $("internExperience")
                                            .value
                                    )
                            })
                    }
                );

                showMessage(
                    "Profile saved successfully"
                );

                loadEverything();

            } catch (error) {

                showMessage(
                    error.message
                );
            }
        }
    );


// ===============================
// CREATE TASK
// ===============================

$("taskForm")
    .addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            try {

                await api(
                    "/api/tasks",
                    {
                        method: "POST",

                        body:
                            JSON.stringify({
                                title:
                                    $("taskTitle")
                                        .value,

                                description:
                                    $("taskDescription")
                                        .value,

                                required_skills:
                                    $("taskSkills")
                                        .value,

                                required_hours:
                                    Number(
                                        $("taskHours")
                                            .value
                                    ),

                                complexity:
                                    Number(
                                        $("taskComplexity")
                                            .value
                                    )
                            })
                    }
                );

                $("taskForm").reset();

                showMessage(
                    "Task created successfully"
                );

                loadEverything();

            } catch (error) {

                showMessage(
                    error.message
                );
            }
        }
    );


// ===============================
// LOAD DASHBOARD
// ===============================

async function loadDashboard() {

    const data =
        await api(
            "/api/dashboard"
        );

    $("totalInterns")
        .textContent =
        data.interns;

    $("totalTasks")
        .textContent =
        data.tasks;

    $("totalAllocations")
        .textContent =
        data.allocations;

    $("totalHours")
        .textContent =
        data.availableHours;
}


 // ======================================
// LOAD TASKS
// ======================================

async function loadTasks() {

    const tasks = await api("/api/tasks");

    const container = $("taskList");

    if (tasks.length === 0) {

        container.innerHTML =
            "<p>No tasks available.</p>";

        return;
    }

    const isAdmin =
        currentUser &&
        currentUser.role === "admin";


    container.innerHTML =
        tasks.map(task => `

            <div class="task-card">

                <div class="task-header">

                    <div>

                        <h3>
                            ${escapeHTML(task.title)}
                        </h3>

                        <p>
                            ${escapeHTML(
                                task.description || ""
                            )}
                        </p>

                    </div>

                    <span class="badge">

                        Complexity:
                        ${task.complexity}

                    </span>

                </div>


                <p>

                    <strong>
                        Required Skills:
                    </strong>

                    ${task.required_skills.join(", ")}

                </p>


                <p>

                    <strong>
                        Required Hours:
                    </strong>

                    ${task.required_hours}

                </p>


                ${
                    isAdmin
                    ?
                    `

                    <button
                        onclick="findMatches(${task.id})"
                    >

                        Find Best Interns

                    </button>


                    <div
                        id="matches-${task.id}"
                    ></div>

                    `
                    :
                    `

                    `
                }

            </div>

        `).join("");
}

// ===============================
// DELETE TASK
// ===============================

async function deleteTask(taskId) {

    const yes =
        confirm(
            "Delete this task?"
        );

    if (!yes) return;

    try {

        await api(
            `/api/tasks/${taskId}`,
            {
                method: "DELETE"
            }
        );

        showMessage(
            "Task deleted"
        );

        loadEverything();

    } catch (error) {

        showMessage(
            error.message
        );
    }
}


// ===============================
// FIND MATCHES
// ===============================

async function findMatches(taskId) {

    try {

        const data =
            await api(
                `/api/matches/${taskId}`
            );

        const container =
            $(`matches-${taskId}`);

        if (
            data.recommendations.length === 0
        ) {

            container.innerHTML =
                "<p>No intern profiles found.</p>";

            return;
        }

        container.innerHTML = `

            <div class="match-result">

                <h3>
                    Best Matching Interns
                </h3>

                ${data.recommendations
                    .slice(0, 5)
                    .map(
                        (item, index) => `

                        <div class="match-person">

                            <strong>
                                #${index + 1}
                                ${escapeHTML(
                                    item.intern.name
                                )}
                            </strong>

                            <div class="score">
                                ${item.match.total}%
                            </div>

                            <p>
                                Skills:
                                ${item.match.skillScore}%
                                <br>

                                Availability:
                                ${item.match.availabilityScore}%
                                <br>

                                Experience:
                                ${item.match.complexityScore}%
                            </p>

                            <p>
                                <strong>
                                    Matched Skills:
                                </strong>

                                ${
                                    item.match
                                        .matchedSkills
                                        .join(", ")
                                    || "None"
                                }
                            </p>

                            ${
                                currentUser.role === "admin"
                                ? `
                                    <button
                                        class="allocate-btn"
                                        onclick="
                                            allocateIntern(
                                                ${taskId},
                                                ${item.intern.id}
                                            )
                                        "
                                    >
                                        Allocate Intern
                                    </button>
                                `
                                : ""
                            }

                        </div>
                    `
                    )
                    .join("")}

            </div>
        `;

    } catch (error) {

        showMessage(
            error.message
        );
    }
}


// ===============================
// ALLOCATE
// ===============================

async function allocateIntern(
    taskId,
    internId
) {

    if (
        !confirm(
            "Allocate this intern?"
        )
    ) {
        return;
    }

    try {

        await api(
            "/api/allocations",
            {
                method: "POST",

                body:
                    JSON.stringify({
                        task_id: taskId,
                        intern_id: internId
                    })
            }
        );

        showMessage(
            "Intern allocated successfully"
        );

        loadEverything();

    } catch (error) {

        showMessage(
            error.message
        );
    }
}


// ===============================
// LOAD ALLOCATIONS
// ===============================

async function loadAllocations() {

    const allocations =
        await api(
            "/api/allocations"
        );

    const table =
        $("allocationTable");

    if (allocations.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="4">
                    No allocations yet.
                </td>
            </tr>
        `;

        return;
    }

    table.innerHTML =
        allocations.map(
            allocation => `

                <tr>

                    <td>
                        ${escapeHTML(
                            allocation.task_title
                        )}
                    </td>

                    <td>
                        ${escapeHTML(
                            allocation.intern_name
                        )}
                    </td>

                    <td>
                        ${allocation.score}%
                    </td>

                    <td>
                        ${escapeHTML(
                            allocation.status
                        )}
                    </td>

                </tr>
            `
        ).join("");
}


// ===============================
// SECURITY
// ===============================

function escapeHTML(value) {

    return String(value || "")
        .replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            }[character])
        );
}


// ===============================
// LOAD EVERYTHING
// ===============================

async function loadEverything() {

    try {

        await Promise.all([
            loadDashboard(),
            loadTasks(),
            loadAllocations()
        ]);

    } catch (error) {

        showMessage(
            error.message
        );
    }
}


// ===============================
// AUTO LOGIN
// ===============================

if (
    token &&
    currentUser
) {

    showApp();

    loadEverything();
}