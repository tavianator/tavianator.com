# Remote reboots with encrypted disks

<div class="infobar">

<fa:clock-o> 2022-05-27
<fa:user> Tavian Barnes
[<fa:twitter> Twitter](https://twitter.com/tavianator/status/1529986039653322759)

</div>

I've been using [LUKS](https://gitlab.com/cryptsetup/cryptsetup/) for [full disk encryption](https://en.wikipedia.org/wiki/Disk_encryption) on all my computers for many years.
The main benefit is that if someone steals my computer, they don't get access to any of my personal data (unless they are [very smart](https://en.wikipedia.org/wiki/Cold_boot_attack) or have a [$5 wrench](https://xkcd.com/538/)).
The main downside is that every time I reboot my computer, I have to type in the disk encryption password so it can actually boot.

That's usually not too annoying.
Normally it just means I can't do [other things](https://xkcd.com/303/) while my computer reboots, since it won't finish until I type in the password.
But it's very annoying if I'm not at home, since I physically can't type in the password.
I spend a fair bit of time at school/on vacation/etc. `ssh`'d into my home computer, since it has more CPU cores than I can comfortably carry around with me, and while it doesn't happen often, sometimes I'd really like to be able to reboot it.

I use [Arch](https://archlinux.org/)™, so the exact solution I came up with is somewhat specific to Arch Linux and some specific details of my setup, but idea applies more generally.
The early boot process that unlocks the encrypted disks is part of the initrd (["initial ramdisk"](https://en.wikipedia.org/wiki/Initial_ramdisk)), so that's what I'll have to mess with to enable remote access at that point.
Arch uses a tool called [`mkinitcpio`](https://wiki.archlinux.org/title/Mkinitcpio) to build the initrd, and it supports various [*hooks*](https://wiki.archlinux.org/title/Mkinitcpio#HOOKS) for adding custom functionality.
So it looks like I'll have to write a hook.


## Writing a hook

A `mkinitcpio` hook is really just a `bash` script.
I called mine `remote`, so it goes in `/etc/initcpio/install/remote`:

```bash
#!/bin/bash

build() {
    figlet "Hello world!"
}

help() {
    cat <<EOF
Enables remote access into the initrd to unlock encrypted disks.
EOF
}
```

`mkinitcpio` will automatically invoke the `help()` function when you ask:

```
# mkinitcpio -H remote
==> Help for hook 'remote':
Enables remote access into the initrd to unlock encrypted disks.
```

To actually use the hook, I added it to the `HOOKS` array in `/etc/mkinitcpio.conf`.
I also added the `hostdata` hook so my hostname would be shared with the initrd.
And just in case I broke everything, I edited `/etc/mkinitcpio.d/linux.preset` to disable the new hook in the fallback initrd image:

```diff
-fallback_options="-S autodetect"
+fallback_options="-S autodetect,remote"
```

Now when we regenerate the initrd, we see our hook invoked!

```
# mkinitcpio -p linux
==> Building image from preset: /etc/mkinitcpio.d/linux.preset: 'default'
...
  -> Running build hook: [remote]
 _   _      _ _                            _     _ _
| | | | ___| | | ___   __      _____  _ __| | __| | |
| |_| |/ _ \ | |/ _ \  \ \ /\ / / _ \| '__| |/ _` | |
|  _  |  __/ | | (_) |  \ V  V / (_) | |  | | (_| |_|
|_| |_|\___|_|_|\___/    \_/\_/ \___/|_|  |_|\__,_(_)
...
==> Image generation successful
```


## Networking

The next step is to get internet access in the initrd.
I already use the `systemd` hook, which means the early boot process in the initrd is managed by [`systemd`](https://www.freedesktop.org/wiki/Software/systemd/) just like my normal boot process.
I use [`systemd-networkd`](https://www.freedesktop.org/software/systemd/man/systemd.network.html) for networking already, so it should also work in the initrd:

```bash
build() {
    # Add systemd-networkd.service and enable it
    add_systemd_unit systemd-networkd.service
    add_symlink /etc/systemd/system/sysinit.target.wants/systemd-networkd.service \
                /usr/lib/systemd/system/systemd-networkd.service
    # Copy the host configuration
    add_full_dir /etc/systemd/network
    # Add the necessary modules
    add_checked_modules /drivers/net
    add_module bridge
}
```

This almost worked, but it was missing the `systemd-network` user.
I made some helper functions to copy users and groups from the host:

```bash
add_user() {
    getent passwd "$1" >>"$BUILDROOT/etc/passwd"
    getent shadow "$1" >>"$BUILDROOT/etc/shadow"
    getent group "$(id -Gn "$1")" >>"$BUILDROOT/etc/group"
}

build() {
    ...
    # Add the networking user
    add_user systemd-network
}
```


## Tailscale

Just having the network up in the initrd would let me reboot my desktop from home without getting up off of the couch, but since I don't expose `ssh` to the public internet, it's not enough for real remote access.
For that, I've been using the [Tailscale](https://tailscale.com/) mesh VPN.
Let me add it to the initrd too:

```bash
build() {
    ...

    # Add tailscaled.service and enable it
    add_systemd_unit tailscaled.service
    add_systemd_unit tailscaled.socket
    add_symlink /etc/systemd/system/sysinit.target.wants/tailscaled.service \
                /usr/lib/systemd/system/tailscaled.service
    # Add the tailscale CLI tool
    add_binary tailscale
    # Add tun
    add_module tun
    # Add iptables
    map add_binary ip{,6}tables
    add_full_dir /usr/lib/xtables
    add_all_modules netfilter
    # Add tailscale configuration
    add_file /etc/default/tailscaled
    add_file /var/lib/tailscale/tailscaled.state
}
```

**WARNING!** This copies `/var/lib/tailscale/tailscaled.state`, which contains the [node key](https://tailscale.com/blog/tailscale-key-management/), to `/boot`, which is *not* encrypted in this setup.
If someone stole my computer, they'd be able to impersonate me to my tailscale network from the initrd.
A better approach would be to generate separate machine/node keys just for the `initrd`, and use [ACLs](https://tailscale.com/kb/1018/acls/) to limit what it can do.

Another problem with this approach is that it doesn't work.
Tailscale didn't start before the boot process paused waiting for my password.
So I tried to force it to start early:

```bash
build() {
    add_systemd_unit cryptsetup-pre.target

    ...

    # Force tailscale to start early
    add_systemd_drop_in tailscaled.service order <<EOF
[Unit]
Wants=cryptsetup-pre.target
Before=cryptsetup-pre.target
EOF
}
```

And that immediately broke everything due to a dependency cycle:

```
sysinit.target: Found ordering cycle on cryptsetup.target/start
sysinit.target: Found dependency on cryptsetup-pre.target/start
sysinit.target: Found dependency on tailscaled.service/start
sysinit.target: Found dependency on sysinit.target/start
sysinit.target: Job cryptsetup.target/start deleted to break ordering cycle starting
                with sysinit.target/start
```

It turns out that `systemd` units get an implicit dependency on `sysinit.target` by default.
If you check [the flowchart from `man bootup`](https://www.freedesktop.org/software/systemd/man/bootup.html), you'll see that `sysinit.target` happens long after `cryptsetup-pre.target`, forming a cycle.
To fix it, I just had to disable the default dependencies by adding `DefaultDependencies=no`.


## SSH

The last piece of the puzzle is to enable SSH so I can actually log in remotely.
Many ssh-in-initrd tutorials use alternative implementations like [Dropbear](https://matt.ucc.asn.au/dropbear/dropbear.html) or [TinySSH](https://tinyssh.org/), but I have plenty of space left in `/boot` so I just used OpenSSH:

```bash
build() {
    ...

    # Add sshd.service and enable it
    add_systemd_unit sshd.service
    add_symlink /etc/systemd/system/sysinit.target.wants/sshd.service \
                /usr/lib/systemd/system/sshd.service
    # Force sshd to start early
    add_systemd_drop_in sshd.service order <<EOF
[Unit]
Wants=cryptsetup-pre.target
Before=cryptsetup-pre.target
DefaultDependencies=no
EOF
    # Required for sshd isolation
    add_user nobody
    add_dir /var/empty
    # Add ssh host keys and configuration
    add_full_dir /etc/ssh
    # Permit root logins in the initrd
    sed -Ei 's/^#?(AllowUsers).*/\1 root/' "$BUILDROOT/etc/ssh/sshd_config"
    sed -Ei 's/^#?(PermitRootLogin).*/\1 yes/' "$BUILDROOT/etc/ssh/sshd_config"
    # No PAM in the initrd
    sed -Ei 's/^#?(UsePAM).*/\1 no/' "$BUILDROOT/etc/ssh/sshd_config"
    # Share authorized_keys with my normal user
    add_file /home/tavianator/.ssh/authorized_keys /root/.ssh/authorized_keys
}
```

With SSH set up, everything is good to go!
We can reboot the machine, then `ssh` back in to input the password:

```
$ ssh root@tachyon
~ # systemctl start cryptsetup.target
🔐 Please enter passphrase for disk Samsung SSD 970 EVO 500GB (cryptslash1): *******
~ # Connection to tachyon closed.
```

I put the whole `mkinitcpio` hook up as a Gist [here](https://gist.github.com/tavianator/6b00355cedae0b2ceb338e43ce8e5c1a).
Feel free to try it out and tweak it for your needs.
