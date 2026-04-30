const API = "https://cupboard-app.onrender.com";

// Auth Functions //
async function checkAuth() {
    try {
        const res = await fetch(API + "/api/me", {
            credentials: "include"
        });

        const data = await res.json();

        if (!data || !data.userId) {
            window.location.href = "login.html";
        }
    } catch (err) {
        window.location.href = "login.html";
    }
}

async function logout() {
    await fetch(API + "/api/logout", {
        method: "POST",
        credentials: "include"
    });

    window.location.href = "login.html";
}