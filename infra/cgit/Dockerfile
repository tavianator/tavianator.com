FROM docker.io/nginx

RUN apt-get update && apt-get install -y \
  cgit \
  fcgiwrap \
  python3-pygments

COPY infra/cgit/cgitrc /etc/cgitrc
RUN chmod +r /etc/cgitrc

COPY infra/cgit/nginx.conf /etc/nginx/nginx.conf

CMD spawn-fcgi -s /run/fcgiwrap.sock -u nginx /usr/sbin/fcgiwrap && nginx -g "daemon off;"
