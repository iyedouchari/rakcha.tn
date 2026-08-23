Add-Type -AssemblyName System.Drawing

$inputPath = "c:\Users\iyedo\Desktop\rakcha\public\logo.jpg"
$outputPath = "c:\Users\iyedo\Desktop\rakcha\public\logo.png"

$src = [System.Drawing.Bitmap]::FromFile($inputPath)
$w = $src.Width
$h = $src.Height

$minX = $w
$maxX = 0
$minY = $h
$maxY = 0

# Threshold to detect emblem vs pure black background
$bgThreshold = 25

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $src.GetPixel($x, $y)
        $maxVal = [Math]::Max([int]$c.R, [Math]::Max([int]$c.G, [int]$c.B))
        if ($maxVal -gt $bgThreshold) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Found logo bounding box: X=[$minX, $maxX], Y=[$minY, $maxY]"

# Add small padding around the logo emblem
$pad = 20
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropW = [Math]::Min($w - $cropX, ($maxX - $minX) + ($pad * 2))
$cropH = [Math]::Min($h - $cropY, ($maxY - $minY) + ($pad * 2))

Write-Host "Crop dimensions: Width=$cropW, Height=$cropH"

$dest = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Soft alpha threshold ramp for smooth anti-aliased edge removal
$blackCutoff = 15
$rampEnd = 45

for ($dy = 0; $dy -lt $cropH; $dy++) {
    $sy = $cropY + $dy
    for ($dx = 0; $dx -lt $cropW; $dx++) {
        $sx = $cropX + $dx
        $pixel = $src.GetPixel($sx, $sy)
        
        $r = [int]$pixel.R
        $g = [int]$pixel.G
        $b = [int]$pixel.B
        $maxVal = [Math]::Max($r, [Math]::Max($g, $b))
        
        if ($maxVal -le $blackCutoff) {
            # Fully transparent background
            $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($maxVal -lt $rampEnd) {
            # Anti-aliased soft edge transition
            $alpha = [int](255 * (($maxVal - $blackCutoff) / ($rampEnd - $blackCutoff)))
            $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb($alpha, $r, $g, $b))
        } else {
            # Opaque emblem foreground
            $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(255, $r, $g, $b))
        }
    }
}

$dest.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dest.Dispose()
$src.Dispose()

Write-Host "Successfully generated transparent logo at $outputPath"
