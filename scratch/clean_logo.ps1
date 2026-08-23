Add-Type -AssemblyName System.Drawing

$inputPath = "c:\Users\iyedo\Desktop\rakcha\public\logo.jpg"
$outputPath = "c:\Users\iyedo\Desktop\rakcha\public\logo.png"

$src = [System.Drawing.Bitmap]::FromFile($inputPath)
$w = $src.Width
$h = $src.Height

# Bounding box calculation
$minX = $w; $maxX = 0; $minY = $h; $maxY = 0

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $p = $src.GetPixel($x, $y)
        $lum = [Math]::Max([int]$p.R, [Math]::Max([int]$p.G, [int]$p.B))
        if ($lum -gt 30) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

$pad = 12
$cropX = [Math]::Max(0, $minX - $pad)
$cropY = [Math]::Max(0, $minY - $pad)
$cropW = [Math]::Min($w - $cropX, ($maxX - $minX) + ($pad * 2))
$cropH = [Math]::Min($h - $cropY, ($maxY - $minY) + ($pad * 2))

$dest = New-Object System.Drawing.Bitmap($cropW, $cropH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Intelligent luminance keying + Color De-fringing
# Black cutoff removes JPEG compression noise completely
$blackCutoff = 22
$solidThreshold = 65

for ($dy = 0; $dy -lt $cropH; $dy++) {
    $sy = $cropY + $dy
    for ($dx = 0; $dx -lt $cropW; $dx++) {
        $sx = $cropX + $dx
        $p = $src.GetPixel($sx, $sy)
        
        $r = [double]$p.R
        $g = [double]$p.G
        $b = [double]$p.B
        $maxVal = [Math]::Max($r, [Math]::Max($g, $b))
        
        if ($maxVal -le $blackCutoff) {
            # Completely transparent
            $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        } elseif ($maxVal -ge $solidThreshold) {
            # Fully opaque foreground
            $dest.SetPixel($dx, $dy, [System.Drawing.Color]::FromArgb(255, [int]$r, [int]$g, [int]$b))
        } else {
            # Semi-transparent edge: calculate alpha smoothly
            $t = ($maxVal - $blackCutoff) / ($solidThreshold - $blackCutoff)
            # Apply smoothstep for natural edge roll-off
            $smoothT = $t * $t * (3.0 - 2.0 * $t)
            $alpha = [int](255 * $smoothT)
            
            if ($alpha -gt 0) {
                # De-fringe: unmultiply dark background tint to restore vibrant color saturation at the boundary
                $scale = 1.0 / [Math]::Max(0.25, $smoothT)
                $dr = [Math]::Min(255, [int]($r * $scale))
                $dg = [Math]::Min(255, [int]($g * $scale))
                $db = [Math]::Min(255, [int]($b * $scale))
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

Write-Host "Cleaned and defringed transparent logo generated at $outputPath"
