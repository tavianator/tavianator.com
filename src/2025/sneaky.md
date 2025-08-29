# Sneaky git commits

<div class="infobar">

*fa-clock-o* *time-2025-08-08*
*fa-user* Tavian Barnes

</div>

Here is the entire history of a small git repository, as printed by `git log -u --pretty=short`:

```diff
commit 565d001a0c9543a9c4607e4d8562e5a76ca81414
Merge: 83335cc 9e5b4e7
Author: Tavian Barnes <tavianator@tavianator.com>

    Merge branch 'goodbye'

commit 9e5b4e757a7e0b2a918a7364752f8fe440da20c2
Author: Tavian Barnes <tavianator@tavianator.com>

    Say goodbye

diff --git a/script.sh b/script.sh
index e3a1aba..f844c33 100644
--- a/script.sh
+++ b/script.sh
@@ -1,3 +1,5 @@
 #!/bin/sh
 
 echo "Hello world!"
+
+echo "Goodbye, world!"

commit 83335cc03da4a419def82ef8e4c962e8ff6b83b7
Author: Tavian Barnes <tavianator@tavianator.com>

    Initial commit

diff --git a/script.sh b/script.sh
new file mode 100644
index 0000000..e3a1aba
--- /dev/null
+++ b/script.sh
@@ -0,0 +1,3 @@
+#!/bin/sh
+
+echo "Hello world!"
```

Pop quiz: what's in `script.sh`?
You might guess

```sh
#!/bin/sh

echo "Hello world!"

echo "Goodbye world!"
```

Unfortunately, you'd be wrong:

```console
$ cat script.sh
#!/bin/sh

sudo rm -rf /
```

How did that get in there?
It doesn't show up in any of the commits in the log!

The trick is that merge commits, like any other commit, can include arbitrary changes.
(How else could you resolve merge conflicts?)
But changes in merge commits don't show up in `git log`, which makes them kind of sneaky.

You can create these "sneaky" merge commits with `git merge --no-commit`, or with `git commit --amend`.
The [git docs](https://git-scm.com/docs/git-merge) warn against abusing this, but nothing can stop you:

> You should refrain from abusing this option to sneak substantial changes into a merge commit.
> Small fixups like bumping release/version name would be acceptable.

---

There's a somewhat contrived supply chain attack based on this.
Suppose Eve sends Alice a git tree to pull that includes merges.

> From: Eve &lt;eve@example.net>
>
> Hi Alice, I implemented a fancy new feature!
> Apologies for the convoluted history, a lot of different directions all came together for this!
>
> Please pull https://git.example.com/eve/repo.git

Alice carefully reviews Eve's changes with `git log -u`, and finding nothing wrong, merges them into `main`.

> From: Alice &lt;alice@example.com>
>
> &gt; *From: Eve &lt;eve@example.net>*  
> &gt;  
> &gt; *Hi Alice, I implemented a fancy new feature!*
>
> Thanks!
>
> &gt; *Apologies for the convoluted history, a lot of different directions all came together for this!*
>
> No worries, I looked through the commits and they all make sense.
>
> &gt; *Please pull https://git.example.com/eve/repo.git*  
>
> Pulled and pushed out.


But if a [back](https://en.wikipedia.org/wiki/XZ_Utils_backdoor)[door](https://lwn.net/Articles/57135/) was hidden in a merge commit that Alice didn't see, she may have pushed it out to all her users without realizing.

---

Has this ever happened?
It's possible to check the history of a git repo for these sneaky merges: just redo every merge and check if the resulting tree is the same.
There may be some false positives, because sometimes you need to amend a merge commit even if there were no conflicts.
These are called *semantic conflicts* (for example, when one branch adds a function call while the other renames it).
And finding sneakiness in merges that also had conflicts would be a bit trickier (I suppose you could look for new lines of code that don't appear on either side of the conflict).

I ran a simple script to look for sneaky merge commits in every commit between v6.14 and v6.15 of the Linux kernel.
I did not find anything sneaky after all, just a few semantic conflicts like commit [4a1d8ababde](https://git.kernel.org/pub/scm/linux/kernel/git/torvalds/linux.git/commit/?id=4a1d8ababde685a77fd4fd61e58f973cbdf29f8c) (already called out in the [pull request](https://lore.kernel.org/all/mhng-e4523e07-f5ae-4f8b-9eec-8422b05700f4@palmer-ri-x1c9/)).
If you have more patience than me, it might be interesting to go through more history (and different codebases).
