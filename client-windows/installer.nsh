; installer.nsh — Custom NSIS hooks for IonMan DNS installer
; Checks for WireGuard and offers to download it during installation

!macro customInstall
  ; Check if WireGuard is already installed
  IfFileExists "$PROGRAMFILES64\WireGuard\wireguard.exe" wg_found wg_missing

  wg_missing:
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "WireGuard for Windows is required but not installed.$\n$\nDownload and install WireGuard now?" \
      IDYES download_wg IDNO skip_wg

  download_wg:
    ExecShell "open" "https://www.wireguard.com/install/"
    MessageBox MB_OK|MB_ICONINFORMATION \
      "Please install WireGuard, then run IonMan DNS.$\nIonMan DNS has been installed and will appear in your Start Menu."

  skip_wg:
    ; Continue installation without WireGuard
    Goto done_wg

  wg_found:
    ; WireGuard already present — nothing to do

  done_wg:
!macroend

!macro customUnInstall
  ; Offer to remove stored config on uninstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Remove saved VPN configuration and settings?" \
    IDYES remove_data IDNO done_uninstall

  remove_data:
    RMDir /r "$APPDATA\ionman-dns-client"

  done_uninstall:
!macroend
