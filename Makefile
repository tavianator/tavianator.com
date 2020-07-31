default:
	cargo build
	cargo install mdbook
	mdbook build

clean:
	mdbook clean
	cargo clean

POD := tavianator.com
IMAGE := docker.io/tavianator/tavianator.com
AUTO_UPDATE := --label io.containers.autoupdate=image

pod:
	podman pod create --replace --name $(POD) -p 80:80 -p 443:443
	podman create --replace --pod $(POD) $(AUTO_UPDATE) --name $(POD)-blog $(IMAGE)-blog
	podman create --replace --pod $(POD) $(AUTO_UPDATE) --name $(POD)-cgit -v /srv/git:/srv/git:ro $(IMAGE)-cgit
	podman create --replace --pod $(POD) $(AUTO_UPDATE) --name $(POD)-aur -v /home/tavianator/aur:/usr/share/nginx/html:ro $(IMAGE)-aur
	podman create --replace --pod $(POD) $(AUTO_UPDATE) --name $(POD)-proxy -v /etc/letsencrypt:/etc/letsencrypt $(IMAGE)-proxy

pod-build: \
    pod-build-blog \
    pod-build-cgit \
    pod-build-aur \
    pod-build-proxy

pod-build-%:
	podman build -t $(IMAGE)-$* -f infra/$* .

pod-push: \
    pod-push-blog \
    pod-push-cgit \
    pod-push-aur \
    pod-push-proxy

pod-push-%:
	podman push $(IMAGE)-$*

systemd:
	cd /etc/systemd/system && podman generate systemd --new -fn $(POD)

.PHONY: default clean pod pod-build pod-push systemd
