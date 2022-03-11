# `bfs` from the ground  up, part 2: parsing

<div class="infobar">

<fa:clock-o> 2017-04-24
<fa:user> Tavian Barnes
[<fa:github> GitHub](https://github.com/tavianator/bfs)

</div>


Today is the release of version 1.0 of [`bfs`], a fully-compatible[\*] drop-in replacement for the UNIX `find` command.
I thought this would be a good occasion to write more about its implementation. This post will talk about how I parse the command line.

[`bfs`]: ../projects/bfs.md
[\*]: https://github.com/tavianator/bfs/labels/compatibility

The `find` command has the most complex command line syntax of any command line tool I'm aware of.
Unlike most utilities which take a sequence of options, values, and paths, `find`'s command line is a rich short-circuiting Boolean expression language.
A command like

```
find \( -type f -o -type d \) -a -print
```

means something like this, in pseudocode:

```
for each file {
    (type == f || type == d) && print()
}
```

Due to the [short-circuiting] behaviour of `-a`/`&&`, this only prints files and directories, skipping symbolic links, device nodes, etc.

[short-circuiting]: https://en.wikipedia.org/wiki/Short-circuit_evaluation

To shorten some common commands[^analogy], find lets you omit `-a`, treating `LHS RHS` the same as `LHS -a RHS`.
Sadly this confuses a lot of users, who write things like

```
find -print -type f
```

without understanding how `find` will interpret it as an expression.
Plenty of invalid [bug] [reports] have been made about this over the years.
In fact, the `find` command line syntax was deeply confusing to me before I wrote `bfs`; I hope not everyone has to implement `find` from scratch just to understand it.

[bug]: https://savannah.gnu.org/bugs/?50780
[reports]: https://savannah.gnu.org/bugs/?50835

We've seen two kinds of parameters so far: *tests*, like `-type f`, that check something about the current file and return a truth value; and *actions*, like `-print`, that perform some side effect (and usually return `true`, unless the action fails).
There is a third kind of parameter: *options*, that affect the overall behaviour of `find`, but don't do any per-file work.
An example is `-follow`, which instructs `find` to follow symbolic links.
A command line like

```
find -follow -type f -print
```

acts something like this:

```
follow_symlinks = true;
for each file {
    true && type == f && print()
}
```

Nesting an option in the middle of an expression can be confusing, so GNU `find` warns unless you put them at the beginning.

If you don't include any actions in your expression, `find` automatically adds `-print` for you, so

```
find -type f -o -type d
```

is the same as

```
find \( -type f -o -type d \) -print
```

(which is the same as `... -a -print`, of course).

The `find` command line can also include root paths to start from.
If you don't specify any paths, GNU `find` looks in `.` for you.
There are also some flags that can come before the paths, and are not part of the expression.
Overall, the command line is structured like this:

```
find [flags...] [paths...] [expression...]
```

If you get the order wrong, you get a frustrating error:

```
$ find -type f .
find: paths must precede expression: .
```

`bfs` does away with this particular restriction, because I hate it when a computer knows what I want to do but refuses to do it.


## Grammar

In order to parse a `find`-style command line, we'll need to come up with a [grammar] for it.
`find` supports expressions like

[grammar]: https://en.wikipedia.org/wiki/Context-free_grammar

- `( EXPR )`
- `! EXPR`, `-not EXPR`
- `EXPR -a EXPR`, `EXPR -and EXPR`, `EXPR EXPR`
- `EXPR -o EXPR`, `EXPR -or EXPR`,
- `EXPR , EXPR`

in decreasing order of precedence.
People often write grammars like this:

```
EXPR : ( EXPR )
     | ! EXPR | -not EXPR
     | EXPR -a EXPR | EXPR -and EXPR | EXPR EXPR
     | EXPR -o EXPR | EXPR -or EXPR
     | EXPR , EXPR
```

and use some [feature] of their parser generator to specify the different precedences of the various production rules.
But you can always encode the precedences right in the grammar itself:

[feature]: https://www.gnu.org/software/bison/manual/html_node/Precedence.html#Precedence

```
LITERAL : -follow | -type TYPE | -print | ...

FACTOR : LITERAL
       | ( EXPR )
       | ! FACTOR | -not FACTOR

TERM : FACTOR
     | TERM -a FACTOR
     | TERM -and FACTOR
     | TERM FACTOR

CLAUSE : TERM
       | CLAUSE -o TERM
       | CLAUSE -or TERM

EXPR : CLAUSE
     | EXPR , CLAUSE
```

`bfs` uses a [recursive descent parser] to parse the command line, where each nonterminal symbol gets a function that parses it, e.g. `parse_clause()`.
These functions recursively call other parsing functions like `parse_term()`, resulting in code that is structured very much like the grammar itself.

[recursive descent parser]: https://en.wikipedia.org/wiki/Recursive_descent_parser

The major limitation of recursive descent parsers is they can't handle left-recursive rules like

```
CLAUSE : CLAUSE -o TERM
```

because the immediate `parse_clause()` call recurses infinitely.
Rules like this can always be re-written right-recursively like

```
CLAUSE : TERM -o CLAUSE
```

but naïvely that will change a left-associative rule into a right-associative one (terms like `a -o b -o c` will group like `a -o (b -o c)` instead of `(a -o b) -o c`.
Care must be taken[^assoc] to parse right-recursively, but build the expression tree left-associatively.


## Parser

Here's an example implementation of a technique that handles left-recursive rules:

```c
static struct expr *parse_clause(struct parser_state *state, struct expr *lhs) {
	// Parse with the right-recursive rules
	// CLAUSE : TERM
	//        | TERM -o CLAUSE
	struct expr *expr = parse_term(state);

	// But build the expression tree left-associatively
	if (lhs) {
		expr = new_or_expr(lhs, expr);
	)

	const char *arg = state->argv[0];
	if (strcmp(arg, "-o") != 0 && strcmp(arg, "-or") != 0) {
		return expr;
	}

	parser_advance(state, T_OPERATOR, 1);
	return parse_clause(state, expr);
}
```

The trick is to thread the left-hand side of the expression through the recursive calls.
Actually, the tail-recursion can be replaced with a loop.
The actual implementation of [`parse_clause()`] looks more like this (omitting error checking):

[`parse_clause()`]: https://github.com/tavianator/bfs/blob/1.0/parse.c#L2548

```c
static struct expr *parse_clause(struct parser_state *state) {
	struct expr *clause = parse_term(state);

	while (true) {
		skip_paths(state);

		const char *arg = state->argv[0];
		if (strcmp(arg, "-o") != 0 && strcmp(arg, "-or") != 0) {
			break;
		}
		parser_advance(state, T_OPERATOR, 1);

		struct expr *lhs = clause;
		struct expr *rhs = parse_term(state);
		clause = new_or_expr(state, lhs, rhs, argv);
	}

	return clause;
}
```

[`parse_term()`] is a little trickier: we need a bit of [lookahead] to decide whether to apply the `TERM : TERM FACTOR` rule:

[`parse_term()`]: https://github.com/tavianator/bfs/blob/1.0/parse.c#L2457
[lookahead]: https://github.com/tavianator/bfs/blob/1.0/parse.c#L2477

```c
if (strcmp(arg, "-o") == 0 || strcmp(arg, "-or") == 0
    || strcmp(arg, ",") == 0
    || strcmp(arg, ")") == 0) {
	break;
}
```

These are all the tokens that may directly follow a `TERM`, and cannot be the first token of a `FACTOR`.
Not all grammars can be parsed with a single such token of lookahead—the ones that can are known as [LL(1)].

[LL(1)]: https://en.wikipedia.org/wiki/LL_parser

Notice the `skip_paths()` call.
That's how `bfs` flexibly handles paths anywhere in the command line, before, after, or even inside the expression.
Non-paths are either `(`, `)`, `,`, `!`, or start with `-`, so we can always tell them apart.
There are a couple corner cases though:

```c
static void skip_paths(struct parser_state *state) {
	while (true) {
		const char *arg = state->argv[0];
		if (!arg) {
			break;
		}

		if (arg[0] == '-') {
			if (strcmp(arg, "--") == 0) {
				// find uses -- to separate flags from the rest
				// of the command line.  We allow mixing flags
				// and paths/predicates, so we just ignore --.
				parser_advance(state, T_FLAG, 1);
				continue;
			}
			if (strcmp(arg, "-") != 0) {
				// - by itself is a file name.  Anything else
				// starting with - is a flag/predicate.
				break;
			}
		}

		// By POSIX, these are always options
		if (strcmp(arg, "(") == 0 || strcmp(arg, "!") == 0) {
			break;
		}

		if (state->expr_started) {
			// By POSIX, these can be paths.  We only treat them as
			// such at the beginning of the command line.
			if (strcmp(arg, ")") == 0 || strcmp(arg, ",") == 0) {
				break;
			}
		}

		parse_root(state, arg);
		parser_advance(state, T_PATH, 1);
	}
}
```

`find` supports unusual command lines like

```
find \) , -print
```

where `\)` and `,` are treated as paths because they come before the expression starts.
To maintain 100% compatibility, `bfs` supports these weird filenames too, but only before it sees any non-path, non-flag tokens.
`parser_advance()` updates `state->expr_started` based on the types of tokens it sees.


## Literals

There are many different literals (options, tests, and actions) supported by `bfs`.
[`parse_literal()`] is driven by a table that looks like this:

[`parse_literal()`]: https://github.com/tavianator/bfs/blob/1.0/parse.c#L2268

```c
typedef struct expr *parse_fn(struct parser_state *state, int arg1, int arg2);

struct table_entry {
	const char *arg;
	bool prefix;
	parse_fn *parse;
	int arg1;
	int arg2;
};

static const struct table_entry parse_table[] = {
	...
	{"follow", false, parse_follow, BFTW_LOGICAL | BFTW_DETECT_CYCLES, true},
	...
	{"print", false, parse_print},
	...
	{"type", false, parse_type, false},
	...
};
```

The table contains entries with a function pointer to the parsing function for each literal, and up to two integer arguments that get passed along to it.
The extra arguments let one function handle multiple similar literals; for example `parse_type()` handles `-type` and `-xtype`.
The `prefix` flag controls whether extra characters after the literal should be accepted; this is used by a couple of literals like `-O` and `-newerXY`.

There are two stages to lookup: the first is an exact match, which could be done by binary search, but is currently just a linear scan.
If that fails, a fuzzy match pass is run to provide a hint to the user.
The fuzzy matching is based on [Levenshtein distance] (or "min-edit" distance).
It [takes the standard QWERTY keyboard layout into account], so for example `-dikkiq` is considered very close to `-follow`:

[Levenshtein distance]: https://en.wikipedia.org/wiki/Levenshtein_distance
[takes the standard QWERTY keyboard layout into account]: https://github.com/tavianator/bfs/blob/1.0/typo.c#L17

```c
$ bfs -diqqik
error: Unknown argument '-dikkiq'; did you mean '-follow'?
```


## Debugging

To help see how the command line was parsed, GNU `find` and `bfs` both support a `-D tree` flag that dumps the parsed expression tree.
`bfs` outputs Lisp-style S-expressions:

```
$ bfs -D tree -follow -type f -print
-L -D tree . -color (-a (-type f) (-print))
```


---

[^analogy]: This also plays into a nice analogy between Boolean algebra and "regular" algebra, where "or" is like addition and "and" is like multiplication. Just like we can write `$xy$` instead of `$x \times y$`, we can omit the explicit `-a`.

[^assoc]: Actually, as all of `find`'s binary operators are associative, this doesn't really matter. But it's still a useful technique to know.