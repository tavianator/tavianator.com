# Fast, Branchless Ray/Bounding Box Intersections, Part 2: NaNs

In [part 1], I outlined an algorithm for computing intersections between rays and axis-aligned bounding boxes.
The idea to eliminate branches by relying on IEEE 754 floating point properties goes back to Brian Smits in <a name="citor-1" href="#cite-1">[1]</a>, and the implementation was fleshed out by Amy Williams. et al. in <a name="citor-2" href="#cite-2">[2]</a>.

[part 1]: ../2011/ray_box.md

To quickly recap, the idea is to replace the naïve slab method:

```c
bool intersection(box b, ray r) {
    double tmin = -INFINITY, tmax = INFINITY;

    for (int i = 0; i < 3; ++i) {
        if (ray.dir[i] != 0.0) {
            double t1 = (b.min[i] - r.origin[i])/r.dir[i];
            double t2 = (b.max[i] - r.origin[i])/r.dir[i];

            tmin = max(tmin, min(t1, t2));
            tmax = min(tmax, max(t1, t2));
        } else if (ray.origin[i] <= b.min[i] || ray.origin[i] >= b.max[i]) {
            return false;
        }
    }

    return tmax > tmin && tmax > 0.0;
}
```

with the equivalent but faster:

```c
bool intersection(box b, ray r) {
    double tmin = -INFINITY, tmax = INFINITY;

    for (int i = 0; i < 3; ++i) {
        double t1 = (b.min[i] - r.origin[i])*r.dir_inv[i];
        double t2 = (b.max[i] - r.origin[i])*r.dir_inv[i];

        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));
    }

    return tmax > max(tmin, 0.0);
}
```

Are the two algorithms really equivalent?
We've eliminated the `$\mathtt{ray.dir}_i \ne 0$` checks by relying on [IEEE 754] floating point behaviour.
When `$\mathtt{ray.dir}_i = \pm 0$`, `$\mathtt{ray.dir\_inv}_i = \pm \infty$`.
If the ray origin's `$i$` coordinate is inside the box, meaning `$\mathtt{b.min}_i < \mathtt{r.origin}_i < \mathtt{b.max}_i$`, we'll have `$t_1 = -t_2 = \pm \infty$`.
Since `$\max(n, -\infty) = \min(n, +\infty) = n$` for all `$n$`, `$t_{\min}$` and `$t_{\max}$` will remain unchanged.

[IEEE 754]: https://en.wikipedia.org/wiki/IEEE_floating_point

On the other hand, if the `$i$` coordinate is outside the box (`$\mathtt{r.origin}_i < \mathtt{b.min}_i$` or `$\mathtt{r.origin}_i > \mathtt{b.max}_i$`), we'll have `$t_1 = t_2 = \pm \infty$`, and therefore either `$t_{\min} = +\infty$` or `$t_{\max} = -\infty$`.
One of those values will stick around through the rest of the algorithm, causing us to return `false`.

Unfortunately the above analysis has a caveat: if the ray lies exactly on a slab (`$\mathtt{r.origin}_i = \mathtt{b.min}_i$` or `$\mathtt{r.origin}_i = \mathtt{b.max}_i$`), we'll have (say)

```math
\begin{aligned}
t_1 &= (\mathtt{b.min}_i - \mathtt{r.origin}_i) \cdot \mathtt{r.dir\_inv}_i \\
&= 0 \cdot \infty \\
&= \mathrm{NaN}
\end{aligned}
```

which behaves a lot less nicely than infinity.
Correctly handling this edge (literally!) case depends on the exact behaviour of `min()` and `max()`.


## On min and max

The most common implementation of `min()` and `max()` is probably

```c
#define min(x, y) ((x) < (y) ? (x) : (y))
#define max(x, y) ((x) > (y) ? (x) : (y))
```

This form is so pervasive it was canonised as the behaviour of the min/max instructions in the SSE/SSE2 instruction sets.
Using these instructions is key to getting good performance out of the algorithm.
That being said, this form has some odd behaviour involving NaN.
Since all comparisons with NaN are false,

```math
\begin{array}{lclcl}
\min(x, \mathrm{NaN}) & = & \max(x, \mathrm{NaN}) & = & \mathrm{NaN} \\
\min(\mathrm{NaN}, x) & = & \max(\mathrm{NaN}, x) & = & x.
\end{array}
```

The operations neither propagate nor suppress NaNs; instead, when either argument is NaN, the second argument is always returned.
(There is also similar odd behaviour concerning signed zero, but it doesn't affect this algorithm.)

In contrast, the IEEE 754-specified min/max operations (called "minNum" and "maxNum") suppress NaNs, always returning a number if possible.
This is also the behaviour of C99's `fmin()` and `fmax()` functions.
On the other hand, Java's `Math.min()` and `Math.max()` functions propagate NaNs, staying consistent with most other binary operations on floating point values.
<a name="citor-3" href="#cite-3">[3]</a> and <a name="citor-4" href="#cite-4">[4]</a> have some more discussion about the various min/max implementations in the wild.


## The problem

The IEEE and Java versions of `min()` and `max()` provide consistent behaviour: all rays that lie exactly on a slab are considered not to intersect the box.
It's easy to see why for the Java version, as the NaNs eventually pollute all the computations and make us return `false`.
For the IEEE version, `$\min(t_1, t_2) = \max(t_1, t_2) = \pm \infty$`, which is the same as when the ray is entirely outside the box.

(Since this is an edge case, you might wonder why we don't choose to return `true` instead of `false` for rays on the boundary.
It turns out to be much harder to get this behaviour with efficient code.)

With the SSE-friendly min/max implementations, the behaviour is inconsistent.
Some rays that lie on a slab will intersect, even if they are completely outside the box in another dimension:

![Ray/box NaN example](ray_box_nan.png)

In the above image, the camera lies in the plane of the top face of the cube, and intersections are computed with the above algorithm. The top face is seen to extend out past the sides, due to improper NaN handling.


## The workaround

When at most one argument is NaN, we can simulate the IEEE behaviour with

```math
\begin{aligned}
\mathrm{minNum}(x, y) &= \min(x, \min(y, +\infty)) \\
\mathrm{maxNum}(x, y) &= \max(x, \max(y, -\infty))
\end{aligned}
```

Thierry Berger-Perrin applies a similar strategy in <a name="citor-5" href="#cite-5">[5]</a>, effectively computing

```c
tmin = max(tmin, min(min(t1, t2), INFINITY));
tmax = min(tmax, max(max(t1, t2), -INFINITY));
```

in the loop instead.
It is also fine to do

```c
tmin = max(tmin, min(min(t1, t2), tmax));
tmax = min(tmax, max(max(t1, t2), tmin));
```

which is around 30% faster because CPUs are slower at handling floating point special cases (infinities, NaNs, subnormals).
For the same reason, it's better to unroll the loop like this, to avoid dealing with any more infinities than necessary:

```c
bool intersection(box b, ray r) {
    double t1 = (b.min[0] - r.origin[0])*r.dir_inv[0];
    double t2 = (b.max[0] - r.origin[0])*r.dir_inv[0];

    double tmin = min(t1, t2);
    double tmax = max(t1, t2);

    for (int i = 1; i < 3; ++i) {
        t1 = (b.min[i] - r.origin[i])*r.dir_inv[i];
        t2 = (b.max[i] - r.origin[i])*r.dir_inv[i];

        tmin = max(tmin, min(min(t1, t2), tmax));
        tmax = min(tmax, max(max(t1, t2), tmin));
    }

    return tmax > max(tmin, 0.0);
}
```

It's a little harder to see why this version is correct: any NaNs from the `$x$` coordinate will propagate through to the end, while NaNs from other coordinates will result in `$t_{\min} \ge t_{\max}$`; in both cases, `false` is returned.

With GCC 4.9.2 at `-O3` this implementation handles just over 93 million rays per second, meaning the runtime is around 30 clock cycles, even without vectorization!


## The other workaround

Sadly, that's still about 15% slower than the version with no explicit NaN handling.
And since this algorithm is generally used when traversing a bounding volume hierarchy, the worst thing that can happen is you traverse more nodes than necessary in degenerate cases.
For many applications, this is well worth it, and it should never result in any visual artifacts in practice if the ray/object intersection functions are implemented correctly.
For completeness, here's a fast implementation (108 million rays/second) that doesn't attempt to handle NaNs consistently:

```c
bool intersection(box b, ray r) {
    double t1 = (b.min[0] - r.origin[0])*r.dir_inv[0];
    double t2 = (b.max[0] - r.origin[0])*r.dir_inv[0];

    double tmin = min(t1, t2);
    double tmax = max(t1, t2);

    for (int i = 1; i < 3; ++i) {
        t1 = (b.min[i] - r.origin[i])*r.dir_inv[i];
        t2 = (b.max[i] - r.origin[i])*r.dir_inv[i];

        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));
    }

    return tmax > max(tmin, 0.0);
}
```

The program I used to test various `intersection()` implementations is given in <a name="citor-6" href="#cite-6">[6]</a>.
In my next post on this topic, I'll talk about low-level implementation details, including vectorization, to get the most performance possible out of this algorithm.


---

<ol style="list-style: none; padding-left: 0;">
    <li><a name="cite-1" href="#citor-1">[1]</a>: Brian Smits: <a href="http://www.cs.utah.edu/~bes/papers/fastRT/">Efficiency Issues for Ray Tracing</a>.  <em>Journal of Graphics Tools</em> (1998).
    <li><a name="cite-2" href="#citor-2">[2]</a>: Amy Williams. et al.: <a href="http://www.cs.utah.edu/~awilliam/box/">An Efficient and Robust Ray-Box Intersection Algorithm</a>.  <em>Journal of Graphics Tools</em> (2005).
    <li><a name="cite-3" href="#citor-3">[3]</a>: <a href="https://groups.google.com/forum/#!topic/llvm-dev/-SKl0nOJW_w">https://groups.google.com/forum/#!topic/llvm-dev/-SKl0nOJW_w</a>
    <li><a name="cite-4" href="#citor-4">[4]</a>: <a href="https://ghc.haskell.org/trac/ghc/ticket/9251">https://ghc.haskell.org/trac/ghc/ticket/9251</a>
    <li><a name="cite-5" href="#citor-5">[5]</a>: <a href="http://www.flipcode.com/archives/SSE_RayBox_Intersection_Test.shtml">http://www.flipcode.com/archives/SSE_RayBox_Intersection_Test.shtml</a>
    <li><a name="cite-6" href="#citor-6">[6]</a>: <a href="https://gist.github.com/tavianator/132d081ed4d410c755fd">https://gist.github.com/tavianator/132d081ed4d410c755fd</a>
</ol>


---

2015-03-23
