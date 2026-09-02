"use strict";

(function initialiseLoginPage(global) {
    const form = document.querySelector("#website-login-form");
    const emailInput = document.querySelector("#login-email");
    const passwordInput = document.querySelector("#login-password");
    const submitButton = document.querySelector("#login-button");
    const message = document.querySelector("#login-message");

    function showMessage(text, type = "error") {
        message.textContent = text;
        message.dataset.type = type;
        message.hidden = false;
    }

    function clearMessage() {
        message.textContent = "";
        message.hidden = true;
        delete message.dataset.type;
    }

    function setBusy(busy) {
        emailInput.disabled = busy;
        passwordInput.disabled = busy;
        submitButton.disabled = busy;
        submitButton.textContent = busy ? "Signing in…" : "Sign in";
    }

    function redirectToAccount() {
        global.location.replace("account.html");
    }

    async function start() {
        if (!global.supabase?.createClient) {
            showMessage(
                "The sign-in service could not be loaded. " +
                "Check your internet connection and refresh the page."
            );
            return;
        }

        const config = global.RecipeSupabaseConfig;

        if (!config?.url || !config?.publishableKey) {
            showMessage(
                "The Supabase website configuration is missing."
            );
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
                error
            } = await client.auth.getSession();

            if (error) {
                throw error;
            }

            if (session?.user) {
                redirectToAccount();
                return;
            }
        } catch (error) {
            showMessage(
                error.message ||
                    "The saved login could not be checked."
            );
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearMessage();

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            setBusy(true);

            try {
                const { data, error } =
                    await client.auth.signInWithPassword({
                        email: emailInput.value.trim(),
                        password: passwordInput.value
                    });

                if (error) {
                    throw error;
                }

                if (!data.session?.user) {
                    throw new Error(
                        "A login session was not created."
                    );
                }

                passwordInput.value = "";

                showMessage(
                    "Sign-in successful. Opening your account…",
                    "success"
                );

                redirectToAccount();
            } catch (error) {
                showMessage(
                    error.message ||
                        "Sign-in failed. Check your email address " +
                        "and password."
                );

                setBusy(false);
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            start,
            { once: true }
        );
    } else {
        start();
    }
})(window);