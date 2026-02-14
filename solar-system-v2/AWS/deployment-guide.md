# 🌌 Solar System Explorer — AWS Deployment Guide

## Project File Tree

```
solar-system-v2/
└── AWS/
    ├── ch3-key.pem                              ← Your SSH key
    ├── deployment-guide.md                      ← This guide
    ├── solar-vpc-architecture.yaml              ← CloudFormation template
    ├── solar-vpc-detailed-architecture.drawio   ← Architecture diagram
    ├── index.html                               ← Solar System Explorer app
    └── textures/                                ← Planet texture images
        ├── Sun.png
        ├── Mercury.png
        ├── Venus.png
        ├── Earth.png
        ├── Mars.png
        ├── Jupiter.png
        ├── Saturn.png
        ├── Uranus.png
        └── Neptune.png
```

## Architecture Overview

```
User (Browser / SSH)
       │
       ▼
  [ Internet ]
       │
       ▼
  [ Solar-IGW ] ─── Internet Gateway
       │
       ▼
  [ Virtual Router ] ◄── [ Solar-Public-RT ]
       │                   0.0.0.0/0  → Solar-IGW
       │                   10.0.0.0/16 → local
       ▼
┌─────────────────────────────────────────────┐
│  Solar-VPC  (10.0.0.0/16)                   │
│  ┌────────────────────────────────────────┐  │
│  │  Solar-Public-Subnet (10.0.1.0/24)    │  │
│  │  ┌──────────────────────────────────┐  │  │
│  │  │  Solar-Public-SG                 │  │  │
│  │  │  Inbound: TCP 22, TCP 80         │  │  │
│  │  │                                  │  │  │
│  │  │  ┌────────────────────────────┐  │  │  │
│  │  │  │  Solar-Public-EC2          │  │  │  │
│  │  │  │  t2.micro | AL2023         │  │  │  │
│  │  │  │  Key: ch3-key              │  │  │  │
│  │  │  │  Apache httpd              │  │  │  │
│  │  │  │  /var/www/html/            │  │  │  │
│  │  │  │    ├── index.html          │  │  │  │
│  │  │  │    └── textures/           │  │  │  │
│  │  │  │        ├── Sun.png         │  │  │  │
│  │  │  │        ├── Earth.png       │  │  │  │
│  │  │  │        └── ... (9 PNGs)    │  │  │  │
│  │  │  └────────────────────────────┘  │  │  │
│  │  │           │                      │  │  │
│  │  │     [ Solar-EIP ]                │  │  │
│  │  │     Elastic IP (Static)          │  │  │
│  │  └──────────────────────────────────┘  │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
         │
         ▼ (Browser loads ES Module)
  [ Three.js CDN - cdn.jsdelivr.net ]
```

### Resources Created by CloudFormation

| Resource | Name | Details |
|----------|------|---------|
| VPC | Solar-VPC | CIDR: 10.0.0.0/16 |
| Subnet | Solar-Public-Subnet | CIDR: 10.0.1.0/24, AZ-a |
| Internet Gateway | Solar-IGW | Attached to Solar-VPC |
| Route Table | Solar-Public-RT | 0.0.0.0/0 → IGW, 10.0.0.0/16 → local |
| Security Group | Solar-Public-SG | Inbound: SSH (22), HTTP (80) |
| EC2 Instance | Solar-Public-EC2 | t2.micro, Amazon Linux 2023, Apache |
| Elastic IP | Solar-EIP | Static public IP for EC2 |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- Key pair `ch3-key` already created in your AWS account
- `ch3-key.pem` file in the `AWS/` folder
- Planet texture PNGs in the `textures/` folder

---

## Step 1: Create the CloudFormation Stack

Open terminal in the `AWS/` folder:

```bash
cd solar-system-v2/AWS
```

Create the stack:

```bash
aws cloudformation create-stack \
  --stack-name solar-vpc-stack \
  --template-body file://solar-vpc-architecture.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=ch3-key \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0
```

Wait for stack creation to complete (~3–5 minutes):

```bash
aws cloudformation wait stack-create-complete --stack-name solar-vpc-stack
```

---

## Step 2: Get CloudFormation Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name solar-vpc-stack \
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

Save Elastic IP to a variable:

```bash
EIP=$(aws cloudformation describe-stacks \
  --stack-name solar-vpc-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIP'].OutputValue" \
  --output text)
echo "Elastic IP: $EIP"
```

---

## Step 3: SSH into Solar-Public-EC2

Set key permissions (first time only):

```bash
chmod 400 ch3-key.pem
```

Connect via SSH:

```bash
ssh -i ch3-key.pem ec2-user@$EIP
```

---

## Step 4: Deploy App Files to EC2

From the `AWS/` folder, upload `index.html` and the entire `textures/` folder:

### Upload index.html

```bash
scp -i ch3-key.pem index.html ec2-user@$EIP:/tmp/
```

### Upload textures/ folder (recursive)

```bash
scp -i ch3-key.pem -r textures ec2-user@$EIP:/tmp/
```

### Move files to Apache web root

```bash
ssh -i ch3-key.pem ec2-user@$EIP "\
  sudo cp /tmp/index.html /var/www/html/index.html && \
  sudo cp -r /tmp/textures /var/www/html/textures && \
  sudo systemctl restart httpd"
```

### One-liner (all 3 steps combined):

```bash
scp -i ch3-key.pem index.html ec2-user@$EIP:/tmp/ && \
scp -i ch3-key.pem -r textures ec2-user@$EIP:/tmp/ && \
ssh -i ch3-key.pem ec2-user@$EIP "\
  sudo cp /tmp/index.html /var/www/html/index.html && \
  sudo cp -r /tmp/textures/* /var/www/html/textures/ && \
  sudo systemctl restart httpd"
```

### Verify files on EC2 (optional):

```bash
ssh -i ch3-key.pem ec2-user@$EIP "ls -la /var/www/html/ && ls -la /var/www/html/textures/"
```

Expected:

```
/var/www/html/
├── index.html
└── textures/
    ├── Sun.png
    ├── Mercury.png
    ├── Venus.png
    ├── Earth.png
    ├── Mars.png
    ├── Jupiter.png
    ├── Saturn.png
    ├── Uranus.png
    └── Neptune.png
```

---

## Step 5: Access Solar System Explorer in Browser

Open your browser and navigate to:

```
http://<ElasticIP>
```

For example: `http://54.xx.xx.xx`

You should see the 3D Solar System with the Sun and all planets orbiting in space.

---

## Step 6: Clean Up — Delete Everything

Delete the entire stack (removes ALL resources):

```bash
aws cloudformation delete-stack --stack-name solar-vpc-stack
```

Wait for deletion to complete:

```bash
aws cloudformation wait stack-delete-complete --stack-name solar-vpc-stack
```

Verify deletion:

```bash
aws cloudformation describe-stacks --stack-name solar-vpc-stack
```

Expected error: `Stack with id solar-vpc-stack does not exist` — confirming everything is cleaned up.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Stack creation fails | `aws cloudformation describe-stack-events --stack-name solar-vpc-stack` |
| Cannot SSH | Ensure `ch3-key` key pair exists in your region; check SG port 22 |
| Website not loading | Wait 2 min for UserData to finish; check `sudo systemctl status httpd` |
| Page shows Apache test page | You haven't deployed files yet — see Step 4 |
| Planets show no textures | Verify `textures/` folder was uploaded: `ls /var/www/html/textures/` |
| Black spheres (no images) | Check file names match exactly (case-sensitive): `Sun.png`, `Earth.png`, etc. |
| Permission denied (SSH) | Run `chmod 400 ch3-key.pem` |
| SCP fails | Ensure EC2 is running and EIP is correct |

---

## Architecture Diagram

Open `solar-vpc-detailed-architecture.drawio` in [app.diagrams.net](https://app.diagrams.net/) to view the full architecture.
