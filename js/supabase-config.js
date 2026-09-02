"use strict";

/*
 * Supabase browser configuration
 *
 * The publishable key is safe to use in browser code.
 * Security is enforced by Supabase Authentication and RLS policies.
 *
 * NEVER place the database password, secret key or service_role key here.
 */

window.RecipeSupabaseConfig = Object.freeze({
    url: "https://trrjumpjpulealmzpnlu.supabase.co",

    publishableKey: "sb_publishable_q2UJ3KgmQd66_hhiks1kXQ_15eiXS1f",

    tableName: "app_snapshots",

    localStorageKey: "recipeRatioCostManager.v2"
});