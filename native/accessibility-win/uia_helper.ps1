Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

try {
    $focused = [System.Windows.Automation.AutomationElement]::FocusedElement
    if ($null -eq $focused) {
        Write-Output '{"timestamp":0,"elements":[],"truncated":false}'
        exit 0
    }

    $rect = $focused.Current.BoundingRectangle
    $isPass = $false
    try { $isPass = [bool]$focused.Current.IsPassword } catch {}

    $name = $focused.Current.Name
    if ($isPass) { $name = "[REDACTED]" }
    elseif ($name -and $name.Length -gt 128) { $name = $name.Substring(0, 128) }

    $roleName = "element"
    try {
        if ($null -ne $focused.Current.ControlType) {
            $roleName = $focused.Current.ControlType.ProgrammaticName.Replace("ControlType.", "").ToLower()
        }
    } catch {}

    $el = @{
        role = $roleName
        name = if ($name) { $name } else { "" }
        bounds = @{
            x = [int]$rect.X
            y = [int]$rect.Y
            width = [int]$rect.Width
            height = [int]$rect.Height
        }
        isProtected = $isPass
    }

    $res = @{
        timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        elements = @($el)
        truncated = $false
    }
    Write-Output ($res | ConvertTo-Json -Compress)
} catch {
    Write-Output '{"timestamp":0,"elements":[],"truncated":false}'
}
