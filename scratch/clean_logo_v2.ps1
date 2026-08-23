Add-Type -AssemblyName System.Drawing

$inputPath = "c:\Users\iyedo\Desktop\rakcha\public\logo.jpg"
$outputPath = "c:\Users\iyedo\Desktop\rakcha\public\logo.png"

$src = [System.Drawing.Bitmap]::FromFile($inputPath)
$w = $src.Width
$h = $src.Height

# High threshold to find exact outer bounds of emblem
$minX = $w; $maxX = 0; $minY = $h; $maxY = 0

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $p = $src.GetPixel($x, $y)
        $lum = [Math]::Max([int]$p.R, [Math]::Max([int]$p.G, [int]$p.B))
        if ($lum -gt 38) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$pad = 10
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropW = [Math]::Min($w - $cropX, ($maxX - $minX) + ($pad * 2))
$cropH = [Math]::Min($h - $cropY, ($maxY - $minY) + ($pad * 2))

$dest = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Thorough thresholding that cleans all inner cavities and exterior halos
$blackCutoff = 36
$solidThreshold = 80

for ($dy = 0; $dy -lt $cropH; $dy++) {
    $sy = $cropY + $dy
    for ($dx = 0; $dx -lt $cropW; $dx++) {
        $sx = $cropX + $dx
        $p = $src.GetPixel($sx, $sy)
        
        $r = [double]$p.R
        $g = [double]$p.G
        $b = [double]$p.B
        $maxVal = [Math]::Max($r, [Math]::Max($g, $b))
        
        # Calculate saturation and chrominance
        $minVal = [Math]::Min($r, [Math]::Min($g, $b))
        $chroma = $maxVal - $minVal
        
        # Background is near-black or dark desaturated compression noise
        if ($maxVal -le $blackCutoff -or ($maxVal -le 48 -and $chroma -le 8)) {
            # 100% transparent in all exterior areas AND interior holes
            $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($maxVal -ge $solidThreshold) {
            # Solid vibrant emblem
            $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(255, [int]$r, [int]$g, [int]$b))
        } else {
            # Smooth transition for anti-aliased contour
            $t = ($maxVal - $blackCutoff) / ($solidThreshold - $blackCutoff)
            $smoothT = $t * $t * (3.0 - 2.0 * $t)
            $alpha = [int](255 * $smoothT)
            
            if ($alpha -gt 15) {
                # De-fringe color normalization to eliminate dark shadows along edge
                $factor = 1.0 / [Math]::Max(0.35, $smoothT)
                $dr = [Math]::Min(255, [int]($r * $factor))
                $dg = [Math]::Min(255, [int]($g * $factor))
                $db = [Math]::Min(255, [int]($b * $factor))
                $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb($alpha, $dr, $dg, $db))
            } else {
                $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        }
    }
}

$dest.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dest.Dispose()
$src.Dispose()

Write-Host "Completely clean transparent emblem saved to $outputPath"
