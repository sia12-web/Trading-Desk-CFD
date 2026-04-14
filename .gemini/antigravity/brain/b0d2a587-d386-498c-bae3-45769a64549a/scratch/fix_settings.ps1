$file = "app\(dashboard)\settings\page.tsx"
$content = Get-Content $file
$newContent = $content | ForEach-Object {
    if ($_.StartsWith("+")) {
        $_.Substring(1)
    } elseif ($_.StartsWith("-")) {
        # Skip this line
    } else {
        $_
    }
}
$newContent | Set-Content $file
Write-Host "Cleanup complete."
