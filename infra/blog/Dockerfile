FROM nginx

COPY infra/blog/nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx site /usr/share/nginx/html
COPY --chown=nginx infra/blog/keybase.txt /usr/share/nginx/html/.well-known/keybase.txt
