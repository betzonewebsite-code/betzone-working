# Deletes the demo-only files that the live backend replaces. Run from the betzone folder: powershell -File scripts-remove-demo.ps1
$files = @(
  "server/oddsEngine.ts","server/socket.ts","server/bookingStore.ts",
  "src/data/fixtures.ts",
  "src/lib/bookingCode.ts","src/lib/cashout.ts","src/lib/settlement.ts","src/lib/txStatus.ts","src/lib/payments.ts","src/lib/useNow.ts",
  "src/store/walletStore.ts","src/store/txStore.ts","src/store/pinStore.ts","src/store/betsStore.ts","src/store/oddsStore.ts",
  "src/components/wallet/MomoPrompt.tsx","src/components/wallet/UssdSim.tsx","src/components/wallet/PinModal.tsx"
)
foreach ($f in $files) { if (Test-Path $f) { Remove-Item $f -Force; Write-Host "removed $f" } }
