param([Parameter(Mandatory)][string]$Folder)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$voice = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $voice.Rate = -1
    foreach ($script in Get-ChildItem -LiteralPath $Folder -Filter 'cue-*.txt') {
        $wav = [IO.Path]::ChangeExtension($script.FullName, '.wav')
        $voice.SetOutputToWaveFile($wav)
        $voice.Speak([IO.File]::ReadAllText($script.FullName))
        $voice.SetOutputToNull()
    }
} finally {
    $voice.Dispose()
}
