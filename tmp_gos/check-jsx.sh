#!/bin/bash
# Restart vite to clear stale watcher cache in /mnt/f
VPID=$(ss -tlnp 2>/dev/null | grep ':5173' | grep -o 'pid=[0-9]*' | head -1 | cut -d= -f2)
echo "vite pid=$VPID"
[ -n "$VPID" ] && kill "$VPID" 2>/dev/null
sleep 2
cd /mnt/f/zoomsys
setsid nohup ./node_modules/.bin/vite > /tmp/zoomsys-vite.log 2>&1 &
sleep 6
echo "=== port ==="
ss -tln 2>/dev/null | grep ':5173' || echo "not up"
echo "=== log ==="
tail -n 8 /tmp/zoomsys-vite.log