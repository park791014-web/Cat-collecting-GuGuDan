param (
    [string]$Version = ""
)

$isGit = git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or $isGit -ne "true") {
    Write-Error "현재 디렉토리가 Git 저장소가 아닙니다."
    exit 1
}

$branch = git branch --show-current
Write-Output "Current branch: $branch"

$versionFile = Join-Path $PSScriptRoot "version.json"
if (-not (Test-Path $versionFile)) {
    Write-Error "version.json 파일을 찾을 수 없습니다."
    exit 1
}
$versionData = Get-Content $versionFile | ConvertFrom-Json

$oldVersion = $versionData.version
$newVersion = $Version

if ([string]::IsNullOrEmpty($newVersion)) {
    $parts = $oldVersion.Split('.')
    if ($parts.Length -eq 3) {
        $patch = [int]$parts[2] + 1
        $newVersion = "$($parts[0]).$($parts[1]).$patch"
    } else {
        $newVersion = "2.1.1"
    }
}

$kst = [System.TimeZoneInfo]::FindSystemTimeZoneById("Korea Standard Time")
$now = [System.TimeZoneInfo]::ConvertTimeFromUtc([System.DateTime]::UtcNow, $kst)
$buildDate = $now.ToString("yyyy-MM-dd")
$buildTime = $now.ToString("HH:mm")

$appJsFile = Join-Path $PSScriptRoot "js/app.js"
$indexHtmlFile = Join-Path $PSScriptRoot "index.html"
$swJsFile = Join-Path $PSScriptRoot "sw.js"

$appJsBackup = Get-Content $appJsFile -Raw
$indexHtmlBackup = Get-Content $indexHtmlFile -Raw
$swJsBackup = Get-Content $swJsFile -Raw
$versionBackup = Get-Content $versionFile -Raw

$versionData.version = $newVersion
$versionData.buildDate = $buildDate
$versionData.buildTime = $buildTime
$versionData | ConvertTo-Json | Set-Content $versionFile

$appJsContent = Get-Content $appJsFile -Raw
$appJsContent = $appJsContent -replace 'version:\s*"[^"]*"', "version: `"$newVersion`""
$appJsContent = $appJsContent -replace 'buildDate:\s*"[^"]*"', "buildDate: `"$buildDate`""
$appJsContent = $appJsContent -replace 'buildTime:\s*"[^"]*"', "buildTime: `"$buildTime`""
$appJsContent | Set-Content $appJsFile

$indexHtmlContent = Get-Content $indexHtmlFile -Raw
$indexHtmlContent = $indexHtmlContent -replace 'src="js/app.js\?v=[^"]*"', "src=`"js/app.js?v=$newVersion`""
$indexHtmlContent = $indexHtmlContent -replace 'src="js/ui/adminAccountManager.js\?v=[^"]*"', "src=`"js/ui/adminAccountManager.js?v=$newVersion`""
$indexHtmlContent = $indexHtmlContent -replace 'src="js/game/modeEngine.js\?v=[^"]*"', "src=`"js/game/modeEngine.js?v=$newVersion`""
$indexHtmlContent = $indexHtmlContent -replace 'href="css/style.css\?v=[^"]*"', "href=`"css/style.css?v=$newVersion`""
$indexHtmlContent = $indexHtmlContent -replace 'href="css/releasePatch.css\?v=[^"]*"', "href=`"css/releasePatch.css?v=$newVersion`""
$indexHtmlContent | Set-Content $indexHtmlFile

$swJsContent = Get-Content $swJsFile -Raw
$swJsContent = $swJsContent -replace 'CACHE_NAME\s*=\s*"[^"]*"', "CACHE_NAME = `"nyanko-cache-v$newVersion`""
$swJsContent = $swJsContent -replace 'css/style.css\?v=[^"]*"', "css/style.css?v=$newVersion`""
$swJsContent = $swJsContent -replace 'css/releasePatch.css\?v=[^"]*"', "css/releasePatch.css?v=$newVersion`""
$swJsContent = $swJsContent -replace 'js/app.js\?v=[^"]*"', "js/app.js?v=$newVersion`""
$swJsContent = $swJsContent -replace 'js/game/modeEngine.js\?v=[^"]*"', "js/game/modeEngine.js?v=$newVersion`""
$swJsContent = $swJsContent -replace 'js/game/adventureEngine.js\?v=[^"]*"', "js/game/adventureEngine.js?v=$newVersion`""
$swJsContent | Set-Content $swJsFile

Write-Output "Running project unit tests..."
$allPassed = $true

$tests = @(
    "js/tests/adminAccountManager.test.cjs",
    "js/tests/phase54AdventureRegression.test.cjs",
    "js/tests/phase54DataValidation.test.cjs",
    "js/tests/phase551StoryMapping.test.cjs"
)

foreach ($test in $tests) {
    Write-Output "Running $test..."
    node $test
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Test failed: $test"
        $allPassed = $false
    }
}

if (-not $allPassed) {
    Write-Error "테스트 검증에 실패했습니다. 버전 변경 사항을 원복합니다."
    $appJsBackup | Set-Content $appJsFile
    $indexHtmlBackup | Set-Content $indexHtmlFile
    $swJsBackup | Set-Content $swJsFile
    $versionBackup | Set-Content $versionFile
    exit 1
}

Write-Output "All tests passed successfully!"

git add -A

$commitMsg = "release: v$newVersion"
if ($newVersion -eq "2.1.0") {
    $commitMsg = "release: v2.1.0 reset game data and rankings`n`n- reset all user game saves`n- reset all leaderboard data`n- prevent legacy local data restore`n- add login screen version indicator`n- add release automation"
}

$msgFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($msgFile, $commitMsg, [System.Text.Encoding]::UTF8)

git commit -F $msgFile
Remove-Item $msgFile

$commitHash = git rev-parse --short HEAD

Write-Output ""
Write-Output "Release commit created successfully."
Write-Output ""
Write-Output "Version: $newVersion"
Write-Output "Commit: $commitHash"
Write-Output "Branch: $branch"
Write-Output ""
Write-Output "Next:"
Write-Output "Open GitHub Desktop and click `"Push origin`"."
