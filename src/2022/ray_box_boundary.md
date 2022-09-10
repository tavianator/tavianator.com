# Fast, Branchless Ray/Bounding Box Intersections, Part 3: Boundaries

<div class="infobar">

<fa:clock-o> <time:2022-07-27>
<fa:user> Tavian Barnes
[<fa:github> GitHub](https://github.com/tavianator/ray_box)

</div>

<ins>This post is the third in a series of posts I've written about ray/bounding box intersection tests.
However, it supersedes the previous two, and should be self contained, so don't feel like you have to read the others unless you're interested in the historical context.
On <time:2022-09-10> I substantially revised this post, improving the implementation and adding a much more thorough performance analysis.</ins>

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
      <code>$\square_{\min} = \begin{pmatrix} x_{\min} \\ y_{\min} \\ z_{\min} \end{pmatrix}$</code>
    </foreignObject>
    <circle cx="320" cy="80" r="4" fill="var(--fg)" />
    <foreignObject x="330" y="40" width="140" height="80">
      <code>$\square_{\max} = \begin{pmatrix} x_{\max} \\ y_{\max} \\ z_{\max} \end{pmatrix}$</code>
    </foreignObject>
  </svg>
</figure>

A point `$(x, y, z)$` is inside the box if and only if

```math
\begin{alignedat}{3}
& x_{\min} && < x && < x_{\max} \\
& y_{\min} && < y && < y_{\max} \\
& z_{\min} && < z && < z_{\max}. \\
\end{alignedat}
```

Equivalently, the interior of the box is the intersection of many [half-spaces](https://en.wikipedia.org/wiki/Half-space_(geometry)):

<figure>
  <svg width="550" height="400" viewBox="-80 0 550 400">
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
      <code>$\displaystyle t_1 = \frac{x_{\min} - x_0}{x_d}$</code>
    </foreignObject>
    <circle cx="320" cy="28.571428" r="4" fill="var(--fg)" />
    <foreignObject x="330" y="30" width="125" height="45">
      <code>$\displaystyle t_2 = \frac{x_{\max} - x_0}{x_d}$</code>
    </foreignObject>
  </svg>
</figure>

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
That means rays which just touch a corneray, edge, or face of the bounding box will be considered non-intersecting.

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
-  if (intersection(ray, objects[i]->bounding_box)) {
+  if (intersection(ray, objects[i]->bounding_box, t)) {
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

Measurements were taken on an 3.80 GHz AMD Ryzen Threadripper 3960X running Arch Linux.
CPU frequency scaling was disabled, as was [Turbo Core](https://en.wikipedia.org/wiki/AMD_Turbo_Core) (AMD's version of [Turbo Boost](https://en.wikipedia.org/wiki/Intel_Turbo_Boost)), so the clock speed was constant throughout the expirement.
The code was compiled by Clang 14.0.6 with the flags `-O3 -flto -march=native`.
I also tried GCC 12.2.0, but it did not consistently eliminate branches or vectorize the loop, making it much slower.
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

The benchmark tested intersections between a ray and a complete [octree](https://en.wikipedia.org/wiki/Octree) of various heights which fit in L1, L2, L3, and main memory.
Approximately 10 billion intersection tests were performed for each configuration.
The observed throughput (intersection tests per second) is reported in this table:

<div style="width: 100%; overflow-x: auto;">
  <table style="min-width: 100%;">
    <thead>
      <tr>
        <th>Height</th>
        <th>4</th>
        <th>5</th>
        <th>8</th>
        <th>10</th>
      </tr>
      <tr>
        <th>Size</th>
        <th>14&nbsp;KiB<br>&lt;&nbsp;32&nbsp;KiB&nbsp;L1</th>
        <th>110&nbsp;KiB<br>&lt;&nbsp;512&nbsp;KiB&nbsp;L2</th>
        <th>55&nbsp;MiB<br>&lt;&nbsp;64&nbsp;MiB&nbsp;L3</th>
        <th>3.5&nbsp;GiB</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Baseline</strong></td>
        <td><strong>753</strong>&nbsp;M/s</td>
        <td><strong>757</strong>&nbsp;M/s</td>
        <td>477&nbsp;M/s</td>
        <td><strong>475</strong>&nbsp;M/s</td>
      </tr>
      <tr>
        <td><strong>Exclusive</strong></td>
        <td>689&nbsp;M/s</td>
        <td>691&nbsp;M/s</td>
        <td>457&nbsp;M/s</td>
        <td>457&nbsp;M/s</td>
      </tr>
      <tr>
        <td><strong>Inclusive</strong></td>
        <td>692&nbsp;M/s</td>
        <td>694&nbsp;M/s</td>
        <td><strong>486</strong>&nbsp;M/s</td>
        <td>458&nbsp;M/s</td>
      </tr>
    </tbody>
  </table>
</div>

The baseline algorithm is fastest in all but one configuration, where surprisingly enough the inclusive algorithm comes out on top.
There is a sharp decline in throughput as the working set exceeds the L2 cache size, but even then every algorithm can handle at least **450 million** intersections/s.
In the fastest configurations, we can compute over **750 million** intersections/s on a single core!
If you want to try these benchmarks yourself, the code is [on GitHub](https://github.com/tavianator/ray_box).
