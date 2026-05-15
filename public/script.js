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

async function waitForServer() {
    let timedOut = false;

    const timeout = setTimeout(() => {

        timedOut = true;

        document.getElementById("OfflineScreen").style.display = "block";
        document.getElementById("Main").style.display = "none";
        document.getElementById("TopBtns").style.display = "none";

    }, 500);

    while (true) {
        try {

            const res = await fetch(API + "/health");

            clearTimeout(timeout);

            if (res.ok) {

                document.getElementById("OfflineScreen").style.display = "none";
                document.getElementById("Main").style.display = "block";
                document.getElementById("TopBtns").style.display = "block";
                return;
            }

            document.getElementById("OfflineScreen").style.display = "block";
            document.getElementById("Main").style.display = "none";
            document.getElementById("TopBtns").style.display = "none";

        } catch (err) {

            clearTimeout(timeout);
            document.getElementById("OfflineScreen").style.display = "block";
            document.getElementById("Main").style.display = "none";
            document.getElementById("TopBtns").style.display = "none";

        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}