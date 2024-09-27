default:
	npm install
	cargo install mdbook --version=0.4.40
	mdbook build

watch: default
	mdbook watch

clean:
	mdbook clean

IMAGE := docker.io/tavianator/tavianator.com

pod-build: \
    pod-build-blog \
    pod-build-cgit

pod-build-%:
	podman build --pull -t $(IMAGE)-$* -f infra/$*/Dockerfile .

pod-push: \
    pod-push-blog \
    pod-push-cgit

pod-push-%:
	podman push $(IMAGE)-$*

install:
	install -Dm644 -t /etc/containers/systemd infra/quadlet/*

.PHONY: default watch clean pod pod-build pod-push install
