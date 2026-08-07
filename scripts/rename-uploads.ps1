# Rename random image filenames to product-based names and update all product markdown references
param([switch]$DryRun)

$uploadsDir = "C:\Users\info\Documents\GitHub\yspcollective\images\uploads"
$productsDir = "C:\Users\info\Documents\GitHub\yspcollective\src\_products"

# Map: old filename => new filename
$renames = @{
    # Lattafa Badee al Oud for Glory
    "1-96.jpeg"   = "lattafa-badee-al-oud-glory-1.jpeg"
    "2-96.jpeg"   = "lattafa-badee-al-oud-glory-2.jpeg"
    "3-96.jpeg"   = "lattafa-badee-al-oud-glory-3.jpeg"

    # Lattafa Qaed al Fursan
    "1-102.jpeg"  = "lattafa-qaed-al-fursan-1.jpeg"

    # Creed Bois du Portugal
    "1110030-100ml-millesime-bois-du-portugal.png" = "creed-bois-du-portugal-1.png"
    "1110030-2.png"                                = "creed-bois-du-portugal-2.png"
    "1110030-3.png"                                = "creed-bois-du-portugal-3.png"

    # Creed Viking
    "1110042_1.png"  = "creed-viking-1.png"
    "1110096.png"    = "creed-viking-2.png"
    "1110096-2.png"  = "creed-viking-3.png"

    # Creed Aventus
    "12852836-4705318355680121.webp"   = "creed-aventus-1.webp"
    "12852836-3425241119242413.webp"   = "creed-aventus-2.webp"
    "12852836-1455241119297013.webp"   = "creed-aventus-3.webp"

    # Armaf Odyssey Mandarin Sky
    "4769_1.webp" = "armaf-odyssey-mandarin-sky-1.webp"
    "4769_2.webp" = "armaf-odyssey-mandarin-sky-2.webp"

    # Paris Corner Coconut Lagoon
    "375x500.101955.jpeg" = "paris-corner-coconut-lagoon-1.jpeg"

    # YSL Black Opium
    "70452-media_swatch.jpeg" = "ysl-black-opium-1.jpeg"
    "23512-media_1.jpeg"      = "ysl-black-opium-2.jpeg"
    "23512-media_3.jpeg"      = "ysl-black-opium-3.jpeg"

    # Roja Parfums Danger
    "dangeredppourhommefront-_1.png" = "roja-parfums-danger-1.png"
    "5056663802265-2.png"            = "roja-parfums-danger-2.png"

    # Rasasi Hawas Eclat
    "ed50f04b3598c40c1912a86c3b86598c0y.png_.webp" = "rasasi-hawas-eclat-1.webp"

    # Al Haramain Amber Oud Dubai Night
    "ahp1485_with_box.jpeg"  = "al-haramain-amber-oud-dubai-night-1.jpeg"
    "ahp1485_.jpeg"          = "al-haramain-amber-oud-dubai-night-2.jpeg"
    "ahp1485_pyramid.jpeg"   = "al-haramain-amber-oud-dubai-night-pyramid.jpeg"
    "ahp1485_solo_2.jpeg"    = "al-haramain-amber-oud-dubai-night-3.jpeg"

    # Swiss Arabian Soul of Bali
    "soul-of-bali-pack-shot_e6a61c85-369f-413b-8781-24b2b2e6ea33.png" = "swiss-arabian-soul-of-bali-1.png"
    "b0f8v55pxx.pt01.jpeg"                                             = "swiss-arabian-soul-of-bali-2.jpeg"
    "b0f8v55pxx.pt02.jpeg"                                             = "swiss-arabian-soul-of-bali-3.jpeg"
    "b0f8v55pxx.pt03.jpeg"                                             = "swiss-arabian-soul-of-bali-4.jpeg"
    "b0f8v55pxx.pt04.jpeg"                                             = "swiss-arabian-soul-of-bali-5.jpeg"
    "b0f8v55pxx.pt05.jpeg"                                             = "swiss-arabian-soul-of-bali-6.jpeg"

    # Swiss Arabian Enigma of Taif
    "sap_cities-enigma-of-taif-box_1_jpg_e269beec-901a-49f4-ae86-76ae93c08257.jpeg" = "swiss-arabian-enigma-of-taif-1.jpeg"
    "eot-02_f756c14f-b476-4ec2-8205-92cc9b485379.jpeg"                              = "swiss-arabian-enigma-of-taif-2.jpeg"
    "eot-box-front_1c63ab56-7210-41aa-a134-17edb6bdc0dc.png"                        = "swiss-arabian-enigma-of-taif-box.png"
    "whatsapp_image_2025-10-29_at_6.41.04_pm_1.jpeg"                                = "swiss-arabian-enigma-of-taif-3.jpeg"
    "whatsapp_image_2025-10-29_at_6.41.06_pm.jpeg"                                  = "swiss-arabian-enigma-of-taif-4.jpeg"
    "whatsapp_image_2025-11-13_at_9.09.08_am.jpeg"                                  = "swiss-arabian-enigma-of-taif-5.jpeg"
    "whatsapp_image_2025-11-13_at_9.09.09_am_1.jpeg"                                = "swiss-arabian-enigma-of-taif-6.jpeg"
}

# Step 1: Rename files
Write-Host "`n=== Renaming files ===" -ForegroundColor Cyan
foreach ($old in $renames.Keys) {
    $newName = $renames[$old]
    $oldPath = Join-Path $uploadsDir $old
    $newPath = Join-Path $uploadsDir $newName

    if (-not (Test-Path $oldPath)) {
        Write-Host "  SKIP (not found): $old" -ForegroundColor Yellow
        continue
    }
    if (Test-Path $newPath) {
        Write-Host "  SKIP (target exists): $old => $newName" -ForegroundColor Yellow
        continue
    }
    if ($DryRun) {
        Write-Host "  [DRY RUN] $old => $newName"
    } else {
        Rename-Item -Path $oldPath -NewName $newName
        Write-Host "  Renamed: $old => $newName" -ForegroundColor Green
    }
}

# Step 2: Update product markdown files
Write-Host "`n=== Updating product markdown files ===" -ForegroundColor Cyan
$mdFiles = Get-ChildItem -Path $productsDir -Recurse -Filter "*.md"

foreach ($mdFile in $mdFiles) {
    $content = Get-Content $mdFile.FullName -Raw
    $original = $content
    $changed = $false

    foreach ($old in $renames.Keys) {
        $newName = $renames[$old]
        if ($content -match [regex]::Escape($old)) {
            $content = $content -replace [regex]::Escape($old), $newName
            $changed = $true
            Write-Host "  Updated [$($mdFile.Name)]: $old => $newName" -ForegroundColor Green
        }
    }

    if ($changed -and -not $DryRun) {
        Set-Content -Path $mdFile.FullName -Value $content -NoNewline
    }
}

Write-Host "`nDone." -ForegroundColor Cyan
if ($DryRun) { Write-Host "(Dry run - no files changed)" -ForegroundColor Yellow }
