# SkyTracker - Live Flight Tracker with CesiumJS 3D Globe

A Flightradar24-inspired live flight tracking application displaying real-time aircraft
positions on a CesiumJS 3D globe with yellow airplane icons and detailed hover popups.

## Features

- 3D Interactive Globe - CesiumJS-powered Earth with terrain and day/night lighting
- Live Flight Data - Real-time aircraft positions from worldwide ADS-B receivers
- Yellow Airplane Icons - Canvas-drawn icons that rotate with heading direction
- Hover Popup - Callsign, ICAO24, altitude, speed, heading, vertical rate, squawk, position
- Server-side OAuth2 - Node.js proxy handles OpenSky auth (no CORS issues)
- Auto-Refresh - Configurable interval (5-120 seconds)
- Bounding Box Optimization - Only fetches flights visible on screen when zoomed in

---

## Architecture

```
Browser (index.html)          EC2 Server
=====================         ==================================
                              Apache httpd (:80)
  GET /                  -->    serves index.html (static)
  GET /api/opensky/*     -->    ProxyPass to Node.js (:3000)
                                  |
  CesiumJS loads tiles          Node.js proxy.js
  from ion.cesium.com             |-- OAuth2 token (server-side)
  (direct, no proxy)              |-- GET opensky-network.org/api/*
                                  |-- Adds Bearer token header
                                  |-- Returns JSON to browser
```

Key point: OpenSky OAuth2 token exchange happens on the server. The browser
never touches auth.opensky-network.org, so there are no CORS issues.

---

## APIs Used

### 1. OpenSky Network REST API (Flight Data)

| Item | Details |
|------|---------|
| Website | https://opensky-network.org |
| Endpoint | GET /api/states/all |
| Auth | OAuth2 Client Credentials (handled server-side) |
| Credentials | Client ID + Client Secret (NOT username/password) |
| Free Tier | Authenticated: 5s rate limit / Anonymous: 10s |

### 2. Cesium Ion (3D Globe)

| Item | Details |
|------|---------|
| Website | https://cesium.com |
| Tokens | https://ion.cesium.com/tokens |
| Required | Yes - access token in index.html |
| Free Tier | Yes - generous Community plan |

---

## Quick Start

### 1. Get Cesium Ion Token
Sign up at https://ion.cesium.com/signup (free) and copy your access token.

### 2. Get OpenSky Client Credentials
1. Register at https://opensky-network.org (free)
2. Profile -> API Clients -> Create New Client
3. Copy Client ID and Client Secret

### 3. Edit index.html
Set your Cesium token (this is the only config in the HTML file):

```javascript
const CONFIG = {
    CESIUM_ION_TOKEN: 'your-cesium-token-here',
    REFRESH_INTERVAL: 10,
};
```

### 4. Deploy to AWS
OpenSky credentials go into the CloudFormation stack (server-side, not in HTML):

```bash
cd AWS/

aws cloudformation create-stack \
  --stack-name Airplan-vpc-stack \
  --template-body file://airplance-tracking-vpc-architecture.yaml \
  --parameters \
    ParameterKey=KeyPairName,ParameterValue=ch3-key \
    ParameterKey=SSHLocation,ParameterValue=0.0.0.0/0 \
    ParameterKey=OpenSkyClientId,ParameterValue=YOUR_CLIENT_ID \
    ParameterKey=OpenSkyClientSecret,ParameterValue=YOUR_CLIENT_SECRET
```

### 5. Deploy index.html

```bash
EIP=$(aws cloudformation describe-stacks --stack-name Airplan-vpc-stack \
  --query "Stacks[0].Outputs[?OutputKey=='ElasticIP'].OutputValue" --output text)

scp -i ch3-key.pem ../index.html ec2-user@$EIP:/tmp/ && \
ssh -i ch3-key.pem ec2-user@$EIP "sudo cp /tmp/index.html /var/www/html/index.html"
```

### 6. Open in browser
```
http://<ElasticIP>
```

---

## Where Credentials Live

| Credential | Location | Visible to browser? |
|-----------|----------|-------------------|
| Cesium Ion Token | index.html CONFIG | Yes (needed by CesiumJS) |
| OpenSky Client ID | EC2 env variable | No (server-side only) |
| OpenSky Client Secret | EC2 env variable | No (server-side only) |

---

## Server Components on EC2

| Service | Port | Role |
|---------|------|------|
| Apache httpd | 80 | Serves index.html + reverse proxy /api/* |
| Node.js proxy.js | 3000 | OAuth2 token mgmt + OpenSky API proxy |

---

## Health Check

Verify the proxy is running and auth status:
```
http://<ElasticIP>/api/health
```

Returns:
```json
{
  "status": "ok",
  "authenticated": true,
  "hasCredentials": true
}
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank globe | Check Cesium Ion token in index.html |
| No flights | Check /api/health - is proxy running? |
| "Anonymous" in status bar | Verify Client ID/Secret in CloudFormation params |
| 502 errors | SSH in, check: sudo systemctl status skytracker-proxy |
| Proxy not starting | Check: sudo journalctl -u skytracker-proxy -f |
| Apache not proxying | Check: cat /etc/httpd/conf.d/skytracker.conf |

### SSH debug commands:
```bash
# Check proxy service
sudo systemctl status skytracker-proxy

# View proxy logs
sudo journalctl -u skytracker-proxy --no-pager -n 50

# Test proxy locally on EC2
curl http://127.0.0.1:3000/api/health

# Restart proxy
sudo systemctl restart skytracker-proxy

# Check Apache config
httpd -t

# View UserData log
cat /var/log/user-data.log
```

---

## Clean Up

```bash
aws cloudformation delete-stack --stack-name Airplan-vpc-stack
aws cloudformation wait stack-delete-complete --stack-name Airplan-vpc-stack
```

---

## License

- CesiumJS: Apache 2.0
- OpenSky Network Data: See Terms of Use (https://opensky-network.org/about/terms-of-use)
