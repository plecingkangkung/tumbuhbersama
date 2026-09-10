$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
Push-Location $repo
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
  $release = Join-Path $repo ('releases/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  $stage = Join-Path $release 'app'
  New-Item -ItemType Directory -Path $stage -Force | Out-Null
  Copy-Item -LiteralPath 'dist' -Destination $stage -Recurse
  New-Item -ItemType Directory -Path "$stage/server", "$stage/shared/data" -Force | Out-Null
  Get-ChildItem server -File -Filter '*.js' | Where-Object { $_.Name -notmatch '\.test\.js$|^captchaTestHelper\.js$' } | Copy-Item -Destination "$stage/server"
  Copy-Item -LiteralPath 'server/migrations' -Destination "$stage/server" -Recurse
  Get-ChildItem shared -File -Filter '*.js' | Copy-Item -Destination "$stage/shared"
  Copy-Item -LiteralPath 'shared/data/who-lms.json','shared/data/who-sources.json' -Destination "$stage/shared/data"
  Copy-Item -LiteralPath 'package.json','package-lock.json','DEPLOYMENT.md' -Destination $stage
  $example = (Get-Content '.env.example' -Raw).Replace('APP_ORIGIN=http://127.0.0.1:5173','APP_ORIGIN=https://domain-anda.example')
  [IO.File]::WriteAllText("$stage/.env.example", "NODE_ENV=production`n" + $example)
  $schema = Get-Content 'server/schema.sql' | Where-Object { $_ -notmatch '^CREATE DATABASE |^USE ' }
  [IO.File]::WriteAllLines("$stage/database-fresh.sql", $schema)
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = Join-Path $release 'TumbuhBersama-production.zip'
  [IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip)
  $archive = [IO.Compression.ZipFile]::OpenRead($zip)
  try {
    foreach ($entry in $archive.Entries) {
      if ($entry.FullName -match '(^|[/\\])(node_modules|\.git|\.env|\.who-cache)([/\\]|$)|\.test\.js$|captchaTestHelper|who-checks|\.pptx$') { throw "Forbidden file: $($entry.FullName)" }
    }
    $count = $archive.Entries.Count
  } finally { $archive.Dispose() }
  $bytes = (Get-Item -LiteralPath $zip).Length
  if ($bytes -ge 150000000) { throw 'Archive exceeds 150 MB' }
  Write-Output "ZIP: $zip"
  Write-Output "Size: $bytes bytes; files: $count"
  Get-FileHash -LiteralPath $zip -Algorithm SHA256
} finally { Pop-Location }
