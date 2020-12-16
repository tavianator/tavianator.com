FROM docker.io/nginx

RUN apt-get update && apt-get install -y \
  certbot \
  python-certbot-nginx

COPY infra/proxy/nginx.conf /etc/nginx/nginx.conf
COPY infra/proxy/proxy.sh /usr/bin/proxy.sh

CMD /usr/bin/proxy.sh
