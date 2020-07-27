FROM archlinux

RUN pacman -Syu --noconfirm certbot certbot-nginx cgit fcgiwrap nginx python-pygments

RUN systemctl set-default multi-user.target
RUN systemctl mask console-getty.service
RUN systemctl mask systemd-logind.service
RUN touch /etc/machine-id

COPY certbot.service /etc/systemd/system/certbot.service
COPY certbot.timer /etc/systemd/system/certbot.timer
RUN chmod +r /etc/systemd/system/certbot.*
RUN systemctl enable certbot.service
RUN systemctl enable certbot.timer

COPY cgitrc /etc/cgitrc
RUN chmod +r /etc/cgitrc
RUN systemctl enable fcgiwrap.socket

COPY nginx.conf /etc/nginx/nginx.conf
COPY --chown=http site /srv/http

RUN systemctl enable nginx
EXPOSE 80
EXPOSE 443

CMD /usr/lib/systemd/systemd
