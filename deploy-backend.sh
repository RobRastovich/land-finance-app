#!/bin/bash

# Load .env file
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "Error: .env file not found"
    exit 1
fi

# Build and deploy with parameters
sam build
sam deploy --parameter-overrides \
    "DBHost=$DB_HOST" \
    "DBPort=$DB_PORT" \
    "DBName=$DB_NAME" \
    "DBUser=$DB_USER" \
    "DBPassword=$DB_PASSWORD" \
    "DBSSL=$DB_SSL" \
    "JWTSecret=$JWT_SECRET" \
    "S3DocumentsBucket=$S3_DOCUMENTS_BUCKET" \
    "RDSInstanceArn=$RDS_INSTANCE_ARN" \
    "LambdaSecurityGroup=$LAMBDA_SG_ID" \
    "Subnet1=$SUBNET_ID_1" \
    "Subnet2=$SUBNET_ID_2"
