# Backend Deployment with AWS SAM
# Updated API endpoint to us-west-2

This project uses AWS SAM (Serverless Application Model) to deploy the backend as a Lambda function with API Gateway.

## Prerequisites

1. **Install AWS SAM CLI**
   ```bash
   brew tap aws/tap
   brew install aws-sam-cli
   ```

2. **Configure AWS credentials**
   ```bash
   aws configure
   ```

3. **Get your AWS values** from the AWS Console:
   - RDS endpoint (DB_HOST)
   - RDS instance ARN (RDS_INSTANCE_ARN)
   - Security Group ID for Lambda (LAMBDA_SG_ID)
   - Subnet IDs for Lambda VPC (SUBNET_ID_1, SUBNET_ID_2)
   - JWT_SECRET
   - S3 bucket name (S3_DOCUMENTS_BUCKET)

## Environment Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables for SAM deployment:
- `DB_HOST` - RDS endpoint
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: melina)
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `DB_SSL` - Use SSL (default: true)
- `JWT_SECRET` - JWT secret for authentication
- `S3_DOCUMENTS_BUCKET` - S3 bucket for documents
- `RDS_INSTANCE_ARN` - RDS instance ARN for IAM policy
- `LAMBDA_SG_ID` - Security group ID for Lambda
- `SUBNET_ID_1` - First subnet ID
- `SUBNET_ID_2` - Second subnet ID

## Deployment

### Build
```bash
npm run sam:build
```

### Deploy
```bash
npm run sam:deploy
```

This will:
1. Create/update the CloudFormation stack `land-finance-app-backend`
2. Deploy the Lambda function in us-west-2
3. Create/update the API Gateway
4. Set up IAM roles and policies

### Get the API URL
After deployment, SAM will output the API Gateway URL. It will look like:
```
https://your-api-id.execute-api.us-west-2.amazonaws.com/prod
```

## Update Frontend

Update the frontend's `.env.local` with the new API URL:

```
REACT_APP_API_ENDPOINT=https://your-api-id.execute-api.us-west-2.amazonaws.com/prod
```

Then rebuild and deploy the frontend via Amplify.

## Local Testing

Test the Lambda locally with SAM:

```bash
npm run sam:local
```

This starts a local API at `http://localhost:3000` that mimics the Lambda environment.

## VPC Configuration Notes

The Lambda function requires VPC configuration to access RDS:
- **Security Group**: Must allow outbound traffic to the RDS port (5432)
- **Subnets**: Should be private subnets with NAT gateway for internet access (if needed for S3)
- **RDS Security Group**: Must allow inbound traffic from the Lambda security group

## Troubleshooting

### Lambda timeout errors
- Increase `Timeout` in `template.yaml` (default: 30 seconds)
- Increase `MemorySize` if needed (default: 512 MB)

### Database connection errors
- Verify RDS security group allows Lambda security group
- Check subnet configuration (needs NAT gateway for internet access)
- Verify DB_HOST and credentials are correct

### S3 access errors
- Verify Lambda IAM policy includes S3 permissions
- Check S3 bucket policy allows Lambda access
