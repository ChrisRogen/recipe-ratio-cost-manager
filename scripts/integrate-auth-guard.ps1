$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot

$protectedFiles = @(
    (Join-Path $projectRoot "index.html"),
    (Join-Path $projectRoot "pages\recipes.html"),
    (Join-Path $projectRoot "pages\calculator.html"),
    (Join-Path $projectRoot "pages\ingredients.html"),
    (Join-Path $projectRoot "pages\business.html"),
    (Join-Path $projectRoot "pages\account.html")
)

foreach ($filePath in $protectedFiles) {
    if (-not (Test-Path $filePath)) {
        throw "Required HTML file was not found: $filePath"
    }

    $content = Get-Content -Path $filePath -Raw

    if ($content -notmatch 'data-auth-state="checking"') {
        $content = $content.Replace(
            '<html lang="en">',
            '<html lang="en" data-auth-state="checking">'
        )
    }

    if ($content -notmatch 'auth-guard\.js') {
        $isRootPage = [System.IO.Path]::GetFileName($filePath) -eq "index.html"

        if ($isRootPage) {
            $configScript = '<script src="js/supabase-config.js" defer></script>'
            $guardScript = '<script src="js/auth-guard.js" defer></script>'
        }
        else {
            $configScript = '<script src="../js/supabase-config.js" defer></script>'
            $guardScript = '<script src="../js/auth-guard.js" defer></script>'
        }

        if (-not $content.Contains($configScript)) {
            throw "Supabase configuration script was not found in: $filePath"
        }

        $content = $content.Replace(
            $configScript,
            "$configScript`r`n    $guardScript"
        )
    }

    if ($content -notmatch 'data-auth-state="checking"\] body') {
        $authStyle = @'
    <style>
        html[data-auth-state="checking"] body,
        html[data-auth-state="redirecting"] body {
            visibility: hidden;
        }
    </style>
'@

        $content = $content.Replace(
            "</head>",
            "$authStyle</head>"
        )
    }

    Set-Content -Path $filePath -Value $content -Encoding UTF8
    Write-Host "Protected page: $filePath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Authentication guard integration completed successfully." -ForegroundColor Cyan
