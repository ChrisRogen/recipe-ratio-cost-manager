"use strict";

(function initialiseAccountPage(global) {
    const elements = {};
    let unsubscribeStatus = null;

    function selectElements() {
        elements.statusBadge = document.querySelector(
            "#cloud-status-badge"
        );

        elements.statusMessage = document.querySelector(
            "#cloud-status-message"
        );

        elements.connectionValue = document.querySelector(
            "#cloud-connection-value"
        );

        elements.accountValue = document.querySelector(
            "#cloud-account-value"
        );

        elements.pendingValue = document.querySelector(
            "#cloud-pending-value"
        );

        elements.lastSyncedValue = document.querySelector(
            "#cloud-last-synced-value"
        );

        elements.signedInSection = document.querySelector(
            "#signed-in-section"
        );

        elements.signedInEmail = document.querySelector(
            "#signed-in-email"
        );

        elements.signOutButton = document.querySelector(
            "#sign-out-button"
        );

        elements.migrationSection = document.querySelector(
            "#migration-section"
        );

        elements.syncControlsSection = document.querySelector(
            "#sync-controls-section"
        );

        elements.localIngredientCount = document.querySelector(
            "#local-ingredient-count"
        );

        elements.localRecipeCount = document.querySelector(
            "#local-recipe-count"
        );

        elements.localBusinessCount = document.querySelector(
            "#local-business-count"
        );

        elements.cloudInformationMessage = document.querySelector(
            "#cloud-information-message"
        );

        elements.cloudBackupValue = document.querySelector(
            "#cloud-backup-value"
        );

        elements.cloudUpdatedValue = document.querySelector(
            "#cloud-updated-value"
        );

        elements.backupBeforeSyncButton = document.querySelector(
            "#backup-before-sync-button"
        );

        elements.uploadLocalButton = document.querySelector(
            "#upload-local-button"
        );

        elements.downloadCloudButton = document.querySelector(
            "#download-cloud-button"
        );

        elements.syncNowButton = document.querySelector(
            "#sync-now-button"
        );

        elements.restoreCloudButton = document.querySelector(
            "#restore-cloud-button"
        );

        elements.downloadBackupButton = document.querySelector(
            "#download-backup-button"
        );
    }

    function getCloudLinkKey() {
        return `${global.RecipeSupabaseConfig.localStorageKey}.cloudLink`;
    }

    function isDeviceLinked() {
        return Boolean(localStorage.getItem(getCloudLinkKey()));
    }

    function formatDateTime(value) {
        if (!value) {
            return "Not yet synchronized";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Not available";
        }

        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function getStatusLabel(code) {
        const labels = {
            starting: "Starting",
            "library-missing": "Unavailable",
            "session-error": "Error",
            "signed-out": "Signed out",
            "signing-in": "Signing in",
            "sign-in-error": "Sign-in failed",
            "signed-in": "Signed in",
            uploading: "Uploading",
            downloading: "Downloading",
            synced: "Synced",
            "realtime-ready": "Realtime ready",
            "realtime-updated": "Updated",
            "local-change": "Saving",
            online: "Online",
            offline: "Offline",
            conflict: "Action required",
            "upload-error": "Upload failed",
            "download-error": "Download failed",
            "cloud-empty": "Cloud empty",
            "empty-local": "Local data empty",
            "cloud-deleted": "Cloud backup missing",
            "sign-out-error": "Sign-out failed"
        };

        return labels[code] || "Cloud status";
    }

    function showMessage(message, type = "information") {
        elements.statusMessage.textContent = message;
        elements.statusMessage.dataset.type = type;
    }

    function setButtonBusy(button, busy, busyText) {
        if (!button) {
            return;
        }

        if (busy) {
            button.dataset.originalText = button.textContent;
            button.textContent = busyText;
            button.disabled = true;
            return;
        }

        button.textContent =
            button.dataset.originalText || button.textContent;

        delete button.dataset.originalText;
        button.disabled = false;
    }

    function renderLocalSummary() {
        let data;

        try {
            data = global.RecipeCloudSync.readLocalData();
        } catch (error) {
            showMessage(error.message, "error");
            return;
        }

        elements.localIngredientCount.textContent =
            data.ingredients.length.toLocaleString();

        elements.localRecipeCount.textContent =
            data.recipes.length.toLocaleString();

        elements.localBusinessCount.textContent =
            data.businessRecords.length.toLocaleString();
    }

    function renderAuthenticationSections(status) {
        const signedIn = Boolean(status.signedIn);
        const linked = signedIn && isDeviceLinked();

        elements.signedInSection.hidden = !signedIn;
        elements.migrationSection.hidden = !signedIn || linked;
        elements.syncControlsSection.hidden = !signedIn || !linked;

        elements.signedInEmail.textContent = signedIn
            ? status.email
            : "Not signed in";
    }

    function renderStatus(status) {
        elements.statusBadge.textContent = getStatusLabel(status.code);
        elements.statusBadge.dataset.status = status.code;

        elements.connectionValue.textContent = status.online
            ? "Online"
            : "Offline";

        elements.accountValue.textContent = status.signedIn
            ? status.email
            : "Not signed in";

        elements.pendingValue.textContent = status.pending
            ? "Yes"
            : "No";

        elements.lastSyncedValue.textContent = formatDateTime(
            status.lastSyncedAt
        );

        showMessage(
            status.message,
            status.code.includes("error") ||
                status.code === "conflict"
                ? "error"
                : status.code === "offline"
                  ? "warning"
                  : "information"
        );

        renderAuthenticationSections(status);
        renderLocalSummary();
    }

    async function refreshCloudInformation() {
        const status = global.RecipeCloudSync.getStatus();

        if (!status.signedIn) {
            elements.cloudInformationMessage.textContent =
                "Sign in to check the cloud backup.";

            elements.cloudBackupValue.textContent = "Not checked";
            elements.cloudUpdatedValue.textContent = "Not available";
            return;
        }

        elements.cloudInformationMessage.textContent =
            "Checking for an existing cloud backupâ€¦";

        try {
            const cloudInformation =
                await global.RecipeCloudSync.getCloudInformation();

            if (!cloudInformation) {
                elements.cloudInformationMessage.textContent =
                    "This account does not have a cloud backup yet.";

                elements.cloudBackupValue.textContent = "Not created";
                elements.cloudUpdatedValue.textContent = "Not available";
                return;
            }

            elements.cloudInformationMessage.textContent =
                "A cloud backup exists for this account.";

            elements.cloudBackupValue.textContent = "Available";

            elements.cloudUpdatedValue.textContent = formatDateTime(
                cloudInformation.updated_at
            );
        } catch (error) {
            elements.cloudInformationMessage.textContent =
                `Unable to check cloud data: ${error.message}`;

            elements.cloudBackupValue.textContent = "Check failed";
            elements.cloudUpdatedValue.textContent = "Not available";
        }
    }

    async function handleSignOut() {
        setButtonBusy(
            elements.signOutButton,
            true,
            "Signing outâ€¦"
        );

        try {
            const result = await global.RecipeCloudSync.signOut();

            if (!result.success) {
                showMessage(
                    result.error?.message || "Unable to sign out.",
                    "error"
                );

                setButtonBusy(elements.signOutButton, false);
                return;
            }

            global.location.replace("login.html");
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            if (document.body.contains(elements.signOutButton)) {
                setButtonBusy(elements.signOutButton, false);
            }
        }
    }

    function handleDownloadBackup() {
        try {
            const fileName =
                global.RecipeCloudSync.downloadLocalBackup();

            showMessage(
                `Local backup downloaded as ${fileName}.`,
                "information"
            );
        } catch (error) {
            showMessage(
                `Backup could not be created: ${error.message}`,
                "error"
            );
        }
    }

    async function handleUploadLocalData() {
        let localData;

        try {
            localData = global.RecipeCloudSync.readLocalData();
        } catch (error) {
            showMessage(error.message, "error");
            return;
        }

        if (!global.RecipeCloudSync.hasUsefulData(localData)) {
            showMessage(
                "There is no ingredient, recipe or business data to upload.",
                "warning"
            );
            return;
        }

        const confirmed = global.confirm(
            "Upload the data currently stored in this browser to Supabase?\n\n" +
            "If a cloud backup already exists, it will be replaced."
        );

        if (!confirmed) {
            return;
        }

        setButtonBusy(
            elements.uploadLocalButton,
            true,
            "Uploadingâ€¦"
        );

        try {
            global.RecipeCloudSync.downloadLocalBackup();

            const result =
                await global.RecipeCloudSync.uploadLocalData();

            if (!result.success) {
                showMessage(
                    result.error?.message ||
                        "The local data was not uploaded.",
                    "error"
                );
                return;
            }

            await refreshCloudInformation();
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setButtonBusy(elements.uploadLocalButton, false);
        }
    }

    async function handleDownloadCloudData() {
        const confirmed = global.confirm(
            "Replace the data in this browser with the Supabase cloud copy?\n\n" +
            "An automatic local backup will be created first."
        );

        if (!confirmed) {
            return;
        }

        setButtonBusy(
            elements.downloadCloudButton,
            true,
            "Downloadingâ€¦"
        );

        try {
            const result =
                await global.RecipeCloudSync.downloadCloudData({
                    automatic: false,
                    reason: "first-device-download"
                });

            if (!result.success) {
                const message = result.empty
                    ? "No cloud backup exists for this account."
                    : result.error?.message ||
                      "Cloud data could not be downloaded.";

                showMessage(message, result.empty ? "warning" : "error");
                return;
            }

            renderLocalSummary();
            await refreshCloudInformation();
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setButtonBusy(elements.downloadCloudButton, false);
        }
    }

    async function handleSyncNow() {
        setButtonBusy(elements.syncNowButton, true, "Syncingâ€¦");

        try {
            const status = global.RecipeCloudSync.getStatus();
            let result;

            if (status.pending) {
                result =
                    await global.RecipeCloudSync.uploadLocalData({
                        allowEmpty: true
                    });
            } else {
                result =
                    await global.RecipeCloudSync.downloadCloudData({
                        automatic: true,
                        reason: "manual-sync"
                    });

                if (result.empty) {
                    result =
                        await global.RecipeCloudSync.uploadLocalData({
                            allowEmpty: true
                        });
                }
            }

            if (!result.success) {
                showMessage(
                    result.conflict
                        ? "Both copies changed. Use Upload or Restore to choose which copy to keep."
                        : result.error?.message ||
                          "Synchronization was not completed.",
                    result.conflict ? "warning" : "error"
                );
                return;
            }

            renderLocalSummary();
            await refreshCloudInformation();
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setButtonBusy(elements.syncNowButton, false);
        }
    }

    async function handleRestoreCloudData() {
        const confirmed = global.confirm(
            "Restore the latest Supabase data on this device?\n\n" +
            "Current browser data will be backed up locally before replacement."
        );

        if (!confirmed) {
            return;
        }

        setButtonBusy(
            elements.restoreCloudButton,
            true,
            "Restoringâ€¦"
        );

        try {
            const result =
                await global.RecipeCloudSync.downloadCloudData({
                    automatic: false,
                    reason: "manual-cloud-restore"
                });

            if (!result.success) {
                showMessage(
                    result.empty
                        ? "No cloud backup exists."
                        : result.error?.message ||
                          "Cloud data could not be restored.",
                    result.empty ? "warning" : "error"
                );
                return;
            }

            renderLocalSummary();
            await refreshCloudInformation();
        } catch (error) {
            showMessage(error.message, "error");
        } finally {
            setButtonBusy(elements.restoreCloudButton, false);
        }
    }

    function bindEvents() {
        elements.signOutButton.addEventListener(
            "click",
            handleSignOut
        );

        elements.backupBeforeSyncButton.addEventListener(
            "click",
            handleDownloadBackup
        );

        elements.downloadBackupButton.addEventListener(
            "click",
            handleDownloadBackup
        );

        elements.uploadLocalButton.addEventListener(
            "click",
            handleUploadLocalData
        );

        elements.downloadCloudButton.addEventListener(
            "click",
            handleDownloadCloudData
        );

        elements.syncNowButton.addEventListener(
            "click",
            handleSyncNow
        );

        elements.restoreCloudButton.addEventListener(
            "click",
            handleRestoreCloudData
        );

        global.addEventListener(
            "recipe-cloud-data-applied",
            () => {
                renderLocalSummary();
                refreshCloudInformation();
            }
        );
    }

    async function startAccountPage() {
        selectElements();
        bindEvents();
        renderLocalSummary();

        if (
            !global.RecipeCloudSync ||
            !global.RecipeSupabaseConfig
        ) {
            showMessage(
                "Cloud synchronization files were not loaded.",
                "error"
            );
            return;
        }

        unsubscribeStatus =
            global.RecipeCloudSync.onStatusChange(renderStatus);

        try {
            await global.RecipeCloudSync.initialise();
            await refreshCloudInformation();
        } catch (error) {
            showMessage(
                `Cloud synchronization could not start: ${error.message}`,
                "error"
            );
        }
    }

    global.addEventListener("beforeunload", () => {
        if (typeof unsubscribeStatus === "function") {
            unsubscribeStatus();
        }
    });

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            startAccountPage,
            { once: true }
        );
    } else {
        startAccountPage();
    }
})(window);