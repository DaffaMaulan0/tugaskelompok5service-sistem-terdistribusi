Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   MENJALANKAN KELIMA SERVICE SISTEM TERDISTRIBUSI" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$services = @(
    @{ Name = "Katalog Service (Peserta 1)"; Dir = "katalog-service"; Port = 5001 },
    @{ Name = "Pelanggan Service (Peserta 2)"; Dir = "pelanggan-service"; Port = 5002 },
    @{ Name = "Pembayaran Service (Peserta 4)"; Dir = "pembayaran-service"; Port = 5004 },
    @{ Name = "Order Service (Peserta 3)"; Dir = "order-service"; Port = 5003 },
    @{ Name = "API Gateway (Peserta 5)"; Dir = "gateway"; Port = 5000 }
)

foreach ($s in $services) {
    Write-Host "Memulai $($s.Name) pada port $($s.Port)..." -ForegroundColor Yellow
    Start-Process cmd -ArgumentList "/k cd $($s.Dir) && npm start"
    Start-Sleep -Seconds 1
}

Write-Host "`nSemua service sedang dijalankan!" -ForegroundColor Green
Write-Host "Dashboard Toko & Admin : http://localhost:5000" -ForegroundColor White
Write-Host "Health Check Status    : http://localhost:5000/health" -ForegroundColor White
Write-Host "Jalankan tes E2E       : node tests/e2e-test.js`n" -ForegroundColor White
