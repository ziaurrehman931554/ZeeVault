# ============================================================
#  ZeeVault.ps1  -  Multi-Media XOR Vault Encryptor (v2)
#  Compile: ps2exe ZeeVault.ps1 ZeeVault.exe -title "ZeeVault"
# ============================================================

param(
    [string]$Password
)

# Electron passes the password through the child process environment so it does
# not appear in the PowerShell command line. Standalone use remains unchanged.
if (-not $Password -and $env:ZEEVAULT_PASSWORD) { $Password = $env:ZEEVAULT_PASSWORD }

$ErrorActionPreference = "Stop"

$procPath   = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
$procName   = [System.IO.Path]::GetFileName($procPath)
$psHosts    = 'powershell.exe', 'pwsh.exe', 'powershell_ise.exe'
$baseDir    = if ($psHosts -contains $procName) { $PSScriptRoot } else { Split-Path $procPath -Parent }
$metaFile   = Join-Path $baseDir "vault.meta"
$videoExts  = @(".mp4", ".mkv", ".avi", ".mov", ".wmv", ".m4v", ".mpeg", ".mpg", ".ogv", ".3gp", ".flv", ".ts")
$imageExts  = @(".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".tif", ".webp")
$allExts    = $videoExts + $imageExts

# ---- Load C# FastXOR module (compile if needed) ----

if (-not ([System.Management.Automation.PSTypeName]'FastXOR').Type) {
    $csc        = "C:\WINDOWS\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    $csId       = [System.IO.Path]::GetRandomFileName() -replace '\.'
    $csSrc      = Join-Path $env:TEMP "ZeeVault_FastXOR_$csId.cs"
    $csDll      = Join-Path $env:TEMP "ZeeVault_FastXOR_$csId.dll"
    $csCode     = @"
using System;
using System.IO;
public static class FastXOR {
    public static void ProcessFile(string src, string dst, byte[] key) {
        int kLen = key.Length, bufSize = 1024 * 1024 * 16;
        byte[] buf = new byte[bufSize]; long kIndex = 0; int read;
        using (var r = new FileStream(src, FileMode.Open, FileAccess.Read, FileShare.None, bufSize, FileOptions.SequentialScan))
        using (var w = new FileStream(dst, FileMode.Create, FileAccess.Write, FileShare.None, bufSize))
            while ((read = r.Read(buf, 0, bufSize)) > 0) {
                for (int i = 0; i < read; i++) { buf[i] ^= key[(int)(kIndex % kLen)]; kIndex++; }
                w.Write(buf, 0, read);
            }
    }
    public static byte[] EncryptBytes(byte[] data, byte[] key) {
        byte[] r = new byte[data.Length]; int k = key.Length;
        for (int i = 0; i < data.Length; i++) r[i] = (byte)(data[i] ^ key[i % k]);
        return r;
    }
    public static byte[] DecryptBytes(byte[] data, byte[] key) { return EncryptBytes(data, key); }
}
"@
    try {
        Set-Content -Path $csSrc -Value $csCode -Encoding UTF8
        & $csc /target:library /out:$csDll $csSrc 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "csc exited with code $LASTEXITCODE" }
        Add-Type -Path $csDll
        Remove-Item $csSrc -Force -ErrorAction SilentlyContinue
    } catch { exit 1 }
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

function Get-VideoDuration([string]$filePath) {
    try {
        $oldEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        $duration = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $filePath 2>$null
        $ErrorActionPreference = $oldEAP
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

function Get-VideoDimensions([string]$filePath) {
    try {
        $oldEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
        $info = & ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=,:p=0 $filePath 2>$null
        $ErrorActionPreference = $oldEAP
        if ($info) {
            $parts = $info -split ','
            if ($parts.Count -ge 2) {
                return @{ Width = [int]$parts[0]; Height = [int]$parts[1] }
            }
        }
    } catch {}
    return $null
}

function Get-ImageDimensions([string]$filePath) {
    try {
        $img = [System.Drawing.Image]::FromFile($filePath)
        $result = @{ Width = $img.Width; Height = $img.Height }
        $img.Dispose()
        return $result
    } catch {
        try { if ($img) { $img.Dispose() } } catch {}
        return $null
    }
}

function Get-ImageThumbnail([string]$filePath, [int]$maxDim = 480) {
    try {
        $img = [System.Drawing.Image]::FromFile($filePath)
        $w = $img.Width; $h = $img.Height
        if ($w -gt $maxDim -or $h -gt $maxDim) {
            $ratio = [Math]::Min([double]$maxDim / $w, [double]$maxDim / $h)
            $w = [int]($w * $ratio); $h = [int]($h * $ratio)
        }
        $thumb = New-Object System.Drawing.Bitmap($w, $h)
        $g = [System.Drawing.Graphics]::FromImage($thumb)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawImage($img, 0, 0, $w, $h)
        $g.Dispose()
        $ms = New-Object System.IO.MemoryStream
        $thumb.Save($ms, [System.Drawing.Imaging.ImageFormat]::Jpeg)
        $bytes = $ms.ToArray()
        $ms.Dispose(); $thumb.Dispose(); $img.Dispose()
        return $bytes
    } catch {
        try { if ($ms) { $ms.Dispose() } } catch {}
        try { if ($thumb) { $thumb.Dispose() } } catch {}
        try { if ($g) { $g.Dispose() } } catch {}
        try { if ($img) { $img.Dispose() } } catch {}
        return $null
    }
}

function Get-VideoThumbnail([string]$filePath) {
    $thumbFile = Join-Path $env:TEMP "$([System.IO.Path]::GetRandomFileName()).jpg"
    $oldEAP = $ErrorActionPreference; $ErrorActionPreference = "Continue"
    & ffmpeg -i $filePath -ss 00:00:03 -vframes 1 -q:v 5 -y $thumbFile 2>$null
    $ErrorActionPreference = $oldEAP
    if (Test-Path $thumbFile) {
        $bytes = [System.IO.File]::ReadAllBytes($thumbFile)
        Remove-Item $thumbFile -Force
        if ($bytes.Length -gt 0) { return $bytes }
    }
    if (Test-Path $thumbFile) { Remove-Item $thumbFile -Force -ErrorAction SilentlyContinue }
    return $null
}

function ConvertTo-Base64([byte[]]$bytes) {
    return [System.Convert]::ToBase64String($bytes)
}

# ---- ENCRYPT -----------------------------------------------

function Start-Encrypt([string]$passHash, [string]$pass) {
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($pass)

    $allFiles = Get-ChildItem -Path $baseDir -File |
                Where-Object { $allExts -contains $_.Extension.ToLower() }

    if ($allFiles.Count -eq 0) { exit 0 }

    $manifest = [ordered]@{}
    if (Test-Path $metaFile) {
        try {
            $existing = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($existing.PSObject.Properties.Name -contains "files" -and $existing.files) {
                foreach ($prop in $existing.files.PSObject.Properties) {
                    $manifest[$prop.Name] = $prop.Value
                }
            }
        } catch {}
    }

    $toProcess = $allFiles | Where-Object {
        $fName = $_.Name
        $found = $false
        foreach ($entry in $manifest.Values) {
            $entryName = if ($entry -is [string]) { $entry } else { $entry.originalName }
            if ($entryName -eq $fName) { $found = $true; break }
        }
        -not $found
    }

    if (@($toProcess).Count -eq 0) { exit 0 }

    $isImageExt = @{}
    foreach ($ext in $imageExts) { $isImageExt[$ext] = $true }

    foreach ($f in $toProcess) {
        $extLower = $f.Extension.ToLower()
        $isImage = $isImageExt.ContainsKey($extLower)

        try {
            $newName = New-RandomName
            while (Test-Path (Join-Path $baseDir $newName)) { $newName = New-RandomName }
            $dst = Join-Path $baseDir $newName

            $duration = if ($isImage) { $null } else { Get-VideoDuration $f.FullName }
            $dimensions = if ($isImage) { Get-ImageDimensions $f.FullName } else { Get-VideoDimensions $f.FullName }

            # Generate thumbnail from original BEFORE encrypting
            $thumbBytes = if ($isImage) {
                Get-ImageThumbnail $f.FullName 480
            } else {
                Get-VideoThumbnail $f.FullName
            }

            [FastXOR]::ProcessFile($f.FullName, $dst, $keyBytes)
            Remove-Item $f.FullName -Force

            $entryObj = [ordered]@{
                originalName = $f.Name
                extension    = $f.Extension.Replace('.', '').ToLower()
                dateAdded    = $f.CreationTimeUtc.ToString('o')
                dateModified = $f.LastWriteTimeUtc.ToString('o')
                fileSize     = $f.Length
            }

            if ($duration) { $entryObj["duration"] = $duration }
            if ($dimensions) {
                $entryObj["width"]  = $dimensions.Width
                $entryObj["height"] = $dimensions.Height
            }
            if ($thumbBytes -and $thumbBytes.Length -gt 0) {
                $encryptedThumb = [FastXOR]::EncryptBytes($thumbBytes, $keyBytes)
                $entryObj["thumbnail"] = ConvertTo-Base64 $encryptedThumb
            }

            $manifest[$newName] = $entryObj

            $meta = [ordered]@{
                state         = "encrypted"
                password_hash = $passHash
                version       = 2
                files         = $manifest
            }
            $meta | ConvertTo-Json -Depth 10 -Compress | Set-Content -Path $metaFile -Encoding UTF8

        } catch { exit 1 }
    }
}

# ---- DECRYPT -----------------------------------------------

function Start-Decrypt([object]$meta, [string]$pass) {
    if (-not $pass) { exit 1 }
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($pass)
    $manifest = $meta.files

    $toProcess = @($manifest.PSObject.Properties | Where-Object {
        Test-Path (Join-Path $baseDir $_.Name)
    })
    if ($toProcess.Count -eq 0) { exit 0 }

    foreach ($prop in $toProcess) {
        $src = Join-Path $baseDir $prop.Name
        $origName = if ($prop.Value -is [string]) { $prop.Value } else { $prop.Value.originalName }
        $dst = Join-Path $baseDir $origName
        try {
            [FastXOR]::ProcessFile($src, $dst, $keyBytes)
            Remove-Item $src -Force
        } catch { exit 1 }
    }

    $meta.state = "decrypted"
    $meta.files = @{}
    $meta | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $metaFile -Encoding UTF8
}

# ---- RE-ENCRYPT (update thumbnails/metadata for existing vault) ----

function Start-ReEncrypt([string]$passHash, [string]$pass) {
    $keyBytes = [System.Text.Encoding]::UTF8.GetBytes($pass)
    $meta = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $manifest = $meta.files
    $updatedManifest = [ordered]@{}
    $isImageExt = @{}
    foreach ($ext in $imageExts) { $isImageExt[$ext] = $true }

    foreach ($prop in $manifest.PSObject.Properties) {
        $encFile = Join-Path $baseDir $prop.Name
        if (-not (Test-Path $encFile)) { continue }
        $entry = $prop.Value
        $origName = if ($entry -is [string]) { $entry } else { $entry.originalName }
        $ext = [System.IO.Path]::GetExtension($origName).ToLower()
        $isImage = $isImageExt.ContainsKey($ext)

        # Decrypt to temp to get thumbnail
        $tmpFile = Join-Path $baseDir "._tmp_$($prop.Name)"
        try {
            [FastXOR]::ProcessFile($encFile, $tmpFile, $keyBytes)

            $thumbBytes = if ($isImage) {
                Get-ImageThumbnail $tmpFile 480
            } else {
                Get-VideoThumbnail $tmpFile
            }

            Remove-Item $tmpFile -Force

            $entryObj = [ordered]@{}
            $entryObj["originalName"] = $origName
            $entryObj["extension"]    = $ext.Replace('.', '')
            $entryObj["dateAdded"]    = if ($entry.dateAdded) { $entry.dateAdded } else { (Get-Item $encFile).CreationTimeUtc.ToString('o') }
            $entryObj["dateModified"] = if ($entry.dateModified) { $entry.dateModified } else { (Get-Item $encFile).LastWriteTimeUtc.ToString('o') }
            $entryObj["fileSize"]     = if ($entry.fileSize) { $entry.fileSize } else { (Get-Item $encFile).Length }
            if ($entry.duration) { $entryObj["duration"] = $entry.duration }
            if ($entry.width)   { $entryObj["width"]   = $entry.width }
            if ($entry.height)  { $entryObj["height"]  = $entry.height }

            if ($thumbBytes -and $thumbBytes.Length -gt 0) {
                $encryptedThumb = [FastXOR]::EncryptBytes($thumbBytes, $keyBytes)
                $entryObj["thumbnail"] = ConvertTo-Base64 $encryptedThumb
            }

            $updatedManifest[$prop.Name] = $entryObj
        } catch {
            $updatedManifest[$prop.Name] = $entry
            if (Test-Path $tmpFile) { Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue }
        }
    }

    $meta = [ordered]@{
        state         = "encrypted"
        password_hash = $passHash
        version       = 2
        files         = $updatedManifest
    }
    $meta | ConvertTo-Json -Depth 10 -Compress | Set-Content -Path $metaFile -Encoding UTF8
}

# ---- MAIN --------------------------------------------------

function Resolve-Password([string]$storedHash) {
    if ($Password) {
        $passHash = Get-SHA256 $Password
        if ($passHash -eq $storedHash) { return $Password }
        return $null
    }
    for ($try = 0; $try -lt 3; $try++) {
        $ss = Read-Host "Enter vault password" -AsSecureString
        $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
        $pass = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
        [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
        if ((Get-SHA256 $pass) -eq $storedHash) { return $pass }
    }
    return $null
}

try {
    if (Test-Path $metaFile) {
        $meta = Get-Content $metaFile -Raw -Encoding UTF8 | ConvertFrom-Json

        if ($meta.state -eq "encrypted") {
            $unencrypted = Get-ChildItem -Path $baseDir -File |
                           Where-Object { $allExts -contains $_.Extension.ToLower() }
            if ($unencrypted) {
                $pass = Resolve-Password $meta.password_hash
                if (-not $pass) { exit 1 }
                Start-Encrypt (Get-SHA256 $pass) $pass
            } else {
                $pass = Resolve-Password $meta.password_hash
                if (-not $pass) { exit 1 }
                Start-Decrypt $meta $pass
            }
        } else {
            # state == "decrypted" — encrypt
            $pass = Resolve-Password $meta.password_hash
            if (-not $pass) { exit 1 }
            Start-Encrypt (Get-SHA256 $pass) $pass
        }
    } else {
        # No meta — first run, prompt for password
        if (-not $Password) {
            $ss = Read-Host "No vault found. Enter a NEW password to create vault" -AsSecureString
            $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
            [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
            if (-not $Password) { Write-Host "No password entered. Aborting." -ForegroundColor Red; exit 1 }
        }
        $passHash = Get-SHA256 $Password
        Start-Encrypt $passHash $Password
    }
} catch { exit 1 }
