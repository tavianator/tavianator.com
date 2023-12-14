FROM docker.io/nginx

COPY infra/blog/nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx site/html /usr/share/nginx/html
COPY --chown=nginx infra/blog/keybase.txt /usr/share/nginx/html/.well-known/keybase.txt
