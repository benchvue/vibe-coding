# 🎬 Movie Actor Explorer — AWS Deployment Guide

## Project File Tree

```
movie-actor-explorer-v2/
└── AWS/
    ├── ch3-key.pem                              ← Your SSH key
    ├── deployment-guide.md                      ← This guide
    ├── movie-vpc-architecture.yaml              ← CloudFormation template
    ├── movies-detailed-architecture.drawio       ← Architecture diagram
    └── index.html                               ← Movie Actor Explorer app
```

## Architecture Overview

```
User (Browser / SSH)
       │
       ▼
  [ Internet ]
       │
       ▼
  [ Movie-IGW ] ─── Internet Gateway
       │
       ▼
  [ Virtual Router ] ◄── [ Movie-Public-RT ]
       │                   0.0.0.0/0  → Movie-IGW
       │                   10.0.0.0/16 → local
       ▼
┌─────────────────────────────────────────────┐
│  Movie-VPC  (10.0.0.0/16)                   │
│  ┌────────────────────────────────────────┐  │
│  │  Movie-Public-Subnet (10.0.1.0/24)    │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │  Movie-Public-SG                 │  │  │
│  │  │  Inbound: TCP 22, TCP 80         │  │  │
│  │  │                                  │  │  │
│  │  │  ┌────────────────────────────┐  │  │  │
│  │  │  │  Movie-Public-EC2          │  │  │  │
│  │  │  │  t2.micro | AL2023         │  │  │  │
│  │  │  │  Key: ch3-key              │  │  │  │
│  │  │  │  Apache httpd → index.html │  │  │  │
│  │  │  └────────────────────────────┘  │  │  │
│  │  │           │                      │  │  │
│  │  │     [ Movie-EIP ]                │  │  │
│  │  │     Elastic IP (Static)          │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Resources Created by CloudFormation

| Resource | Name | Details |
|----------|------|---------|
| VPC | Movie-VPC | CIDR: 10.0.0.0/16 |
| Subnet | Movie-Public-Subnet | CIDR: 10.0.1.0/24, AZ-a |
| Internet Gateway | Movie-IGW | Attached to Movie-VPC |
| Route Table | Movie-Public-RT | 0.0.0.0/0 → IGW, 10.0.0.0/16 → local |
| Security Group | Movie-Public-SG | Inbound: SSH (22), HTTP (80) |
| EC2 Instance | Movie-Public-EC2 | t2.micro, Amazon Linux 2023, Apache |
| Elastic IP | Movie-EIP | Static public IP for EC2 |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Key pair `ch3-key` already created in your AWS account
- `ch3-key.pem` file in the `AWS/` folder

---

## Step 1: Create the CloudFormation Stack

Open terminal in the `AWS/` folder:

```bash
cd movie-actor-explorer-v2/AWS
```

Create the stack:

```bash
aws cloudformation create-stack \
  --stack-name movie-vpc-stack \
  --template-body file://movie-vpc-architecture.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=ch3-key \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0
```

Wait for stack creation to complete (~3–5 minutes):

```bash
aws cloudformation wait stack-create-complete --stack-name movie-vpc-stack
```

---

## Step 2: Get CloudFormation Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name movie-vpc-stack \
  --query "Stacks[0].Outputs" \
  --output table
```

Expected output:

```
-----------------------------------------------------------------
|                       DescribeStacks                          |
+-----------------+---------------------------------------------+
|   OutputKey     |   OutputValue                               |
+-----------------+---------------------------------------------+
|   VPCId         |   vpc-0abc123def456                         |
|   ElasticIP     |   54.xx.xx.xx                               |
|   WebsiteURL    |   http://54.xx.xx.xx                        |
|   SSHCommand    |   ssh -i ch3-key.pem ec2-user@54.xx.xx.xx   |
|   InstanceId    |   i-0abc123def456                            |
+-----------------+---------------------------------------------+
```

Quick — get just the Elastic IP:

```bash
aws cloudformation describe-stacks \
  --stack-name movie-vpc-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIP'].OutputValue" \
  --output text
```

Save it to a variable for convenience:

```bash
EIP=$(aws cloudformation describe-stacks \
  --stack-name movie-vpc-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIP'].OutputValue" \
  --output text)
echo "Elastic IP: $EIP"
```

---

## Step 3: SSH into Movie-Public-EC2

Set key permissions (first time only):

```bash
chmod 400 ch3-key.pem
```

Connect via SSH:

```bash
ssh -i ch3-key.pem ec2-user@$EIP
```

Or manually:

```bash
ssh -i ch3-key.pem ec2-user@54.xx.xx.xx
```

---

## Step 4: Deploy index.html to EC2

From the `AWS/` folder, upload `index.html` using SCP:

```bash
scp -i ch3-key.pem index.html ec2-user@$EIP:/tmp/
```

Then SSH in and move it to Apache's web root:

```bash
ssh -i ch3-key.pem ec2-user@$EIP
```

```bash
sudo cp /tmp/index.html /var/www/html/index.html
sudo systemctl restart httpd
```

### One-liner alternative (no need to SSH in separately):

```bash
scp -i ch3-key.pem index.html ec2-user@$EIP:/tmp/ && \
ssh -i ch3-key.pem ec2-user@$EIP "sudo cp /tmp/index.html /var/www/html/index.html && sudo systemctl restart httpd"
```

---

## Step 5: Access Movie Actor Explorer in Browser

Open your browser and navigate to:

```
http://<ElasticIP>
```

For example: `http://54.xx.xx.xx`

---

## Step 6: Clean Up — Delete Everything

Delete the entire stack (removes ALL resources):

```bash
aws cloudformation delete-stack --stack-name movie-vpc-stack
```

Wait for deletion to complete:

```bash
aws cloudformation wait stack-delete-complete --stack-name movie-vpc-stack
```

Verify deletion:

```bash
aws cloudformation describe-stacks --stack-name movie-vpc-stack
```

Expected error: `Stack with id movie-vpc-stack does not exist` — confirming everything is cleaned up.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Stack creation fails | `aws cloudformation describe-stack-events --stack-name movie-vpc-stack` |
| Cannot SSH | Ensure `ch3-key` key pair exists in your region; check SG port 22 |
| Website not loading | Wait 2 min for UserData; run `sudo systemctl status httpd` on EC2 |
| Page shows Apache test page | You haven't deployed `index.html` yet — see Step 4 |
| Permission denied (SSH) | Run `chmod 400 ch3-key.pem` |
| SCP fails | Ensure EC2 is running and EIP is correct |

---

## Architecture Diagram

Open `movies-detailed-architecture.drawio` in [app.diagrams.net](https://app.diagrams.net/) to view the full architecture.
