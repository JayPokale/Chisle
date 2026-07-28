# chisle — statusline badge for Claude Code (Windows / PowerShell)
# Mirrors chisle-statusline.sh. Reads the mode flag and savings suffix, renders an orange badge.

$ErrorActionPreference = 'SilentlyContinue'

$configDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }
$flag = Join-Path $configDir '.chisle-active'

if (-not (Test-Path -LiteralPath $flag -PathType Leaf)) { exit 0 }

# Refuse symlinks/reparse points — mirrors the .sh guard against pointing the
# flag at an arbitrary file and rendering its bytes every keystroke.
$item = Get-Item -LiteralPath $flag -Force
if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { exit 0 }

# Hard-cap at 64 chars, lowercase, strip anything outside [a-z0-9-].
# NB: -Raw and -TotalCount are mutually exclusive — cap the string instead.
$raw = Get-Content -LiteralPath $flag -Raw
if (-not $raw) { exit 0 }
$mode = $raw.Substring(0, [Math]::Min(64, $raw.Length)).ToLower()
$mode = ($mode -replace '[^a-z0-9-]', '')

switch ($mode) {
  'off' { }
  'on'  { }
  default { exit 0 }
}

$esc = [char]27
$orange = "$esc[38;5;172m"
$reset = "$esc[0m"

# Input-side savings from the tool-output compressor ledger (mirrors the sh version).
$suffix = ''
$stats = Join-Path $configDir '.chisle-compress-stats.json'
$sitem = if (Test-Path -LiteralPath $stats -PathType Leaf) { Get-Item -LiteralPath $stats -Force } else { $null }
if ($sitem -and -not ($sitem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
  $raw = Get-Content -LiteralPath $stats -Raw
  if ($raw -match '"savedChars":(\d+)') {
    $tok = [long]$Matches[1] / 4
    if ($tok -ge 1000000)   { $suffix = " $([math]::Floor($tok / 1000000))M tok" }
    elseif ($tok -ge 1000)  { $suffix = " $([math]::Floor($tok / 1000))k tok" }
    elseif ($tok -gt 0)     { $suffix = " $([math]::Floor($tok)) tok" }
    if ($suffix) { $suffix = " $([char]0x21E3)$($suffix.Trim())" }
  }
}

# One mode, one badge.
Write-Host -NoNewline "$orange[CHISLE]$reset$suffix"
