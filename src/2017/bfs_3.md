# `bfs` from the ground  up, part 3: optimization

<div class="infobar">

*fa-clock-o* *time-2017-10-12*
*fa-user* Tavian Barnes
[*fa-reddit* Reddit](https://www.reddit.com/r/C_Programming/comments/75xssz/optimizations_in_my_clone_of_the_unix_find_command/)
[*fa-github* GitHub](https://github.com/tavianator/bfs)

</div>


I recently released [version 1.1.3] of [`bfs`], my breadth-first drop-in replacement for the UNIX `find` command.
The major change in this release is a refactor of the optimizer, so I figured it would be a good time to write up some of the details of its implementation.

[version 1.1.3]: https://github.com/tavianator/bfs/releases/tag/1.1.3
[`bfs`]: ../projects/bfs.md

After `bfs` parses its command line, it applies a series of optimizations to the resulting expression tree, in the hopes that this will make it run faster.
`bfs` supports different levels of optimization (`-O1`, `-O2`, etc.), so this post will talk about each level in order, and what new optimization each one introduces.


## `-O1`

At `-O1`, bfs enables a basic set of Boolean simplifications, things like `$(\texttt{-true} \mathbin{\texttt{-and}} B) \iff B$`.
This actually comes up quite often, because options that have no per-file effect are still part of the expression tree.
For example,

<style type="text/css">
pre.terminal {
    background: black;
    color: #b2b2b2;
    padding: 0.5em;
    white-space: pre-wrap;
}
pre.terminal .white {
    color: white;
    font-weight: bold;
}
pre.terminal .red {
    color: #ff5454;
    font-weight: bold;
}
pre.terminal .green {
    color: #54ff54;
    font-weight: bold;
}
pre.terminal .blue {
    color: #5454ff;
    font-weight: bold;
}
pre.terminal .magenta {
    color: #ff54ff;
    font-weight: bold;
}
pre.terminal .yellow {
    color: #ffff54;
    font-weight: bold;
}
pre.terminal .cyan {
    color: #54ffff;
    font-weight: bold;
}
</style>

<pre class="terminal">
<span class="white">$</span> <span class="green">bfs</span> <span class="blue">-follow -print</span>
</pre>

results in the same expression tree as

<pre class="terminal">
<span class="white">$</span> <span class="green">bfs</span> <span class="blue">-true -print</span>
</pre>

(but with the `follow` flag set).

The full list of simplifications applied by `-O1` is:

```math
\begin{array}{rllcll}
{} & \texttt{-not} & \texttt{-true} & \iff & \texttt{-false} \\
{} & \texttt{-not} & \texttt{-false} & \iff & \texttt{-true} \\
\texttt{-not} & \texttt{-not} & A & \iff & A & \text{(double negation)} \\
A & \texttt{-and} & \texttt{-true} & \iff & A & \text{(conjunction elimination)} \\
\texttt{-true} & \texttt{-and} & B & \iff & B & \text{(conjunction elimination)}\\
\texttt{-false} & \texttt{-and} & B & \iff & \texttt{-false} \\
A & \texttt{-or} & \texttt{-false} & \iff & A & \text{(disjunctive syllogism)} \\
\texttt{-false} & \texttt{-or} & B & \iff & B & \text{(disjunctive syllogism)} \\
\texttt{-true} & \texttt{-or} & B & \iff & \texttt{-true} \\
\texttt{-not} \, A & \texttt{-and} & \texttt{-not} \, B & \iff & \texttt{-not} \, (A \mathbin{\texttt{-or}} B) & \text{(De Morgan's laws)} \\
\texttt{-not} \, A & \texttt{-or} & \texttt{-not} \, B & \iff & \texttt{-not} \, (A \mathbin{\texttt{-and}} B) & \text{(De Morgan's laws)} \\
\end{array}
```

Most of these optimizations are just implemented directly with manual pattern matching, e.g.

```c
struct expr *optimize_not_expr(struct expr *expr) {
	if (optlevel >= 1)
		if (expr->rhs == &expr_true) {
			free_expr(expr);
			return &expr_false;
		} else if (expr->rhs == &expr_false) {
			free_expr(expr);
			return &expr_true;
		} else if (expr->rhs->eval == eval_not) {
			return extract_child_expr(expr, &expr->rhs->rhs);
		}
		...
```

Some tempting optimizations like `$(A \mathbin{\texttt{-and}} \texttt{-false}) \iff \texttt{-false}$` are not actually valid unless we know that `$A$` has no side effects. The next level is responsible for that kind of optimization.</p>


## `-O2`

### Dead code elimination

At `-O2`, `bfs` begins to distinguish between expressions that have side effects and those that don't.
Expressions like `-type f` with no side effects can be completely removed if their return value is never used.
These laws take into account the purity of the subexpressions:

```math
\begin{array}{rllcl}
\mathrm{pure} & \texttt{-and} & \texttt{-false} & \iff & \texttt{-false} \\
\mathrm{pure} & \texttt{-or} & \texttt{-true} & \iff & \texttt{-true} \\
\mathrm{pure} & \texttt{,} & B & \iff & B \\
(A \mathbin{\{\texttt{-and}, \texttt{-or}, \texttt{,}\}} \mathrm{pure}) & \texttt{,} & B & \iff & A \mathbin{\texttt{,}} B \\
\end{array}
```

The implementation keeps track of a `pure` flag for each (sub)expression, and tests this to know whether these optimizations are safe to apply:

```c

struct expr *optimize_and_expr(struct expr *expr) {
	if (optlevel >= 2) {
		if (expr->lhs->pure && expr->rhs == &expr_false) {
			return extract_child_expr(expr, &expr->rhs);
		}
		...
```

### Data-flow analysis

[Data-flow analysis] is a broad term for optimizations that take into account the possible values an expression may have in its context, and propagate those values to future contexts.
As an example, given this command line:

[Data-flow analysis]: https://en.wikipedia.org/wiki/Data-flow_analysis

<pre class="terminal">
<span class="white">$</span> <span class="green">bfs</span> <span class="blue">-type</span> <span class="white">f</span> <span class="red">-and</span> <span class="blue">-type</span> <span class="white">d</span>
</pre>

`bfs`'s data-flow analysis determines that `-type d` can never be true at the point it's evaluated (after all, a path can't be both a regular file and a directory).
This analysis proceeds by attaching a set of data flow *facts* to every node in the tree, at three different points in the evaluation: those facts known to be true before the expression is evaluated, and those known to be true after the expression returns either true or false.

Currently, `bfs` keeps track of three data flow facts: the minimum and maximum depth a path may be in the directory tree, and its possible file types.
Unreachable situations are represented by impossible facts, such as an empty set of possible types, or an empty range of possible depths.
Facts are inferred as the expression tree is walked recursively:

```c
/**
 * Data flow facts about an evaluation point.
 */
struct opt_facts {
	/** Minimum possible depth at this point. */
	int mindepth;
	/** Maximum possible depth at this point. */
	int maxdepth;

	/** Bitmask of possible file types at this point. */
	enum bftw_typeflag types;
};

/**
 * Optimizer state.
 */
struct opt_state {
	/** The command line we're optimizing. */
	const struct cmdline *cmdline;

	/** Data flow facts before this expression is evaluated. */
	struct opt_facts facts;
	/** Data flow facts after this expression returns true. */
	struct opt_facts facts_when_true;
	/** Data flow facts after this expression returns false. */
	struct opt_facts facts_when_false;
};

static void infer_type_facts(struct opt_state *state, const struct expr *expr) {
	state->facts_when_true.types &= expr->idata;
	state->facts_when_false.types &= ~expr->idata;
}

struct expr *optimize_and_expr_recursive(struct opt_state *state, struct expr *expr) {
	struct opt_state lhs_state = *state;
	expr->lhs = optimize_expr_recursive(&lhs_state, expr->lhs);

	struct opt_state rhs_state = *state;
	// Due to short-circuit evaluation, rhs is only evaluated if lhs returned true
	rhs_state.facts = lhs_state.facts_when_true;
	expr->rhs = optimize_expr_recursive(&rhs_state, expr->rhs);

	state->facts_when_true = rhs_state.facts_when_true;
	facts_union(&state->facts_when_false,
	            &lhs_state.facts_when_false, &rhs_state.facts_when_false);

	return optimize_and_expr(expr);
}

...

struct expr *optimize_expr_recursive(struct opt_state *state, struct expr *expr) {
	...
	if (expr->eval == eval_type) {
		infer_type_facts(state, expr);
	} else if (expr->eval == eval_and) {
		expr = optimize_and_expr_recursive(state, expr);
	}
	...

	if (expr->pure) {
		if (facts_impossible(&state->facts_when_true) {
			free_expr(expr);
			return &expr_false;
		} else if (facts_impossible(&state->facts_when_false) {
			free_expr(expr);
			return &expr_true;
		}
	}

	return expr;
}
```


## `-O3` (default)

Some tests are faster to execute than others.
`-type f` is nearly instantaneous, just checking a single integer.
`-name '*.c'` is a little slower, requiring the machinery of `fnmatch()`.
`-links 2` is even slower, needing a `stat()` system call, which may even require I/O, to count the number of hard links to the file.

At `-O3`, the default optimization level, `bfs` re-orders expressions to reduce their expected cost.
Most primitives are initialized with a cost and probability of returning true, which I [measured] on my own computer.
Some heuristics are applied as well, considering e.g. `-name '*.c'` to be [more likely] than `-name 'foo.c'`.

[measured]: https://github.com/tavianator/bfs/blob/1.1.3/parse.c#L2018
[more likely]: https://github.com/tavianator/bfs/blob/1.1.3/parse.c#L1330-L1334

The cost and probability for compound expressions are computed from their constituent parts:

```math
\begin{array}{rcl}
\mathrm{cost}(A \mathbin{\texttt{-and}} B) & = & \mathrm{cost}(A) + \Pr(A)\,\mathrm{cost}(B) \\
\mathrm{cost}(A \mathbin{\texttt{-or}} B) & = & \mathrm{cost}(A) + (1 -
\Pr(A))\,\mathrm{cost}(B) \\
\mathrm{cost}(A \mathbin{\texttt{,}} B) & = & \mathrm{cost}(A) + \mathrm{cost}(B) \\
\end{array}
```

It's impossible in general to compute the probabilities, without knowing how `$A$` and `$B$` are related.
`bfs` makes the naïve assumption that `$A$` and `$B$` are [independent]:

[independent]: https://en.wikipedia.org/wiki/Independence_(probability_theory)

```math
\begin{array}{rcl}
\Pr(A \mathbin{\texttt{-and}} B) & \approx & \Pr(A)\,\Pr(B) \\
\Pr(A \mathbin{\texttt{-or}} B) & \approx & 1 - (1 - \Pr(A))\,(1 - \Pr(B)) \\
\Pr(A \mathbin{\texttt{,}} B) & = & \Pr(B) \\
\end{array}
```

Then, for `-and` and `-or`, if `$A$` and `$B$` are both pure and swapping them would reduce the expected cost, they get swapped:

```c
struct expr *optimize_and_expr(struct expr *expr) {
	struct expr *lhs = expr->lhs;
	struct expr *rhs = expr->rhs;

	...

	expr->cost = lhs->cost + lhs->probability*rhs->cost;
	expr->probability = lhs->probability*rhs->probability;

	if (optlevel >= 3 && lhs->pure && rhs->pure) {
		double swapped_cost = rhs->cost + rhs->probability*lhs->cost;
		if (swapped_cost &lt; expr->cost) {
			expr->lhs = rhs;
			expr->rhs = lhs;
			expr->cost = swapped_cost;
		}
	}

	return expr;
}
```


## `-O4`/`-Ofast`

The final level of optimization, which is not enabled by default, contains aggressive optimizations that may affect correctness in corner cases.
Its main effect is to set -maxdepth to the highest depth inferred by data-flow analysis for any impure expression in the entire tree.
For example,

<pre class="terminal">
<span class="white">$</span> <span class="green">bfs</span> <span class="cyan">-O</span><span class="white">4</span> <span class="blue">-depth</span> <span class="white">5</span> <span class="red">-or</span> <span class="blue">-depth</span> <span class="white">6</span>
</pre>

will infer `-mindepth 5` and `-maxdepth 6`, skipping traversal of deeper paths entirely.
This optimization is unsafe in general because skipping these paths can change what errors `bfs` reports, and therefore its exit status.
Exemplified:

<pre class="terminal">
<span class="white">$</span> <span class="green">mkdir</span> -p foo/bar/baz &amp;&amp; <span class="green">chmod</span> -r foo/bar/baz
<span class="white">$</span> <span class="green">bfs</span> <span class="magenta">foo</span> <span class="blue">-depth</span> <span class="white">1</span>
<span class="blue">foo/bar</span>
<span class="red">'foo/bar/baz': Permission denied</span>
<span class="white">$</span> <span class="green">echo</span> $?
1
<span class="white">$</span> <span class="green">bfs</span> <span class="cyan">-O</span><span class="white">4</span> <span class="magenta">foo</span> <span class="blue">-depth</span> <span class="white">1</span>
<span class="blue">foo/bar</span>
<span class="white">$</span> <span class="green">echo</span> $?
0
</pre>

This optimization is actually so aggressive it will skip the entire traversal if no side effects are reachable, by setting `-maxdepth` to `-1`:

<pre class="terminal">
<span class="white">$</span> <span class="green">time bfs</span> <span class="cyan">-O</span><span class="white">4</span> <span class="magenta">/</span> <span class="blue">-false</span>
bfs -O4 / -false  0.00s user 0.00s system 88% cpu 0.002 total
</pre>


The other thing `-O4` does is treat certain expressions as pure that may have side effects in corner cases.
`-empty` will attempt to read directories, and `-xtype` will follow symbolic links, either of which may affect the result of `bfs` if they encounter a permissions error.
Therefore we don't consider these tests pure except at -O4.


## Try it out

`bfs` implements a debugging flag `-D opt` that logs details about the optimizations being performed.
Expressions are dumped in a Lisp-style [S-expression] syntax:

[S-expression]: https://en.wikipedia.org/wiki/S-expression

<pre class="terminal">
<span class="white">$</span> <span class="green">bfs</span> -D opt -not -false
-O1: constant propagation: (<span class="red">-not</span> (<span class="blue">-false</span>)) &lt;==&gt; (<span class="blue">-true</span>)
-O1: conjunction elimination: (<span class="red">-a</span> (<span class="blue">-true</span>) (<span class="blue">-true</span>)) &lt;==&gt; (<span class="blue">-true</span>)
-O1: conjunction elimination: (<span class="red">-a</span> (<span class="blue">-true</span>) (<span class="blue">-print</span>)) &lt;==&gt; (<span class="blue">-print</span>)
...
<span class="white">$</span> <span class="green">bfs</span> -D opt -type f -or -not -type f
-O1: conjunction elimination: (<span class="red">-a</span> (<span class="blue">-true</span>) (<span class="blue">-type</span> <span class="white">f</span>)) &lt;==&gt; (<span class="blue">-type</span> <span class="white">f</span>)
-O2: data flow: (<span class="blue">-type</span> <span class="white">f</span>) --&gt; (<span class="blue">-false</span>)
-O1: constant propagation: (<span class="red">-not</span> (<span class="blue">-false</span>)) &lt;==&gt; (<span class="blue">-true</span>)
-O2: purity: (<span class="red">-or</span> (<span class="blue">-type</span> <span class="white">f</span>) (<span class="blue">-true</span>)) &lt;==&gt; (<span class="blue">-true</span>)
-O1: conjunction elimination: (<span class="red">-a</span> (<span class="blue">-true</span>) (<span class="blue">-print</span>)) &lt;==&gt; (<span class="blue">-print</span>)
...
<span class="white">$</span> <span class="green">bfs</span> -D opt -name '*.c' -type f
-O1: conjunction elimination: (<span class="red">-a</span> (<span class="blue">-true</span>) (<span class="blue">-name</span> <span class="white">*.c</span>)) &lt;==&gt; (<span class="blue">-name</span> <span class="white">*.c</span>)
-O3: cost: (<span class="red">-a</span> (<span class="blue">-name</span> <span class="white">*.c</span>) (<span class="blue">-type</span> <span class="white">f</span>)) &lt;==&gt; (<span class="red">-a</span> (<span class="blue">-type</span> <span class="white">f</span>) (<span class="blue">-name</span> <span class="white">*.c</span>)) (~<span class="yellow">420</span> --&gt; ~<span class="yellow">383.909</span>)
...
<span class="white">$</span> <span class="green">bfs</span> -D opt -O4 -type f -type d
-O1: conjunction elimination: (<span class="red">-a</span> (<span class="blue">-true</span>) (<span class="blue">-true</span>)) &lt;==&gt; (<span class="blue">-true</span>)
-O1: conjunction elimination: (<span class="red">-a</span> (<span class="blue">-true</span>) (<span class="blue">-type</span> <span class="white">f</span>)) &lt;==&gt; (<span class="blue">-type</span> <span class="white">f</span>)
-O2: data flow: (<span class="blue">-type</span> <span class="white">d</span>) --&gt; (<span class="blue">-false</span>)
-O2: purity: (<span class="red">-a</span> (<span class="blue">-type</span> <span class="white">f</span>) (<span class="blue">-false</span>)) &lt;==&gt; (<span class="blue">-false</span>)
-O1: short-circuit: (<span class="red">-a</span> (<span class="blue">-false</span>) (<span class="blue">-print</span>)) &lt;==&gt; (<span class="blue">-false</span>)
-O2: data flow: mindepth --&gt; 2147483647
-O4: data flow: maxdepth --&gt; -1
</pre>
