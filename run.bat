@echo off
pushd %~dp0

rem If using a different name for ".venv" consider changing this
if exist .venv (
    call .venv\Scripts\activate.bat
)

for %%f in ("%~dp0\.") do set appname=%%~nxf

pushd ..

python -m %appname% %*

popd
popd
