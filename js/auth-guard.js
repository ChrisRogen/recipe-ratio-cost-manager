"use strict";

(function protectApplicationPage(global) {
    const documentElement = document.documentElement;

    function getLoginUrl() {
        const inPagesDirectory = global.location.pathname
            .replaceAll("\\", "/")
            .includes("/pages/");

        return inPagesDirectory ? "login.html" : "pages/login.html";
    }

    function revealPage() {
        documentElement.dataset.authState = "authenticated";
    }

    function redirectToLogin() {
        documentElement.dataset.authState = "redirecting";
        global.location.replace(getLoginUrl());
    }

    async function clearLocalSession(client) {
        try {
            await client.auth.signOut({ scope: "local" });
        } catch (error) {
            console.warn("The expired local session could not be cleared:", error);
        }
    }

    async function verifyAuthentication() {
        const config = global.RecipeSupabaseConfig;

        if (!global.supabase?.createClient || !config) {
            console.error("Authentication files were not loaded.");
            redirectToLogin();
            return;
        }

        const client = global.supabase.createClient(
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

        try {
            const {
                data: { session },
                error: sessionError
            } = await client.auth.getSession();

            if (sessionError) {
                throw sessionError;
            }

            if (!session?.user) {
                redirectToLogin();
                return;
            }

            let {
                data: { user },
                error: userError
            } = await client.auth.getUser();

            if (userError || !user) {
                const {
                    data: refreshData,
                    error: refreshError
                } = await client.auth.refreshSession();

                if (refreshError || !refreshData.session?.user) {
                    await clearLocalSession(client);
                    redirectToLogin();
                    return;
                }

                const verifiedUserResult = await client.auth.getUser();
                user = verifiedUserResult.data.user;
                userError = verifiedUserResult.error;
            }

            if (userError || !user) {
                await clearLocalSession(client);
                redirectToLogin();
                return;
            }

            revealPage();
        } catch (error) {
            console.error("Authentication check failed:", error);
            await clearLocalSession(client);
            redirectToLogin();
        }
    }

    verifyAuthentication();
})(window);