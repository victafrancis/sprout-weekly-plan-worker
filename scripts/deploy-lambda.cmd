@echo off
setlocal

if "%REGION%"=="" (
  echo [ERROR] REGION is required
  exit /b 1
)

if "%LAMBDA_FUNCTION_NAME%"=="" (
  echo [ERROR] LAMBDA_FUNCTION_NAME is required
  exit /b 1
)

if "%OPENROUTER_API_KEY%"=="" (
  echo [ERROR] OPENROUTER_API_KEY is required
  exit /b 1
)

if "%LAMBDA_ROLE_ARN%"=="" (
  echo [ERROR] LAMBDA_ROLE_ARN is required for first-time create
  echo [INFO] If the function already exists, this value can be reused safely.
  exit /b 1
)

call npm run package
if errorlevel 1 exit /b 1

set ZIP_FILE=dist\lambda.zip

aws lambda get-function --function-name "%LAMBDA_FUNCTION_NAME%" --region "%REGION%" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Function not found. Creating %LAMBDA_FUNCTION_NAME%...
  aws lambda create-function ^
    --function-name "%LAMBDA_FUNCTION_NAME%" ^
    --runtime nodejs22.x ^
    --handler handler.handler ^
    --architectures x86_64 ^
    --role "%LAMBDA_ROLE_ARN%" ^
    --zip-file fileb://%ZIP_FILE% ^
    --timeout 30 ^
    --memory-size 256 ^
    --region "%REGION%"
  if errorlevel 1 exit /b 1
) else (
  echo [INFO] Function exists. Updating code for %LAMBDA_FUNCTION_NAME%...
  aws lambda update-function-code ^
    --function-name "%LAMBDA_FUNCTION_NAME%" ^
    --zip-file fileb://%ZIP_FILE% ^
    --region "%REGION%"
  if errorlevel 1 exit /b 1
)

echo [INFO] Updating function environment variables...
aws lambda update-function-configuration ^
  --function-name "%LAMBDA_FUNCTION_NAME%" ^
  --region "%REGION%" ^
  --handler "handler.handler" ^
  --environment "Variables={REGION=%REGION%,DYNAMODB_TABLE=%DYNAMODB_TABLE%,S3_BUCKET=%S3_BUCKET%,CHILD_ID=%CHILD_ID%,OPENROUTER_MODEL=%OPENROUTER_MODEL%,OPENROUTER_API_KEY=%OPENROUTER_API_KEY%,S3_PROMPT_KEY=%S3_PROMPT_KEY%,S3_DEVELOPMENT_GUIDES_PREFIX=%S3_DEVELOPMENT_GUIDES_PREFIX%,S3_WEEKLY_PLANS_PREFIX=%S3_WEEKLY_PLANS_PREFIX%}"

if errorlevel 1 exit /b 1

echo [INFO] Deploy complete.
endlocal

