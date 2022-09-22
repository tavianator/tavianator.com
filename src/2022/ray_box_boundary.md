# Fast, Branchless Ray/Bounding Box Intersections, Part 3: Boundaries

<div class="infobar">

<fa:clock-o> <time:2022-07-27>
<fa:user> Tavian Barnes
[<fa:github> GitHub](https://github.com/tavianator/ray_box)

</div>

<ins>This post is the third in a series of posts I've written about ray/bounding box intersection tests.
However, it supersedes the previous two, and should be self contained, so don't feel like you have to read the others unless you're interested in the historical context.
On <time:2022-09-10> and <time:2022-09-14> I substantially revised this post, improving the implementation and adding a much more thorough performance analysis.</ins>

[Last time I wrote about ray/box intersections](../2015/ray_box_nan.md), we left off with a simple and fast implementation of the slab method that handles all the corner cases.
To save you the trouble of (re-)reading the last two posts, I'll start with a quick recap.
Feel free to skip to the [next section](#boundaries) if you're already familiar with it.


## Geometry

An axis-aligned bounding box `$\square$` can be specified by the coordinates of two of its corners:

<figure>
  <svg width="550" height="340" viewBox="-80 40 550 340">
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
  <svg width="550" height="400" viewBox="-80 0 550 400">
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
  <svg width="550" height="400" viewBox="-80 0 550 400">
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
  <svg width="550" height="200" viewBox="-80 0 550 200">
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

    for (int i = 0; i < 3; ++i) {
        float t1 = (box->min[i] - ray->origin[i]) * ray->dir_inv[i];
        float t2 = (box->max[i] - ray->origin[i]) * ray->dir_inv[i];

        tmin = max(tmin, min(t1, t2));
        tmax = min(tmax, max(t1, t2));
    }

    return tmin < tmax;
}
```

We precompute `ray->dir_inv[i] = 1.0 / ray->dir[i]` to replace division (slow) with multiplication (fast).
You might worry about dividing by zero, but [part 1](../2011/ray_box.md) describes how floating point infinities lead to the right answer even when `ray->dir[i] == 0.0`.

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

    for (int i = 0; i < 3; ++i) {
        float t1 = (box->min[i] - ray->origin[i]) * ray->dir_inv[i];
        float t2 = (box->max[i] - ray->origin[i]) * ray->dir_inv[i];

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
  <svg width="550" height="340" viewBox="-80 40 550 340">
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
  <svg width="550" height="340" viewBox="-80 40 550 340">
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

    for (int i = 0; i < 3; ++i) {
        float t1 = (box->min[i] - ray->origin[i]) * ray->dir_inv[i];
        float t2 = (box->max[i] - ray->origin[i]) * ray->dir_inv[i];

        tmin = min(max(t1, tmin), max(t2, tmin));
        tmax = max(min(t1, tmax), min(t2, tmax));
    }

    return tmin <= tmax;
}
```

</div>
</div>

<figure>
  <svg width="550" height="340" viewBox="-80 40 550 340">
    <rect x="80" y="80" width="240" height="240" stroke="var(--fg)" fill="url(#hatch)" />
    <line x1="-80" y1="80" x2="120" y2="380" stroke="green" stroke-width="2" />
    <line x1="-80" y1="80" x2="470" y2="80" stroke="green" stroke-width="2" />
  </svg>
</figure>


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
    for (size_t i = 0; i < nboxes; ++i) {
        const struct box *box = &boxes[i];
        float tmin = 0.0, tmax = ts[i];

        for (int j = 0; j < 3; ++j) {
            float t1 = (box->min[j] - ray->origin[j]) * ray->dir_inv[j];
            float t2 = (box->max[j] - ray->origin[j]) * ray->dir_inv[j];

            tmin = min(max(t1, tmin), max(t2, tmin));
            tmax = max(min(t1, tmax), min(t2, tmax));
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

I measured the performance of three variations of this algorithm.
The baseline implementation (from [part 1](../2011/ray_box.md)) makes no attempt to handle NaN consistently.
The "exclusive" implementation (from [part 2](../2015/ray_box_nan.md)) consistently treats the boundary of the box as non-intersecting.
Finally, the "inclusive" implementation (from this post) includes the boundary as part of the box.

Measurements were taken on an 3.80 GHz AMD Ryzen Threadripper 3960X with 64 GiB of RAM, running Arch Linux.
CPU frequency scaling was disabled, as was [Turbo Core](https://en.wikipedia.org/wiki/AMD_Turbo_Core) (AMD's version of [Turbo Boost](https://en.wikipedia.org/wiki/Intel_Turbo_Boost)), so the clock speed was constant throughout the expirement.
The code was compiled by Clang 14.0.6 with the flags `-O3 -flto -march=native`.
I also tried GCC 12.2.0, but it did not consistently [eliminate branches](https://gcc.gnu.org/bugzilla/show_bug.cgi?id=106952) or vectorize the loop, making it much slower.
The hot loop of each configuration looks like:

<div class="tabs">
<input type="radio" id="tabs-perf-baseline" name="tabs-perf">
<label for="tabs-perf-baseline">Baseline</label>
<input type="radio" id="tabs-perf-exclusive" name="tabs-perf">
<label for="tabs-perf-exclusive">Exclusive</label>
<input type="radio" id="tabs-perf-inclusive" name="tabs-perf" checked>
<label for="tabs-perf-inclusive">Inclusive</label>

<div class="tab">

```c
for (size_t i = 0; i < nboxes; ++i) {
    const struct box *box = &boxes[i];
    float tmin = 0.0, tmax = ts[i];

    for (int j = 0; j < 3; ++j) {
        float t1 = (box->min[j] - ray->origin[j]) * ray->dir_inv[j];
        float t2 = (box->max[j] - ray->origin[j]) * ray->dir_inv[j];

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

    for (int j = 0; j < 3; ++j) {
        float t1 = (box->min[j] - ray->origin[j]) * ray->dir_inv[j];
        float t2 = (box->max[j] - ray->origin[j]) * ray->dir_inv[j];

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

    for (int j = 0; j < 3; ++j) {
        float t1 = (box->min[j] - ray->origin[j]) * ray->dir_inv[j];
        float t2 = (box->max[j] - ray->origin[j]) * ray->dir_inv[j];

        tmin = min(max(t1, tmin), max(t2, tmin));
        tmax = max(min(t1, tmax), min(t2, tmax));
    }

    ts[i] = tmin <= tmax ? tmin : ts[i];
}
```

</div>
</div>

The benchmark tested intersections between a ray and a complete [octree](https://en.wikipedia.org/wiki/Octree) of various depths.
Approximately 10 billion intersection tests were performed for each configuration.
The observed throughput, measured in billions of intersections per second, is shown in the graph below.

<script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js" integrity="sha256-+8RZJua0aEWg+QVVKg4LEzEEm/8RFez5Tb4JBNiV5xA=" crossorigin="anonymous"></script>

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

/// A vectorized ray, holding 8 rays at once.
struct vray {
    vfloat origin[3];
    vfloat dir_inv[3];
};

/// A vectorized bounding box, holding 8 boxes.
struct vbox {
    vfloat min[3];
    vfloat max[3];
};
```

The implementation looks almost identical, mostly just replacing single `float`s with vectors.
Each iteration of the outer loop is now intersecting 8 rays (or 8 copies of the same ray) against 8 bounding boxes.

<div class="tabs">
<input type="radio" id="tabs-vec-baseline" name="tabs-vec">
<label for="tabs-vec-baseline">Baseline</label>
<input type="radio" id="tabs-vec-exclusive" name="tabs-vec">
<label for="tabs-vec-exclusive">Exclusive</label>
<input type="radio" id="tabs-vec-inclusive" name="tabs-vec" checked>
<label for="tabs-vec-inclusive">Inclusive</label>

<div class="tab">

```c
void intersections(
    const struct vray *ray,
    size_t nboxes,
    const struct vbox boxes[nboxes],
    vfloat ts[nboxes])
{
    for (size_t i = 0; i < nboxes; ++i) {
        const struct vbox *box = &boxes[i];
        vfloat tmin = broadcast(0.0);
        vfloat tmax = ts[i];

        for (int j = 0; j < 3; ++j) {
            vfloat t1 = (box->min[j] - ray->origin[j]) * ray->dir_inv[j];
            vfloat t2 = (box->max[j] - ray->origin[j]) * ray->dir_inv[j];

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
    const struct vray *ray,
    size_t nboxes,
    const struct vbox boxes[nboxes],
    vfloat ts[nboxes])
{
    for (size_t i = 0; i < nboxes; ++i) {
        const struct vbox *box = &boxes[i];
        vfloat tmin = broadcast(0.0);
        vfloat tmax = ts[i];

        for (int j = 0; j < 3; ++j) {
            vfloat t1 = (box->min[j] - ray->origin[j]) * ray->dir_inv[j];
            vfloat t2 = (box->max[j] - ray->origin[j]) * ray->dir_inv[j];

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
    const struct vray *ray,
    size_t nboxes,
    const struct vbox boxes[nboxes],
    vfloat ts[nboxes])
{
    for (size_t i = 0; i < nboxes; ++i) {
        const struct vbox *box = &boxes[i];
        vfloat tmin = broadcast(0.0);
        vfloat tmax = ts[i];

        for (int j = 0; j < 3; ++j) {
            vfloat t1 = (box->min[j] - ray->origin[j]) * ray->dir_inv[j];
            vfloat t2 = (box->max[j] - ray->origin[j]) * ray->dir_inv[j];

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
</div>

Throughput is significantly improved, at least until memory becomes the bottleneck.
We're reaching between 2 and 2.5 billion intersections/s, around 2.6× faster than the un/auto-vectorized implementation.

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
The best configurations reach over 61 billion intersections/second!
It scales quite nicely too:

<figure>
  <div style="min-width: 500px;">
    <canvas id="schart"></canvas>
  </div>
</figure>

These benchmarks are [on GitHub](https://github.com/tavianator/ray_box) if you want to try them yourself.
The code is MIT licensed, so feel free to adapt it for your own uses.

<script>
const data = {
    "baseline": [
        [0.763161, 0.764691, 0.751712, 0.751976, 0.465335, 0.483422, 0.471040],
        [1.524424, 1.474368, 1.503835, 1.502880, 0.578417, 0.570265, 0.579976],
        [2.259223, 2.913369, 3.019897, 3.006132, 0.508256, 0.575270, 0.577903],
        [3.314204, 4.366812, 4.511349, 4.501569, 0.510419, 0.568618, 0.572150],
        [4.499349, 5.849062, 5.964388, 6.001414, 0.509451, 0.561852, 0.570255],
        [6.210391, 8.775773, 8.974541, 8.976246, 0.639829, 0.694094, 0.728100],
        [8.812262, 11.670651, 11.957068, 11.922864, 0.784429, 0.732741, 0.819823],
        [12.270292, 17.490843, 17.953744, 17.876015, 1.001550, 1.016816, 1.011154],
        [12.154070, 16.160823, 16.445835, 16.431108, 1.152326, 1.156793, 1.265402],
        [11.637813, 18.791477, 19.411588, 12.359465, 1.333312, 1.178373, 1.348926]
    ],
    "inclusive": [
        [0.693724, 0.694521, 0.689286, 0.691451, 0.420356, 0.496366, 0.489914],
        [1.387115, 1.353371, 1.380861, 1.380558, 0.591998, 0.559962, 0.575219],
        [2.141758, 2.657018, 2.770485, 2.764104, 0.538650, 0.564067, 0.577362],
        [3.104074, 4.010350, 4.141909, 4.143449, 0.507188, 0.569691, 0.576020],
        [4.237003, 5.356752, 5.504781, 5.454823, 0.508361, 0.562233, 0.569547],
        [5.794311, 8.019849, 8.214602, 8.225284, 0.644725, 0.673094, 0.696867],
        [8.302739, 10.510350, 11.036113, 10.971169, 0.778796, 0.816667, 0.821081],
        [12.053284, 15.959397, 16.496802, 16.074800, 0.997726, 1.012097, 0.998475],
        [11.874363, 14.829451, 15.097186, 15.059465, 1.159977, 1.161474, 1.302523],
        [11.266818, 17.576974, 17.925462, 10.864061, 1.336425, 1.223432, 1.193953]
    ],
    "exclusive": [
        [0.689703, 0.691403, 0.687118, 0.686904, 0.478912, 0.489074, 0.462417],
        [1.379475, 1.343943, 1.370024, 1.370691, 0.558909, 0.564375, 0.556310],
        [2.093813, 2.659788, 2.728879, 2.734855, 0.511586, 0.572220, 0.581457],
        [3.075845, 4.000405, 4.080626, 4.101723, 0.514677, 0.570650, 0.576158],
        [4.193997, 5.322959, 5.482733, 5.478419, 0.508789, 0.562496, 0.569512],
        [6.097918, 7.997756, 8.190899, 8.075118, 0.655759, 0.691880, 0.713520],
        [8.301132, 10.565323, 10.894422, 10.853475, 0.778338, 0.814066, 0.819623],
        [11.734987, 15.887479, 16.291147, 16.312246, 0.997606, 1.005945, 1.002443],
        [11.765759, 14.887001, 15.166731, 15.216758, 1.160444, 1.156674, 1.264039],
        [11.470013, 17.748570, 18.238732, 17.415951, 1.332254, 1.232941, 1.355284]
    ]
};
const vdata = {
    "baseline": [
        [2.692031, 2.496632, 2.365816, 2.369694, 0.557352, 0.578931, 0.566132],
        [5.391106, 4.442073, 4.675312, 4.631491, 0.579784, 0.584346, 0.592367],
        [8.549172, 8.620023, 9.375924, 9.430581, 0.507168, 0.580112, 0.582385],
        [12.312492, 12.633873, 14.273257, 14.137968, 0.507585, 0.572280, 0.580923],
        [21.532980, 16.744158, 18.675205, 17.092546, 0.512467, 0.563860, 0.574157],
        [32.269095, 22.564178, 27.357494, 27.038208, 0.629113, 0.676570, 0.718617],
        [29.590375, 34.605408, 36.986263, 36.462335, 0.781158, 0.783264, 0.827602],
        [49.836569, 49.170669, 54.492240, 52.069808, 0.996612, 1.016971, 1.104380],
        [50.826487, 48.506425, 50.985452, 49.927874, 1.159910, 1.156806, 1.406810],
        [61.259167, 59.797679, 61.864887, 27.088790, 1.349302, 1.139892, 1.331131]
    ],
    "inclusive": [
        [2.118380, 2.077976, 2.026493, 1.984828, 0.582891, 0.552267, 0.577884],
        [3.790839, 3.795615, 4.038218, 4.032508, 0.548467, 0.564073, 0.595255],
        [8.478070, 7.480396, 8.197240, 8.018440, 0.518191, 0.571863, 0.589405],
        [7.669866, 11.062902, 12.186723, 11.818098, 0.515964, 0.575259, 0.583106],
        [16.913268, 14.695167, 16.219898, 15.749321, 0.539300, 0.564444, 0.574382],
        [21.597984, 22.574097, 23.723534, 23.974583, 0.629271, 0.694037, 0.698233],
        [25.076049, 29.652684, 31.195530, 31.694123, 0.778077, 0.820484, 0.825861],
        [50.792368, 44.538805, 47.574658, 46.974978, 1.002271, 1.012969, 1.135473],
        [44.277251, 41.201595, 44.093318, 42.889944, 1.164448, 1.167062, 1.484997],
        [48.285099, 49.333032, 51.216956, 28.751168, 1.347177, 1.131402, 1.161095]
    ],
    "exclusive": [
        [2.049542, 2.008851, 1.952444, 1.907343, 0.564980, 0.576431, 0.577879],
        [4.095500, 3.669516, 3.927045, 3.798764, 0.532909, 0.581057, 0.589611],
        [8.186831, 7.091682, 7.870308, 7.793420, 0.496359, 0.579898, 0.585202],
        [8.310342, 10.573590, 11.778461, 11.485538, 0.512111, 0.568887, 0.579865],
        [16.378917, 14.127565, 15.671665, 15.520127, 0.507811, 0.565318, 0.573721],
        [24.460587, 19.781531, 23.220647, 22.804452, 0.656261, 0.721579, 0.714942],
        [32.706027, 28.328664, 29.978574, 30.963307, 0.782201, 0.822860, 0.827713],
        [41.085805, 41.957012, 45.719565, 45.533680, 1.079776, 1.017953, 1.136234],
        [42.028150, 39.853908, 42.094942, 41.575787, 1.240576, 1.167132, 1.436503],
        [50.181357, 47.981944, 49.786505, 30.871773, 1.349824, 1.177188, 1.073671]
    ]
};
const labels = [4, 5, 6, 7, 8, 9, 10];
function invDepth(n) {
    return Math.log(7 * n + 1) / Math.log(8) - 4;
}
function chartOptions(title) {
    return {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: title,
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
                afterTickToLabelConversion: (axis) => {
                    axis.ticks[0].label = "Octree depth: 4";
                },
            },
            xCount: {
                display: true,
                ticks: {
                    align: "end",
                    labelOffset: 8,
                },
                grid: {
                    drawBorder: false,
                    drawOnChartArea: false,
                },
                afterTickToLabelConversion: (axis) => {
                    axis.ticks = [
                        { value: invDepth(1.0e3), label: "Boxes: 10³" },
                        { value: invDepth(1.0e4), label: "10⁴" },
                        { value: invDepth(1.0e5), label: "10⁵" },
                        { value: invDepth(1.0e6), label: "10⁶" },
                        { value: invDepth(1.0e7), label: "10⁷" },
                        { value: invDepth(1.0e8), label: "10⁸" },
                    ];
                },
            },
            xSize: {
                display: true,
                grid: {
                    drawBorder: false,
                    drawOnChartArea: false,
                },
                afterTickToLabelConversion: (axis) => {
                    axis.ticks = [
                        { value: invDepth((32 << 10) / 24), label: "L1 (32 KiB)" },
                        { value: invDepth((512 << 10) / 24), label: "L2 (512 KiB)" },
                        { value: invDepth((1 << 22) / 24), label: "4 MiB" },
                        { value: invDepth((64 << 20) / 24), label: "L3 (64 MiB)" },
                        { value: invDepth((1 << 30) / 24), label: "1 GiB" },
                    ];
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
                    labels,
                    datasets: [
                        {
                            label: "Baseline",
                            data: data.baseline[0],
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--fg"),
                        },
                        {
                            label: "Exclusive",
                            data: data.exclusive[0],
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--search-mark-bg"),
                        },
                        {
                            label: "Inclusive",
                            data: data.inclusive[0],
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--sidebar-active"),
                        },
                    ],
                },
                options: chartOptions("Ray/box intersection throughput"),
            });
            vchart = new Chart(document.getElementById("vchart"), {
                type: "line",
                data: {
                    labels,
                    datasets: [
                        {
                            label: "Baseline",
                            data: vdata.baseline[0],
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--fg"),
                        },
                        {
                            label: "Exclusive",
                            data: vdata.exclusive[0],
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--search-mark-bg"),
                        },
                        {
                            label: "Inclusive",
                            data: vdata.inclusive[0],
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--sidebar-active"),
                        },
                        {
                            label: "Baseline (auto-vectorized)",
                            data: data.baseline[0],
                            cubicInterpolationMode: "monotone",
                            borderColor: style.getPropertyValue("--icons"),
                        },
                    ],
                },
                options: chartOptions("Vectorized ray/box intersection throughput"),
            });
            const threads = [1, 2, 4, 6, 8, 12, 16, 24, 32, 48];
            const pcolors = [
                style.getPropertyValue("--fg"),
                style.getPropertyValue("--search-mark-bg"),
                style.getPropertyValue("--sidebar-active"),
                style.getPropertyValue("--table-header-bg"),
                style.getPropertyValue("--icons"),
                style.getPropertyValue("--icons"),
                style.getPropertyValue("--icons"),
            ];
            const pdata = labels.map((d, i) => {
                return {
                    label: "Depth " + d,
                    data: threads.map((t, j) => vdata.baseline[j][i]),
                    cubicInterpolationMode: "monotone",
                    borderColor: pcolors[i],
                };
            });
            pchart = new Chart(document.getElementById("pchart"), {
                type: "line",
                data: {
                    labels: threads,
                    datasets: pdata,
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: "Parallel ray/box intersection throughput",
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
                            afterTickToLabelConversion: (axis) => {
                                axis.ticks[0].label = "Threads: 1";
                            },
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: "Intersections per second (billions)",
                            },
                        },
                    },
                },
            });
            const sdata = labels.map((d, i) => {
                return {
                    label: "Depth " + d,
                    data: threads.map((t, j) => vdata.baseline[j][i] / vdata.baseline[0][i] / t),
                    cubicInterpolationMode: "monotone",
                    borderColor: pcolors[i],
                };
            });
            schart = new Chart(document.getElementById("schart"), {
                type: "line",
                data: {
                    labels: threads,
                    datasets: sdata,
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: "Ray/box intersection scalability",
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
                            afterTickToLabelConversion: (axis) => {
                                axis.ticks[0].label = "Threads: 1";
                            },
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: "Efficiency",
                            },
                        },
                    },
                },
            });
        }
    }
});
chartObserver.observe(document.documentElement, { attributes: true });
</script>
