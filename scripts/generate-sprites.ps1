$API_KEY = "sc_live_a8d23676c6b0c7c5e00fa52806c3a899904406b4bcf807fc"
$BASE_URL = "https://api.spritecook.ai/v1/api/generate-sync"
$ANCHOR_ID = "4168326e-5fe6-46d1-b5ae-6625c4cc2399"
$OUT_DIR = "D:\Project\SecondMe\a2a-market-news\public\sprites\characters"
$RESULTS_FILE = "D:\Project\SecondMe\a2a-market-news\scripts\sprite-results.json"

$commonParams = @{
    width = 128
    height = 128
    pixel = $true
    bg_mode = "transparent"
    theme = "cyberpunk neon city at night, dark atmosphere, rain-slicked surfaces"
    style = "16-bit pixel art, clean outlines, vibrant neon glow accents"
    colors = @("#0a0a1a", "#1a1a2e", "#00d2ff", "#ffb020", "#a855f7")
    smart_crop = $true
    reference_asset_id = $ANCHOR_ID
}

$sprites = @(
    @{ name = "lingshu-talk"; prompt = "cute receptionist character with white rabbit ears, cyan uniform with neon trim, hand raised gesturing, mouth open, side view, single sprite" }
    @{ name = "lingshu-walk"; prompt = "cute receptionist character with white rabbit ears, cyan uniform with neon trim, mid-stride walking pose, side view, single sprite" }
    @{ name = "editor-idle"; prompt = "news editor character with brown fedora hat, amber gold vest, holding notepad, relaxed standing pose, side view, single sprite" }
    @{ name = "editor-talk"; prompt = "news editor character with brown fedora hat, amber gold vest, holding notepad, hand raised gesturing, mouth open, side view, single sprite" }
    @{ name = "editor-walk"; prompt = "news editor character with brown fedora hat, amber gold vest, holding notepad, mid-stride walking pose, side view, single sprite" }
    @{ name = "tech-idle"; prompt = "tech advisor character with purple-framed glasses, purple coat, holding data tablet, relaxed standing pose, side view, single sprite" }
    @{ name = "tech-talk"; prompt = "tech advisor character with purple-framed glasses, purple coat, holding data tablet, hand raised gesturing, mouth open, side view, single sprite" }
    @{ name = "tech-walk"; prompt = "tech advisor character with purple-framed glasses, purple coat, holding data tablet, mid-stride walking pose, side view, single sprite" }
    @{ name = "pa-idle"; prompt = "adventurer character with goggles on forehead, blue jacket, adventurer look, relaxed standing pose, side view, single sprite" }
    @{ name = "pa-talk"; prompt = "adventurer character with goggles on forehead, blue jacket, adventurer look, hand raised gesturing, mouth open, side view, single sprite" }
    @{ name = "pa-walk"; prompt = "adventurer character with goggles on forehead, blue jacket, adventurer look, mid-stride walking pose, side view, single sprite" }
)

$headers = @{
    Authorization = "Bearer $API_KEY"
    "Content-Type" = "application/json"
}

$allResults = @()
$totalSprites = $sprites.Count
$completed = 0

foreach ($sprite in $sprites) {
    $completed++
    Write-Host "[$completed/$totalSprites] Generating $($sprite.name)..." -ForegroundColor Cyan

    $body = $commonParams.Clone()
    $body.prompt = $sprite.prompt
    $jsonBody = $body | ConvertTo-Json -Depth 3

    try {
        $response = Invoke-RestMethod -Uri $BASE_URL -Method POST -Headers $headers -Body $jsonBody -TimeoutSec 120
        $asset = $response.assets[0]
        $pixelUrl = $asset._presigned_pixel_url
        if (-not $pixelUrl) { $pixelUrl = $asset._presigned_url }
        if (-not $pixelUrl) { $pixelUrl = $asset.pixel_url }

        $outPath = Join-Path $OUT_DIR "$($sprite.name).png"
        Write-Host "  Downloading to $outPath..." -ForegroundColor Green
        Invoke-WebRequest -Uri $pixelUrl -OutFile $outPath -TimeoutSec 30

        $fileSize = (Get-Item $outPath).Length
        Write-Host "  Done! ($fileSize bytes, credits remaining: $($response.credits_remaining))" -ForegroundColor Green

        $allResults += @{
            name = $sprite.name
            asset_id = $asset.id
            file = $outPath
            size = $fileSize
            credits_used = $response.credits_used
            credits_remaining = $response.credits_remaining
        }
    }
    catch {
        Write-Host "  FAILED: $($_.Exception.Message)" -ForegroundColor Red
        $allResults += @{
            name = $sprite.name
            error = $_.Exception.Message
        }
    }
}

$allResults | ConvertTo-Json -Depth 3 | Out-File $RESULTS_FILE -Encoding UTF8
Write-Host "`n=== Generation Complete ===" -ForegroundColor Yellow
Write-Host "Results saved to $RESULTS_FILE"
Write-Host "Successful: $(($allResults | Where-Object { -not $_.error }).Count) / $totalSprites"
