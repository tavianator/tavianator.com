# Fast, Branchless Ray/Bounding Box Intersections, Part 3: Boundaries

<div class="infobar">

<fa:clock-o> 2022-07-27
<fa:user> Tavian Barnes

</div>

[Last time I wrote about ray/box intersections](../2015/ray_box_nan.md), we left off with a simple and fast implementation of the slab method that handles all the corner cases.
To save you the trouble of (re-)reading the last two posts, I'll start with a quick recap.
Feel free to skip to the [next section](#boundaries) if you're already familiar with it.

An axis-aligned bounding box `$\square$` can be specified by the coordinates of two of its corners:

<p style="text-align: center;">
  <svg style="display:block; margin:auto; font-family:serif;" width="550" height="340" viewBox="-80 40 550 340">
    <defs>
      <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="var(--icons)" stroke-width="1" />
      </pattern>
      <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="var(--icons)" stroke-width="0.5" />
        <line x1="0" y1="4" x2="8" y2="4" stroke="var(--icons)" stroke-width="0.5" />
      </pattern>
    </defs>
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <circle cx="80" cy="320" r="4" fill="var(--fg)" />
    <foreignObject x="-70" y="300" width="140" height="80">
      <code>$\square_{\min} = \begin{pmatrix} x_{\min} \\ y_{\min} \\ z_{\min} \end{pmatrix}$</code>
    </foreignObject>
    <circle cx="320" cy="80" r="4" fill="var(--fg)" />
    <foreignObject x="330" y="40" width="140" height="80">
      <code>$\square_{\max} = \begin{pmatrix} x_{\max} \\ y_{\max} \\ z_{\max} \end{pmatrix}$</code>
    </foreignObject>
  </svg>
</p>

A point `$(x, y, z)$` is inside the box if and only if

```math
\begin{alignedat}{3}
& x_{\min} && < x && < x_{\max} \\
& y_{\min} && < y && < y_{\max} \\
& z_{\min} && < z && < z_{\max}. \\
\end{alignedat}
```

Equivalently, the interior of the box is the intersection of many [half-spaces](https://en.wikipedia.org/wiki/Half-space_(geometry)):

<p style="text-align: center;">
  <svg style="display:block; margin:auto; font-family:serif;" width="550" height="400" viewBox="-80 0 550 400">
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$x &gt; x_{\min}$</code>
      </foreignObject>
      <set id="reset" attributeName="visibility" to="hidden" begin="0s; edges.end" dur="4s" />
      <set id="xmin" attributeName="visibility" to="visible" begin="reset.end" dur="2s" />
      <set attributeName="visibility" to="hidden" begin="xmin.end" end="edges.begin" />
      <set id="edges" attributeName="visibility" to="hidden" begin="ymax.end" dur="4s" />
    </g>
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$x &lt; x_{\max}$</code>
      </foreignObject>
      <set id="xmax" attributeName="visibility" to="visible" begin="xmin.end" dur="2s" />
      <set attributeName="visibility" to="hidden" begin="xmax.end" end="xmax.begin" />
    </g>
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$y &gt; y_{\min}$</code>
      </foreignObject>
      <set id="ymin" attributeName="visibility" to="visible" begin="xmax.end" dur="2s" />
      <set attributeName="visibility" to="hidden" begin="ymin.end" end="ymin.begin" />
    </g>
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$y &lt; y_{\max}$</code>
      </foreignObject>
      <set id="ymax" attributeName="visibility" to="visible" begin="ymin.end" dur="2s" />
      <set attributeName="visibility" to="hidden" begin="ymax.end" end="ymax.begin" />
    </g>
    <rect x="-80" y="0" width="550" height="400" fill="url(#hatch)">
      <animate attributeName="x" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="width" to="390" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="width" to="240" begin="xmax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y" to="80" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="height" to="320" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="height" to="240" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y" to="0" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="width" to="550" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="height" to="400" begin="reset.begin" dur="1s" fill="freeze" />
    </rect>
    <line x1="-81" y1="0" x2="-81" y2="400" stroke="var(--fg)">
      <animate attributeName="x1" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-81" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="0" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="-81" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="400" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="471" y1="0" x2="471" y2="400" stroke="var(--fg)">
      <animate attributeName="x1" to="320" begin="xmax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="xmax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="471" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="0" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="471" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="400" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="-1" x2="470" y2="-1" stroke="var(--fg)">
      <animate attributeName="y1" to="80" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="80" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="-1" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="470" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="-1" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="401" x2="470" y2="401" stroke="var(--fg)">
      <animate attributeName="y1" to="320" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="401" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="470" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="401" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
  </svg>
</p>

The slab method tests for an intersection between a ray and an AABB (axis-aligned bounding box) by repeatedly clipping the line with these half-spaces.
In the end, what's left of the ray is the segment that intersects the box, if any.

<p style="text-align: center;">
  <svg style="display:block; margin:auto; font-family:serif;" width="550" height="400" viewBox="-80 0 550 400">
    <line x1="-81" y1="0" x2="-81" y2="400" stroke="var(--fg)">
      <animate attributeName="x1" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-81" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="0" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="-81" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="400" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="471" y1="0" x2="471" y2="400" stroke="var(--fg)">
      <animate attributeName="x1" to="320" begin="xmax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="xmax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="471" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="0" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="471" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="400" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="-1" x2="470" y2="-1" stroke="var(--fg)">
      <animate attributeName="y1" to="80" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="80" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="-1" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="470" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="-1" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="401" x2="470" y2="401" stroke="var(--fg)">
      <animate attributeName="y1" to="320" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="80" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="401" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="470" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="401" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="200" x2="120" y2="0" stroke="var(--icons)" stroke-dasharray="1" />
    <line x1="-80" y1="200" x2="120" y2="0" stroke="var(--fg)" stroke-width="2">
      <animate attributeName="x1" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="40" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="40" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="80" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="stroke" to="red" begin="ymin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="200" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="120" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="0" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="stroke" to="var(--fg)" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="200" x2="386.666666" y2="0" stroke="var(--icons)" stroke-dasharray="1" />
    <line x1="-80" y1="200" x2="386.666666" y2="0" stroke="var(--fg)" stroke-width="2">
      <animate attributeName="x1" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="131.428571" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="xmax.begin+0.277777s" dur="0.222222s" fill="freeze" />
      <animate attributeName="y2" to="28.571428" begin="xmax.begin+0.277777s" dur="0.222222s" fill="freeze" />
      <animate attributeName="x2" to="200" begin="ymin.begin+0.17857142s" dur="0.32142857s" fill="freeze" />
      <animate attributeName="y2" to="80" begin="ymin.begin+0.17857142s" dur="0.32142857s" fill="freeze" />
      <animate attributeName="stroke" to="green" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="200" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="386.666666" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="0" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="stroke" to="var(--fg)" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="200" x2="470" y2="200" stroke="var(--icons)" stroke-dasharray="1" />
    <line x1="-80" y1="200" x2="470" y2="200" stroke="var(--fg)" stroke-width="2">
      <animate attributeName="x1" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="xmax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="stroke" to="green" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="470" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="stroke" to="var(--fg)" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="200" x2="386.666666" y2="400" stroke="var(--icons)" stroke-dasharray="1" />
    <line x1="-80" y1="200" x2="386.666666" y2="400" stroke="var(--fg)" stroke-width="2">
      <animate attributeName="x1" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="268.571428" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="320" begin="xmax.begin+0.277777s" dur="0.222222s" fill="freeze" />
      <animate attributeName="y2" to="371.428571" begin="xmax.begin+0.277777s" dur="0.222222s" fill="freeze" />
      <animate attributeName="x2" to="200" begin="ymax.begin+0.17857142s" dur="0.32142857s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="ymax.begin+0.17857142s" dur="0.32142857s" fill="freeze" />
      <animate attributeName="stroke" to="green" begin="edges.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="200" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="386.666666" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="400" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="stroke" to="var(--fg)" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <line x1="-80" y1="200" x2="120" y2="400" stroke="var(--icons)" stroke-dasharray="1" />
    <line x1="-80" y1="200" x2="120" y2="400" stroke="var(--fg)" stroke-width="2">
      <animate attributeName="x1" to="80" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y1" to="360" begin="xmin.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x2" to="40" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="y2" to="320" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="stroke" to="red" begin="ymax.begin" dur="0.5s" fill="freeze" />
      <animate attributeName="x1" to="-80" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y1" to="200" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="x2" to="120" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="y2" to="400" begin="reset.begin" dur="1s" fill="freeze" />
      <animate attributeName="stroke" to="var(--fg)" begin="reset.begin" dur="1s" fill="freeze" />
    </line>
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
  </svg>
</p>

A ray is typically defined parametrically by

```math
\ell(t) = \begin{pmatrix}
x_0 \\
y_0 \\
z_0 \\
\end{pmatrix} + t \begin{pmatrix}
x_d \\
y_d \\
z_d \\
\end{pmatrix},
```

where `$(x_0, y_0, z_0)$` is the origin of the ray and `$(x_d, y_d, z_d)$` is the ray's direction.
`$t > 0$` is considered &ldquo;in front&rdquo; of the origin, while `$t < 0$` is &ldquo;behind&rdquo; it.
We can find where the ray intersects an axis-aligned plane by solving (for example)

```math
\ell_x(t) = x_0 + t x_d = x
```

for

```math
t = \frac{x - x_0}{x_d}.
```

The segment of the ray that intersects the `$x$` planes of the bounding box is then

<p style="text-align: center;">
  <svg style="display:block; margin:auto; font-family:serif;" width="550" height="200" viewBox="-80 0 550 200">
    <line x1="80" y1="0" x2="80" y2="400" stroke="var(--fg)" />
    <line x1="320" y1="0" x2="320" y2="400" stroke="var(--fg)" />
    <line x1="-80" y1="200" x2="386.666666" y2="0" stroke="var(--icons)" stroke-dasharray="1" />
    <line x1="80" y1="131.428571" x2="320" y2="28.571428" stroke="var(--fg)" stroke-width="2" />
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <circle cx="80" cy="131.428571" r="4" fill="var(--fg)" />
    <foreignObject x="-50" y="100" width="125" height="45">
      <code>$\displaystyle t_1 = \frac{x_{\min} - x_0}{x_d}$</code>
    </foreignObject>
    <circle cx="320" cy="28.571428" r="4" fill="var(--fg)" />
    <foreignObject x="330" y="30" width="125" height="45">
      <code>$\displaystyle t_2 = \frac{x_{\max} - x_0}{x_d}$</code>
    </foreignObject>
  </svg>
</p>

```math
\begin{aligned}
t_{\min} & = \min \{ t_1, t_2 \} \\
t_{\max} & = \max \{ t_1, t_2 \}. \\
\end{aligned}
```

The intersection of two segments `$(u_{\min}, u_{\max})$` and `$(v_{\min}, v_{\max})$` is just

```math
\begin{aligned}
t_{\min} & = \max \{ u_{\min}, v_{\min} \} \\
t_{\max} & = \min \{ u_{\max}, v_{\max} \}. \\
\end{aligned}
```

If we end up with `$t_{\min} > t_{\max}$`, the intersection is empty.

Putting all this together leads to a naturally branch-free ray/AABB intersection test (assuming `min()` and `max()` are branch-free and loops are unrolled):

```c
bool intersection(ray r, box b) {
    float tmin = 0.0, tmax = INFINITY;

    for (int i = 0; i < 3; ++i) {
        float t1 = (b.min[i] - r.origin[i]) * r.dir_inv[i];
        float t2 = (b.max[i] - r.origin[i]) * r.dir_inv[i];

        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));
    }

    return tmin < tmax;
}
```

We precompute `r.dir_inv[i] = 1.0 / r.dir[i]` to replace division (slow) with multiplication (fast).
You might worry about dividing by zero, but [part 1](../2011/ray_box.md) describes how floating point infinities lead to the right answer even when `r.dir[i] == 0.0`.

You might also worry about the multiplication, since in floating point, `$0 * \infty \equiv \mathrm{NaN}$`.
Luckily, [part 2](../2015/ray_box_nan.md) describes a simple fix:

```diff
-        tmin = max(tmin, min(t1, t2));
-        tmax = min(tmax, max(t1, t2));
+        tmin = max(tmin, min(min(t1, t2), tmax));
+        tmax = min(tmax, max(max(t1, t2), tmin));
```

which works for the most efficient implementation of `min()`/`max()`:

```c
static inline float min(float x, float y) {
    return x < y ? x : y;
}

static inline float max(float x, float y) {
    return x > y ? x : y;
}
```


## Boundaries

You may have noticed that all the inequalities above are strict (`$<$`, not `$\le$`).
That means rays which just touch a corner, edge, or face of the bounding box will be considered non-intersecting.

<p style="text-align: center;">
  <svg style="display:block; margin:auto; font-family:serif;" width="550" height="340" viewBox="-80 40 550 340">
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <line x1="-80" y1="80" x2="120" y2="380" stroke="red" stroke-width="2" />
    <line x1="-80" y1="80" x2="470" y2="80" stroke="red" stroke-width="2" />
  </svg>
</p>

This might not be too big a deal, since rays that exactly touch the boundary of the box are a somewhat degenerate case.
Of course, degenerate doesn't mean *impossible* or even *unlikely*, so it would be nice to include the boundary.
[Several](../2015/ray_box_nan.md#comment-4) [comments](../2015/ray_box_nan.md#comment-6) [on the](../2015/ray_box_nan.md#comment-10) [last post](../2015/ray_box_nan.md#comment-11) [agree](https://twitter.com/spydon/status/1551717294061002752).

Sadly, relaxing the inequalities fixes the corner case, but not the edge case, since that's the one involving `NaN`:

```diff
-    return tmin < tmax;
+    return tmin <= tmax;
```

<p style="text-align: center;">
  <svg style="display:block; margin:auto; font-family:serif;" width="550" height="340" viewBox="-80 40 550 340">
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <line x1="-80" y1="80" x2="120" y2="380" stroke="green" stroke-width="2" />
    <line x1="-80" y1="80" x2="470" y2="80" stroke="red" stroke-width="2" />
  </svg>
</p>

I alluded to this in the [previous post](../2015/ray_box_nan.md#the-problem):

> (Since this is an edge case, you might wonder why we don't choose to return `true` instead of `false` for rays on the boundary.
> It turns out to be much harder to get this behaviour with efficient code.)

I'm happy to announce that after ~~seven years of grueling research~~ thinking about it for a few minutes yesterday, I finally found an efficient implementation that includes the boundary:

```diff
-        tmin = max(tmin, min(t1, t2));
-        tmax = min(tmax, max(t1, t2));
+        tmin = min(max(t1, tmin), max(t2, tmin));
+        tmax = max(min(t1, tmax), min(t2, tmax));
```

<p style="text-align: center;">
  <svg style="display:block; margin:auto; font-family:serif;" width="550" height="340" viewBox="-80 40 550 340">
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <line x1="-80" y1="80" x2="120" y2="380" stroke="green" stroke-width="2" />
    <line x1="-80" y1="80" x2="470" y2="80" stroke="green" stroke-width="2" />
  </svg>
</p>

This works for both the SSE-friendly and the IEEE-compliant `min()`/`max()` implementations, but not the NaN-propagating ones.


## Performance

The boundary-inclusive implementation looks like this:

```c
bool intersection(ray r, box b) {
    float tmin = 0.0, tmax = INFINITY;

    for (int i = 0; i < 3; ++i) {
        float t1 = (b.min[i] - r.origin[i]) * r.dir_inv[i];
        float t2 = (b.max[i] - r.origin[i]) * r.dir_inv[i];

        tmin = min(max(t1, tmin), max(t2, tmin));
        tmax = max(min(t1, tmax), min(t2, tmax));
    }

    return tmin <= tmax;
}
```

I benchmarked it against the versions from [part 1](../2011/ray_box.md) and [part 2](../2015/ray_box_nan.md) (adjusted to also include the boundary, and to use `float` instead of `double`).
Part 1 was still the fastest at 271 million rays per second, but this version was only 9% slower at 241 Mrays/s, beating part 2's 235 Mrays/s.
At least, when compiled with `clang -O3`.
GCC 12.1 [stubbornly refused](https://godbolt.org/z/4qb9j6nYq) to use single instructions for some `min()`/`max()` calls, which destroyed its performance.
