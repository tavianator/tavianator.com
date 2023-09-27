# A Beautiful Ray/Mesh Intersection Algorithm

<div class="infobar">

*fa-clock-o* *time-2014-05-30*
*fa-user* Tavian Barnes
[*fa-comments* Comments](#comments)

</div>


In my [last post], I talked about a beautiful method for computing ray/triangle intersections.
In this post, I will extend it to computing intersections with [triangle fans].
Since meshes are often stored in a [corner table], which is simply an array of triangle fans, this gives an efficient algorithm for ray tracing triangle meshes.

[last post]: ray_triangle.md
[triangle fans]: https://en.wikipedia.org/wiki/Triangle_fan
[corner table]: https://en.wikipedia.org/wiki/Polygon_mesh#Representations

The aforementioned algorithm computes ray/triangle intersections with 1 division, 20 multiplications, and up to 18 additions.
It also required storing an affine transformation matrix, which takes up 4/3 as much space as just storing the vertices.
But if we have many triangles which all share a common vertex, we can exploit that structure to save time and memory.

Say our triangle fan is composed of triangles `$ABC$`, `$ACD$`, `$ADE$`, etc.  As before, we compute

```math
P_{ABC} =
\begin{bmatrix}
\overrightarrow{AB} & \overrightarrow{AC} & \overrightarrow{AB} \times \overrightarrow{AC} & \overrightarrow{A} \\
0 & 0 & 0 & 1
\end{bmatrix}^{-1}.
```

Computing the change of basis from here to the next triangle is even easier.  We want to find new coordinates `$\langle u', v', w' \rangle$` such that

```math
\begin{array}{ccccccccc}
\vec{p} &=& u\hphantom{'}\,\overrightarrow{AB} &+& v\hphantom{'}\,\overrightarrow{AC} &+& w\hphantom{'}\,\overrightarrow{AB}\times\overrightarrow{AC} &+& \overrightarrow{A} \\
   {}   &=& u'\,\overrightarrow{AC} &+& v'\,\overrightarrow{AD} &+& w'\,\overrightarrow{AC}\times\overrightarrow{AD} &+& \overrightarrow{A}.
\end{array}
```

Two things are apparent: the first is that there is no further translation to perform because both coordinate systems have their origin at `$\overrightarrow{A}$`.
The second is that only `$u'$` depends on `$v$`.
This means the matrix `$P^{ABC}_{ACD}$` that takes us to the new basis has the special form

```math
P^{ABC}_{ACD} = P_{ACD}\,P^{-1}_{ABC} =
\begin{bmatrix}
a & 1 & d & 0 \\
b & 0 & e & 0 \\
c & 0 & f & 0 \\
0 & 0 & 0 & 1
\end{bmatrix},
```

so we only need to store two of its columns, and transforming the ray into the new space can be done much faster than with a full matrix multiplication.  The following transformation is applied to both the ray origin and direction:

```math
\begin{aligned}
u' &= a\,u + v + d\,w \\
v' &= b\,u + e\,w \\
w' &= c\,u + f\,w.
\end{aligned}
```

In the end, for a triangle fan with `$n$` vertices, the ray intersection can be computed with

```math
\begin{aligned}
n & \text{ divisions,} \\
6 + 14\,n & \text{ multiplications, and} \\
7 + 11\,n & \text{ additions}.
\end{aligned}
```

The multiplications and additions are also easily vectorisable.
The storage requirement is `$6\,(n + 1)$` floating-point values, which is equivalent to storing all the vertices and precomputed normals.

The implementation of this algorithm in my ray tracer [Dimension] is available [here].

[Dimension]: /dimension/
[here]: /cgit/dimension.git/tree/libdimension/model/objects/triangle_fan.c

---


## Comments

> [**Mo**](http://thecodeboss.com/)
> *fa-clock-o* *time-2014-05-30*
>
> Pretty cool, I wonder if this can be extended to triangle strips as well.
> That one might be a lot more challenging though.
>
> $$ Also I wonder if these dollar signs will break your page with a MathJax injection.
> I imagine it's more intelligent than that.
>
> > [**Mo**](http://thecodeboss.com/)
> > *fa-clock-o* *time-2014-05-30*
> >
> > Nope. :)
>
> > *fa-user* [**Tavian Barnes**](/)
> > *fa-clock-o* *time-2014-05-30*
> >
> > Haha yeah the MathJax is all done with a WordPress plugin, I write [latex]m^at_h[/latex] and it prettifies it.
> > I'm hoping it doesn't scan the page and replace $m^at_h$ with MathJax.
> >
> > And you're right, it looks hard to do this well with triangle strips because they don't all share a common vertex.
> > The above still works except the translation comes back which wastes time and space.
