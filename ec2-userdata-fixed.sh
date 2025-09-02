#!/bin/bash

# EC2 User Data Script for Warehouse Device Labeling App
# Fixed version for Amazon Linux 2023 curl conflicts

set -e  # Exit on any error

echo "🚀 Starting Warehouse Device Labeling App Setup..."

# Update system packages
echo "📦 Updating system packages..."
if command -v yum &> /dev/null; then
    # Amazon Linux 2/2023
    yum update -y
    # Install essential packages, handle curl conflict
    yum install -y git wget unzip
    # Check if curl is available, if not use curl-minimal
    if ! command -v curl &> /dev/null; then
        echo "📡 curl not found, using curl-minimal (already installed)"
    else
        echo "📡 curl is available"
    fi
elif command -v apt-get &> /dev/null; then
    # Ubuntu/Debian
    apt-get update -y
    apt-get install -y git curl wget unzip
else
    echo "❌ Unsupported package manager"
    exit 1
fi

# Install Docker
echo "🐳 Installing Docker..."
if command -v yum &> /dev/null; then
    # Amazon Linux 2/2023
    yum install -y docker
    systemctl start docker
    systemctl enable docker
    usermod -a -G docker ec2-user
elif command -v apt-get &> /dev/null; then
    # Ubuntu/Debian
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io
    systemctl start docker
    systemctl enable docker
    usermod -a -G docker ubuntu
fi

# Install Docker Compose
echo "🐙 Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    # Use wget if curl is not available
    if command -v curl &> /dev/null; then
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    else
        wget -O /usr/local/bin/docker-compose "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)"
    fi
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

# Install Node.js (for potential direct usage)
echo "📱 Installing Node.js..."
if command -v yum &> /dev/null; then
    # Amazon Linux 2/2023
    if command -v curl &> /dev/null; then
        curl -sL https://rpm.nodesource.com/setup_18.x | bash -
    else
        wget -O - https://rpm.nodesource.com/setup_18.x | bash -
    fi
    yum install -y nodejs
elif command -v apt-get &> /dev/null; then
    # Ubuntu/Debian
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Install additional tools
echo "🔧 Installing additional tools..."
if command -v yum &> /dev/null; then
    yum install -y jq tree htop cronie awscli
elif command -v apt-get &> /dev/null; then
    apt-get install -y jq tree htop cron awscli
fi

# Create app directory
echo "📁 Creating application directory..."
mkdir -p /opt/warehouse-labeler
cd /opt/warehouse-labeler

# Clone repository
echo "📥 Cloning repository..."
git clone https://github.com/anas6676/Device-Labeling.git .
chmod -R 755 .

# Create environment file
echo "⚙️ Creating environment configuration..."
cat > .env << 'EOF'
# Warehouse Labeler Environment Variables
NODE_ENV=production
DATABASE_URL=postgres://postgres:postgres@db:5432/warehouse
VITE_API_URL=http://localhost:3000

# Database Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=warehouse

# App Configuration
APP_PORT=3000
FRONTEND_PORT=3001
DB_PORT=5432

# Optional S3 backup/restore
# Set to your bucket name to enable S3 uploads/restores, e.g. my-backups-bucket
BACKUP_S3_BUCKET=
# Optional S3 prefix (folder path inside the bucket), e.g. warehouse-labeler/
BACKUP_S3_PREFIX=warehouse-labeler/
EOF

# Create systemd service for auto-start
echo "🔧 Creating systemd service..."
cat > /etc/systemd/system/warehouse-labeler.service << 'EOF'
[Unit]
Description=Warehouse Device Labeling App
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/warehouse-labeler
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable and start the service
systemctl daemon-reload
systemctl enable warehouse-labeler.service

# Create startup script
echo "📜 Creating startup script..."
cat > /opt/warehouse-labeler/start.sh << 'EOF'
#!/bin/bash
cd /opt/warehouse-labeler
echo "🚀 Starting Warehouse Labeler App..."
docker-compose up -d
echo "✅ App started! Access at:"
# Use wget if curl is not available
if command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
else
    PUBLIC_IP=$(wget -qO- http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
fi
echo "   🌐 Frontend: http://$PUBLIC_IP:3001"
echo "   🔌 Backend: http://$PUBLIC_IP:3000"
echo "   🗄️ Database: localhost:5432"
EOF

chmod +x /opt/warehouse-labeler/start.sh

# Create stop script
echo "🛑 Creating stop script..."
cat > /opt/warehouse-labeler/stop.sh << 'EOF'
#!/bin/bash
cd /opt/warehouse-labeler
echo "🛑 Stopping Warehouse Labeler App..."
docker-compose down
echo "✅ App stopped!"
EOF

chmod +x /opt/warehouse-labeler/stop.sh

# Create status script
echo "📊 Creating status script..."
cat > /opt/warehouse-labeler/status.sh << 'EOF'
#!/bin/bash
cd /opt/warehouse-labeler
echo "📊 Warehouse Labeler App Status:"
echo "================================"
docker-compose ps
echo ""
echo "📈 Resource Usage:"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
EOF

chmod +x /opt/warehouse-labeler/status.sh

# Create logs script
echo "📝 Creating logs script..."
cat > /opt/warehouse-labeler/logs.sh << 'EOF'
#!/bin/bash
cd /opt/warehouse-labeler
echo "📝 Warehouse Labeler App Logs:"
echo "=============================="
docker-compose logs --tail=50 -f
EOF

chmod +x /opt/warehouse-labeler/logs.sh

# Create backup script
echo "💾 Creating backup script..."
cat > /opt/warehouse-labeler/backup.sh << 'EOF'
#!/bin/bash
cd /opt/warehouse-labeler
BACKUP_DIR="/opt/backups/warehouse-labeler"
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d_%H%M%S)

echo "💾 Creating backup: $BACKUP_DIR/backup_$DATE.sql"
docker-compose exec -T db pg_dump -U postgres warehouse > $BACKUP_DIR/backup_$DATE.sql

echo "🗜️ Compressing backup..."
gzip $BACKUP_DIR/backup_$DATE.sql

echo "🧹 Cleaning old backups (keeping last 7 days)..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# Load optional S3 config from .env
set -a
[ -f ./.env ] && . ./.env
set +a

# Upload to S3 if configured and awscli is available
if [ -n "${BACKUP_S3_BUCKET}" ] && command -v aws &> /dev/null; then
    S3_PREFIX=${BACKUP_S3_PREFIX:-warehouse-labeler/}
    S3_KEY="${S3_PREFIX}backup_${DATE}.sql.gz"
    echo "☁️  Uploading backup to s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
    aws s3 cp "$BACKUP_DIR/backup_${DATE}.sql.gz" "s3://${BACKUP_S3_BUCKET}/${S3_KEY}"
    if [ $? -eq 0 ]; then
        echo "✅ S3 upload completed"
    else
        echo "⚠️  S3 upload failed"
    fi
fi

echo "✅ Backup completed: $BACKUP_DIR/backup_$DATE.sql.gz"
EOF

chmod +x /opt/warehouse-labeler/backup.sh

# Create restore script
echo "🔄 Creating restore script..."
cat > /opt/warehouse-labeler/restore.sh << 'EOF'
#!/bin/bash
cd /opt/warehouse-labeler
BACKUP_DIR="/opt/backups/warehouse-labeler"

if [ -z "$1" ]; then
    echo "❌ Usage: $0 <backup_file.sql.gz>"
    echo "📁 Available backups:"
    ls -la $BACKUP_DIR/*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Restoring from backup: $BACKUP_FILE"
echo "⚠️  This will overwrite current database. Continue? (y/N)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo "🔄 Restoring database..."
    gunzip -c "$BACKUP_FILE" | docker-compose exec -T db psql -U postgres warehouse
    echo "✅ Database restored successfully!"
else
    echo "❌ Restore cancelled"
fi
EOF

chmod +x /opt/warehouse-labeler/restore.sh

# Create README for EC2
echo "📖 Creating EC2 README..."
cat > /opt/warehouse-labeler/EC2-README.md << 'EOF'
# 🏭 Warehouse Device Labeling App - EC2 Setup

## 🚀 Quick Start
```bash
cd /opt/warehouse-labeler
./start.sh
```

## 🛑 Stop App
```bash
./stop.sh
```

## 📊 Check Status
```bash
./status.sh
```

## 📝 View Logs
```bash
./logs.sh
```

## 💾 Backup Database
```bash
./backup.sh
```

## 🔄 Restore Database
```bash
./restore.sh <backup_file.sql.gz>
```

## 🌐 Access URLs
- **Frontend**: http://YOUR_EC2_IP:3001
- **Backend API**: http://YOUR_EC2_IP:3000
- **Database**: localhost:5432 (from EC2)

## 🔧 Manual Commands
```bash
# Start with Docker Compose
docker-compose up -d

# Stop with Docker Compose
docker-compose down

# View running containers
docker-compose ps

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build
```

## 📁 Directory Structure
```
/opt/warehouse-labeler/
├── start.sh          # Start the app
├── stop.sh           # Stop the app
├── status.sh         # Check status
├── logs.sh           # View logs
├── backup.sh         # Backup database
├── restore.sh        # Restore database
├── docker-compose.yml
├── backend/          # Node.js backend
├── frontend/         # React frontend
└── EC2-README.md     # This file
```

## 🔐 Security Notes
- Change default PostgreSQL passwords in production
- Configure firewall rules for ports 3000, 3001, 5432
- Use HTTPS in production
- Regular database backups recommended

## 🆘 Troubleshooting
1. Check if Docker is running: `systemctl status docker`
2. Check app status: `./status.sh`
3. View logs: `./logs.sh`
4. Restart app: `./stop.sh && ./start.sh`
5. Check system resources: `htop`
EOF

# Set proper permissions
echo "🔐 Setting proper permissions..."
chown -R ec2-user:ec2-user /opt/warehouse-labeler 2>/dev/null || chown -R ubuntu:ubuntu /opt/warehouse-labeler 2>/dev/null

# Create cron job for daily backups
echo "⏰ Setting up daily backup cron job..."
if command -v crontab &> /dev/null; then
    (crontab -l 2>/dev/null; echo "0 2 * * * /opt/warehouse-labeler/backup.sh") | crontab -
    echo "✅ Daily backup cron job created (runs at 2:00 AM)"
else
    echo "⚠️  crontab not available, skipping automatic backup setup"
    echo "💡 You can manually run backups with: /opt/warehouse-labeler/backup.sh"
fi

# Start the application
echo "🚀 Starting Warehouse Labeler App..."
cd /opt/warehouse-labeler
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Check status
echo "📊 Checking application status..."
docker-compose ps

# Attempt auto-restore from S3 if DB is empty and S3 config is present
echo "🔍 Checking if database is empty for optional auto-restore..."
set -a
[ -f ./.env ] && . ./.env
set +a
TABLE_COUNT=$(docker-compose exec -T db psql -U postgres -d warehouse -tAc "select count(1) from pg_tables where schemaname='public';" 2>/dev/null || echo "-1")
if [ "$TABLE_COUNT" = "0" ] && [ -n "$BACKUP_S3_BUCKET" ] && command -v aws &> /dev/null; then
    echo "🧭 Database appears empty. Searching S3 for latest backup..."
    S3_PREFIX=${BACKUP_S3_PREFIX:-warehouse-labeler/}
    LATEST=$(aws s3 ls "s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}" | awk '{print $4}' | sort | tail -n1)
    if [ -n "$LATEST" ]; then
        echo "⬇️  Downloading s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}${LATEST}"
        aws s3 cp "s3://${BACKUP_S3_BUCKET}/${S3_PREFIX}${LATEST}" /tmp/backup.sql.gz && \
        gunzip -c /tmp/backup.sql.gz | docker-compose exec -T db psql -U postgres warehouse && \
        echo "✅ Auto-restore completed from S3."
    else
        echo "ℹ️  No backups found in S3 prefix ${S3_PREFIX}"
    fi
else
    echo "ℹ️  Auto-restore skipped (DB not empty, S3 not configured, or AWS CLI missing)."
fi

# Get public IP
echo "🌐 Getting public IP address..."
if command -v curl &> /dev/null; then
    PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
else
    PUBLIC_IP=$(wget -qO- http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
fi

# Final setup message
echo ""
echo "🎉 Warehouse Device Labeling App Setup Complete!"
echo "================================================"
echo ""
echo "🌐 Access URLs:"
echo "   Frontend: http://$PUBLIC_IP:3001"
echo "   Backend:  http://$PUBLIC_IP:3000"
echo ""
echo "📁 App Directory: /opt/warehouse-labeler"
echo "🔧 Management Scripts:"
echo "   ./start.sh    - Start the app"
echo "   ./stop.sh     - Stop the app"
echo "   ./status.sh   - Check status"
echo "   ./logs.sh     - View logs"
echo "   ./backup.sh   - Backup database"
echo ""
echo "📖 Documentation: /opt/warehouse-labeler/EC2-README.md"
echo ""
echo "🔄 Auto-start enabled: App will start automatically on reboot"
if command -v crontab &> /dev/null; then
    echo "💾 Daily backups scheduled at 2:00 AM"
else
    echo "💾 Manual backups available (run ./backup.sh when needed)"
fi
echo ""
echo "✅ Setup completed successfully!"
echo "🚀 Your warehouse labeling app is now running!"
