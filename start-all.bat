@echo off
TITLE Sistem Terdistribusi - Multi-Service Launcher
echo ========================================================
echo   MENJALANKAN KELIMA SERVICE SISTEM TERDISTRIBUSI
echo ========================================================
echo.

echo [1/5] Menjalankan Katalog Service (Port 5001)...
start "Peserta 1: Katalog Service" cmd /k "cd katalog-service && npm start"

timeout /t 2 /nobreak >nul

echo [2/5] Menjalankan Pelanggan Service (Port 5002)...
start "Peserta 2: Pelanggan Service" cmd /k "cd pelanggan-service && npm start"

timeout /t 2 /nobreak >nul

echo [3/5] Menjalankan Pembayaran Service (Port 5004)...
start "Peserta 4: Pembayaran Service" cmd /k "cd pembayaran-service && npm start"

timeout /t 2 /nobreak >nul

echo [4/5] Menjalankan Order Service (Port 5003)...
start "Peserta 3: Order Service" cmd /k "cd order-service && npm start"

timeout /t 2 /nobreak >nul

echo [5/5] Menjalankan API Gateway & Dashboard (Port 5000)...
start "Peserta 5: API Gateway" cmd /k "cd gateway && npm start"

echo.
echo ========================================================
echo   SELURUH SERVICE BERHASIL DIJALANKAN!
echo   Buka browser di: http://localhost:5000
echo   Untuk menjalankan test otomatis: npm test
echo ========================================================
pause
