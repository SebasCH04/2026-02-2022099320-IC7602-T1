@echo off
echo Iniciando Autrum (Analizador de Espectros)...
echo Verificando si Node.js esta instalado...
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado. Por favor de instalar desde https://nodejs.org/
        pause
        exit /b 1
    )

echo Iniciando servidor local en el puerto 8080...
echo Presione Ctrl+C para detener el servidor.
npx -y http-server . -p 8080 -c-1 -o
