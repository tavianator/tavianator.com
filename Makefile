default:
	cargo build
	cargo install mdbook
	mdbook build

pod:
	podman pod create --name tavianator.com -p 80:80 -p 443:443
	podman create --pod tavianator.com tavianator/tavianator.com/blog
	podman create --pod tavianator.com -v /srv/git:/srv/git:ro tavianator/tavianator.com/cgit
	podman create --pod tavianator.com -v /home/tavianator/aur:/usr/share/nginx/html:ro tavianator/tavianator.com/aur
	podman create --pod tavianator.com -v /etc/letsencrypt:/etc/letsencrypt tavianator/tavianator.com/proxy

pod-build: \
    pod-build-blog \
    pod-build-cgit \
    pod-build-aur \
    pod-build-proxy

pod-build-%:
	podman build -t tavianator/tavianator.com/$* -f infra/$* .

pod-push: \
    pod-push-blog \
    pod-push-cgit \
    pod-push-aur \
    pod-push-proxy

pod-push-%:
	podman push tavianator/tavianator.com/$*

systemd:
	cd /etc/systemd/system && podman generate systemd -fn tavianator.com

.PHONY: default pod pod-build pod-push systemd
