default:
	cargo build
	cargo install mdbook
	mdbook build

install:
	podman build -t tavianator.com .
	podman rm tavianator.com || true
	podman create --name tavianator.com --systemd=always -p 80:80 -p 443:443 -v /srv/git:/srv/git:ro tavianator.com
	cd /etc/systemd/system && podman generate systemd -fn tavianator.com
