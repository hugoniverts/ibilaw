# =========================================================
# Serveur web local pour tester IBILAW sur cet ordinateur.
# Lancement : clic droit sur ce fichier > « Exécuter avec PowerShell »,
# puis ouvrir http://localhost:8123 dans le navigateur.
# Pour arrêter : fermer la fenêtre ou appuyer sur Ctrl+C.
# (Ne sert qu'aux tests sur le PC : le GPS d'un téléphone exige le site en ligne.)
# =========================================================

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$prefix = "http://localhost:8123/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
  ".svg"  = "image/svg+xml"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".ico"  = "image/x-icon"
  ".txt"  = "text/plain; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host ""
Write-Host "  IBILAW - serveur local demarre." -ForegroundColor Green
Write-Host "  Ouvrez : $prefix" -ForegroundColor Cyan
Write-Host "  (Ctrl+C pour arreter)" -ForegroundColor DarkGray
Write-Host ""

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response
    try {
      $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart("/"))
      if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
      $file = [System.IO.Path]::GetFullPath((Join-Path $root $path))

      # On ne sert que les fichiers du dossier de l'appli.
      if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path $file -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($file).ToLower()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] }
        $res.Headers.Add("Cache-Control", "no-store")
        $bytes = [System.IO.File]::ReadAllBytes($file)
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 - Fichier introuvable : $path")
        $res.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      $res.StatusCode = 500
    }
    $res.OutputStream.Close()
  }
}
finally {
  $listener.Stop()
}
