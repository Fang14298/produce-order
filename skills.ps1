# skills.ps1 - PowerShell script for managing skills and syncing with antigravity-cli

$SuperpowersSkills = "C:/Users/fang0/.gemini/config/plugins/superpowers/skills"
$CliSkillsDir = "$HOME/.gemini/antigravity-cli/skills"
$CliSkillsJson = "$CliSkillsDir/skills.json"

Write-Host "=== Agent Skills Manager (skills.sh / skills.ps1) ===" -ForegroundColor Cyan
Write-Host "Superpowers directory: $SuperpowersSkills"
Write-Host "Antigravity CLI config: $CliSkillsJson"
Write-Host ""

if (-not (Test-Path $CliSkillsDir)) {
    New-Item -ItemType Directory -Path $CliSkillsDir -Force | Out-Null
}

$jsonContent = @'
{
  "entries": [
    {
      "path": "C:/Users/fang0/.gemini/config/plugins/superpowers/skills"
    },
    {
      "path": "C:/Users/fang0/.agents/skills"
    }
  ]
}
'@

Set-Content -Path $CliSkillsJson -Value $jsonContent -Encoding UTF8
Write-Host "[OK] Updated $CliSkillsJson successfully." -ForegroundColor Green

if ($args.Count -gt 0) {
    Write-Host "[EXEC] Executing: npx skills $args" -ForegroundColor Yellow
    npx -y skills $args
} else {
    Write-Host "[INFO] Current Installed Global Skills:" -ForegroundColor Cyan
    npx -y skills ls -g
}
