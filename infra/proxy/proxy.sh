#!/bin/bash

set -e

nginx -g "daemon off;" &

(
    while true; do
        certbot --nginx --agree-tos -n --email tavianator@tavianator.com -d tavianator.com -d www.tavianator.com -d tavian.dev -d www.tavian.dev
        sleep $((24*60*60))
    done
) &

wait %1
