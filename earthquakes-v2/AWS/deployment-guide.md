# 🌍 Earthquake 3D Visualization — AWS Deployment Guide

## Project File Tree

```
earthquake-cesium/
└── AWS/
    ├── ch3-key.pem                                  ← Your SSH key
    ├── deployment-guide.md                          ← This guide
    ├── earthquakes-vpc-architecture.yaml            ← CloudFormation template
    ├── earthquakes-vpc-detailed-architecture.drawio ← Architecture diagram
    └── index.html                                   ← Earthquake 3D app (single file)
```

## Architecture Overview

```
User (Browser / SSH)
       │
       ▼
  [ Internet ]
       │
       ▼
  [ Earthquake-IGW ] ─── Internet Gateway
       │
       ▼
  [ Virtual Router ] ◄── [ Earthquake-Public-RT ]
       │                   0.0.0.0/0  → Earthquake-IGW
       │                   10.0.0.0/16 → local
       ▼
┌─────────────────────────────────────────────────┐
│  Earthquake-VPC  (10.0.0.0/16)                  │
│  ┌────────────────────────────────────────────┐  │
│  │  Earthquake-Public-Subnet (10.0.1.0/24)   │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Earthquake-Public-SG                │  │  │
│  │  │  Inbound: TCP 22, TCP 80             │  │  │
│  │  │                                      │  │  │
│  │  │  ┌────────────────────────────────┐  │  │  │
│  │  │  │  Earthquake-Public-EC2         │  │  │  │
│  │  │  │  t2.micro | AL2023             │  │  │  │
│  │  │  │  Key: ch3-key                  │  │  │  │
│  │  │  │  Apache httpd                  │  │  │  │
│  │  │  │  /var/www/html/index.html      │  │  │  │
│  │  │  └────────────────────────────────┘  │  │  │
│  │  │           │                          │  │  │
│  │  │     [ Earthquake-EIP ]               │  │  │
│  │  │     Elastic IP (Static)              │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │
         ▼ (Browser fetches at runtime)
  [ USGS Earthquake API ]    [ CesiumJS CDN + Ion Terrain ]
```

### Resources Created by CloudFormation

| Resource | Name | Details |
|----------|------|---------|
| VPC | Earthquake-VPC | CIDR: 10.0.0.0/16 |
| Subnet | Earthquake-Public-Subnet | CIDR: 10.0.1.0/24, AZ-a |
| Internet Gateway | Earthquake-IGW | Attached to Earthquake-VPC |
| Route Table | Earthquake-Public-RT | 0.0.0.0/0 → IGW, 10.0.0.0/16 → local |
| Security Group | Earthquake-Public-SG | Inbound: SSH (22), HTTP (80) |
| EC2 Instance | Earthquake-Public-EC2 | t2.micro, Amazon Linux 2023, Apache |
| Elastic IP | Earthquake-EIP | Static public IP for EC2 |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Key pair `ch3-key` already created in your AWS account
- `ch3-key.pem` file in the `AWS/` folder

---

## Step 1: Create the CloudFormation Stack

Open terminal in the `AWS/` folder:

```bash
cd earthquake-cesium/AWS
```

Create the stack:

```bash
aws cloudformation create-stack \
  --stack-name earthquake-vpc-stack \
  --template-body file://earthquakes-vpc-architecture.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=ch3-key \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0
```

Wait for stack creation to complete (~3–5 minutes):

```bash
aws cloudformation wait stack-create-complete --stack-name earthquake-vpc-stack
```

---

## Step 2: Get CloudFormation Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name earthquake-vpc-stack \
  --query "Stacks[0].Outputs" \
  --output table
```

Expected output:

```
----------------------------------------------------------------------
|                          DescribeStacks                            |
+-------------------+------------------------------------------------+
|   OutputKey       |   OutputValue                                  |
+-------------------+------------------------------------------------+
|   VPCId           |   vpc-0abc123def456                            |
|   ElasticIP       |   54.xx.xx.xx                                  |
|   WebsiteURL      |   http://54.xx.xx.xx                           |
|   SSHCommand      |   ssh -i ch3-key.pem ec2-user@54.xx.xx.xx      |
|   InstanceId      |   i-0abc123def456                               |
+-------------------+------------------------------------------------+
```

Save Elastic IP to a variable:

```bash
EIP=$(aws cloudformation describe-stacks \
  --stack-name earthquake-vpc-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIP'].OutputValue" \
  --output text)
echo "Elastic IP: $EIP"
```

---

## Step 3: SSH into Earthquake-Public-EC2

Set key permissions (first time only):

```bash
chmod 400 ch3-key.pem
```

Connect via SSH:

```bash
ssh -i ch3-key.pem ec2-user@$EIP
```

---

## Step 4: Deploy index.html to EC2

From the `AWS/` folder, upload and deploy the single `index.html`:

```bash
scp -i ch3-key.pem index.html ec2-user@$EIP:/tmp/ && \
ssh -i ch3-key.pem ec2-user@$EIP "\
  sudo cp /tmp/index.html /var/www/html/index.html && \
  sudo systemctl restart httpd"
```

Verify deployment (optional):

```bash
ssh -i ch3-key.pem ec2-user@$EIP "ls -la /var/www/html/"
```

Expected:

```
/var/www/html/
└── index.html
```

---

## Step 5: Access Earthquake 3D Visualization in Browser

Open your browser and navigate to:

```
http://<ElasticIP>
```

For example: `http://54.xx.xx.xx`

You should see the CesiumJS 3D globe with earthquake data loading automatically from the USGS API.

> **Note**: The app loads CesiumJS from CDN and fetches earthquake data from USGS at runtime — both require internet access from the browser.

---

## Step 6: Clean Up — Delete Everything

Delete the entire stack (removes ALL resources):

```bash
aws cloudformation delete-stack --stack-name earthquake-vpc-stack
```

Wait for deletion to complete:

```bash
aws cloudformation wait stack-delete-complete --stack-name earthquake-vpc-stack
```

Verify deletion:

```bash
aws cloudformation describe-stacks --stack-name earthquake-vpc-stack
```

Expected error: `Stack with id earthquake-vpc-stack does not exist` — confirming everything is cleaned up.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Stack creation fails | `aws cloudformation describe-stack-events --stack-name earthquake-vpc-stack` |
| Cannot SSH | Ensure `ch3-key` key pair exists in your region; check SG port 22 |
| Website not loading | Wait 2 min for UserData to finish; check `sudo systemctl status httpd` |
| Page shows Apache test page | You haven't deployed `index.html` yet — see Step 4 |
| Globe not rendering | Check browser console; ensure Cesium Ion token is valid |
| No earthquake data | Verify USGS API is accessible; check date range and magnitude filter |
| Permission denied (SSH) | Run `chmod 400 ch3-key.pem` |
| SCP fails | Ensure EC2 is running and EIP is correct |

---

## Architecture Diagram

Open `earthquakes-vpc-detailed-architecture.drawio` in [app.diagrams.net](https://app.diagrams.net/) to view the full architecture.
