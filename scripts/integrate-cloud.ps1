$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$pages = @(
    @{
        Path = Join-Path $projectRoot "index.html"
        ScriptPrefix = ""
        AccountHref = "pages/account.html"
    },
    @{
        Path = Join-Path $projectRoot "pages\ingredients.html"
        ScriptPrefix = "../"
        AccountHref = "account.html"
    },
    @{
        Path = Join-Path $projectRoot "pages\recipes.html"
        ScriptPrefix = "../"
        AccountHref = "account.html"
    },
    @{
        Path = Join-Path $projectRoot "pages\calculator.html"
        ScriptPrefix = "../"
        AccountHref = "account.html"
    },
    @{
        Path = Join-Path $projectRoot "pages\business.html"
        ScriptPrefix = "../"
        AccountHref = "account.html"
    }
)

foreach ($page in $pages) {
    $filePath = $page.Path
    $prefix = $page.ScriptPrefix
    $accountHref = $page.AccountHref

    if (-not (Test-Path $filePath)) {
        throw "Required HTML file was not found: $filePath"
    }

    $content = [System.IO.File]::ReadAllText($filePath)

    if ($content -notmatch [regex]::Escape("cloud-bootstrap.js")) {
        $cloudScripts = @"

    <!-- Supabase cloud synchronization -->
    <script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        defer
    ></script>
    <script src="${prefix}js/supabase-config.js" defer></script>
    <script src="${prefix}js/cloud-sync.js" defer></script>
    <script src="${prefix}js/cloud-bootstrap.js" defer></script>
"@

        if ($content -notmatch "</head>") {
            throw "No closing head tag was found in: $filePath"
        }

        $content = $content -replace "</head>", "$cloudScripts`r`n</head>"
    }

    $accountLinkPattern = 'href\s*=\s*["'']' +
        [regex]::Escape($accountHref) +
        '["'']'

    if ($content -notmatch $accountLinkPattern) {
        $accountLink = @"

                <a href="$accountHref">Account</a>
"@

        if ($content -notmatch "</nav>") {
            throw "No closing navigation tag was found in: $filePath"
        }

        $content = $content -replace "</nav>", "$accountLink`r`n            </nav>"
    }

    [System.IO.File]::WriteAllText(
        $filePath,
        $content,
        $utf8NoBom
    )

    Write-Host "Integrated cloud sync:" $filePath -ForegroundColor Green
}

Write-Host ""
Write-Host "Cloud integration completed successfully." -ForegroundColor Cyan