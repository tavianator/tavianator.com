default:
	cargo build
	cargo install mdbook --version=0.4.18
	mdbook build

watch: default
	mdbook watch

clean:
	mdbook clean
	cargo clean

POD := tavianator.com
IMAGE := docker.io/tavianator/tavianator.com
CREATE := podman create --replace --pod $(POD) --label io.containers.autoupdate=image

pod:
	podman pod create --replace --name $(POD) --ip 10.88.0.2
	$(CREATE) --name $(POD)-blog $(IMAGE)-blog
	$(CREATE) --name $(POD)-cgit -v /srv/git:/srv/git:ro $(IMAGE)-cgit

pod-build: \
    pod-build-blog \
    pod-build-cgit

pod-build-%:
	podman build --pull -t $(IMAGE)-$* -f infra/$* .

pod-push: \
    pod-push-blog \
    pod-push-cgit

pod-push-%:
	podman push $(IMAGE)-$*

systemd:
	cd /etc/systemd/system && podman generate systemd --new -fn $(POD)

.PHONY: default watch clean pod pod-build pod-push systemd
