# Rounding percentages

<div class="infobar">

*fa-clock-o* *time-2024-06-21*
*fa-user* Tavian Barnes

</div>

Let's say you're downloading a file and you see this:

<p>
<div style="background: linear-gradient(90deg, var(--sidebar-active) 1%, var(--sidebar-bg) 1%); text-align: center; font-weight: bold;">
0%
</div>
</p>

How do you know the download actually started?
Similarly, if you see this:

<p>
<div style="background: linear-gradient(90deg, var(--sidebar-active) 100%, var(--sidebar-bg) 100%); text-align: center; font-weight: bold;">
100%
</div>
</p>

Is it actually done?
Or did it download 999/1000 bytes and then hang?

I know this is a relatively minor thing, but I find myself frustrated by UIs like this so often that I'm proposing these rules for rounding percentages that are shown to users:

- 0% means **exactly zero percent**.
  If the user sees 0%, they can assume that absolutely nothing has happened yet except rendering the progress bar.

- 100% means **finished**.
  If the user sees 100%, the process is finished, done, over, complete.
  They shouldn't have to wait for anything else to happen to start using the thing.
  Don't show 100% and then call `fsync()` or something silly.

In between those values, interpolate as normal.

There are a few ways to implement this.
With (truncating) integer division, you just have to fix up the 0% case:

```python
>>> def percent(progress, total):
...     ret = 100 * progress // total
...     if ret == 0 and progress > 0:
...         return 1
...     else:
...         return ret
...
>>> percent(0, 1000)
0
>>> percent(1, 1000)
1
>>> percent(999, 1000)
99
>>> percent(1000, 1000)
100
```

There's also a neat trick with floating point: the default rounding mode is typically *ties-to-even*.
So if we interpolate between `$[0.5, 99.5]$` instead of `$[0, 100]$`, the endpoints will round correctly and everything else will stay within `$[1, 99]$`:

```python
>>> def percent(progress, total):
...     return round(99 * progress / total + 0.5)
...
>>> percent(0, 1000)
0
>>> percent(1, 1000)
1
>>> percent(999, 1000)
99
>>> percent(1000, 1000)
100
```

(If your language has [bad defaults](https://doc.rust-lang.org/std/primitive.f32.html#method.round), you may have to ask for the right rounding mode [explicitly](https://doc.rust-lang.org/std/primitive.f32.html#method.round_ties_even).)
