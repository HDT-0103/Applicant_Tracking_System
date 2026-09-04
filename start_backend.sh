$env:PYTHONPATH = "src;src/backend"

if (Test-Path ".env") {
    Get-Content .env | Where-Object { $_ -match '=' -and $_ -notmatch '^#' } | ForEach-Object {
        $name, $value = $_.Split('=', 2)
        [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
    }
}

& "src\backend\.venv\Scripts\python.exe" -m uvicorn apps.main:app --reload --host 0.0.0.0 --port 8000 --app-dir src/backend