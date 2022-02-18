# Exact Bounding Boxes for Spheres/Ellipsoids

<div class="infobar">

<fa:clock-o> 2014-06-08
<fa:user> Tavian Barnes
[<fa:comments> Comments](#comments)

</div>


Finding the tightest axis-aligned bounding box for a sphere is trivial: the box extends from the center by the radius in all dimensions.
But once the sphere is transformed, finding the minimal bounding box becomes trickier.
Rotating a sphere, for example, shouldn't change its bounding box, but naïvely rotating the bounding box will expand it unnecessarily.
Luckily there's a trick to computing minimal bounding boxes by representing the transformed sphere as a [quadric surface].

[quadric surface]: https://en.wikipedia.org/wiki/Quadric

A description of the technique can be found on Yining Karl Li's blog [here], and in [this] Stack Overflow answer.
Unfortunately, both descriptions gloss over the math, as well as some details that give rise to a simple and efficient implementation.
The post on Li's blog also contains a small bug.
In contrast, this post examines the technique in full detail.
It relies on the [projective representation of a quadric].

[here]: http://blog.yiningkarlli.com/2013/02/bounding-boxes-for-ellipsoids.html
[this]: https://stackoverflow.com/questions/4368961/calculating-an-aabb-for-a-transformed-sphere/4369956#4369956
[projective representation of a quadric]: https://en.wikipedia.org/wiki/Quadric#Projective_geometry

A sphere of radius 1, centred at the origin, can be defined as the set of points where `$x^2 + y^2 + z^2 = 1$`.
For the homogeneous point `$\vec{p} = \begin{bmatrix}x & y & z & 1\end{bmatrix}^\top$`, the same sphere can be defined by

```math
\vec{p}^\top \, \mathbf{S} \, \vec{p} = 0,
```

where

```math
\mathbf{S} = \begin{bmatrix}
1 & 0 & 0 & 0 \\
0 & 1 & 0 & 0 \\
0 & 0 & 1 & 0 \\
0 & 0 & 0 & -1
\end{bmatrix}.
```

If an arbitrary affine transformation `$\mathbf{M}$` is applied to the sphere, the equation becomes

```math
\begin{aligned}
(\mathbf{M}^{-1}\,\vec{p})^\top \, \mathbf{S} \, (\mathbf{M}^{-1}\,\vec{p}) & = \vec{p}^\top \, (\mathbf{M}^{-\mathrm{T}}\,\mathbf{S}\,\mathbf{M}^{-1}) \, \vec{p} \\
{} & = 0.
\end{aligned}
```

We denote this transformed quadric matrix by `$\mathbf{Q} = \mathbf{M}^{-\mathrm{T}}\,\mathbf{S}\,\mathbf{M}^{-1}$`.
Note that `$\mathbf{Q}$` is symmetric.


## The Dual Form

The minimal bounding box for this surface will be tangent to it, so we need to find an expression for its tangent planes.
In homogeneous coordinates, a plane can be represented by a row vector `$\vec{u}^\top$` such that `$\vec{u}\cdot\vec{p} = 0$`.
For a point `$\vec{p}$` on the surface, the plane `$\vec{u}^\top = \vec{p}^\top \, \mathbf{Q}$` touches the quadric at `$\vec{p}$`, since

```math
\begin{aligned}
\vec{u}\cdot\vec{p} & = \vec{u}^\top \, \vec{p} \\
{} & = \vec{p}^\top \, \mathbf{Q} \, \vec{p} \\
{} & = 0.
\end{aligned}
```

Furthermore, this must be the unique intersection point.
To see why, consider a point `$\vec{q} = \vec{p} + r\,\hat{r}$` that falls on both the plane and the quadric.

```math
\begin{aligned}
\vec{q}^\top \, \mathbf{Q} \, \vec{q} & = (\vec{p} + r\,\hat{r})^\top \, \mathbf{Q} \, \vec{q} \\
{} & = \vec{u}\cdot\vec{p} + r\,\hat{r}^\top \, \mathbf{Q} \, \vec{q} \\
{} & = r \, (\vec{q}^\top \, \mathbf{Q} \, \hat{r})^\top \\
{} & = r^2 \, (\hat{r}^\top \, \mathbf{Q} \, \hat{r}) \\
{} & = 0.
\end{aligned}
```

If `$\hat{r}^\top \, \mathbf{Q} \, \hat{r}$` is zero, then the whole line `$\vec{p} + t\,\hat{r}$` must lie on the quadric, which is impossible since its surface is curved.
Therefore `$r = 0$` and `$\vec{q} = \vec{p}$`.
Since the plane has exactly one point in common with the quadric, `$\vec{u}^\top$` must be the tangent plane at that point.
This gives a nice characterization of the tangent planes:

```math
\begin{aligned}
\vec{u}^\top \, \mathbf{Q}^{-1} \, \vec{u} & = \vec{p}^\top \, \mathbf{Q} \, \mathbf{Q}^{-1} \, \mathbf{Q} \, \vec{p} \\
{} & = \vec{p}^\top \, \mathbf{Q} \, \vec{p} \\
{} & = 0.
\end{aligned}
```


## Solving for the Planes

Let `$\mathbf{R} = \mathbf{Q}^{-1} = \mathbf{M} \, \mathbf{S}^{-1} \, \mathbf{M}^\top$`.
Like `$\mathbf{Q}$`, `$\mathbf{R}$` is symmetric.
We want to find axis-aligned planes `$\vec{u}^\top$` such that `$\vec{u}^\top \, \mathbf{R} \, \vec{u} = 0$`.
The plane perpendicular to `$\hat{x}$` looks like `$\vec{u}^\top = \begin{bmatrix}1 & 0 & 0 & -x\end{bmatrix}$`, so we have

```math
\begin{aligned}
\vec{u}^\top \, \mathbf{R} \, \vec{u} & =
\begin{bmatrix}
1 & 0 & 0 & -x
\end{bmatrix}
\,
\mathbf{R}
\,
\begin{bmatrix}
1 \\
0 \\
0 \\
-x \\
\end{bmatrix} \\
{} & =
\begin{bmatrix}
1 & 0 & 0 & -x
\end{bmatrix}
\,
\begin{bmatrix}
\mathbf{R}_{1,1} - \mathbf{R}_{1,4}\,x \\
\mathbf{R}_{2,1} - \mathbf{R}_{2,4}\,x \\
\mathbf{R}_{3,1} - \mathbf{R}_{3,4}\,x \\
\mathbf{R}_{4,1} - \mathbf{R}_{4,4}\,x \\
\end{bmatrix} \\
{} & = \mathbf{R}_{4,4}\,x^2 - (\mathbf{R}_{1,4} + \mathbf{R}_{4,1})\,x + \mathbf{R}_{1,1} \\
{} & = \mathbf{R}_{4,4}\,x^2 - 2\,\mathbf{R}_{1,4}\,x + \mathbf{R}_{1,1} \\
{} & = 0 \\
x & = \frac{\mathbf{R}_{1,4} \pm \sqrt{\mathbf{R}_{1,4}^2 - \mathbf{R}_{1,1}\,\mathbf{R}_{4,4}}}{\mathbf{R}_{4,4}}. \\
\end{aligned}
```

Similarly, the `$\hat{y}$` and `$\hat{z}$` planes are given by

```math
\begin{aligned}
y & = \frac{\mathbf{R}_{2,4} \pm \sqrt{\mathbf{R}_{2,4}^2 - \mathbf{R}_{2,2}\,\mathbf{R}_{4,4}}}{\mathbf{R}_{4,4}} \\
z & = \frac{\mathbf{R}_{3,4} \pm \sqrt{\mathbf{R}_{3,4}^2 - \mathbf{R}_{3,3}\,\mathbf{R}_{4,4}}}{\mathbf{R}_{4,4}}. \\
\end{aligned}
```

This is where the above linked posts stop, but a lot more simplification can be done.


## Implementation Details

Several details of the problem can make computing the planes more efficient.
The first is that `$\mathbf{S}$` is involutory, meaning `$\mathbf{S}^{-1} = \mathbf{S}$`.
This means that the product `$\mathbf{M}\,\mathbf{S}^{-1}$` can be computed implicitly: it is simply `$\mathbf{M}$` with its last column negated.
The last column of `$\mathbf{R} = \mathbf{M} \, \mathbf{S}^{-1} \, \mathbf{M}^\top$` is the same, because the last column of `$\mathbf{M}^\top$` is `$\begin{bmatrix}0 & 0 & 0 & 1\end{bmatrix}^\top$`.
In particular, `$\mathbf{R}_{4,4} = -1$`.

Not all values of `$\mathbf{R}$` are used; in fact, only values from the last column and the diagonal appear in the formulae.
We know the last column implicitly, and the diagonal has the formula

```math
\mathbf{R}_{i,i} = \left(\sum_{j=1}^3 \mathbf{M}_{i,j}^2\right) - \mathbf{M}_{i,4}^2.
```

Plugging this identity into the plane equations simplifies them greatly:

```math
\begin{aligned}
x & = \mathbf{M}_{1,4} \pm \sqrt{\mathbf{M}_{1,1}^2 + \mathbf{M}_{1,2}^2 + \mathbf{M}_{1,3}^2} \\
y & = \mathbf{M}_{2,4} \pm \sqrt{\mathbf{M}_{2,1}^2 + \mathbf{M}_{2,2}^2 + \mathbf{M}_{2,3}^2} \\
z & = \mathbf{M}_{3,4} \pm \sqrt{\mathbf{M}_{3,1}^2 + \mathbf{M}_{3,2}^2 + \mathbf{M}_{3,3}^2}.
\end{aligned}
```

This makes at least some intuitive sense, since the fourth column of `$\mathbf{M}$` determines the sphere's translation.
See [here][impl] for an implementation in my ray tracer [Dimension].

[impl]: /cgit/dimension.git/tree/libdimension/sphere.c?id=df36a146277eaa442f09520da8d40b95107803d7#n62
[Dimension]: /dimension

---


## Comments

> **Michael Doube**
> <fa:clock-o> 2015-03-24
>
> Hello,
>
> Very nice simplification.
> How does M relate to the ellipsoid's eigenvectors and eigenvalues?
> Or, put another way: I already know the ellipsoid's centre, its radii & eigenvalues (U, 3 × 3) and an eigenvector roation matrix (V, 3 × 3).
> The centre is M[1,2,3],4, but how can I get the other M elements from what I know?
> Or another way: is the top left 3×3 of the 4×4 affine transform simply UV (which I also already have)?
>
> <http://en.wikipedia.org/wiki/Ellipsoid#Generalised_equations>
>
> I'd like to implement your solution in my Ellipsoid class, to exclude ellipsoids from other calculations:
>
> <https://github.com/mdoube/BoneJ/blob/master/src/org/doube/geometry/Ellipsoid.java>
>
> Thanks,
>
> Michael
>
> > <fa:user> [**Tavian Barnes**](/)
> > <fa:clock-o> 2015-03-25
> >
> > If I'm not mistaken, you have `$\mathbf{A} = \mathbf{V} \, \mathbf{U} \, \mathbf{V}^\mathrm{T}$` (with `$\mathbf{U} = \mathrm{diag}(r_x^{-2}, r_y^{-2}, r_z^{-2})$`) such that your ellipsoid is determined by `$(\vec{x} - \vec{v})^\mathrm{T} \, \mathbf{A} \, (\vec{x} - \vec{v}) = 1$`.
> > In this case, `$\mathbf{A}$` takes the place of `$\mathbf{Q}$` above, but the expressions are in terms of `$\mathbf{R} = \mathbf{Q}^{-1}$`.
> >
> > A more convenient formulation would have `$\mathbf{U} = \mathrm{diag}(r_x^{-1}, r_y^{-1}, r_z^{-1})$`.
> > Then `$\mathbf{A} = \mathbf{M}^{-\mathrm{T}} \, \mathbf{M}^{-1} = \mathbf{V} \, \mathbf{U} \, (\mathbf{V} \, \mathbf{U})^\mathrm{T}$`, so `$\mathbf{M}^{-1} = (\mathbf{V} \, \mathbf{U})^\mathrm{T} = \mathbf{U} \, \mathbf{V}^\mathrm{T}$` and `$\mathbf{M} = \mathbf{V}^{-\mathrm{T}} \, \mathbf{U}^{-1}$`.
> > Since `$\mathbf{V}$` is a rotation matrix, `$\mathbf{V}^{-\mathrm{T}} = \mathbf{V}$`, so `$\mathbf{M} = \mathbf{V} \, \mathbf{U}^{-1}$`.
> > `$\mathrm{U}^{-1}$` is of course `$\mathrm{diag}(r_x, r_y, r_z)$`.
> > That means your bounding box will be given by
> >
> > ```math
> > \begin{aligned}
> > x &= v_x \pm \sqrt{r_x^2\,\mathbf{V}_{1,1}^2 + r_y^2\,\mathbf{V}_{1,2}^2 + r_z^2\,\mathbf{V}_{1,3}^2} \\
> > y &= v_y \pm \sqrt{r_x^2\,\mathbf{V}_{2,1}^2 + r_y^2\,\mathbf{V}_{2,2}^2 + r_z^2\,\mathbf{V}_{2,3}^2} \\
> > z &= v_z \pm \sqrt{r_x^2\,\mathbf{V}_{3,1}^2 + r_y^2\,\mathbf{V}_{3,2}^2 + r_z^2\,\mathbf{V}_{3,3}^2}.
> > \end{aligned}
> > ```
> >
> > > **Michael Doube**
> > > <fa:clock-o> 2015-03-25
> > >
> > > Hi Tavian,
> > >
> > > Thanks for the reply.
> > > I've worked out the affine transform, based on sequential scaling, rotation and transformation.
> > > The scaling matrix S is diag(ra, rb, rc), the rotation is V and the transform, M is given by M = VS.
> > > Then I use the values from M as you originally proposed.
> > > (seems to work and a massive speedup, thank you!)
> > >
> > > The result looks very similar to your comment above except that the off-diagonal terms are also multiplied, because the rotation matrix is postmultiplied by the diagonal scaling matrix.
> > > (Each column of the affine transform is multiplied by the corresponding element of the diagonal scaling transform)
> > >
> > > In Java:
> > >
> > > ```java
> > > public double[] getXMinAndMax() {
> > > 	final double m11 = ev[0][0] * ra;
> > > 	final double m12 = ev[0][1] * rb;
> > > 	final double m13 = ev[0][2] * rc;
> > > 	final double d = Math.sqrt(m11 * m11 + m12 * m12 + m13 * m13);
> > > 	double[] minMax = { cx - d, cx + d };
> > > 	return minMax;
> > > }
> > >
> > > public double[] getYMinAndMax() {
> > > 	final double m21 = ev[1][0] * ra;
> > > 	final double m22 = ev[1][1] * rb;
> > > 	final double m23 = ev[1][2] * rc;
> > > 	final double d = Math.sqrt(m21 * m21 + m22 * m22 + m23 * m23);
> > > 	double[] minMax = { cy - d, cy + d };
> > > 	return minMax;
> > > }
> > >
> > > public double[] getZMinAndMax() {
> > > 	final double m31 = ev[2][0] * ra;
> > > 	final double m32 = ev[2][1] * rb;
> > > 	final double m33 = ev[2][2] * rc;
> > > 	final double d = Math.sqrt(m31 * m31 + m32 * m32 + m33 * m33);
> > > 	double[] minMax = { cz - d, cz + d };
> > > 	return minMax;
> > > }
> > > ```
> > >
> > > > <fa:user> [**Tavian Barnes**](/)
> > > > <fa:clock-o> 2015-03-25
> > > >
> > > > Yep, I forgot how to multiply matrices apparently.
> > > > Fixed!
> > > > Glad you found this post useful.

> **William H Walker**
> <fa:clock-o> 2019-12-01
>
> I've been trying to understand the practical application of SVD to a simple data set, and have constructed an ellipsoid analogous to what is shown in: \
> <http://www.aprendtech.com/blog/P42svd/P42svd.html>
>
> I'm not a professional, and never did any work in the fields of imaging, statistics, or linear algebra, but can follow most of what is going on. \
> I'm using POV-Ray to visualize what is going on, and do most of the post-SVD matrix math and geometric transforms. \
> I generate random points on a sphere, anisotropically scale the system, and then rotate it around z, y, and x to give me an ellipsoid. \
> Over the last two weeks, I have spent much of my free time trying to do two things:
>
> 1. Construct a set of basis vectors from the SVD that properly align with the ellipsoid, and then rotate the system so that the ellipsoid is aligned with the cardinal Euclidean axes.
>
> 2. Understand the rest of the SVD results, and actually apply them to the ellipsoid to regenerate the original spherical system.
>
> Could you possibly offer me some assistance, at least to reliably achieve goal #1? I've tried to contact several other people directly or through fora already, and I'm met with no reply, a complete failure to understand the situation and issue(s), or ... worse. :(
>
> I have seen it stated in one variation or another that, "the columns of U are the axes of the transformed data hyperellipse and the corresponding diagonal elements of S are their lengths."
>
> I'm struggling with this for a number of reasons. There is the narrow or thin SVD, and the wide or full SVD. So sometimes it's unclear to me which matrix is which. In either case, one of the matrices from the SVD is a max(n,m) x max (n,m) matrix. \
> If I have 30, or 400 data points, that's a 30x30 or 400 x 400 matrix. How are axes and their lengths extracted from that?
>
> I've done both the narrow and wide SVDs, and I think I always wind up getting the smaller 3x3 matrix to be an orthonormal matrix whose axes get aligned with the cardinal axes when I apply the matrix-transpose. That makes sense to me, as the axes would need to be unit lengths in order to be properly scaled by S, and being orthonormal and having a determinant of 1 shows that it's a purely rotational matrix. I confirm that graphically, but the axes don't line up with the axes of the ellipsoid data points.
>
> For goal #2, understanding the rest of the SVD:
>
> Going back to, "the columns of U are the axes of the transformed data hyperellipse and the corresponding diagonal elements of S are their lengths," I have also seen it claimed that, "To approximate the original matrix, it makes sense to use the U and V matrices of the original matrix and then to adjust the S matrix. That way we can get the original matrix back for a full rank approximation by using the complete S matrix. "
>
> I guess I'm naively believing that since [A] = [U][S][VT], that S would/should give me the scaling factors that I use to generate the ellipsoid from the sphere. Perhaps I could accept the explanation that a composition of the matrices of the SVD is only an _approximation_ of the original matrix, but I find it extremely curious that using 3 different tools to calculate the SVD gives very closely matching results. Shouldn't I get an accurate set of scaling factors from S?
>
> And now the real beast:
> "multiplying by U rotates the scaled data."
> That sounds great and looks even better when written symbolically, but the practical details completely elude me.
>
> When I create a transform matrix for my sphere, I make a matrix for scaling and three matrices for the rotations around z, y, and x. The composition of these matrices gives me a final overall matrix ([A]?) that converts the sphere into the ellipsoid. That matrix is still only 3x3.
> How does one get a max(n,m) x max (n,m) matrix, and more importantly (for me), how does one use that huge matrix as a "rotation matrix"?
