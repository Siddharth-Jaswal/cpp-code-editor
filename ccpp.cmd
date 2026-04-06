@echo off
setlocal
set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$root = [System.IO.Path]::GetFullPath('%ROOT%'); $node = (Get-Command node).Source; $script = [System.IO.Path]::Combine($root, 'scripts', 'dev-runner.js'); Start-Process -WindowStyle Hidden -FilePath $node -ArgumentList @($script) -WorkingDirectory $root"
endlocal
exit /b 0
