# ============================================================
#  vault.ps1  -  XOR Video Vault (ps2exe compatible)
#  Compile: ps2exe vault.ps1 vault.exe -title "XOR Video Vault"
# ============================================================

param(
    [string]$Password
)

$ErrorActionPreference = "Stop"

$procPath   = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
$procName   = [System.IO.Path]::GetFileName($procPath)
$psHosts    = 'powershell.exe', 'pwsh.exe', 'powershell_ise.exe'
$baseDir    = if ($psHosts -contains $procName) { $PSScriptRoot } else { Split-Path $procPath -Parent }
$metaFile   = Join-Path $baseDir "vault.meta"
$extensions = @(".mp4", ".mkv", ".avi", ".mov", ".wmv", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp", ".ts")
$maxTries   = 3

# ---- Inline C# for fast bulk XOR ---------------------------

try {
    Add-Type -TypeDefinition @"
using System;
using System.IO;

public static class FastXOR {
    public static void ProcessFile(string src, string dst, byte[] key) {
        int     kLen    = key.Length;
        int     bufSize = 1024 * 1024 * 16;
        byte[]  buf     = new byte[bufSize];
        long    kIndex  = 0;
        int     read;

        using (var reader = new FileStream(src, FileMode.Open,   FileAccess.Read,  FileShare.None, bufSize, FileOptions.SequentialScan))
        using (var writer = new FileStream(dst, FileMode.Create, FileAccess.Write, FileShare.None, bufSize)) {
            while ((read = reader.Read(buf, 0, bufSize)) > 0) {
                for (int i = 0; i < read; i++) {
                    buf[i] ^= key[(int)(kIndex % kLen)];
                    kIndex++;
                }
                writer.Write(buf, 0, read);
            }
        }
    }
}
"@ -Language CSharp
} catch {
    [Console]::Error.WriteLine("FATAL: Failed to load FastXOR module: $_")
    exit 1
}

# ---- Helpers -----------------------------------------------

function Get-SHA256([string]$text) {
    $sha   = [System.Security.Cryptography.SHA256]::Create()
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $hash  = $sha.ComputeHash($bytes)
    return ($hash | ForEach-Object { $_.ToString("x2") }) -join ""
}

function New-RandomName {
    $bytes = New-Object byte[] 8
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return (($bytes | ForEach-Object { $_.ToString("x2") }) -join "") + ".enc"
}

function Read-Password([string]$prompt) {
    $ss  = Read-Host -Prompt $prompt -AsSecureString
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
    try {
        return [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    } finally {
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Get-VerifiedPassword([string]$storedHash) {
    for ($try = 1; $try -le $maxTries; $try++) {
        $pass = Read-Password "Enter vault password"
        if ((Get-SHA256 $pass) -eq $storedHash) { return $pass }
        if ($try -lt $maxTries) {
            [Console]::Error.WriteLine("Wrong password. $($maxTries - $try) attempt(s) left.")
        }
    }
    [Console]::Error.WriteLine("Too many wrong attempts.")
    exit 1
}

function Get-VideoDuration([string]$filePath) {
    try {
        $duration = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $filePath 2>$null
        if ($duration) {
            $totalSec = [math]::Floor([double]$duration)
            $hours   = [math]::Floor($totalSec / 3600)
            $minutes = [math]::Floor(($totalSec % 3600) / 60)
            $seconds = $totalSec % 60
            if ($hours -gt 0) {
                return "$($hours):$($minutes.ToString('00')):$($seconds.ToString('00'))"
            }
            return "$($minutes):$($seconds.ToString('00'))"
        }
    } catch {}
    return $null
}

function Write-Done {
    [Console]::WriteLine("Done")
}

# ---- ENCRYPT -----------------------------------------------

function Start-Encrypt([string]$passHash, [string]$pass) {
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($pass)

    $allFiles = Get-ChildItem -Path $baseDir -File |
                Where-Object { $extensions -contains $_.Extension.ToLower() }

    if ($allFiles.Count -eq 0) {
        Write-Done
        exit 0
    }

    # Load existing manifest (any state — encrypted or decrypted)
    $manifest = [ordered]@{}
    if (Test-Path $metaFile) {
        try {
            $existing = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($existing.PSObject.Properties.Name -contains "files" -and $existing.files) {
                foreach ($prop in $existing.files.PSObject.Properties) {
                    $manifest[$prop.Name] = $prop.Value
                }
            }
        } catch {
            # corrupted meta — ignore
        }
    }

    # Filter: only files NOT already in manifest
    $toProcess = $allFiles | Where-Object {
        $fName = $_.Name
        $found = $false
        foreach ($entry in $manifest.Values) {
            $entryName = if ($entry -is [string]) { $entry } else { $entry.originalName }
            if ($entryName -eq $fName) { $found = $true; break }
        }
        -not $found
    }

    $total = $toProcess.Count
    if ($total -eq 0) {
        Write-Done
        exit 0
    }

    $done = 0

    foreach ($f in $toProcess) {
        $done++

        try {
            $newName = New-RandomName
            while (Test-Path (Join-Path $baseDir $newName)) { $newName = New-RandomName }
            $dst = Join-Path $baseDir $newName

            $duration = Get-VideoDuration $f.FullName

            [FastXOR]::ProcessFile($f.FullName, $dst, $keyBytes)
            Remove-Item $f.FullName -Force

            $entryObj = [ordered]@{ originalName = $f.Name }
            if ($duration) { $entryObj["duration"] = $duration }
            $manifest[$newName] = $entryObj

            $meta = [ordered]@{
                state         = "encrypted"
                password_hash = $passHash
                files         = $manifest
            }
            $meta | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $metaFile -Encoding UTF8

        } catch {
            [Console]::Error.WriteLine("Error encrypting $($f.Name): $_")
            exit 1
        }
    }

    Write-Done
}

# ---- DECRYPT -----------------------------------------------

function Start-Decrypt([object]$meta) {
    if ($Password) {
        $passHash = Get-SHA256 $Password
        if ($passHash -ne $meta.password_hash) {
            [Console]::Error.WriteLine("Wrong password.")
            exit 1
        }
        $pass = $Password
    } else {
        $pass = Get-VerifiedPassword $meta.password_hash
    }
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($pass)
    $manifest = $meta.files

    $toProcess = @($manifest.PSObject.Properties | Where-Object {
        Test-Path (Join-Path $baseDir $_.Name)
    })

    $total = $toProcess.Count
    if ($total -eq 0) {
        Write-Done
        exit 0
    }

    $done = 0

    foreach ($prop in $toProcess) {
        $done++

        $src = Join-Path $baseDir $prop.Name
        $origName = if ($prop.Value -is [string]) { $prop.Value } else { $prop.Value.originalName }
        $dst = Join-Path $baseDir $origName

        try {
            [FastXOR]::ProcessFile($src, $dst, $keyBytes)
            Remove-Item $src -Force
        } catch {
            [Console]::Error.WriteLine("Error decrypting $origName : $_")
            exit 1
        }
    }

    $meta.state = "decrypted"
    $meta.files = @{}
    $meta | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $metaFile -Encoding UTF8

    Write-Done
}

# ---- MAIN --------------------------------------------------

try {
    if (Test-Path $metaFile) {
        $meta = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json

        if ($meta.state -eq "encrypted") {
            # Check if there are unencrypted videos that need encrypting first
            $unencrypted = Get-ChildItem -Path $baseDir -File |
                           Where-Object { $extensions -contains $_.Extension.ToLower() }
            if ($unencrypted) {
                # Also do we have the password? Ask/verify
                if ($Password) {
                    $passHash = Get-SHA256 $Password
                    if ($passHash -ne $meta.password_hash) {
                        [Console]::Error.WriteLine("Wrong password.")
                        exit 1
                    }
                    Start-Encrypt $passHash $Password
                } else {
                    $pass = Get-VerifiedPassword $meta.password_hash
                    Start-Encrypt $meta.password_hash $pass
                }
            } else {
                Start-Decrypt $meta
            }
        } else {
            # state == "decrypted" — encrypt
            if ($Password) {
                $passHash = Get-SHA256 $Password
                if ($passHash -ne $meta.password_hash) {
                    [Console]::Error.WriteLine("Wrong password.")
                    exit 1
                }
                Start-Encrypt $passHash $Password
            } else {
                $pass = Get-VerifiedPassword $meta.password_hash
                Start-Encrypt $meta.password_hash $pass
            }
        }
    } else {
        # No meta — first run, create password
        if ($Password) {
            $passHash = Get-SHA256 $Password
            Start-Encrypt $passHash $Password
        } else {
            $pass1 = Read-Password "Create vault password"
            $pass2 = Read-Password "Confirm password"

            if ($pass1 -ne $pass2) {
                [Console]::Error.WriteLine("Passwords do not match.")
                exit 1
            }
            if ($pass1.Length -eq 0) {
                [Console]::Error.WriteLine("Password cannot be empty.")
                exit 1
            }

            Start-Encrypt (Get-SHA256 $pass1) $pass1
        }
    }
} catch {
    [Console]::Error.WriteLine("Error: $_")
    exit 1
}
