"use strict";

(function initialiseRecipeCloudSync(global) {
    const config = global.RecipeSupabaseConfig;

    if (!config) {
        console.error("Supabase configuration was not loaded.");
        return;
    }

    const CLOUD_LINK_KEY = `${config.localStorageKey}.cloudLink`;
    const BACKUP_PREFIX = `${config.localStorageKey}.backup`;
    const MONITOR_INTERVAL_MS = 1500;
    const UPLOAD_DELAY_MS = 900;

    let supabaseClient = null;
    let currentSession = null;
    let realtimeChannel = null;
    let monitorTimer = null;
    let uploadTimer = null;
    let lastKnownLocalValue = null;
    let pendingLocalChanges = false;
    let applyingCloudData = false;
    let statusListeners = [];

    let syncStatus = {
        code: "starting",
        message: "Cloud sync is starting.",
        online: navigator.onLine,
        signedIn: false,
        email: "",
        pending: false,
        lastSyncedAt: null
    };

    function updateStatus(code, message, extra = {}) {
        syncStatus = {
            ...syncStatus,
            code,
            message,
            online: navigator.onLine,
            signedIn: Boolean(currentSession),
            email: currentSession?.user?.email || "",
            pending: pendingLocalChanges,
            ...extra
        };

        statusListeners.forEach((listener) => {
            try {
                listener({ ...syncStatus });
            } catch (error) {
                console.error("Cloud status listener failed:", error);
            }
        });

        global.dispatchEvent(
            new CustomEvent("recipe-cloud-status", {
                detail: { ...syncStatus }
            })
        );
    }

    function getStatus() {
        return { ...syncStatus };
    }

    function onStatusChange(listener) {
        if (typeof listener !== "function") {
            return function unsubscribeEmptyListener() {};
        }

        statusListeners.push(listener);
        listener({ ...syncStatus });

        return function unsubscribeStatusListener() {
            statusListeners = statusListeners.filter(
                (registeredListener) => registeredListener !== listener
            );
        };
    }

    function readRawLocalValue() {
        return localStorage.getItem(config.localStorageKey);
    }

    function createEmptyAppData() {
        return {
            ingredients: [],
            recipes: [],
            businessRecords: []
        };
    }

    function normaliseAppData(value) {
        const source =
            value && typeof value === "object" && !Array.isArray(value)
                ? value
                : {};

        return {
            ...source,
            ingredients: Array.isArray(source.ingredients)
                ? source.ingredients
                : [],
            recipes: Array.isArray(source.recipes) ? source.recipes : [],
            businessRecords: Array.isArray(source.businessRecords)
                ? source.businessRecords
                : []
        };
    }

    function readLocalData() {
        const rawValue = readRawLocalValue();

        if (!rawValue) {
            return createEmptyAppData();
        }

        try {
            return normaliseAppData(JSON.parse(rawValue));
        } catch (error) {
            throw new Error(
                "The existing local application data is not valid JSON."
            );
        }
    }

    function hasUsefulData(data) {
        if (!data || typeof data !== "object") {
            return false;
        }

        return (
            (Array.isArray(data.ingredients) &&
                data.ingredients.length > 0) ||
            (Array.isArray(data.recipes) && data.recipes.length > 0) ||
            (Array.isArray(data.businessRecords) &&
                data.businessRecords.length > 0)
        );
    }

    function createLocalBackup(reason = "cloud-replacement") {
        const rawValue = readRawLocalValue();

        if (!rawValue) {
            return null;
        }

        const timestamp = new Date()
            .toISOString()
            .replaceAll(":", "-")
            .replaceAll(".", "-");

        const backupKey = `${BACKUP_PREFIX}.${timestamp}`;

        localStorage.setItem(
            backupKey,
            JSON.stringify({
                createdAt: new Date().toISOString(),
                reason,
                storageKey: config.localStorageKey,
                data: JSON.parse(rawValue)
            })
        );

        return backupKey;
    }

    function downloadLocalBackup() {
        const data = readLocalData();
        const timestamp = new Date().toISOString().slice(0, 10);
        const fileName = `recipe-ratio-backup-${timestamp}.json`;

        const blob = new Blob(
            [
                JSON.stringify(
                    {
                        exportedAt: new Date().toISOString(),
                        storageKey: config.localStorageKey,
                        data
                    },
                    null,
                    2
                )
            ],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);

        return fileName;
    }

    function getLinkedUserId() {
        return localStorage.getItem(CLOUD_LINK_KEY);
    }

    function setLinkedUserId(userId) {
        localStorage.setItem(CLOUD_LINK_KEY, userId);
    }

    function clearLinkedUserId() {
        localStorage.removeItem(CLOUD_LINK_KEY);
    }

    function writeCloudDataToLocal(data, reason = "cloud-download") {
        const normalisedData = normaliseAppData(data);
        const newRawValue = JSON.stringify(normalisedData);
        const currentRawValue = readRawLocalValue();

        if (currentRawValue === newRawValue) {
            lastKnownLocalValue = newRawValue;
            pendingLocalChanges = false;
            return false;
        }

        if (currentRawValue) {
            createLocalBackup(reason);
        }

        applyingCloudData = true;
        localStorage.setItem(config.localStorageKey, newRawValue);
        lastKnownLocalValue = newRawValue;
        pendingLocalChanges = false;
        applyingCloudData = false;

        global.dispatchEvent(
            new CustomEvent("recipe-cloud-data-applied", {
                detail: {
                    reason,
                    data: normalisedData
                }
            })
        );

        return true;
    }

    function requireClient() {
        if (!supabaseClient) {
            throw new Error("The Supabase client is not ready.");
        }

        return supabaseClient;
    }

    function requireSession() {
        if (!currentSession?.user?.id) {
            throw new Error("Sign in before synchronizing data.");
        }

        return currentSession;
    }

    async function uploadLocalData(options = {}) {
        const client = requireClient();
        const session = requireSession();

        if (!navigator.onLine) {
            pendingLocalChanges = true;
            updateStatus(
                "offline",
                "Changes are saved locally and will sync when online."
            );

            return {
                success: false,
                offline: true
            };
        }

        const data = readLocalData();

        if (!options.allowEmpty && !hasUsefulData(data)) {
            updateStatus(
                "empty-local",
                "There is no local recipe data to upload."
            );

            return {
                success: false,
                empty: true
            };
        }

        const uploadedRawValue = JSON.stringify(data);
        const clientUpdatedAt = new Date().toISOString();

        updateStatus("uploading", "Uploading local data to Supabase.");

        const { data: savedRow, error } = await client
            .from(config.tableName)
            .upsert(
                {
                    user_id: session.user.id,
                    data,
                    client_updated_at: clientUpdatedAt
                },
                {
                    onConflict: "user_id"
                }
            )
            .select("user_id, client_updated_at, updated_at")
            .single();

        if (error) {
            pendingLocalChanges = true;
            updateStatus("upload-error", error.message);

            return {
                success: false,
                error
            };
        }

        const currentRawValue = readRawLocalValue();

        if (currentRawValue === uploadedRawValue) {
            lastKnownLocalValue = uploadedRawValue;
            pendingLocalChanges = false;
        } else {
            pendingLocalChanges = true;
            scheduleUpload();
        }

        setLinkedUserId(session.user.id);

        updateStatus("synced", "Local data is backed up to Supabase.", {
            lastSyncedAt: savedRow.updated_at
        });

        return {
            success: true,
            row: savedRow
        };
    }

    async function downloadCloudData(options = {}) {
        const client = requireClient();
        const session = requireSession();

        if (!navigator.onLine) {
            updateStatus(
                "offline",
                "Cloud data cannot be downloaded while offline."
            );

            return {
                success: false,
                offline: true
            };
        }

        updateStatus("downloading", "Downloading the latest cloud data.");

        const { data: cloudRow, error } = await client
            .from(config.tableName)
            .select("user_id, data, client_updated_at, updated_at")
            .eq("user_id", session.user.id)
            .maybeSingle();

        if (error) {
            updateStatus("download-error", error.message);

            return {
                success: false,
                error
            };
        }

        if (!cloudRow) {
            updateStatus(
                "cloud-empty",
                "No cloud backup exists for this account."
            );

            return {
                success: false,
                empty: true
            };
        }

        if (
            options.automatic &&
            pendingLocalChanges &&
            readRawLocalValue() !== JSON.stringify(cloudRow.data)
        ) {
            updateStatus(
                "conflict",
                "Local and cloud data have both changed. Choose which copy to keep."
            );

            return {
                success: false,
                conflict: true,
                cloudRow
            };
        }

        const changed = writeCloudDataToLocal(
            cloudRow.data,
            options.reason || "cloud-download"
        );

        setLinkedUserId(session.user.id);

        updateStatus("synced", "Cloud data is available on this device.", {
            lastSyncedAt: cloudRow.updated_at
        });

        return {
            success: true,
            changed,
            row: cloudRow
        };
    }

    async function getCloudInformation() {
        const client = requireClient();
        const session = requireSession();

        const { data, error } = await client
            .from(config.tableName)
            .select("user_id, client_updated_at, updated_at")
            .eq("user_id", session.user.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return data;
    }

    async function signIn(email, password) {
        const client = requireClient();

        updateStatus("signing-in", "Signing in.");

        const { data, error } = await client.auth.signInWithPassword({
            email: String(email || "").trim(),
            password: String(password || "")
        });

        if (error) {
            updateStatus("sign-in-error", error.message);

            return {
                success: false,
                error
            };
        }

        currentSession = data.session;
        await subscribeToRealtime();

        const linkedUserId = getLinkedUserId();

        if (linkedUserId === currentSession.user.id) {
            await downloadCloudData({
                automatic: true,
                reason: "sign-in-refresh"
            });
        } else {
            updateStatus(
                "signed-in",
                "Signed in. Choose whether to upload local data or download cloud data."
            );
        }

        return {
            success: true,
            session: currentSession
        };
    }

    async function signOut() {
        const client = requireClient();

        if (realtimeChannel) {
            await client.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        const { error } = await client.auth.signOut();

        if (error) {
            updateStatus("sign-out-error", error.message);

            return {
                success: false,
                error
            };
        }

        currentSession = null;
        pendingLocalChanges = false;

        updateStatus("signed-out", "Signed out. Local data remains on this device.");

        return {
            success: true
        };
    }

    async function subscribeToRealtime() {
        const client = requireClient();

        if (!currentSession?.user?.id) {
            return;
        }

        if (realtimeChannel) {
            await client.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }

        realtimeChannel = client
            .channel(`app-snapshot-${currentSession.user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: config.tableName,
                    filter: `user_id=eq.${currentSession.user.id}`
                },
                async (payload) => {
                    if (
                        payload.eventType === "DELETE" ||
                        !payload.new?.data
                    ) {
                        updateStatus(
                            "cloud-deleted",
                            "The cloud snapshot was deleted. Local data was preserved."
                        );
                        return;
                    }

                    const incomingRawValue = JSON.stringify(
                        normaliseAppData(payload.new.data)
                    );

                    if (incomingRawValue === readRawLocalValue()) {
                        pendingLocalChanges = false;
                        lastKnownLocalValue = incomingRawValue;

                        updateStatus(
                            "synced",
                            "Data is synchronized.",
                            {
                                lastSyncedAt: payload.new.updated_at || null
                            }
                        );
                        return;
                    }

                    if (pendingLocalChanges) {
                        updateStatus(
                            "conflict",
                            "Another device changed the cloud data while this device has unsynced changes."
                        );
                        return;
                    }

                    writeCloudDataToLocal(
                        payload.new.data,
                        "realtime-update"
                    );

                    updateStatus(
                        "realtime-updated",
                        "New data was received from another device.",
                        {
                            lastSyncedAt: payload.new.updated_at || null
                        }
                    );
                }
            )
            .subscribe((subscriptionStatus) => {
                if (subscriptionStatus === "SUBSCRIBED") {
                    updateStatus(
                        "realtime-ready",
                        "Realtime synchronization is connected."
                    );
                }
            });
    }

    function scheduleUpload() {
        if (!currentSession || !getLinkedUserId()) {
            return;
        }

        if (uploadTimer) {
            clearTimeout(uploadTimer);
        }

        uploadTimer = setTimeout(async () => {
            uploadTimer = null;

            try {
                await uploadLocalData({
                    allowEmpty: true,
                    automatic: true
                });
            } catch (error) {
                pendingLocalChanges = true;
                updateStatus("upload-error", error.message);
            }
        }, UPLOAD_DELAY_MS);
    }

    function checkForLocalChanges() {
        if (applyingCloudData) {
            return;
        }

        const currentRawValue = readRawLocalValue();

        if (currentRawValue === lastKnownLocalValue) {
            return;
        }

        lastKnownLocalValue = currentRawValue;
        pendingLocalChanges = true;

        updateStatus(
            navigator.onLine ? "local-change" : "offline",
            navigator.onLine
                ? "A local change is waiting to synchronize."
                : "The change is saved locally and will sync when online."
        );

        scheduleUpload();
    }

    async function initialise() {
        if (!global.supabase?.createClient) {
            updateStatus(
                "library-missing",
                "The Supabase JavaScript library was not loaded."
            );
            return;
        }

        supabaseClient = global.supabase.createClient(
            config.url,
            config.publishableKey,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

        lastKnownLocalValue = readRawLocalValue();

        const {
            data: { session },
            error
        } = await supabaseClient.auth.getSession();

        if (error) {
            updateStatus("session-error", error.message);
            return;
        }

        currentSession = session;

        supabaseClient.auth.onAuthStateChange(
            async (event, changedSession) => {
                currentSession = changedSession;

                if (event === "SIGNED_OUT") {
                    updateStatus(
                        "signed-out",
                        "Signed out. Local data remains on this device."
                    );
                    return;
                }

                if (
                    event === "SIGNED_IN" ||
                    event === "TOKEN_REFRESHED"
                ) {
                    await subscribeToRealtime();
                }
            }
        );

        if (currentSession) {
            await subscribeToRealtime();

            if (getLinkedUserId() === currentSession.user.id) {
                await downloadCloudData({
                    automatic: true,
                    reason: "page-load-refresh"
                });
            } else {
                updateStatus(
                    "signed-in",
                    "Signed in. Cloud migration has not been completed on this device."
                );
            }
        } else {
            updateStatus(
                "signed-out",
                "Sign in to enable cloud synchronization."
            );
        }

        monitorTimer = setInterval(
            checkForLocalChanges,
            MONITOR_INTERVAL_MS
        );
    }

    global.addEventListener("online", async () => {
        updateStatus("online", "Internet connection restored.");

        if (currentSession && pendingLocalChanges) {
            try {
                await uploadLocalData({
                    allowEmpty: true,
                    automatic: true
                });
            } catch (error) {
                updateStatus("upload-error", error.message);
            }
        }
    });

    global.addEventListener("offline", () => {
        updateStatus(
            "offline",
            "Offline. Changes will remain saved on this device."
        );
    });

    global.RecipeCloudSync = Object.freeze({
        initialise,
        signIn,
        signOut,
        uploadLocalData,
        downloadCloudData,
        getCloudInformation,
        getStatus,
        onStatusChange,
        readLocalData,
        createLocalBackup,
        downloadLocalBackup,
        hasUsefulData,
        clearLinkedUserId
    });
})(window);