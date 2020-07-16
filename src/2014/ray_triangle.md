# A Beautiful Ray/Triangle Intersection Method

<div class="infobar">

<fa:clock-o> 2014-05-23
<fa:user> Tavian Barnes
[<fa:comments> Comments](#comments)

</div>


3D ray/triangle intersections are obviously an important part of much of computer graphics.
The [Möller–Trumbore algorithm], for example, computes these intersections very quickly.
But there is another method that I believe is more elegant, and in some cases allows you to compute the intersection for “free.”

[Möller–Trumbore algorithm]: https://en.wikipedia.org/wiki/M%C3%B6ller%E2%80%93Trumbore_intersection_algorithm

Say your triangle has corners at `$A$`, `$B$`, and `$C$`.
If your triangle is not degenerate, those three points define a plane.
Writing the vector from `$A$` to `$B$` as `$\overrightarrow{AB} = \overrightarrow{B} - \overrightarrow{A}$`, and similarly for `$\overrightarrow{AC}$`, the normal vector perpendicular to that plane is given by

```math
\overrightarrow{N} = \overrightarrow{AB} \times \overrightarrow{AC}
```

Since `$\overrightarrow{AB}$`, `$\overrightarrow{AC}$`, and `$\overrightarrow{N}$` are all linearly independent, they form an alternative basis for all of 3-space.
That is, any point `$\overrightarrow{p}$`  can be represented by a unique triple `$\langle u, v, w \rangle$` such that

```math
\vec{p} = u\,\overrightarrow{AB} + v\,\overrightarrow{AC} + w\,\overrightarrow{N}.
```

We can make this space even nicer by translating `$A$` to the origin, giving

```math
\vec{p} = u\,\overrightarrow{AB} + v\,\overrightarrow{AC} + w\,\overrightarrow{N} + \overrightarrow{A}.
```

In this space, the three corners of the triangle are at `$\langle 0,0,0 \rangle$`, `$\langle 1,0,0 \rangle$`, and `$\langle 0,1,0 \rangle$`.
It is easy to see that a point is within the triangle if and only if `$u,v \ge 0$`, `$u + v \le 1$`, and `$w = 0$`.

To transform a point `$(x,y,z)$` into this nicer space, we can use an affine change of basis matrix

```math
P = \begin{bmatrix}
\overrightarrow{AB} & \overrightarrow{AC} & \overrightarrow{N} & \overrightarrow{A} \\
0 & 0 & 0 & 1
\end{bmatrix}^{-1}.
```

A line defined by `$\overrightarrow{o} + t\,\overrightarrow{n}$` can thus be transformed into the new space by

```math
\begin{aligned}
\begin{bmatrix}
\mathrlap{o_u}\hphantom{n_u} \\
\mathrlap{o_v}\hphantom{n_v} \\
\mathrlap{o_w}\hphantom{n_w} \\
1
\end{bmatrix}
& =
P\,
\begin{bmatrix}
\mathrlap{o_x}\hphantom{n_x} \\
\mathrlap{o_y}\hphantom{n_y} \\
\mathrlap{o_z}\hphantom{n_z} \\
1
\end{bmatrix} \\
\begin{bmatrix}
n_u \\
n_v \\
n_w \\
0
\end{bmatrix}
& =
P\,
\begin{bmatrix}
n_x \\
n_y \\
n_z \\
0
\end{bmatrix}
\end{aligned}
```

Solving for the intersection point is easy:

```math
\begin{aligned}
t & = -o_w/n_w \\
u & = o_u + t\,n_u \\
v & = o_v + t\,n_v
\end{aligned}
```

And as above, this can be quickly checked with `$u, v \ge 0$`, `$u + v \le 1$` (and `$t \ge 0$` to only count intersections &ldquo;in front&rdquo; of the ray).

The beauty of this method is that often, objects are already associated with a transformation matrix, so if you left-multiply that matrix by `$P$`, the change of basis is performed for free at the same time as other transformations, and only the short block above is needed to actually perform the intersection test.
At a cost of 1 division, 2 multiplications, 2 or 3 additions, and some comparisons, that's about as fast as possible without special-casing triangles versus other objects.

Of course, if you're working with lots of triangles (a mesh, for example), you can save memory and time by not associating a transformation matrix with each triangle.
In that case, other algorithms such as the one linked above may be faster as they can avoid the two matrix multiplications.

An implementation of this method can be seen [here] in my ray tracer [Dimension].

[here]: /cgit/dimension.git/commit/?id=21137f8eaae886c034f62e18e6039cc48f09993e
[Dimension]: /dimension/

---


# Comments

> **Raphael**
> <fa:clock-o> 2014-08-09
>
> I'm a bit confused about the "cost of 1 division, 2 multiplications, 2 or 3 additions, and some comparisons".
> Don't you still have to multiply each ray by the matrix P?
> So even if P is precomputed and stored ahead of time, that's still 16 multiplications and 12 additions, plus the computations of t,u, and v.
>
> > <fa:user> [**Tavian Barnes**](/)
> > <fa:clock-o> 2014-08-10
> >
> > That's in the case that "objects are already associated with a transformation matrix," in which case you have to do a matrix-ray multiplication anyway, so it doesn't count against you.
> > Also I think you've underestimated the cost of a matrix-ray multiplication, it ought to be 18 multiplications and 15 additions.

> **Vladimir**
> <fa:clock-o> 2017-01-18
>
> Hi! I wonder what is nw is 0? I watched sources from the dimension repo, that case is not handled at all: \
> <https://tavianator.com/cgit/dimension.git/tree/libdimension/triangle.c?id=21137f8eaae886c034f62e18e6039cc48f09993e>
>
> Could you please explain what to do if nw is 0?
>
> > <fa:user> [**Tavian Barnes**](/)
> > <fa:clock-o> 2017-01-31
> >
> > Geometrically, if `$n_w$` is zero, then the line is exactly parallel to the plane of the triangle.
> > For this degenerate case, it's easiest to just return "no intersection."
> > There are a few sub-cases:
> >
> > - `$o_w = 0$`: Then we'll have `$t = \mathrm{NaN}$`, so `$t \ge 0$` fails and we return `false`
> > - `$o_w > 0$`: We'll have `$t = -\infty$`, so again `$t \ge 0$` fails and we return `false`
> > - `$o_w < 0$`: We get `$t = \infty$`.  Depending on `$n_u$` and `$n_v$`,
> >   - `$n_u < 0$` or `$n_v < 0$`: Then `$u = -\infty$`, `$v = -\infty$`, so at least one of `$u \ge 0$` or `$v \ge 0$` fails and we return `false`
> >   - `$n_u = 0$` or `$n_v = 0$`: Results in `$u = \mathrm{NaN}$` or `$v = \mathrm{NaN}$`, so again one of `$u \ge 0$` or `$v \ge 0$` fails and we return `false`
> >   - `$n_u > 0$` and `$n_v > 0$`: That means `$u = v = \infty$`, so `$u + v \le 1$` fails and we return `false`
> >
> > Without explicitly handling the `$n_w = 0$` case, the properties of IEEE floating point arithmetic have given us the desired behaviour in all cases.
