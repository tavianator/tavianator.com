# A quick trick for faster naïve matrix multiplication

<div class="infobar">

*fa-clock-o* *time-2016-11-12*
*fa-user* Tavian Barnes

</div>


If you need to multiply some matrices together very quickly, usually it's best to use a highly optimized library like [ATLAS].
But sometimes adding such a dependency isn't worth it, if you're worried about portability, code size, etc.
If you just need good performance, rather than the *best possible* performance, it can make sense to hand-roll your own matrix multiplication function.

[ATLAS]: http://math-atlas.sourceforge.net/

Unfortunately, the way that matrix multiplication is usually taught:

```math
C_{i,j} = \sum_k A_{i,k} \, B_{k,j}
```

<p style="text-align: center;">
<code>$\Bigg($</code><span id="matrix-slow-C"></span><code>$\Bigg) = \Bigg($</code><span id="matrix-slow-A"></span><code>$\Bigg) \, \Bigg($</code><span id="matrix-slow-B"></span><code>$\Bigg)$</code>
</p>

<style type="text/css">
@keyframes matrix-fade-in {
    from { background-color: var(--bg); }
    to { background-color: var(--fg); }
}
@keyframes matrix-fade-out {
    from { background-color: var(--fg); }
    to { background-color: var(--bg); }
}
.matrix-fade-in {
    background-color: var(--fg);
    animation-name: matrix-fade-in;
    animation-duration: 1s;
}
.matrix-fade-out {
    background-color: var(--bg);
    animation-name: matrix-fade-out;
    animation-duration: 1s;
}
.matrix-faded {
    background-color: var(--bg);
}
</style>

<script type="text/javascript">
function squish(node) {
    node.style.margin = "0";
    node.style.border = "0";
    node.style.padding = "0";
}
function createMatrix(rows, cols, node) {
    var table = document.createElement("table");
    table.style.width = "auto";
    table.style.display = "inline-table";
    table.style.verticalAlign = "middle";
    squish(table);
    var tbody = document.createElement("tbody");
    table.appendChild(tbody);
    var matrix = [];
    for (var i = 0; i < rows; ++i) {
        var tr = document.createElement("tr");
        var row = [];
        for (var j = 0; j < cols; ++j) {
            var td = document.createElement("td");
            td.style.width = 64 / cols + "px";
            td.style.height = 64 / rows + "px";
            td.className = "matrix-faded";
            squish(td);
            tr.appendChild(td);
            row.push(td);
        }
        tbody.appendChild(tr);
        matrix.push(row);
    }
    node.appendChild(table);
    return matrix;
}
var rows = 8;
var mid = 8;
var cols = 8;
var slowC = createMatrix(rows, cols, document.getElementById("matrix-slow-C"));
var slowA = createMatrix(rows, mid, document.getElementById("matrix-slow-A"));
var slowB = createMatrix(mid, cols, document.getElementById("matrix-slow-B"));
var slowI = 0;
var slowJ = 0;
var slowK = -1;
function fade(matrix, oldI, oldJ, newI, newJ) {
    if (oldI != newI || oldJ != newJ) {
        if (oldI >= 0 && oldJ >= 0) {
            matrix[oldI][oldJ].className = "matrix-fade-out";
        }
    }
    matrix[newI][newJ].className = "matrix-fade-in";
}
function slowAnimate() {
    var oldI = slowI;
    var oldJ = slowJ;
    var oldK = slowK;
    ++slowK;
    if (slowK == mid) {
        slowK = 0;
        ++slowJ;
    }
    if (slowJ == cols) {
        slowJ = 0;
        ++slowI;
    }
    if (slowI == rows) {
        slowI = 0;
    }
    fade(slowC, oldI, oldJ, slowI, slowJ);
    fade(slowA, oldI, oldK, slowI, slowK);
    fade(slowB, oldK, oldJ, slowK, slowJ);
}
setInterval(slowAnimate, 125);
</script>

leads to a slow implementation:

```c
void matmul(double *dest, const double *lhs, const double *rhs,
            size_t rows, size_t mid, size_t cols) {
    for (size_t i = 0; i < rows; ++i) {
        for (size_t j = 0; j < cols; ++j) {
            const double *rhs_row = rhs;
            double sum = 0.0;
            for (size_t k = 0; k < mid; ++k) {
                sum += lhs[k] * rhs_row[j];
                rhs_row += cols;
            }
            *dest++ = sum;
        }
        lhs += mid;
    }
}
```

This function multiplies a `rows`×`mid` matrix with a `mid`×`cols` matrix using the "linear algebra 101" algorithm.
Unfortunately, it has a bad memory access pattern: we loop over `dest` and `lhs` pretty much in order, but jump all over the place in `rhs`, since it's stored row-major but we need its columns.

Luckily there's a simple fix that's dramatically faster: instead of computing each cell of the destination separately, we can update whole rows of it at a time.
Effectively, we do this:

```math
C_{i} = \sum_j A_{i,j} \, B_j
```

<p style="text-align: center;">
<code>$\Bigg($</code><span id="matrix-fast-C"></span><code>$\Bigg) = \Bigg($</code><span id="matrix-fast-A"></span><code>$\Bigg) \, \Bigg($</code><span id="matrix-fast-B"></span><code>$\Bigg)$</code>
</p>

<script type="text/javascript">
var fastC = createMatrix(rows, cols, document.getElementById("matrix-fast-C"));
var fastA = createMatrix(rows, mid, document.getElementById("matrix-fast-A"));
var fastB = createMatrix(mid, cols, document.getElementById("matrix-fast-B"));
var fastI = 0;
var fastJ = 0;
var fastK = -1;
function fastAnimate() {
    var oldI = fastI;
    var oldJ = fastJ;
    var oldK = fastK;
    ++fastK;
    if (fastK == cols) {
        fastK = 0;
        ++fastJ;
    }
    if (fastJ == mid) {
        fastJ = 0;
        ++fastI;
    }
    if (fastI == rows) {
        fastI = 0;
    }
    fade(fastC, oldI, oldK, fastI, fastK);
    fade(fastA, oldI, oldJ, fastI, fastJ);
    fade(fastB, oldJ, oldK, fastJ, fastK);
}
setInterval(fastAnimate, 125);
</script>

In code, it looks like this:

```c
void matmul(double *dest, const double *lhs, const double *rhs,
            size_t rows, size_t mid, size_t cols) {
    memset(dest, 0, rows * cols * sizeof(double));

    for (size_t i = 0; i < rows; ++i) {
        const double *rhs_row = rhs;
        for (size_t j = 0; j < mid; ++j) {
            for (size_t k = 0; k < cols; ++k) {
                dest[k] += lhs[j] * rhs_row[k];
            }
            rhs_row += cols;
        }
        dest += cols;
        lhs += mid;
    }
}
```

On my computer, that drops the time to multiply two 256×256 matrices from 37ms to 13ms (with `gcc -O3`).
ATLAS does it in 5ms though, so always use something like it if it's available.
