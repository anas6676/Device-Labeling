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

echo "✅ Backup completed: $BACKUP_DIR/backup_$DATE.sql.gz"
