# Pre-commit workflow gate (deterministic).
# Fires as a PreToolUse hook on Bash. Only acts when the command is a `git commit`
# targeting the expense-manager repo. Runs backend `tsc --noEmit`; blocks the
# commit if it fails. Allows otherwise. No transcript reading, no LLM.
#
# NOTE: this enforces TypeScript compilation only. The code-review skill and the
# test suite cannot be verified by a shell hook (code-review is an agent action;
# tests are too slow to run on every commit) — those remain reminders via the
# PostToolUse gate, not hard blocks.

$ErrorActionPreference = 'SilentlyContinue'

$raw = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }
try { $data = $raw | ConvertFrom-Json } catch { exit 0 }

$cmd = [string]$data.tool_input.command
if ([string]::IsNullOrWhiteSpace($cmd)) { exit 0 }

# Only gate actual commits
if ($cmd -notmatch 'git\s+commit') { exit 0 }

$expmgr = 'C:\nd\repos\expense-manager'

# Work out which repo the commit targets: honour a leading `cd <path>` in the
# command, otherwise fall back to the session cwd.
$targetDir = [string]$data.cwd
$m = [regex]::Match($cmd, 'cd\s+"?([^"&|;]+)"?')
if ($m.Success) { $targetDir = $m.Groups[1].Value.Trim() }

$root = & git -C "$targetDir" rev-parse --show-toplevel 2>$null
if (-not $root) { exit 0 }
$rootNorm = (($root | Select-Object -First 1) -replace '/', '\').TrimEnd('\')

# Only enforce for the expense-manager repo; every other repo commits freely.
if ($rootNorm -ne $expmgr) { exit 0 }

# Run the deterministic check: backend TypeScript compilation.
# Call the local tsc compiler directly via node — `npx tsc` fails to resolve
# under the nvm4w setup when invoked from the hook's non-profile child shell.
$tscBin = "$expmgr\backend\node_modules\typescript\bin\tsc"
if (-not (Test-Path $tscBin)) { exit 0 }  # fail open if tooling missing (don't block on infra issues)

Push-Location "$expmgr\backend"
$tscOut = & node $tscBin --noEmit 2>&1
$code = $LASTEXITCODE
Pop-Location

if ($code -ne 0) {
    $reason = "Pre-commit gate: backend TypeScript check (tsc --noEmit) FAILED. Fix these errors before committing:`n`n" + (($tscOut | Out-String).Trim())
    $out = @{
        hookSpecificOutput = @{
            hookEventName            = 'PreToolUse'
            permissionDecision       = 'deny'
            permissionDecisionReason = $reason
        }
    } | ConvertTo-Json -Compress -Depth 6
    [Console]::Out.Write($out)
    exit 0
}

exit 0
