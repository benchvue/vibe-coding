# SkyTracker - AWS Deployment Guide

## Project File Tree

```
airplance-tracking-v1/
|-- index.html                                               <-- SkyTracker app (browser)
|-- README.md                                                <-- Project documentation
+-- AWS/
    |-- ch3-key.pem                                          <-- Your SSH key
    |-- deployment-guide.md                                  <-- This guide
    |-- airplance-tracking-vpc-architecture.yaml             <-- CloudFormation template
    +-- airplance-tracking-detailed-architecture.drawio      <-- Architecture diagram
```

Note: index.html is in the PARENT directory, not inside AWS/.

---

## What Changed (CORS Fix)

The OpenSky OAuth2 auth server (auth.opensky-network.org) does NOT allow
browser-side requests (no Access-Control-Allow-Origin header). This caused
CORS errors when index.html tried to get OAuth2 tokens directly.

Solution: A Node.js proxy runs on EC2 and handles OAuth2 server-side:

```
BEFORE (broken):
  Browser --CORS BLOCKED--> auth.opensky-network.org/token
  Browser --CORS BLOCKED--> opensky-network.org/api/*

AFTER (fixed):
  Browser --> EC2 Apache :80 /api/opensky/* --> Node.js :3000
                                                   |
                                                   +--> auth.opensky-network.org (OAuth2 token)
                                                   +--> opensky-network.org/api/* (with Bearer token)
```

---

## Architecture

```
User (Browser)
       |
       v
  [ Internet ]
       |
       v
  [ Airplan-IGW ]
       |
       v
+---------------------------------------------+
|  Airplan-VPC  (10.0.0.0/16)                 |
|  +----------------------------------------+ |
|  |  Airplan-Public-Subnet (10.0.1.0/24)   | |
|  |  +----------------------------------+  | |
|  |  |  Airplan-Public-SG               |  | |
|  |  |  Inbound: TCP 22, TCP 80         |  | |
|  |  |                                  |  | |
|  |  |  +----------------------------+  |  | |
|  |  |  |  Airplan-Public-EC2        |  |  | |
|  |  |  |  t2.micro | AL2023         |  |  | |
|  |  |  |                            |  |  | |
|  |  |  |  Apache httpd (:80)        |  |  | |
|  |  |  |    /           -> static   |  |  | |
|  |  |  |    /api/*      -> proxy    |  |  | |
|  |  |  |                            |  |  | |
|  |  |  |  Node.js proxy (:3000)     |  |  | |
|  |  |  |    OAuth2 token manager    |  |  | |
|  |  |  |    OpenSky API forwarder   |  |  | |
|  |  |  +----------------------------+  |  | |
|  |  |           |                      |  | |
|  |  |     [ Airplan-EIP ]              |  | |
|  |  +----------------------------------+  | |
|  +----------------------------------------+ |
+---------------------------------------------+
```

### Resources Created by CloudFormation

| Resource | Name | Details |
|----------|------|---------|
| VPC | Airplan-VPC | CIDR: 10.0.0.0/16 |
| Subnet | Airplan-Public-Subnet | CIDR: 10.0.1.0/24, AZ-a |
| Internet Gateway | Airplan-IGW | Attached to Airplan-VPC |
| Route Table | Airplan-Public-RT | 0.0.0.0/0 -> IGW |
| Security Group | Airplan-Public-SG | Inbound: SSH(22), HTTP(80) |
| EC2 Instance | Airplan-Public-EC2 | t2.micro, AL2023, Apache + Node.js |
| Elastic IP | Airplan-EIP | Static public IP |

### Software installed by UserData

| Software | Purpose |
|----------|---------|
| Apache httpd | Serves index.html + reverse proxies /api/* |
| Node.js + npm | Runs proxy.js for OAuth2 + API forwarding |
| skytracker-proxy.service | systemd service for Node.js proxy |

---

## Prerequisites

- AWS CLI configured (aws configure)
- Key pair ch3-key in your AWS account
- ch3-key.pem in the AWS/ folder
- Cesium Ion token (free: https://ion.cesium.com/tokens)
- OpenSky Client ID + Secret (free: https://opensky-network.org -> Profile -> API Clients)

### Before deploying: Set Cesium token in index.html

Open airplance-tracking-v1/index.html and edit the CONFIG:

```javascript
const CONFIG = {
    CESIUM_ION_TOKEN: 'paste-your-cesium-token-here',
    REFRESH_INTERVAL: 10,
};
```

OpenSky credentials are NOT in index.html. They go into the CloudFormation
command as parameters (stored as EC2 environment variables, server-side only).

---

## Step 1: Create the CloudFormation Stack

```bash
cd airplance-tracking-v1/AWS
```

Create the stack WITH OpenSky credentials:

```bash
aws cloudformation create-stack \
  --stack-name Airplan-vpc-stack \
  --template-body file://airplance-tracking-vpc-architecture.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=ch3-key \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0 \
    ParameterKey=OpenSkyClientId,ParameterValue=YOUR_CLIENT_ID_HERE \
    ParameterKey=OpenSkyClientSecret,ParameterValue=YOUR_CLIENT_SECRET_HERE
```

Or WITHOUT OpenSky credentials (anonymous mode, 10s rate limit):

```bash
aws cloudformation create-stack \
  --stack-name Airplan-vpc-stack \
  --template-body file://airplance-tracking-vpc-architecture.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=ch3-key \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0
```

Wait for completion (~3-5 minutes):

```bash
aws cloudformation wait stack-create-complete --stack-name Airplan-vpc-stack
```

---

## Step 2: Get CloudFormation Outputs

```bash
aws cloudformation describe-stacks \
  --stack-name Airplan-vpc-stack \
  --query "Stacks[0].Outputs" \
  --output table
```

Save EIP to variable:

```bash
EIP=$(aws cloudformation describe-stacks \
  --stack-name Airplan-vpc-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIP'].OutputValue" \
  --output text)
echo "Elastic IP: $EIP"
```

---

## Step 3: Verify Proxy is Running

Wait ~2 minutes for UserData to complete, then check:

```bash
curl http://$EIP/api/health
```

Expected response:

```json
{"status":"ok","authenticated":true,"hasCredentials":true}
```

If authenticated is false but hasCredentials is true, the token may still
be initializing. Wait 10 seconds and try again.

---

## Step 4: Deploy index.html

From the AWS/ folder:

```bash
scp -i ch3-key.pem ../index.html ec2-user@$EIP:/tmp/ && \
ssh -i ch3-key.pem ec2-user@$EIP "sudo cp /tmp/index.html /var/www/html/index.html"
```

From the project root:

```bash
scp -i AWS/ch3-key.pem index.html ec2-user@$EIP:/tmp/ && \
ssh -i AWS/ch3-key.pem ec2-user@$EIP "sudo cp /tmp/index.html /var/www/html/index.html"
```

---

## Step 5: Open in Browser

```
http://<ElasticIP>
```

You should see:
- 3D globe loading
- Yellow airplane icons appearing within 10 seconds
- Status bar: "Authenticated (OAuth2)" or "Anonymous"
- Hover any airplane for flight details

---

## Step 6: Re-deploy After Changes

```bash
scp -i ch3-key.pem ../index.html ec2-user@$EIP:/tmp/ && \
ssh -i ch3-key.pem ec2-user@$EIP "sudo cp /tmp/index.html /var/www/html/index.html"
```

Hard-refresh browser: Ctrl+Shift+R

---

## Step 7: Clean Up

```bash
aws cloudformation delete-stack --stack-name Airplan-vpc-stack
aws cloudformation wait stack-delete-complete --stack-name Airplan-vpc-stack
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Stack creation fails | aws cloudformation describe-stack-events --stack-name Airplan-vpc-stack |
| Cannot SSH | Ensure ch3-key exists in region; chmod 400 ch3-key.pem |
| /api/health returns 503 | Proxy not started yet - wait 2 min for UserData |
| /api/health shows anonymous | Check Client ID/Secret in stack params |
| No flights on globe | Check /api/health first, then browser console (F12) |
| Globe blank | Cesium Ion token missing in index.html |
| 429 Too Many Requests | Reduce refresh interval or wait - rate limited |
| Apache test page | index.html not deployed yet (Step 4) |

### SSH Debug Commands

```bash
ssh -i ch3-key.pem ec2-user@$EIP

# Check proxy
sudo systemctl status skytracker-proxy
sudo journalctl -u skytracker-proxy --no-pager -n 50

# Test proxy locally
curl http://127.0.0.1:3000/api/health

# Check Apache
sudo systemctl status httpd
cat /etc/httpd/conf.d/skytracker.conf

# View full UserData log
cat /var/log/user-data.log

# Restart everything
sudo systemctl restart skytracker-proxy
sudo systemctl restart httpd
```

---

## Architecture Diagram

Open airplance-tracking-detailed-architecture.drawio in https://app.diagrams.net/
