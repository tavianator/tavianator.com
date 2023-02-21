# Fast, Branchless Ray/Bounding Box Intersections, Part 3: Boundaries

<div class="infobar">

<fa:clock-o> <time:2022-07-27>
<fa:user> Tavian Barnes
[<fa:github> GitHub](https://github.com/tavianator/ray_box)

</div>

<ins>This post is the third in a series of posts I've written about ray/bounding box intersection tests.
However, it supersedes the previous two, and should be self contained, so don't feel like you have to read the others unless you're interested in the historical context.
On <time:2022-09-10>, <time:2022-09-14>, and <time:2023-02-18>, I substantially revised this post, improving the implementation and adding a much more thorough performance analysis.</ins>

[Last time I wrote about ray/box intersections](../2015/ray_box_nan.md), we left off with a simple and fast implementation of the slab method that handles all the corner cases.
To save you the trouble of (re-)reading the last two posts, I'll start with a quick recap.
Feel free to skip to the [next section](#boundaries) if you're already familiar with it.


## Geometry

An axis-aligned bounding box `$\square$` can be specified by the coordinates of two of its corners:

<figure>
  <svg class="fig-scale" width="550" viewBox="-80 40 550 340">
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
      <code>$\square_{\min{}} = \begin{pmatrix} x_{\min{}} \\ y_{\min{}} \\ z_{\min{}} \end{pmatrix}$</code>
    </foreignObject>
    <circle cx="320" cy="80" r="4" fill="var(--fg)" />
    <foreignObject x="330" y="40" width="140" height="80">
      <code>$\square_{\max{}} = \begin{pmatrix} x_{\max{}} \\ y_{\max{}} \\ z_{\max{}} \end{pmatrix}$</code>
    </foreignObject>
  </svg>
</figure>

A point `$(x, y, z)$` is inside the box if and only if

```math
\begin{alignedat}{3}
& x_{\min{}} && < x && < x_{\max{}} \\
& y_{\min{}} && < y && < y_{\max{}} \\
& z_{\min{}} && < z && < z_{\max{}}. \\
\end{alignedat}
```

Equivalently, the interior of the box is the intersection of many [half-spaces](https://en.wikipedia.org/wiki/Half-space_(geometry)):

<figure>
  <svg class="fig-scale" width="550" viewBox="-80 0 550 400">
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$x &gt; x_{\min{}}$</code>
      </foreignObject>
      <set id="reset" attributeName="visibility" to="hidden" begin="0s; edges.end" dur="4s" />
      <set id="xmin" attributeName="visibility" to="visible" begin="reset.end" dur="2s" />
      <set attributeName="visibility" to="hidden" begin="xmin.end" end="edges.begin" />
      <set id="edges" attributeName="visibility" to="hidden" begin="ymax.end" dur="4s" />
    </g>
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$x &lt; x_{\max{}}$</code>
      </foreignObject>
      <set id="xmax" attributeName="visibility" to="visible" begin="xmin.end" dur="2s" />
      <set attributeName="visibility" to="hidden" begin="xmax.end" end="xmax.begin" />
    </g>
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$y &gt; y_{\min{}}$</code>
      </foreignObject>
      <set id="ymin" attributeName="visibility" to="visible" begin="xmax.end" dur="2s" />
      <set attributeName="visibility" to="hidden" begin="ymin.end" end="ymin.begin" />
    </g>
    <g visibility="hidden">
      <foreignObject x="160" y="185" width="80" height="25">
        <code>$y &lt; y_{\max{}}$</code>
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
</figure>

The slab method tests for an intersection between a ray and an AABB (axis-aligned bounding box) by repeatedly clipping the line with these half-spaces.
In the end, what's left of the ray is the segment that intersects the box, if any.

<figure>
  <svg class="fig-scale" width="550" viewBox="-80 0 550 400">
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
</figure>

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

<figure>
  <svg class="fig-scale" width="550" viewBox="-80 0 550 200">
    <line x1="80" y1="0" x2="80" y2="400" stroke="var(--fg)" />
    <line x1="320" y1="0" x2="320" y2="400" stroke="var(--fg)" />
    <line x1="-80" y1="200" x2="386.666666" y2="0" stroke="var(--icons)" stroke-dasharray="1" />
    <line x1="80" y1="131.428571" x2="320" y2="28.571428" stroke="var(--fg)" stroke-width="2" />
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <circle cx="80" cy="131.428571" r="4" fill="var(--fg)" />
    <foreignObject x="-50" y="100" width="125" height="45">
      <code>$\displaystyle t_1 = \frac{x_{\min{}} - x_0}{x_d}$</code>
    </foreignObject>
    <circle cx="320" cy="28.571428" r="4" fill="var(--fg)" />
    <foreignObject x="330" y="30" width="125" height="45">
      <code>$\displaystyle t_2 = \frac{x_{\max{}} - x_0}{x_d}$</code>
    </foreignObject>
  </svg>
</figure>

```math
\begin{aligned}
t_{\min{}} & = \min \{ t_1, t_2 \} \\
t_{\max{}} & = \max \{ t_1, t_2 \}. \\
\end{aligned}
```

The intersection of two segments `$(u_{\min{}}, u_{\max{}})$` and `$(v_{\min{}}, v_{\max{}})$` is just

```math
\begin{aligned}
t_{\min{}} & = \max \{ u_{\min{}}, v_{\min{}} \} \\
t_{\max{}} & = \min \{ u_{\max{}}, v_{\max{}} \}. \\
\end{aligned}
```

If we end up with `$t_{\min{}} > t_{\max{}}$`, the intersection is empty.

Putting all this together leads to a naturally branch-free ray/AABB intersection test (assuming `min()` and `max()` are branch-free and loops are unrolled):

```c
/// Parametric representation of a ray.
struct ray {
    float origin[3];
    float dir[3];
    float dir_inv[3];
};

/// An axis-aligned bounding box.
struct box {
    float min[3];
    float max[3];
};

bool intersection(const struct ray *ray, const struct box *box) {
    float tmin = 0.0, tmax = INFINITY;

    for (int d = 0; d < 3; ++d) {
        float t1 = (box->min[d] - ray->origin[d]) * ray->dir_inv[d];
        float t2 = (box->max[d] - ray->origin[d]) * ray->dir_inv[d];

        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));
    }

    return tmin < tmax;
}
```

We precompute `ray->dir_inv[d] = 1.0 / ray->dir[d]` to replace division (slow) with multiplication (fast).
You might worry about dividing by zero, but [part 1](../2011/ray_box.md) describes how floating point infinities lead to the right answer even when `ray->dir[d] == 0.0`.

You might also worry about the multiplication, since in floating point, `$0 * \infty \equiv \mathrm{NaN}$`.
Luckily, [part 2](../2015/ray_box_nan.md) describes a simple fix:

<div class="tabs">
<input type="radio" id="tabs-nan-diff" name="tabs-nan" checked>
<label for="tabs-nan-diff">Diff</label>
<input type="radio" id="tabs-nan-code" name="tabs-nan">
<label for="tabs-nan-code">Full code</label>

<div class="tab">

```diff
-        tmin = max(tmin, min(t1, t2));
-        tmax = min(tmax, max(t1, t2));
+        tmin = max(tmin, min(min(t1, t2), tmax));
+        tmax = min(tmax, max(max(t1, t2), tmin));
```

</div>
<div class="tab">

```c
bool intersection(const struct ray *ray, const struct box *box) {
    float tmin = 0.0, tmax = INFINITY;

    for (int d = 0; d < 3; ++d) {
        float t1 = (box->min[d] - ray->origin[d]) * ray->dir_inv[d];
        float t2 = (box->max[d] - ray->origin[d]) * ray->dir_inv[d];

        tmin = max(tmin, min(min(t1, t2), tmax));
        tmax = min(tmax, max(max(t1, t2), tmin));
    }

    return tmin < tmax;
}
```

</div>
</div>


## Boundaries

You may have noticed that all the inequalities above are strict (`$<$`, not `$\le$`).
That means rays which just touch a corner, edge, or face of the bounding box will be considered non-intersecting.

<figure>
  <svg class="fig-scale" width="550" viewBox="-80 40 550 340">
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <line x1="-80" y1="80" x2="120" y2="380" stroke="red" stroke-width="2" />
    <line x1="-80" y1="80" x2="470" y2="80" stroke="red" stroke-width="2" />
  </svg>
</figure>

This might not be too big a deal, since rays that exactly touch the boundary of the box are a somewhat degenerate case.
Of course, degenerate doesn't mean *impossible* or even *unlikely*, so it would be nice to include the boundary.
[Several](../2015/ray_box_nan.md#comment-4) [comments](../2015/ray_box_nan.md#comment-6) [on the](../2015/ray_box_nan.md#comment-10) [last post](../2015/ray_box_nan.md#comment-11) [agree](https://twitter.com/spydon/status/1551717294061002752).

Sadly, relaxing the inequalities fixes the corner case, but not the edge case, since that's the one involving NaN:

```diff
-    return tmin < tmax;
+    return tmin <= tmax;
```

<figure>
  <svg class="fig-scale" width="550" viewBox="-80 40 550 340">
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <line x1="-80" y1="80" x2="120" y2="380" stroke="green" stroke-width="2" />
    <line x1="-80" y1="80" x2="470" y2="80" stroke="red" stroke-width="2" />
  </svg>
</figure>

I alluded to this in the [previous post](../2015/ray_box_nan.md#the-problem):

> (Since this is an edge case, you might wonder why we don't choose to return `true` instead of `false` for rays on the boundary.
> It turns out to be much harder to get this behaviour with efficient code.)

I'm happy to announce that after ~~seven years of grueling research~~ thinking about it for a few minutes yesterday, I finally found an efficient implementation that includes the boundary.
If `min()` and `max()` are implemented in the obvious way:

```c
static inline float min(float x, float y) {
    return x < y ? x : y;
}

static inline float max(float x, float y) {
    return x > y ? x : y;
}
```

(which is also typically the most efficient way, since it matches the x86 SSE min/max instructions), then we get some curious semantics around NaN:

```math
\begin{aligned}
\min\{x, \mathrm{NaN}\} & = \max\{x, \mathrm{NaN}\} = \mathrm{NaN} \\
\min\{\mathrm{NaN}, y\} & = \max\{\mathrm{NaN}, y\} = y. \\
\end{aligned}
```

We'd like to keep `tmin` and `tmax` unchanged if either `t1` or `t2` is NaN, so swapping the arguments to keep `tmin`/`tmax` on the right seems like a good idea:

```diff
-        tmin = max(tmin, min(t1, t2));
-        tmax = min(tmax, max(t1, t2));
+        tmin = max(min(t1, t2), tmin);
+        tmax = min(max(t1, t2), tmax);
```

This works if `t2` is NaN, but doesn't handle `t1`.
The last piece of the puzzle is to push `tmin`/`tmax` into the inner `min()`/`max()`, so that at least one argument is always non-NaN:

<div class="tabs">
<input type="radio" id="tabs-boundary-diff" name="tabs-boundary" checked>
<label for="tabs-boundary-diff">Diff</label>
<input type="radio" id="tabs-boundary-code" name="tabs-boundary">
<label for="tabs-boundary-code">Full code</label>

<div class="tab">

```diff
-        tmin = max(min(t1, t2), tmin);
-        tmax = min(max(t1, t2), tmax);
+        tmin = min(max(t1, tmin), max(t2, tmin));
+        tmax = max(min(t1, tmax), min(t2, tmax));
```

</div>
<div class="tab">

```c
bool intersection(const struct ray *ray, const struct box *box) {
    float tmin = 0.0, tmax = INFINITY;

    for (int d = 0; d < 3; ++d) {
        float t1 = (box->min[d] - ray->origin[d]) * ray->dir_inv[d];
        float t2 = (box->max[d] - ray->origin[d]) * ray->dir_inv[d];

        tmin = min(max(t1, tmin), max(t2, tmin));
        tmax = max(min(t1, tmax), min(t2, tmax));
    }

    return tmin <= tmax;
}
```

</div>
</div>

<figure>
  <svg class="fig-scale" width="550" viewBox="-80 40 550 340">
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <line x1="-80" y1="80" x2="120" y2="380" stroke="green" stroke-width="2" />
    <line x1="-80" y1="80" x2="470" y2="80" stroke="green" stroke-width="2" />
  </svg>
</figure>


## Signs

Looking again at the formulas

```math
\begin{aligned}
t_1 & = \frac{x_{\min{}} - x_0}{x_d}, & t_2 & = \frac{x_{\max{}} - x_0}{x_d},
\end{aligned}
```

you might wonder if we have to calculate `$\min \{ t_1, t_2 \}$` or `$\max \{ t_1, t_2 \}$` at all.
Since we already know `$x_{\min{}} < x_{\max{}}$`, the sign of `$x_d$` is the only thing that affects the order of `$t_1$` and `$t_2$`.
If we use that sign to select which box coordinates to use:

```math
\begin{aligned}
(b_{\min{}}, x_{\max{}}) & = (x_{\min{}}, x_{\max{}}) && \text{if $x_d > 0$,} \\
(b_{\min{}}, x_{\max{}}) & = (x_{\max{}}, x_{\min{}}) && \text{otherwise,} \\
\end{aligned}
```

then we can directly calculate

```math
\begin{aligned}
t_{\min{}} & = \frac{b_{\min{}} - x_0}{x_d}, & t_{\max{}} & = \frac{x_{\max{}} - x_0}{x_d},
\end{aligned}
```

avoiding the `min()`/`max()` calls entirely.
In code, that looks like


<div class="tabs">
<input type="radio" id="tabs-signs-diff" name="tabs-signs" checked>
<label for="tabs-signs-diff">Diff</label>
<input type="radio" id="tabs-signs-code" name="tabs-signs">
<label for="tabs-signs-code">Full code</label>

<div class="tab">

```diff
 struct box {
-    float min[3];
-    float max[3];
+    float corners[2][3];
 };
 
 bool intersection(const struct ray *ray, const struct box *box) {
     float tmin = 0.0, tmax = INFINITY;

     for (int d = 0; d < 3; ++d) {
-        float t1 = (box->min[d] - ray->origin[d]) * ray->dir_inv[d];
-        float t2 = (box->max[d] - ray->origin[d]) * ray->dir_inv[d];
+        bool sign = signbit(ray->dir_inv[d]);
+        float bmin = box->corners[sign][d];
+        float bmax = box->corners[!sign][d];
+
+        float dmin = (bmin - ray->origin[d]) * ray->dir_inv[d];
+        float dmax = (bmax - ray->origin[d]) * ray->dir_inv[d];
 
-        tmin = min(max(t1, tmin), max(t2, tmin));
-        tmax = max(min(t1, tmax), min(t2, tmax));
+        tmin = max(dmin, tmin);
+        tmax = min(dmax, tmax);
     }

     return tmin < tmax;
 }
```

</div>
<div class="tab">

```c
/// Parametric representation of a ray.
struct ray {
    float origin[3];
    float dir[3];
    float dir_inv[3];
};

/// An axis-aligned bounding box.
struct box {
    float corners[2][3];
};

bool intersection(const struct ray *ray, const struct box *box) {
    float tmin = 0.0, tmax = INFINITY;

    for (int d = 0; d < 3; ++d) {
        bool sign = signbit(ray->dir_inv[d]);
        float bmin = box->corners[sign][d];
        float bmax = box->corners[!sign][d];

        float dmin = (bmin - ray->origin[d]) * ray->dir_inv[d];
        float dmax = (bmax - ray->origin[d]) * ray->dir_inv[d];

        tmin = max(dmin, tmin);
        tmax = min(dmax, tmax);
    }

    return tmin < tmax;
}
```

</div>
</div>

I've tried this optimization in the past with mixed results, but combined with the improvements in the next few sections, it gives a significant benefit.


## Batching

With the ray/box intersection API as it currently is, a simple ray tracer might call it like this:

```c
struct object *object = NULL;
float t = INFINITY;

for (int i = 0; i < nobjects; ++i) {
    if (intersection(ray, objects[i]->bounding_box)) {
        if (objects[i]->intersection(ray, &t)) {
            object = objects[i];
        }
    }
}
```

This is suboptimal in a few ways.
For starters, we're keeping track of the `$t$` value of the closest intersecting object, but the ray/box intersection test is ignoring it.
We should pass it in to avoid looking inside bounding boxes that are too far away:

```diff
-bool intersection(const struct ray *ray, const struct box *box) {
-    float tmin = 0.0, tmax = INFINITY;
+bool intersection(const struct ray *ray, const struct box *box, float tmax) {
+    float tmin = 0.0;
 ...
 for (int i = 0; i < nobjects; ++i) {
-    if (intersection(ray, objects[i]->bounding_box)) {
+    if (intersection(ray, objects[i]->bounding_box, t)) {
         if (objects[i]->intersection(ray, &t)) {
```

Another problem is that we just spent all this effort coming up with a fast, branchless intersection test, and then immediately branched on the result.
We could probably get more throughput by testing a ray against a batch of bounding boxes all at once, before we move onto the more expensive ray/object intersections.
But if we do that, `bool` (or even `bool[]`) is probably the wrong return type.
Instead, we should save the `$t$` values we calculated:

```c
void intersections(
    const struct ray *ray,
    size_t nboxes,
    const struct box boxes[nboxes],
    float ts[nboxes])
{
    bool signs[3];
    for (int d = 0; d < 3; ++d) {
        signs[d] = signbit(ray->dir_inv[d]);
    }

    for (size_t i = 0; i < nboxes; ++i) {
        const struct box *box = &boxes[i];
        float tmin = 0.0, tmax = ts[i];

        for (int d = 0; d < 3; ++d) {
            float bmin = box->corners[signs[d]][d];
            float bmax = box->corners[!signs[d]][d];

            float dmin = (bmin - ray->origin[d]) * ray->dir_inv[d];
            float dmax = (bmax - ray->origin[d]) * ray->dir_inv[d];

            tmin = max(dmin, tmin);
            tmax = min(dmax, tmax);
        }

        ts[i] = tmin <= tmax ? tmin : ts[i];
    }
}
```

and use them later to decide which boxes might still intersect the ray segment:

```c
// Pseudo-code, don't really use VLAs :)
float ts[nobjects] = {INFINITY, INFINITY, ...};
intersections(ray, nobjects, bounding_boxes, ts);

for (size_t i = 0; i < nobjects; ++i) {
    if (ts[i] < t) {
        if (objects[i]->intersection(ray, &t)) {
            object = objects[i];
        }
    }
}
```

This API also allows the implementation to be easily vectorized, parallelized, or even offloaded to a GPU.


## Performance

<div id="specs">

|                 |                                            |
|-----------------|--------------------------------------------|
| **CPU**         | [AMD Ryzen Threadripper 3960X]             |
| &emsp;Frequency | 3.8 GHz                                    |
| &emsp;Cores     | 24 (48 threads)                            |
| &emsp;Cache     | 24 &times; L1, 24 &times; L2, 8 &times; L3 |
| &emsp;&emsp;L1  | 32 KiB (inst), 32 KiB (data)               |
| &emsp;&emsp;L2  | 512 KiB                                    |
| &emsp;&emsp;L3  | 16 MiB                                     |
| &emsp;&mu;arch  | [Zen 2]                                    |
| **Memory**      | [Kingston KSM32ED8/32ME]                   |
| &emsp;Size      | 128 GiB (4 &times; 32 GiB)                 |
| &emsp;Type      | DDR4 3200 MHz (ECC)                        |
| &emsp;Timings   | 22-22-22                                   |
| &emsp;NUMA      | 4 nodes                                    |
| **Software**    | Arch Linux                                 |
| &emsp; Kernel   | 6.1.12-arch1-1                             |
| &emsp; Compiler | Clang 15.0.7                               |
| &emsp; Flags    | `-O3 -flto -march=native`                  |

</div>
<style>
#specs {
    float: right;
    font-size: smaller;
    margin: 0 0 20px 20px;
}
#specs .table-wrapper {
    //max-height: 180px;
    overflow-y: auto;
    overflow-x: hidden;
}
#specs .header {
    position: sticky;
    top: 0;
    background: var(--table-header-bg);
}
#specs .collapsed tr:not(:first-child) {
    visibility: collapse;
}
</style>
<script type="postproc">
const table = document.querySelector("#specs table");
table.tHead.remove();
const tBodies = [];
for (const row of table.querySelectorAll("tr")) {
    if (row.querySelector("strong")) {
        row.classList.add("header");
        tBodies.push(document.createElement("tbody"));
    }
    tBodies[tBodies.length - 1].append(row);
}
table.append(...tBodies);
</script>

[AMD Ryzen Threadripper 3960X]: https://en.wikichip.org/wiki/amd/ryzen_threadripper/3960x
[Zen 2]: https://en.wikichip.org/wiki/amd/microarchitectures/zen_2
[Kingston KSM32ED8/32ME]: https://www.kingston.com/dataSheets/KSM32ED8_32ME.pdf

I evaluated the performance of this algorithm on my high-end desktop, `tachyon`.
The full hardware and software configuration is listed in the table on the right.

I tried to extract as much performance as possible from the machine while keeping the measurements stable between runs.
The CPU was pinned to its maximum sustainable frequency of 3.8&nbsp;GHz, with [Turbo Core](https://en.wikipedia.org/wiki/AMD_Turbo_Core) (AMD's version of [Turbo Boost](https://en.wikipedia.org/wiki/Intel_Turbo_Boost)) disabled.
Threads were pinned to specific CPU cores based on the latency/throughput demands of each benchmark, and NUMA configuration (either pinned or interleaved) was tuned similarly.

The code was compiled with Clang 15.
I also tried GCC 12.2, but it did not consistently [eliminate branches](https://gcc.gnu.org/bugzilla/show_bug.cgi?id=106952) or vectorize the loop, making it much slower.

Four variations of the algorithm were benchmarked:

- **Baseline** (from [part 1](../2011/ray_box.md)) makes no attempt to handle NaN consistently.
- **Exclusive** (from [part 2](../2015/ray_box_nan.md)) consistently treats the boundary of the box as non-intersecting.
- **Inclusive** (from [this post](#boundaries)) includes the boundary as part of the box.
- **Signs** (also from [this post](#signs)) uses the sign of the ray direction to avoid some `min()`/`max()` calls.

The hot loop of each variation looks like:

<div class="tabs" style="clear: both;">
<input type="radio" id="tabs-perf-baseline" name="tabs-perf">
<label for="tabs-perf-baseline">Baseline</label>
<input type="radio" id="tabs-perf-exclusive" name="tabs-perf">
<label for="tabs-perf-exclusive">Exclusive</label>
<input type="radio" id="tabs-perf-inclusive" name="tabs-perf">
<label for="tabs-perf-inclusive">Inclusive</label>
<input type="radio" id="tabs-perf-signs" name="tabs-perf" checked>
<label for="tabs-perf-signs">Signs</label>

<div class="tab">

```c
for (size_t i = 0; i < nboxes; ++i) {
    const struct box *box = &boxes[i];
    float tmin = 0.0, tmax = ts[i];

    for (int d = 0; d < 3; ++d) {
        float t1 = (box->min[d] - ray->origin[d]) * ray->dir_inv[d];
        float t2 = (box->max[d] - ray->origin[d]) * ray->dir_inv[d];

        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));
    }

    ts[i] = tmin < tmax ? tmin : ts[i];
}
```

</div>
<div class="tab">

```c
for (size_t i = 0; i < nboxes; ++i) {
    const struct box *box = &boxes[i];
    float tmin = 0.0, tmax = ts[i];

    for (int d = 0; d < 3; ++d) {
        float t1 = (box->min[d] - ray->origin[d]) * ray->dir_inv[d];
        float t2 = (box->max[d] - ray->origin[d]) * ray->dir_inv[d];

        tmin = max(tmin, min(min(t1, t2), tmax));
        tmax = min(tmax, max(max(t1, t2), tmin));
    }

    ts[i] = tmin < tmax ? tmin : ts[i];
}
```

</div>
<div class="tab">

```c
for (size_t i = 0; i < nboxes; ++i) {
    const struct box *box = &boxes[i];
    float tmin = 0.0, tmax = ts[i];

    for (int d = 0; d < 3; ++d) {
        float t1 = (box->min[d] - ray->origin[d]) * ray->dir_inv[d];
        float t2 = (box->max[d] - ray->origin[d]) * ray->dir_inv[d];

        tmin = min(max(t1, tmin), max(t2, tmin));
        tmax = max(min(t1, tmax), min(t2, tmax));
    }

    ts[i] = tmin <= tmax ? tmin : ts[i];
}
```

</div>
<div class="tab">

```c
for (size_t i = 0; i < nboxes; ++i) {
    const struct box *box = &boxes[i];
    float tmin = 0.0, tmax = ts[i];

    for (int d = 0; d < 3; ++d) {
        float bmin = box->corners[signs[d]][d];
        float bmax = box->corners[!signs[d]][d];

        float dmin = (bmin - ray->origin[d]) * ray->dir_inv[d];
        float dmax = (bmax - ray->origin[d]) * ray->dir_inv[d];

        tmin = max(dmin, tmin);
        tmax = min(dmax, tmax);
    }

    ts[i] = tmin <= tmax ? tmin : ts[i];
}
```

</div>
</div>

The benchmarks tested intersections between a ray and a complete [octree](https://en.wikipedia.org/wiki/Octree) of various depths.
The various sizes illustrate how each level of the cache hierarchy affects performance.
Regardless of depth, approximately the same number of intersection tests (~10 billion) were performed.
The observed throughput, measured in billions of intersections per second, is shown in the graph below.

<script src="https://cdn.jsdelivr.net/npm/chart.js@4.2.1/dist/chart.umd.js" integrity="sha256-kJV6QFiOvYKbRWdhfNEwB2OKJ2w1y+8aH7mBGSHy8mY=" crossorigin="anonymous"></script>

<figure>
  <div style="min-width: 500px;">
    <canvas id="chart"></canvas>
  </div>
</figure>


## Vectorization

Clang managed to automatically vectorize the implementation and achieve impressive performance.
However, humans can often still beat the compiler at vectorization, so let's try it.
My CPU supports AVX2, which gives us 256-bit registers that hold 8 `float`s:

```c
#include <xmmintrin.h>
#include <immintrin.h>

/// A vector of 8 floats.
typedef __m256 vfloat;

/// Broadcast a float across all elements of a vector.
#define broadcast(x) _mm256_set1_ps(x)

/// Elementwise vector minimum.
#define min(x, y) _mm256_min_ps(x, y)

/// Elementwise vector maximum.
#define max(x, y) _mm256_max_ps(x, y)

/// A vectorized bounding box, holding 8 boxes.
struct vbox {
    vfloat min[3];
    vfloat max[3];
};
```

The implementation looks almost identical, mostly just replacing single `float`s with vectors.
Each iteration of the outer loop is now intersecting a ray against 8 bounding boxes at once.

<div class="tabs">
<input type="radio" id="tabs-vec-baseline" name="tabs-vec">
<label for="tabs-vec-baseline">Baseline</label>
<input type="radio" id="tabs-vec-exclusive" name="tabs-vec">
<label for="tabs-vec-exclusive">Exclusive</label>
<input type="radio" id="tabs-vec-inclusive" name="tabs-vec">
<label for="tabs-vec-inclusive">Inclusive</label>
<input type="radio" id="tabs-vec-signs" name="tabs-vec" checked>
<label for="tabs-vec-signs">Signs</label>

<div class="tab">

```c
void intersections(
    const struct ray *ray,
    size_t nboxes,
    const struct vbox boxes[nboxes],
    vfloat ts[nboxes])
{
    vfloat origin[3], dir_inv[3];
    for (int d = 0; d < 3; ++d) {
        origin[d] = broadcast(ray->origin[d]);
        dir_inv[d] = broadcast(ray->dir_inv[d]);
    }

    for (size_t i = 0; i < nboxes; ++i) {
        const struct vbox *box = &boxes[i];
        vfloat tmin = broadcast(0.0);
        vfloat tmax = ts[i];

        for (int d = 0; d < 3; ++d) {
            vfloat t1 = (box->min[d] - origin[d]) * dir_inv[d];
            vfloat t2 = (box->max[d] - origin[d]) * dir_inv[d];

            tmin = max(tmin, min(t1, t2));
            tmax = min(tmax, max(t1, t2));
        }

        // Use a comparison mask and blend to vectorize
        // ts[i] = tmin < tmax ? tmin : ts[i];
        vfloat mask = _mm256_cmp_ps(tmin, tmax, _CMP_LT_OQ);
        ts[i] = _mm256_blendv_ps(ts[i], tmin, mask);
    }
}
```

</div>
<div class="tab">

```c
void intersections(
    const struct ray *ray,
    size_t nboxes,
    const struct vbox boxes[nboxes],
    vfloat ts[nboxes])
{
    vfloat origin[3], dir_inv[3];
    for (int d = 0; d < 3; ++d) {
        origin[d] = broadcast(ray->origin[d]);
        dir_inv[d] = broadcast(ray->dir_inv[d]);
    }

    for (size_t i = 0; i < nboxes; ++i) {
        const struct vbox *box = &boxes[i];
        vfloat tmin = broadcast(0.0);
        vfloat tmax = ts[i];

        for (int d = 0; d < 3; ++d) {
            vfloat t1 = (box->min[d] - origin[d]) * dir_inv[d];
            vfloat t2 = (box->max[d] - origin[d]) * dir_inv[d];

            tmin = max(tmin, min(min(t1, t2), tmax));
            tmax = min(tmax, max(max(t1, t2), tmin));
        }

        // Use a comparison mask and blend to vectorize
        // ts[i] = tmin < tmax ? tmin : ts[i];
        vfloat mask = _mm256_cmp_ps(tmin, tmax, _CMP_LT_OQ);
        ts[i] = _mm256_blendv_ps(ts[i], tmin, mask);
    }
}
```

</div>
<div class="tab">

```c
void intersections(
    const struct ray *ray,
    size_t nboxes,
    const struct vbox boxes[nboxes],
    vfloat ts[nboxes])
{
    vfloat origin[3], dir_inv[3];
    for (int d = 0; d < 3; ++d) {
        origin[d] = broadcast(ray->origin[d]);
        dir_inv[d] = broadcast(ray->dir_inv[d]);
    }

    for (size_t i = 0; i < nboxes; ++i) {
        const struct vbox *box = &boxes[i];
        vfloat tmin = broadcast(0.0);
        vfloat tmax = ts[i];

        for (int d = 0; d < 3; ++d) {
            vfloat t1 = (box->min[d] - origin[d]) * dir_inv[d];
            vfloat t2 = (box->max[d] - origin[d]) * dir_inv[d];

            tmin = min(max(t1, tmin), max(t2, tmin));
            tmax = max(min(t1, tmax), min(t2, tmax));
        }

        // Use a comparison mask and blend to vectorize
        // ts[i] = tmin <= tmax ? tmin : ts[i];
        vfloat mask = _mm256_cmp_ps(tmin, tmax, _CMP_LE_OQ);
        ts[i] = _mm256_blendv_ps(ts[i], tmin, mask);
    }
}
```

</div>
<div class="tab">

```c
void intersections(
    const struct ray *ray,
    size_t nboxes,
    const struct vbox boxes[nboxes],
    vfloat ts[nboxes])
{
    vfloat origin[3], dir_inv[3];
    bool signs[3];
    for (int d = 0; d < 3; ++d) {
        origin[d] = broadcast(ray->origin[d]);
        dir_inv[d] = broadcast(ray->dir_inv[d]);
        signs[d] = signbit(ray->dir_inv[d]);
    }

    for (size_t i = 0; i < nboxes; ++i) {
        const struct vbox *box = &boxes[i];
        vfloat tmin = broadcast(0.0);
        vfloat tmax = ts[i];

        for (int d = 0; d < 3; ++d) {
            vfloat bmin = box->corners[signs[d]][d];
            vfloat bmax = box->corners[!signs[d]][d];

            vfloat dmin = (bmin - origin[d]) * dir_inv[d];
            vfloat dmax = (bmax - origin[d]) * dir_inv[d];

            tmin = max(dmin, tmin);
            tmax = min(dmax, tmax);
        }

        // Use a comparison mask and blend to vectorize
        // ts[i] = tmin <= tmax ? tmin : ts[i];
        vfloat mask = _mm256_cmp_ps(tmin, tmax, _CMP_LE_OQ);
        ts[i] = _mm256_blendv_ps(ts[i], tmin, mask);
    }
}
```

</div>
</div>

Throughput is significantly improved, at least until memory becomes the bottleneck.
We're reaching between 2 and 3.5 billion intersections/s, around 3.3× faster than the un/auto-vectorized implementation.

<figure>
  <div style="min-width: 500px;">
    <canvas id="vchart"></canvas>
  </div>
</figure>


## Parallelism

All the results so far were single-threaded, but I hope no one is writing single-threaded (CPU) ray tracers these days.
Let's see what happens if we crank up the parallelism:

<figure>
  <div style="min-width: 500px;">
    <canvas id="pchart"></canvas>
  </div>
</figure>

As long as we're not bottlenecked on memory, each added thread contributes significant additional throughput.
The best configuration reaches over 88 billion intersections/second!
It scales quite nicely too:

<figure>
  <div style="min-width: 500px;">
    <canvas id="schart"></canvas>
  </div>
</figure>

These benchmarks are [on GitHub](https://github.com/tavianator/ray_box) if you want to try them yourself.
The code is MIT licensed, so feel free to adapt it for your own uses.

<script>
const data = {"ray_box_baseline":[{"threads":1,"depths":[{"depth":4,"samples":[0.771612,0.771563,0.77125,0.771796,0.771694,0.771844,0.771922]},{"depth":5,"samples":[0.777458,0.777259,0.777465,0.777501,0.777447,0.777615,0.777649]},{"depth":6,"samples":[0.766432,0.757405,0.759399,0.759907,0.760416,0.765567,0.760238]},{"depth":7,"samples":[0.761075,0.759511,0.760452,0.761034,0.761151,0.759927,0.758254]},{"depth":8,"samples":[0.604828,0.604876,0.604415]},{"depth":9,"samples":[0.603607,0.605831,0.603535]},{"depth":10,"samples":[0.60766,0.607127,0.608539]}]}],"ray_box_inclusive":[{"threads":1,"depths":[{"depth":4,"samples":[0.689876,0.69042,0.689976,0.690332,0.690138,0.690533,0.690091]},{"depth":5,"samples":[0.69669,0.696689,0.696696,0.69655,0.696693,0.696763,0.696758]},{"depth":6,"samples":[0.692357,0.686163,0.686565,0.690588,0.6877,0.691225,0.689993]},{"depth":7,"samples":[0.691343,0.687328,0.69055,0.68747,0.68988,0.691355,0.687661]},{"depth":8,"samples":[0.600018,0.599918,0.600169]},{"depth":9,"samples":[0.599428,0.59816,0.599808]},{"depth":10,"samples":[0.599791,0.598023,0.600981]}]}],"ray_box_exclusive":[{"threads":1,"depths":[{"depth":4,"samples":[0.687553,0.68742,0.687555,0.687265,0.68749,0.687447,0.687685]},{"depth":5,"samples":[0.692344,0.692347,0.692323,0.692194,0.692339,0.692356,0.692346]},{"depth":6,"samples":[0.696156,0.689227,0.693928,0.689938,0.68829,0.689731,0.690092]},{"depth":7,"samples":[0.68945,0.688674,0.690699,0.688199,0.693901,0.69048,0.68753]},{"depth":8,"samples":[0.600329,0.601425,0.600786]},{"depth":9,"samples":[0.60146,0.600004,0.602226]},{"depth":10,"samples":[0.600463,0.601409,0.602124]}]}],"ray_box_signs":[{"threads":1,"depths":[{"depth":4,"samples":[1.090172,1.090375,1.090342,1.091079,1.091005,1.09008,1.090562]},{"depth":5,"samples":[1.107907,1.107945,1.107633,1.107757,1.107244,1.107822,1.107773]},{"depth":6,"samples":[0.813114,0.813126,0.809804,0.816312,0.815448,0.811682,0.81266]},{"depth":7,"samples":[0.784727,0.782588,0.781082,0.781732,0.780274,0.783453,0.7825]},{"depth":8,"samples":[0.604673,0.577704,0.609189]},{"depth":9,"samples":[0.606865,0.607886,0.608385]},{"depth":10,"samples":[0.60484,0.608162,0.60582]}]}],"ray_vbox_baseline":[{"threads":1,"depths":[{"depth":4,"samples":[2.787362,2.787082,2.787011,2.786346,2.785157,2.785255,2.785572]},{"depth":5,"samples":[2.654984,2.655896,2.655835,2.654821,2.65496,2.654317,2.654529]},{"depth":6,"samples":[2.501473,2.492814,2.509177,2.507324,2.513407,2.492327,2.493915]},{"depth":7,"samples":[2.455961,2.531389,2.517664,2.528078,2.526989,2.53372,2.523234]},{"depth":8,"samples":[0.968899,0.973705,0.967268]},{"depth":9,"samples":[0.967788,0.965534,0.969274]},{"depth":10,"samples":[0.966657,0.96291,0.962416]}]}],"ray_vbox_inclusive":[{"threads":1,"depths":[{"depth":4,"samples":[2.084678,2.084521,2.084563,2.084448,2.0845,2.084662,2.084979]},{"depth":5,"samples":[2.06905,2.069047,2.06721,2.068752,2.068469,2.068392,2.068679]},{"depth":6,"samples":[1.996345,2.002315,2.043421,1.997975,2.028316,2.043876,2.004119]},{"depth":7,"samples":[2.003746,2.025936,2.053488,2.055212,2.005598,2.019036,2.044257]},{"depth":8,"samples":[0.908261,0.910468,0.908133]},{"depth":9,"samples":[0.908051,0.911282,0.913514]},{"depth":10,"samples":[0.904657,0.903441,0.906824]}]}],"ray_vbox_exclusive":[{"threads":1,"depths":[{"depth":4,"samples":[2.043978,2.043806,2.043356,2.043414,2.043611,2.043093,2.042646]},{"depth":5,"samples":[2.024247,2.024386,2.024132,2.024164,1.958946,2.024202,2.024249]},{"depth":6,"samples":[1.985656,1.960769,1.9842,1.953196,1.942389,1.998935,1.980031]},{"depth":7,"samples":[1.995844,1.974127,1.98596,1.95119,1.96842,1.946997,1.957822]},{"depth":8,"samples":[0.898049,0.897308,0.898742]},{"depth":9,"samples":[0.898836,0.897784,0.897401]},{"depth":10,"samples":[0.898659,0.896579,0.896846]}]}],"ray_vbox_signs":[{"threads":1,"depths":[{"depth":4,"samples":[3.633768,3.635888,3.633663,3.635525,3.634871,3.633475,3.633613]},{"depth":5,"samples":[3.285027,3.284229,3.284986,3.285042,3.284353,3.284569,3.284204]},{"depth":6,"samples":[2.744722,2.749347,2.719768,2.73989,2.744455,2.777104,2.721554]},{"depth":7,"samples":[2.806335,2.763967,2.788463,2.827026,2.788581,2.788317,2.811404]},{"depth":8,"samples":[1.049505,1.059827,1.060462]},{"depth":9,"samples":[1.054967,1.058909,1.057457]},{"depth":10,"samples":[1.025429,1.028426,1.022661]}]},{"threads":2,"depths":[{"depth":4,"samples":[7.175695,7.175981,7.183923,7.179608,7.198087,7.178982,7.193647]},{"depth":5,"samples":[6.568712,6.569258,6.568857,6.568009,6.56013,6.570964,6.568581]},{"depth":6,"samples":[5.49887,5.3258,5.685831,5.661702,5.438042,5.457843,5.687161]},{"depth":7,"samples":[5.731009,5.718715,5.785118,5.798188,5.634302,5.627565,5.6216]},{"depth":8,"samples":[1.853859,1.852423,1.85375]},{"depth":9,"samples":[1.853482,1.856349,1.854262]},{"depth":10,"samples":[1.855742,1.858008,1.854982]}]},{"threads":3,"depths":[{"depth":4,"samples":[10.941797,10.941113,10.939412,10.94243,10.946611,10.94172,10.943896]},{"depth":5,"samples":[10.053533,10.054171,10.054099,10.053155,10.050882,10.053665,10.051868]},{"depth":6,"samples":[8.211614,8.087201,8.264595,8.190931,8.101324,8.023059,8.096324]},{"depth":7,"samples":[8.469271,8.599029,8.592619,8.47807,8.626107,8.320641,8.412579]},{"depth":8,"samples":[2.209684,2.157244,2.115526]},{"depth":9,"samples":[2.703623,2.70136,2.694074]},{"depth":10,"samples":[2.70906,2.710883,2.668459]}]},{"threads":4,"depths":[{"depth":4,"samples":[14.356542,14.351664,14.358879,14.352547,14.35425,14.353664,14.353953]},{"depth":5,"samples":[13.165413,13.164643,13.16438,13.170096,13.165313,13.163155,13.146338]},{"depth":6,"samples":[10.970833,10.693474,10.794162,10.836431,10.755608,10.941942,11.138284]},{"depth":7,"samples":[11.022305,11.17472,11.400005,11.228973,11.301803,11.278562,11.110447]},{"depth":8,"samples":[2.964426,2.945526,2.951988]},{"depth":9,"samples":[3.491802,3.434746,3.505099]},{"depth":10,"samples":[3.397032,3.444313,3.456495]}]},{"threads":6,"depths":[{"depth":4,"samples":[21.528582,21.546757,21.545128,21.520493,21.530505,21.537955,21.540924]},{"depth":5,"samples":[19.780644,19.786258,19.784384,19.783912,19.785886,19.783893,19.781672]},{"depth":6,"samples":[16.267032,16.334372,16.395077,16.336277,16.142164,16.202862,16.295456]},{"depth":7,"samples":[16.393121,16.514356,16.628648,16.565467,16.697299,16.565612,16.541499]},{"depth":8,"samples":[2.361903,2.3224,2.492907]},{"depth":9,"samples":[3.146304,2.984796,3.082404]},{"depth":10,"samples":[3.118008,3.266062,3.247417]}]},{"threads":8,"depths":[{"depth":4,"samples":[28.706496,28.700396,28.707277,28.71767,28.706381,28.687696,28.71491]},{"depth":5,"samples":[26.115069,26.112889,26.119508,26.110613,26.11324,26.111409,26.106429]},{"depth":6,"samples":[22.003773,22.04568,22.043674,21.500264,21.790182,21.799202,21.91955]},{"depth":7,"samples":[22.127271,22.438657,22.305716,22.540369,22.749003,22.438511,22.900435]},{"depth":8,"samples":[3.892907,3.905777,3.830876]},{"depth":9,"samples":[5.489456,5.518541,5.618867]},{"depth":10,"samples":[5.481074,5.645706,5.632747]}]},{"threads":12,"depths":[{"depth":4,"samples":[43.047859,43.032593,43.092104,43.056883,43.048154,43.04822,43.035246]},{"depth":5,"samples":[35.282639,35.28248,35.269601,35.278461,35.283708,35.281301,35.285573]},{"depth":6,"samples":[31.169657,31.384025,31.183061,31.352907,31.717638,30.959924,31.178942]},{"depth":7,"samples":[32.459737,31.930829,32.749129,31.936374,31.604991,31.802813,31.162972]},{"depth":8,"samples":[4.436363,4.395272,4.421507]},{"depth":9,"samples":[5.494189,5.452414,5.439014]},{"depth":10,"samples":[5.193599,5.275476,5.721564]}]},{"threads":16,"depths":[{"depth":4,"samples":[57.291398,57.293847,57.255078,57.276875,57.258981,57.244882,57.272785]},{"depth":5,"samples":[45.722979,45.720247,45.755633,45.747091,45.723948,45.673966,45.743531]},{"depth":6,"samples":[41.916857,41.503452,41.865745,42.243236,40.813653,40.292588,40.492344]},{"depth":7,"samples":[41.829097,41.865901,41.785765,41.424799,42.077856,42.05569,42.193486]},{"depth":8,"samples":[4.440488,4.398571,4.478063]},{"depth":9,"samples":[5.449311,5.115081,5.012032]},{"depth":10,"samples":[6.5617,6.59588,6.244607]}]},{"threads":24,"depths":[{"depth":4,"samples":[84.862538,83.702774,83.657114,83.660108,84.905211,83.673487,83.634368]},{"depth":5,"samples":[68.477707,68.529435,68.523656,68.529413,68.648457,68.523151,68.504579]},{"depth":6,"samples":[61.074288,61.044976,61.992751,61.068302,60.549124,61.308785,60.941916]},{"depth":7,"samples":[61.365062,62.693114,60.52381,60.873114,61.327589,61.107296,60.6232]},{"depth":8,"samples":[6.109231,6.02746,6.120389]},{"depth":9,"samples":[7.710443,7.603096,6.971944]},{"depth":10,"samples":[7.080861,6.231353,6.478098]}]},{"threads":32,"depths":[{"depth":4,"samples":[74.606369,75.526692,75.291077,76.357231,75.857428,75.650121,73.947208]},{"depth":5,"samples":[70.582798,72.171018,70.747631,71.025352,71.31453,70.701692,71.092136]},{"depth":6,"samples":[62.868443,62.624805,63.371437,63.417875,62.233557,62.822919,62.646304]},{"depth":7,"samples":[62.987593,63.460546,62.734998,63.042442,62.636107,62.530388,62.786115]},{"depth":8,"samples":[8.957143,10.172477,9.865211]},{"depth":9,"samples":[7.595799,10.28622,9.468346]},{"depth":10,"samples":[7.447304,11.215035,9.706864]}]},{"threads":48,"depths":[{"depth":4,"samples":[88.862655,88.359913,88.407891,88.381381,88.383258,88.342766,88.40053]},{"depth":5,"samples":[79.855156,79.405465,79.838891,77.727005,79.802299,74.517928,79.877951]},{"depth":6,"samples":[76.940207,76.193424,76.1488,76.341312,76.379448,76.110699,76.08339]},{"depth":7,"samples":[73.098042,72.791428,72.901841,73.090175,72.811857,72.953276,72.927636]},{"depth":8,"samples":[12.123569,12.129174,12.160608]},{"depth":9,"samples":[12.141654,12.141113,12.129698]},{"depth":10,"samples":[13.028863,12.900054,12.695941]}]}]};
const depths = data.ray_box_baseline[0].depths.map(d => d.depth);
const threads = data.ray_vbox_signs.map(d => d.threads);
function invDepth(n) {
    return Math.log(7 * n + 1) / Math.log(8) - 4;
}
function median(samples) {
    samples = [...samples];
    samples.sort();
    const mid = Math.floor(samples.length / 2);
    return samples[mid];
}
function chartOptions(title) {
    return {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: title,
            },
            tooltip: {
                callbacks: {
                    title(items) {
                        return "Depth: " + items[0].label;
                    },
                    labelColor(item) {
                        const color = item.dataset.borderColor;
                        return {
                            borderColor: color,
                            backgroundColor: color,
                        };
                    },
                },
            },
        },
        interaction: {
            mode: "index",
            intersect: false,
        },
        scales: {
            x: {
                display: true,
                ticks: {
                    align: "end",
                    labelOffset: 3,
                },
                afterTickToLabelConversion(axis) {
                    axis.ticks[0].label = "Octree depth: 4";
                },
            },
            xCount: {
                display: true,
                ticks: {
                    align: "end",
                    labelOffset: 8,
                    padding: 32,
                },
                grid: {
                    drawOnChartArea: false,
                    tickLength: -28,
                    tickBorderDash: [5, 5],
                },
                border: {
                    display: false,
                },
                afterTickToLabelConversion(axis) {
                    axis.ticks = [
                        { value: invDepth(1.0e3), label: "Boxes: 10³" },
                        { value: invDepth(1.0e4), label: "10⁴" },
                        { value: invDepth(1.0e5), label: "10⁵" },
                        { value: invDepth(1.0e6), label: "10⁶" },
                        { value: invDepth(1.0e7), label: "10⁷" },
                        { value: invDepth(1.0e8), label: "10⁸" },
                    ];
                },
                afterFit(axis) {
                    axis.height -= 32;
                },
            },
            xSize: {
                display: true,
                ticks: {
                    padding: 54,
                },
                grid: {
                    drawOnChartArea: false,
                    tickLength: -50,
                    tickBorderDash: [5, 5],
                },
                border: {
                    display: false,
                },
                afterTickToLabelConversion(axis) {
                    axis.ticks = [
                        { value: invDepth((32 << 10) / 24), label: "L1 (32 KiB)" },
                        { value: invDepth((512 << 10) / 24), label: "L2 (512 KiB)" },
                        { value: invDepth((16 << 20) / 24), label: "L3 (16 MiB)" },
                        { value: invDepth((1 << 30) / 24), label: "1 GiB" },
                    ];
                },
                afterFit(axis) {
                    axis.height -= 54;
                },
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: "Intersections/s (billions)",
                },
            },
        },
    };
}
function threadOptions(title, yLabel) {
    return {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: title,
            },
            tooltip: {
                callbacks: {
                    title(items) {
                        return "Threads: " + items[0].label;
                    },
                    labelColor(item) {
                        const color = item.dataset.borderColor;
                        return {
                            borderColor: color,
                            backgroundColor: color,
                        };
                    },
                },
            },
        },
        interaction: {
            mode: "index",
            intersect: false,
        },
        scales: {
            x: {
                display: true,
                type: "linear",
                ticks: {
                    align: "end",
                    labelOffset: 4,
                },
                min: threads[0],
                max: threads[threads.length - 1],
                afterBuildTicks(axis) {
                    axis.ticks = threads.map(t => ({ value: t }));
                },
                afterTickToLabelConversion(axis) {
                    axis.ticks[0].label = "Threads: 1";
                },
            },
            xInfo: {
                display: true,
                type: "linear",
                ticks: {
                    align: "end",
                    labelOffset: 4,
                },
                grid: {
                    drawOnChartArea: false,
                    drawTicks: false,
                },
                border: {
                    display: false,
                },
                min: threads[0],
                max: threads[threads.length - 1],
                afterTickToLabelConversion(axis) {
                    axis.ticks = [
                        { value: 24, label: "(CPU cores)" },
                        { value: 48, label: "(CPU threads)" },
                    ];
                },
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: yLabel,
                },
            },
        },
    };
}
let chart = null;
let vchart = null;
let pchart = null;
let schart = null;
const chartObserver = new MutationObserver((mutations, observer) => {
    for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.attributeName === "class") {
            const style = getComputedStyle(document.body);
            chart && chart.destroy();
            vchart && vchart.destroy();
            pchart && pchart.destroy();
            schart && schart.destroy();
            Chart.defaults.color = style.getPropertyValue("--fg");
            Chart.defaults.borderColor = style.getPropertyValue("--icons");
            chart = new Chart(document.getElementById("chart"), {
                type: "line",
                data: {
                    labels: depths,
                    datasets: [
                        {
                            label: "Baseline",
                            data: data.ray_box_baseline[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--table-header-bg"),
                        },
                        {
                            label: "Exclusive",
                            data: data.ray_box_exclusive[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--search-mark-bg"),
                        },
                        {
                            label: "Inclusive",
                            data: data.ray_box_inclusive[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--sidebar-active"),
                        },
                        {
                            label: "Signs",
                            data: data.ray_box_signs[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--fg"),
                        },
                    ],
                },
                options: chartOptions("Ray/box intersection throughput"),
            });
            vchart = new Chart(document.getElementById("vchart"), {
                type: "line",
                data: {
                    labels: depths,
                    datasets: [
                        {
                            label: "Baseline",
                            data: data.ray_vbox_baseline[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--table-header-bg"),
                        },
                        {
                            label: "Exclusive",
                            data: data.ray_vbox_exclusive[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--search-mark-bg"),
                        },
                        {
                            label: "Inclusive",
                            data: data.ray_vbox_inclusive[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--sidebar-active"),
                        },
                        {
                            label: "Signs",
                            data: data.ray_vbox_signs[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--fg"),
                        },
                        {
                            label: "Signs (auto-vectorized)",
                            data: data.ray_box_signs[0].depths.map(d => median(d.samples)),
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--icons"),
                        },
                    ],
                },
                options: chartOptions("Vectorized ray/box intersection throughput"),
            });
            const pcolors = [
                style.getPropertyValue("--fg"),
                style.getPropertyValue("--search-mark-bg"),
                style.getPropertyValue("--sidebar-active"),
                style.getPropertyValue("--table-header-bg"),
                style.getPropertyValue("--icons"),
                style.getPropertyValue("--icons"),
                style.getPropertyValue("--icons"),
            ];
            const pdata = depths.map((d, i) => ({
                label: "Depth " + d,
                data: threads.map((t, j) => ({
                    x: t,
                    y: median(data.ray_vbox_signs[j].depths[i].samples),
                })),
                cubicInterpolationMode: "monotone",
                borderColor: pcolors[i],
            }));
            pchart = new Chart(document.getElementById("pchart"), {
                type: "line",
                data: {
                    datasets: pdata,
                },
                options: threadOptions(
                    "Parallel ray/box intersection throughput",
                    "Intersections per second (billions)",
                ),
            });
            const sdata = depths.map((d, i) => {
                let baseline = median(data.ray_vbox_signs[0].depths[i].samples);
                return {
                    label: "Depth " + d,
                    data: threads.map((t, j) => ({
                        x: t,
                        y: median(data.ray_vbox_signs[j].depths[i].samples) / baseline / t,
                    })),
                    cubicInterpolationMode: "monotone",
                    borderColor: pcolors[i],
                };
            });
            schart = new Chart(document.getElementById("schart"), {
                type: "line",
                data: {
                    datasets: sdata,
                },
                options: threadOptions(
                    "Ray/box intersection scalability",
                    "Efficiency",
                ),
            });
        }
    }
});
chartObserver.observe(document.documentElement, { attributes: true });
</script>

