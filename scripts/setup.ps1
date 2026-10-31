$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path -LiteralPath '.env')) {
    function New-Hex { [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower() }
    $password = New-Hex
    $settings = Get-Content '.env.example' -Raw
    $settings = $settings.Replace('change_me', $password).Replace('replace-with-long-random-string', (New-Hex))
    [IO.File]::WriteAllText((Join-Path (Get-Location) '.env'), $settings, [Text.UTF8Encoding]::new($false))
    Write-Host 'Created .env with random database password and JWT secret.'
}
Write-Host 'Start P2: docker compose up -d --build --wait --wait-timeout 300'
Write-Host 'P2 API: http://localhost:3002/api/health'
