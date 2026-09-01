"use strict";

(function initialiseCloudBootstrap(global) {
    let started = false;
    let reloadScheduled = false;
    let refreshNotice = null;

    function isUserEditingForm() {
        const activeElement = document.activeElement;

        if (!activeElement) {
            return false;
        }

        return (
            activeElement.matches("input, textarea, select") ||
            activeElement.isContentEditable
        );
    }

    function removeRefreshNotice() {
        if (refreshNotice) {
            refreshNotice.remove();
            refreshNotice = null;
        }
    }

    function showRefreshNotice() {
        if (refreshNotice) {
            return;
        }

        refreshNotice = document.createElement("aside");
        refreshNotice.setAttribute("role", "status");
        refreshNotice.setAttribute("aria-live", "polite");

        Object.assign(refreshNotice.style, {
            position: "fixed",
            right: "1rem",
            bottom: "1rem",
            zIndex: "9999",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            maxWidth: "min(26rem, calc(100vw - 2rem))",
            padding: "0.85rem 1rem",
            border: "1px solid #9bcdb0",
            borderRadius: "0.75rem",
            background: "#ffffff",
            color: "#123d28",
            boxShadow: "0 0.5rem 1.5rem rgba(20, 45, 30, 0.16)"
        });

        const message = document.createElement("span");
        message.textContent =
            "New cloud data is available from another device.";

        const refreshButton = document.createElement("button");
        refreshButton.type = "button";
        refreshButton.textContent = "Refresh";

        Object.assign(refreshButton.style, {
            padding: "0.5rem 0.75rem",
            border: "0",
            borderRadius: "0.45rem",
            background: "#137548",
            color: "#ffffff",
            fontWeight: "700",
            cursor: "pointer"
        });

        refreshButton.addEventListener("click", () => {
            removeRefreshNotice();
            global.location.reload();
        });

        refreshNotice.append(message, refreshButton);
        document.body.appendChild(refreshNotice);
    }

    function applyCloudPageUpdate(event) {
        if (reloadScheduled) {
            return;
        }

        const reason = event.detail?.reason || "cloud-update";

        if (reason === "realtime-update" && isUserEditingForm()) {
            showRefreshNotice();
            return;
        }

        reloadScheduled = true;

        global.setTimeout(() => {
            global.location.reload();
        }, 300);
    }

    function updatePageCloudState(status) {
        document.documentElement.dataset.cloudStatus = status.code;
        document.documentElement.dataset.cloudOnline = String(
            status.online
        );
        document.documentElement.dataset.cloudSignedIn = String(
            status.signedIn
        );

        global.dispatchEvent(
            new CustomEvent("recipe-page-cloud-status", {
                detail: status
            })
        );
    }

    async function start() {
        if (started) {
            return;
        }

        started = true;

        if (!global.RecipeCloudSync) {
            console.warn(
                "Cloud sync was not loaded on this page. Local features remain available."
            );
            return;
        }

        global.RecipeCloudSync.onStatusChange(
            updatePageCloudState
        );

        try {
            await global.RecipeCloudSync.initialise();
        } catch (error) {
            console.error(
                "Cloud synchronization could not start:",
                error
            );
        }
    }

    global.addEventListener(
        "recipe-cloud-data-applied",
        applyCloudPageUpdate
    );

    global.addEventListener("beforeunload", removeRefreshNotice);

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start, {
            once: true
        });
    } else {
        start();
    }
})(window);