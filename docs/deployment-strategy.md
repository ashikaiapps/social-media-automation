# Deployment Strategy & Infrastructure

## Overview

Production-ready deployment strategy for the social media automation system, designed for high availability, scalability, and cost-effectiveness.

## Architecture Decision: Clawdbot Skill vs Standalone App

### ✅ Recommended: Hybrid Approach (Clawdbot Skill + Microservices)

**Architecture:**
- **Core API**: Deployed as a Clawdbot Skill
- **Background Services**: Standalone microservices
- **Dashboard**: Standalone web application
- **Database & Cache**: Shared infrastructure

**Benefits:**
- Leverages existing Clawdbot infrastructure
- Seamless integration with Ashik.ai workflow
- Independent scaling of components
- Easier maintenance and updates

```yaml
# Clawdbot Skill Configuration
skill:
  name: "social-media-automation"
  version: "1.0.0"
  type: "api-service"
  
  endpoints:
    - path: "/api/posts"
      method: ["GET", "POST", "PUT", "DELETE"]
    - path: "/api/accounts"
      method: ["GET", "POST", "DELETE"]
    - path: "/api/analytics"
      method: ["GET"]
  
  permissions:
    - "web_access"
    - "file_storage"
    - "database"
    - "scheduler"
  
  dependencies:
    - "postgresql"
    - "redis"
    - "s3-storage"
```

## Infrastructure Overview

### Container Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer (Nginx)                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   Clawdbot      │ │   Dashboard     │ │   Background    │
    │   Skill API     │ │   Web App       │ │   Services      │
    │   (Node.js)     │ │   (Next.js)     │ │   (Node.js)     │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │   PostgreSQL    │ │     Redis       │ │   File Storage  │
    │   (Primary DB)  │ │   (Cache/Jobs)  │ │    (S3/MinIO)   │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Deployment Environments

### 1. Development Environment

**Docker Compose Setup:**
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # Core API Service (Clawdbot Skill)
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/socialautodb
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./src:/app/src
      - ./node_modules:/app/node_modules
    depends_on:
      - postgres
      - redis

  # Background Services
  scheduler:
    build:
      context: .
      dockerfile: Dockerfile.scheduler
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://user:password@postgres:5432/socialautodb
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  media-processor:
    build:
      context: .
      dockerfile: Dockerfile.media
    environment:
      - NODE_ENV=development
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - S3_BUCKET=${S3_BUCKET}
    volumes:
      - /tmp/media:/app/temp
    depends_on:
      - redis

  # Frontend Dashboard
  dashboard:
    build:
      context: ./dashboard
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3000
    volumes:
      - ./dashboard/src:/app/src
      - ./dashboard/node_modules:/app/node_modules

  # Database
  postgres:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=socialautodb
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  # Cache & Queue
  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  # Object Storage (Development)
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 2. Production Environment

**AWS Infrastructure (Recommended)**
```yaml
# production-infrastructure.yml
Resources:
  # ECS Cluster
  ProductionCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: social-automation-prod
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT

  # Application Load Balancer
  ApplicationLoadBalancer:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: social-automation-alb
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup

  # RDS PostgreSQL
  DatabaseInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: social-automation-db
      Engine: postgres
      EngineVersion: '14.9'
      DBInstanceClass: db.t3.medium
      AllocatedStorage: 100
      StorageType: gp2
      StorageEncrypted: true
      MultiAZ: true
      BackupRetentionPeriod: 7
      DeletionProtection: true

  # ElastiCache Redis
  RedisCluster:
    Type: AWS::ElastiCache::ReplicationGroup
    Properties:
      ReplicationGroupId: social-automation-redis
      Description: Redis cluster for caching and job queues
      Engine: redis
      EngineVersion: 6.2
      CacheNodeType: cache.t3.micro
      NumCacheClusters: 2
      AtRestEncryptionEnabled: true
      TransitEncryptionEnabled: true

  # S3 Bucket for Media Storage
  MediaBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: ashik-social-automation-media
      VersioningConfiguration:
        Status: Enabled
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256

  # CloudFront Distribution
  MediaCDN:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Origins:
          - DomainName: !GetAtt MediaBucket.DomainName
            Id: S3Origin
            S3OriginConfig:
              OriginAccessIdentity: !Sub 'origin-access-identity/cloudfront/${CloudFrontOAI}'
        Enabled: true
        DefaultCacheBehavior:
          TargetOriginId: S3Origin
          ViewerProtocolPolicy: redirect-to-https
          CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6 # Managed-CachingOptimized
```

### 3. ECS Service Definitions

**API Service (Clawdbot Skill):**
```json
{
  "family": "social-automation-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/socialAutomationTaskRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "social-automation-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "PORT", "value": "3000"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:region:account:parameter/social-automation/database-url"},
        {"name": "REDIS_URL", "valueFrom": "arn:aws:ssm:region:account:parameter/social-automation/redis-url"},
        {"name": "JWT_SECRET", "valueFrom": "arn:aws:ssm:region:account:parameter/social-automation/jwt-secret"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/social-automation-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

**Background Services:**
```json
{
  "family": "social-automation-scheduler",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/socialAutomationTaskRole",
  "containerDefinitions": [
    {
      "name": "scheduler",
      "image": "social-automation-scheduler:latest",
      "environment": [
        {"name": "NODE_ENV", "value": "production"},
        {"name": "SERVICE_TYPE", "value": "scheduler"}
      ],
      "secrets": [
        {"name": "DATABASE_URL", "valueFrom": "arn:aws:ssm:region:account:parameter/social-automation/database-url"},
        {"name": "REDIS_URL", "valueFrom": "arn:aws:ssm:region:account:parameter/social-automation/redis-url"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/social-automation-scheduler",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## CI/CD Pipeline

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY_API: social-automation-api
  ECR_REPOSITORY_SCHEDULER: social-automation-scheduler
  ECR_REPOSITORY_MEDIA: social-automation-media

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type checking
        run: npm run type-check
      
      - name: Run tests
        run: npm run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
      
      - name: Run e2e tests
        run: npm run test:e2e

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push API image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG -f Dockerfile.api .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY_API:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY_API:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_API:latest
      
      - name: Build and push Scheduler image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY_SCHEDULER:$IMAGE_TAG -f Dockerfile.scheduler .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_SCHEDULER:$IMAGE_TAG
          docker tag $ECR_REGISTRY/$ECR_REPOSITORY_SCHEDULER:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY_SCHEDULER:latest
          docker push $ECR_REGISTRY/$ECR_REPOSITORY_SCHEDULER:latest
      
      - name: Update ECS services
        run: |
          aws ecs update-service --cluster social-automation-prod --service social-automation-api --force-new-deployment
          aws ecs update-service --cluster social-automation-prod --service social-automation-scheduler --force-new-deployment
      
      - name: Wait for deployment
        run: |
          aws ecs wait services-stable --cluster social-automation-prod --services social-automation-api
          aws ecs wait services-stable --cluster social-automation-prod --services social-automation-scheduler
```

## Security Configuration

### Environment Variables & Secrets Management
```bash
# AWS Systems Manager Parameter Store
aws ssm put-parameter \
  --name "/social-automation/database-url" \
  --value "postgresql://user:password@prod-db.amazonaws.com:5432/socialautodb" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/social-automation/redis-url" \
  --value "rediss://prod-redis.cache.amazonaws.com:6380" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/social-automation/jwt-secret" \
  --value "$(openssl rand -base64 32)" \
  --type "SecureString"

# Platform API credentials
aws ssm put-parameter \
  --name "/social-automation/linkedin-client-id" \
  --value "your-linkedin-client-id" \
  --type "SecureString"

aws ssm put-parameter \
  --name "/social-automation/openai-api-key" \
  --value "sk-..." \
  --type "SecureString"
```

### IAM Roles & Policies
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::ashik-social-automation-media/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/social-automation/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

## Monitoring & Observability

### CloudWatch Dashboards
```json
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ECS", "CPUUtilization", "ServiceName", "social-automation-api"],
          [".", "MemoryUtilization", ".", "."]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "API Service Resources"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", "social-automation-alb"],
          [".", "TargetResponseTime", ".", "."],
          [".", "HTTPCode_Target_4XX_Count", ".", "."],
          [".", "HTTPCode_Target_5XX_Count", ".", "."]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Load Balancer Metrics"
      }
    }
  ]
}
```

### Application Logging
```typescript
// logging.config.ts
import winston from 'winston';
import { CloudWatchTransport } from 'winston-aws-cloudwatch';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'social-automation-api',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new CloudWatchTransport({
      logGroupName: `/ecs/social-automation-${process.env.SERVICE_NAME}`,
      logStreamName: process.env.ECS_TASK_ID,
      createLogGroup: true,
      createLogStream: true,
      submissionRetryCount: 3,
      submissionTimeout: 20000,
      batchSize: 20,
      awsConfig: {
        region: process.env.AWS_REGION || 'us-east-1'
      }
    })
  ]
});

export default logger;
```

## Performance Optimization

### Auto Scaling Configuration
```yaml
# ECS Service Auto Scaling
AutoScalingTarget:
  Type: AWS::ApplicationAutoScaling::ScalableTarget
  Properties:
    ServiceNamespace: ecs
    ResourceId: service/social-automation-prod/social-automation-api
    ScalableDimension: ecs:service:DesiredCount
    MinCapacity: 2
    MaxCapacity: 10

CPUScalingPolicy:
  Type: AWS::ApplicationAutoScaling::ScalingPolicy
  Properties:
    PolicyName: social-automation-cpu-scaling
    PolicyType: TargetTrackingScaling
    ScalingTargetId: !Ref AutoScalingTarget
    TargetTrackingScalingPolicyConfiguration:
      PredefinedMetricSpecification:
        PredefinedMetricType: ECSServiceAverageCPUUtilization
      TargetValue: 70.0
      ScaleOutCooldown: 300
      ScaleInCooldown: 300
```

### Database Connection Optimization
```typescript
// database.config.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['query', 'info', 'warn', 'error']
});

// Connection pool configuration
prisma.$on('beforeExit', async () => {
  console.log('Disconnecting from database...');
  await prisma.$disconnect();
});

// Read replicas configuration for analytics
const analyticsDB = new PrismaClient({
  datasources: {
    db: {
      url: process.env.ANALYTICS_DATABASE_URL || process.env.DATABASE_URL
    }
  }
});

export { prisma, analyticsDB };
```

## Backup & Recovery

### Database Backup Strategy
```yaml
# RDS Automated Backups
BackupRetentionPeriod: 7
PreferredBackupWindow: "03:00-04:00"
PreferredMaintenanceWindow: "Sun:04:00-Sun:05:00"

# Manual Snapshot Creation
aws rds create-db-snapshot \
  --db-instance-identifier social-automation-db \
  --db-snapshot-identifier social-automation-db-$(date +%Y%m%d-%H%M%S)
```

### Disaster Recovery Plan
1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 1 hour
3. **Backup Strategy**: Automated daily backups + manual snapshots
4. **Cross-region replication** for critical data
5. **Blue-green deployment** for zero-downtime updates

## Cost Optimization

### Monthly Cost Estimates (Production)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| ECS Fargate (API) | 2 tasks, 1GB RAM, 0.5 vCPU | $45 |
| ECS Fargate (Background) | 1 task, 1GB RAM, 0.5 vCPU | $23 |
| RDS PostgreSQL | db.t3.medium, Multi-AZ | $180 |
| ElastiCache Redis | cache.t3.micro, 2 nodes | $35 |
| Application Load Balancer | Standard configuration | $25 |
| S3 Storage | 100GB storage, 1TB transfer | $30 |
| CloudFront CDN | 1TB data transfer | $85 |
| CloudWatch Logs | 10GB logs/month | $5 |
| **Total Estimated** | | **~$430/month** |

### Cost Optimization Strategies
- Use **Spot instances** for background processing (50% savings)
- Implement **S3 Intelligent Tiering** for media storage
- Set up **CloudWatch billing alerts**
- Use **Reserved Instances** for predictable workloads
- Implement **automatic scaling** to avoid over-provisioning

This deployment strategy provides a robust, scalable, and cost-effective foundation for running the social media automation system in production.