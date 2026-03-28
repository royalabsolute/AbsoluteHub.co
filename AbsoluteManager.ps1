# Absolute Console Hub v2.6 - Iron Stability Edition
# Este script está blindado contra errores de scoping y excepciones de UI.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$script:processes = @{}
$script:logFile = "c:\xampp\htdocs\Absolute\hub_debug.log"

function Write-HubDebug($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    "[$ts] $msg" | Out-File $script:logFile -Append
}

Write-HubDebug "--- Invocación del Hub v2.6 ---"

try {
    # 1. Ventana Principal
    $mainForm = New-Object System.Windows.Forms.Form
    $mainForm.Text = "Absolute Hub PRO v2.6"
    $mainForm.Size = New-Object System.Drawing.Size(1000, 700)
    $mainForm.StartPosition = "CenterScreen"
    $mainForm.BackColor = [System.Drawing.Color]::FromArgb(25, 25, 25)
    $mainForm.ForeColor = [System.Drawing.Color]::White

    # 2. Header
    $header = New-Object System.Windows.Forms.Panel
    $header.Dock = "Top"
    $header.Height = 50
    $header.BackColor = [System.Drawing.Color]::FromArgb(45, 45, 48)
    $mainForm.Controls.Add($header)

    $btnStart = New-Object System.Windows.Forms.Button
    $btnStart.Text = "START SYSTEM"
    $btnStart.Location = New-Object System.Drawing.Point(10, 10)
    $btnStart.Size = New-Object System.Drawing.Size(120, 30)
    $btnStart.BackColor = [System.Drawing.Color]::FromArgb(0, 122, 204)
    $btnStart.FlatStyle = "Flat"
    $header.Controls.Add($btnStart)

    $btnStop = New-Object System.Windows.Forms.Button
    $btnStop.Text = "STOP SYSTEM"
    $btnStop.Location = New-Object System.Drawing.Point(140, 10)
    $btnStop.Size = New-Object System.Drawing.Size(120, 30)
    $btnStop.BackColor = [System.Drawing.Color]::FromArgb(161, 38, 13)
    $btnStop.FlatStyle = "Flat"
    $header.Controls.Add($btnStop)

    $lblStatus = New-Object System.Windows.Forms.Label
    $lblStatus.Text = "System Idle"
    $lblStatus.Location = New-Object System.Drawing.Point(280, 18)
    $lblStatus.AutoSize = $true
    $header.Controls.Add($lblStatus)

    # 3. Tabs
    $tabs = New-Object System.Windows.Forms.TabControl
    $tabs.Dock = "Fill"
    $mainForm.Controls.Add($tabs)

    function New-Tab($name) {
        $tp = New-Object System.Windows.Forms.TabPage
        $tp.Text = $name
        $tp.BackColor = [System.Drawing.Color]::Black
        $box = New-Object System.Windows.Forms.TextBox
        $box.Multiline = $true; $box.Dock = "Fill"; $box.ReadOnly = $true
        $box.BackColor = [System.Drawing.Color]::Black
        $box.ForeColor = [System.Drawing.Color]::White
        $box.Font = New-Object System.Drawing.Font("Consolas", 9)
        $box.ScrollBars = "Both"
        $tp.Controls.Add($box)
        $tabs.TabPages.Add($tp)
        return $box
    }

    $script:logBE = New-Tab "CORE BACKEND"
    $script:logAI = New-Tab "AI WORKER"
    $script:logTUN = New-Tab "TUNNELS"
    $script:logFE = New-Tab "FRONTEND"

    # 4. Funciones de Control
    function Log($box, $txt) {
        if ($txt -and $mainForm.Visible) {
            $mainForm.Invoke([Action] {
                    $box.AppendText("$txt`r`n")
                    if ($box.Text.Length -gt 10000) { $box.Text = $box.Text.Substring(5000) } # Limitar memoria
                    $box.SelectionStart = $box.Text.Length
                    $box.ScrollToCaret()
                })
        }
    }

    function Get-FreePort($s) {
        $p = $s; while ($true) {
            try { $t = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p); $t.Start(); $t.Stop(); return $p } catch { $p++ }
        }
    }

    function Sync-Angular($port) {
        $paths = @(
            "c:\xampp\htdocs\Absolute\ABSOLUTE PLANTILLA\src\app\theme\shared\service\mc-server.service.ts",
            "c:\xampp\htdocs\Absolute\ABSOLUTE PLANTILLA\src\app\theme\shared\service\music-studio.service.ts"
        )
        foreach ($p in $paths) {
            if (Test-Path $p) {
                try {
                    $c = [System.IO.File]::ReadAllText($p)
                    # Sincronizamos solo el puerto local, el host se detecta dinámicamente
                    $c = $c -replace ":(\d+)([`'])\s+// LOCAL_PORT_MARKER", ":$port$2 // LOCAL_PORT_MARKER"
                    [System.IO.File]::WriteAllText($p, $c)
                    Log $script:logBE "[SYNC] Puerto $port actualizado en $p"
                }
                catch { Log $script:logBE "[SYNC ERROR] $p" }
            }
        }
    }

    function Run-Proc($id, $cmd, $args, $dir, $box, $port) {
        Log $box ">> Lanzando $id..."
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = $cmd; $psi.Arguments = $args; $psi.WorkingDirectory = $dir
        $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true

        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $psi
        $p.EnableRaisingEvents = $true

        # Captura de variables para el closure
        $targetBox = $box; $targetId = $id; $targetPort = $port
        
        $outputHandler = {
            param($s, $e)
            if ($e.Data) {
                Log $targetBox "[$targetId] $($e.Data)"
            }
        }.GetNewClosure()

        $p.add_OutputDataReceived($outputHandler)
        $p.add_ErrorDataReceived($outputHandler)

        if ($p.Start()) {
            $p.BeginOutputReadLine(); $p.BeginErrorReadLine()
            $script:processes[$id] = $p
            Write-HubDebug "Success: $id ($($p.Id))"
            return $true
        }
        return $false
    }

    $btnStart.Add_Click({
            $lblStatus.Text = "Port scanning..."
            $beP = Get-FreePort 3000; $feP = Get-FreePort 4200
            $lblStatus.Text = "Running Startup..."
            $base = "c:\xampp\htdocs\Absolute"

            # Env
            if (Test-Path "$base\backend\.env") {
                (Get-Content "$base\backend\.env") -replace "PORT=\d+", "PORT=$beP" | Set-Content "$base\backend\.env"
            }

            # Spawn
            [void](Run-Proc "BACKEND" "node" "index.js" "$base\backend" $script:logBE $beP)
            [void](Run-Proc "AI" "$base\backend\music\python_stable\python.exe" "ai_worker.py" "$base\backend\music" $script:logAI $beP)
            [void](Run-Proc "FRONTEND" "cmd.exe" "/c npm start -- --port $feP" "$base\ABSOLUTE PLANTILLA" $script:logFE $beP)
        
            Sync-Angular $beP
        
            $lblStatus.Text = "System Active"
        })

    $btnStop.Add_Click({
            $lblStatus.Text = "Closing processes..."
            foreach ($k in $script:processes.Keys) {
                $p = $script:processes[$k]
                try {
                    Log $script:logBE "Stopping $k..."
                    Get-CimInstance Win32_Process | Where-Object { $_.ParentProcessId -eq $p.Id } | ForEach-Object { Stop-Process $_.ProcessId -Force -ErrorAction SilentlyContinue }
                    Stop-Process $p.Id -Force -ErrorAction SilentlyContinue
                }
                catch {}
            }
            $script:processes.Clear()
            $lblStatus.Text = "System Idle"
        })

    $mainForm.Add_FormClosing({
            foreach ($p in $script:processes.Values) { try { Stop-Process $p.Id -Force -ErrorAction SilentlyContinue } catch {} }
        })

    [void]$mainForm.ShowDialog()

}
catch {
    $e = "FATAL ERROR: $($_.Exception.Message)`n$($_.ScriptStackTrace)"
    Write-HubDebug $e
    [System.Windows.Forms.MessageBox]::Show($e, "Hub Critical Failure")
}
