# Irregular expressions

<div class="infobar">

*fa-regular fa-clock* *time-2023-03-07*
*fa-solid fa-user* Tavian Barnes
[*fa-brands fa-github* GitHub](https://github.com/tavianator/irregex)
[*fa-brands fa-hacker-news* Hacker News](https://news.ycombinator.com/item?id=35503089)

</div>

[Regular expressions][regex] are fascinating to me.
On one hand, they can be extremely succinct, expressive, and efficient.
On the other hand, they can be basically [write-only].
They come with a simple but powerful [theory][NFA] that leads to efficient implementations.
Sadly, many implementations ignore the theory in order to offer [additional features], at the cost of [worst-case exponential complexity][exp].

[regex]: https://en.wikipedia.org/wiki/Regular_expression
[write-only]: https://www.ex-parrot.com/~pdw/Mail-RFC822-Address.html
[NFA]: https://en.wikipedia.org/wiki/Nondeterministic_finite_automaton
[additional features]: https://en.wikipedia.org/wiki/Regular_expression#Patterns_for_non-regular_languages
[exp]: https://swtch.com/~rsc/regexp/regexp1.html

~~It is possible, however, to implement some of those additional features, and still operate in worst-case linear time.~~
<ins>It was pointed out to me by [Geoff Langdale](https://twitter.com/geofflangdale/status/1633304188234104834) and [Evgeny Kapun](https://github.com/tavianator/irregex/issues/1) that my implementation of those additional features is incorrect.  I've hidden the wrong implementations for now.</ins>
The implementation (~400 lines of Rust) even fits in a single blog post!
The full code is on [GitHub](https://github.com/tavianator/irregex/blob/main/src/lib.rs), and the [commit history](https://github.com/tavianator/irregex/commits/main) lines up with the blog post if you want to follow along.


## State machines

The key to worst-case linear running time is to use [Nondeterministic Finite Automata (NFAs)][NFA].
An NFA is basically a flow chart for deciding whether to accept or reject a string.
The N in NFA means that multiple states can be active at the same time.

<figure class="h-fig">
  <svg width="320" viewBox="-60 -100 320 130">
    <text x="100" y="-80" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">
      <tspan class="a a-3">a</tspan><!--
      --><tspan class="a a-5">b</tspan><!--
      --><tspan class="a a-7">a</tspan><!--
      --><tspan class="a a-9">c</tspan><!--
      --><tspan class="a a-11">u</tspan><!--
      --><tspan class="a a-13">s</tspan>
    </text>
    <line class="a a-1" x1="-50" y1="0" x2="-20" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="-20,0 -30,-4, -30,4" fill="var(--fg)" />
    <circle class="a a-2 a-3 a-4 a-5 a-6 a-7 a-8 a-9 a-10 a-11 a-12 a-13" cx="0" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <path class="a a-3 a-5 a-7 a-9 a-11 a-13" d="M 14.1421 -14.1421 A 25 25 0 1 0 -14.1421 -14.1421" stroke="var(--fg)" stroke-dasharray="127.0213623046875" fill="none" />
    <polygon class="a a-3 a-5 a-7 a-9 a-11 a-13" points="0,0 -10,-5, -10,5" transform="translate(-14.1421 -14.1421) rotate(45)" fill="var(--fg)" />
    <text class="a a-3 a-5 a-7 a-9 a-11 a-13" x="0" y="-70" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">.</text>
    <line class="a a-3 a-7" x1="20" y1="0" x2="80" y2="0" stroke="var(--fg)" stroke-dasharray="60" />
    <polygon class="a a-3 a-7" points="80,0 70,-4, 70,4" fill="var(--fg)" />
    <text class="a a-3 a-7" x="50" y="-15" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">a</text>
    <circle class="a a-4 a-8" cx="100" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-9" x1="120" y1="0" x2="180" y2="0" stroke="var(--fg)" stroke-dasharray="60" />
    <polygon class="a a-9" points="180,0 170,-4, 170,4" fill="var(--fg)" />
    <text class="a a-9" x="150" y="-15" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">c</text>
    <circle class="a a-10 a-11 a-12 a-13" cx="200" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-10 a-11 a-12 a-13" cx="200" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
    <g transform="translate(200 0)">
      <path class="a a-11 a-13" d="M 14.1421 -14.1421 A 25 25 0 1 0 -14.1421 -14.1421" stroke="var(--fg)" stroke-dasharray="127.0213623046875" fill="none" />
      <polygon class="a a-11 a-13" points="0,0 -10,-5, -10,5" transform="translate(-14.1421 -14.1421) rotate(45)" fill="var(--fg)" />
      <text class="a a-11 a-13" x="0" y="-70" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">.</text>
    </g>
  </svg>
</figure>
<script type="postproc">
function animate(e, attr, frames, values, cumulative = false) {
    const array = [];
    let value = 0;
    for (const f of frames) {
        value = cumulative ? value + values[f] : values[f];
        array.push(value);
    }
    const ani = document.createElement("animate");
    ani.setAttribute("attributeName", attr);
    ani.setAttribute("values", array.join(";"));
    ani.setAttribute("dur", "15s");
    ani.setAttribute("repeatCount", "indefinite");
    e.append(ani);
}
for (const e of document.querySelectorAll("svg .a")) {
    const frames = new Array(15).fill(0);
    for (const c of e.classList) {
        if (c.startsWith("a-")) {
            frames[parseInt(c.substring(2))] = 1;
        }
    }
    e.className = "";
    if (e.tagName == "line" || e.tagName == "path") {
        const len = parseInt(e.getAttribute("stroke-dasharray"));
        animate(e, "stroke-dashoffset", frames, [0, -2 * len], true);
        animate(e, "stroke", frames, ["var(--fg)", "var(--sidebar-active)"]);
        animate(e, "stroke-width", frames, [1, 2]);
    } else if (e.tagName == "polygon") {
        animate(e, "fill", frames, ["var(--fg)", "var(--sidebar-active)"]);
    } else if (e.tagName == "circle") {
        animate(e, "stroke", frames, ["var(--fg)", "var(--sidebar-active)"]);
        animate(e, "stroke-width", frames, [2, 3]);
    } else if (e.tagName == "text" || e.tagName == "tspan") {
        animate(e, "fill", frames, ["var(--fg)", "var(--sidebar-active)"]);
    }
}
</script>

Before actually implementing NFAs, it's nice to start with an interface for them:

```rust,no_run,noplayground
/// A regular expression matcher.
trait Matcher {
    /// Activate this matcher's *start* state.
    fn start(&mut self) -> bool;

    /// Process a character from the string we're matching against.
    fn push(&mut self, c: char) -> bool;
}
```

A `Matcher` starts out with no active states.
`Matcher::start()` activates the start state, and returns whether the matcher is currently in an accepting state (which could happen if, for example, the regex matches an empty string).
To test if a string matches, you feed its characters one-by-one to `Matcher::push()`, or just call this helper method to do it for you:

```rust,no_run,noplayground
trait Matcher {
    ...
    /// Test if a string matches.
    fn matches(&mut self, text: &str) -> bool {
        text.chars().fold(self.start(), |_, c| self.push(c))
    }
}
```


<style>
.h-commit {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    margin: 36px 0 20px 0;
}
.h-commit > * {
    margin: 0 !important;
}
.h-commit h2 {
    flex: 1;
    white-space: nowrap;
}
.h-commit a {
    text-decoration: none !important;
}
</style>
<div class="h-commit">

## Much ado about nothing

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/346711c2777f957805f7b8788c637976b005f831)

</div>

The simplest regex is the empty regex, so let's start with that.

```rust,no_run,noplayground
/// A regular expression.
enum Regex {
    /// The empty regex.
    Empty,
}
```

The empty matcher has only one state.

<style>
.code-fig {
    display: flex;
    flex-flow: row-reverse wrap;
    align-items: stretch;
}
.code-fig > * {
    flex: 1;
    margin: 0;
    max-width: 100%;
}
.code-fig > figure {
    background: var(--quote-bg);
    overflow: initial;
    display: flex;
    align-items: center;
    justify-content: center;
}
.code-fig > figure p {
    margin: 0;
}
</style>
<div class="code-fig">

<figure>
  <svg width="120" viewBox="-60 -40 120 80">
    <line class="a a-1" x1="-50" y1="0" x2="-20" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="-20,0 -30,-4, -30,4" fill="var(--fg)" />
    <circle class="a a-2" cx="0" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-2" cx="0" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
  </svg>
</figure>

```rust,no_run,noplayground
/// Matcher for Regex::Empty.
#[derive(Default)]
struct Empty {
    matched: bool,
}

impl Matcher for Empty {
    fn start(&mut self) -> bool {
        self.matched = true;
        true
    }

    fn push(&mut self, _: char) -> bool {
        self.matched = false;
        false
    }
}
```

</div>

It would be convenient if we could parse regexes instead of having to write things like `Regex::Empty` explicitly.
We can use [nom](https://crates.io/crates/nom) to build a parser, starting with a simple grammar.

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Eᴍᴘᴛʏ} & \rarr \varepsilon \\[2pt]
\text{Gʀᴏᴜᴘ} & \rarr \texttt{(} \; \text{Rᴇɢᴇx} \; \texttt{)} \\[2pt]
\text{Rᴇɢᴇx} & \rarr \text{Gʀᴏᴜᴘ} \mid \text{Eᴍᴘᴛʏ} \\
\end{aligned}
```
</figure>

```rust,no_run,noplayground
/// Parser implementation.
fn regex(pattern: &str) -> IResult<&str, Regex> {
    let empty = success(Regex::Empty);

    let group = delimited(char('('), regex, char(')'));

    alt((group, empty))
        .parse(input)
}
```

</div>


<div class="h-commit">

## Dot dot dot

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/91a5c86122d7abd6584d3ff012a0a58481e2d97f)

</div>

The next-simplest regex is the `.` metacharacter, which matches any character.

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches any one character.
    Dot,
}
```

The matcher for `.` has two states.

<div class="code-fig">

<figure>
  <svg width="220" viewBox="-60 -40 220 80">
    <line class="a a-1" x1="-50" y1="0" x2="-20" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="-20,0 -30,-4, -30,4" fill="var(--fg)" />
    <circle class="a a-2" cx="0" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-3" x1="20" y1="0" x2="80" y2="0" stroke="var(--fg)" stroke-dasharray="60" />
    <polygon class="a a-3" points="80,0 70,-4, 70,4" fill="var(--fg)" />
    <text class="a a-3" x="50" y="-15" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">.</text>
    <circle class="a a-4" cx="100" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-4" cx="100" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
  </svg>
</figure>

```rust,no_run,noplayground
/// Matcher for Regex::Dot.
#[derive(Default)]
struct Dot {
    started: bool,
    matched: bool,
}

impl Matcher for Dot {
    fn start(&mut self) -> bool {
        self.started = true;
        self.matched
    }

    fn push(&mut self, _: char) -> bool {
        self.matched = self.started;
        self.started = false;
        self.matched
    }
}
```

</div>

It's a small addition to the parser as well.

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Dᴏᴛ} & \rarr \texttt{.} \\[2pt]
\text{Rᴇɢᴇx} & \rarr \text{Dᴏᴛ}
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let dot = char('.').map(|_| Regex::Dot);

    alt((dot, group, empty))
        .parse(input)
}
```

</div>


<div class="h-commit">

## Literally me

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/48604737308076ff7bace3d852b53a480580d891)

</div>

The next regex to support is character literals like `c` that match only themselves.

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches a literal character.
    Literal(char),
}
```

The matcher for literals is very similar to `Dot`.

<div class="code-fig">

<figure>
  <svg width="220" viewBox="-60 -40 220 80">
    <line class="a a-1" x1="-50" y1="0" x2="-20" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="-20,0 -30,-4, -30,4" fill="var(--fg)" />
    <circle class="a a-2" cx="0" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-3" x1="20" y1="0" x2="80" y2="0" stroke="var(--fg)" stroke-dasharray="60" />
    <polygon class="a a-3" points="80,0 70,-4, 70,4" fill="var(--fg)" />
    <text class="a a-3" x="50" y="-15" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">c</text>
    <circle class="a a-4" cx="100" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-4" cx="100" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
  </svg>
</figure>

```rust,no_run,noplayground
/// Matcher for Regex::Literal.
struct Literal {
    c: char,
    started: bool,
    matched: bool,
}

impl Matcher for Literal {
    fn start(&mut self) -> bool {
        self.started = true;
        self.matched
    }

    fn push(&mut self, c: char) -> bool {
        self.matched = self.started && c == self.c;
        self.started = false;
        self.matched
    }
}
```

</div>

The parser is extended with support for literals, as well as escape sequences like `\.` to allow matching metacharacters literally.

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Mᴇᴛᴀ} & \rarr \texttt{\textbackslash} \mid \texttt{(} \mid \texttt{)} \mid \texttt{.} \\[2pt]
\text{Lɪᴛᴇʀᴀʟ} & \rarr \text{any non-Mᴇᴛᴀ} \\
& \hphantom{{}\rarr{}} \text{character} \\[2pt]
\text{Esᴄᴀᴘᴇ} & \rarr \texttt{\textbackslash} \; \text{Mᴇᴛᴀ} \\[2pt]
\text{Rᴇɢᴇx} & \rarr \text{Lɪᴛᴇʀᴀʟ} \mid \text{Esᴄᴀᴘᴇ} \\
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let meta = r"\().";

    let literal = none_of(meta).map(Regex::Literal);

    let escape = preceded(char('\\'), one_of(meta))
        .map(Regex::Literal);

    alt((literal, escape, dot, group, empty))
        .parse(input)
}
```

</div>


<div class="h-commit">

## A star is born

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/36a2c9fb40b098f67a15d0775e95ed36b1d1c3fc)

</div>

So far our regexes can only match up to a single character.
The next step is to support the [Kleene star](https://en.wikipedia.org/wiki/Kleene_star) operator `*`, for regexes like `a*` that match `""`, `"a"`, `"aa"`, `"aaa"`, etc.

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches zero or more repetitions.
    Star(Box<Regex>),
}
```

The NFA for the `*` operator adds a loop with `$\varepsilon$`-transitions to let the pattern match multiple times.
It doesn't even need any states of its own.

<div class="code-fig">

<figure>
  <svg width="220" viewBox="-60 -105 220 210">
    <ellipse cx="50" cy="0" rx="90" ry="50" stroke="var(--fg)" stroke-width="2" fill="var(--theme-hover)" />
    <text class="a a-7 a-8" x="50" y="-25" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">A</text>
    <line class="a a-1" x1="-50" y1="0" x2="-20" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="-20,0 -30,-4, -30,4" fill="var(--fg)" />
    <circle class="a a-2 a-3 a-4 a-5 a-6 a-11 a-12 a-13" cx="0" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-7 a-8" x1="20" y1="0" x2="80" y2="0" stroke="var(--fg)" stroke-dasharray="5" />
    <polygon class="a a-7 a-8" points="80,0 70,-4, 70,4" fill="var(--fg)" />
    <circle class="a a-4 a-5 a-6 a-9 a-10 a-11 a-12 a-13" cx="100" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-4 a-5 a-6 a-9 a-10 a-11 a-12 a-13" cx="100" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
    <path class="a a-3 a-12" d="M 0 20 A 60 120 0 0 0 98 22" stroke="var(--fg)" stroke-dasharray="149.77947998046875" fill="none" />
    <polygon class="a a-3 a-12" points="0,0 -10,-5, -10,5" transform="translate(99 20) rotate(-70)" fill="var(--fg)" />
    <text class="a a-3 a-12" x="50" y="95" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
    <path class="a a-5 a-10" d="M 100 -20 A 60 120 0 0 0 2 -22" stroke="var(--fg)" stroke-dasharray="149.77947998046875" fill="none" />
    <polygon class="a a-5 a-10" points="0,0 -10,-5, -10,5" transform="translate(1 -20) rotate(110)" fill="var(--fg)" />
    <text class="a a-5 a-10" x="50" y="-85" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
  </svg>
</figure>

```rust,no_run,noplayground
/// Matcher for Regex::Star.
struct Star<A>(A);

impl<A: Matcher> Matcher for Star<A> {
    fn start(&mut self) -> bool {
        self.0.start() || true
    }

    fn push(&mut self, c: char) -> bool {
        self.0.push(c) && self.start()
    }
}
```

</div>

To parse the `*` operator properly we have to shuffle some grammar rules around.

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Mᴇᴛᴀ} & \rarr \texttt{*} \\[2pt]
\text{Aᴛᴏᴍ} & \rarr \text{Lɪᴛᴇʀᴀʟ} \mid \text{Esᴄᴀᴘᴇ} \\
& \rarr \text{Dᴏᴛ} \\
& \rarr \text{Gʀᴏᴜᴘ} \\[2pt]
\text{Rᴇᴘᴇᴀᴛ} & \rarr \text{Aᴛᴏᴍ} \\
& \rarr \text{Rᴇᴘᴇᴀᴛ} \; \texttt{*} \\[2pt]
\text{Rᴇɢᴇx} & \rarr \text{Rᴇᴘᴇᴀᴛ} \mid \text{Eᴍᴘᴛʏ} \\
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let meta = r"\().*";
    ...
    let atom = alt((literal, escape, dot, group));

    let repeat = flat_map(atom, |r| fold_many0(
        char('*'),
        move || r.clone(),
        |r, _| r.star(),
    ));

    alt((repeat, empty))
        .parse(input)
}
```

</div>


<div class="h-commit">

## One is the loneliest number

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/590470a431e4d04455e83ce257f97716031e3137)

</div>

It's a bit sad that our regexes can currently only have one (non-meta) character.
We can handle `a`, `a*`, and even the questionably-useful `a**`, but in order to support regexes like `ab*c`, we need our first binary operator: concatenation.

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches two patterns in a row.
    Concat(Box<Regex>, Box<Regex>),
}
```

The matcher for concatenated patterns connects the accept state of the first to the start state of the second.

<style>
.code-fig > .h-fig {
    display: none;
}
@media (max-width: 666px) {
    .code-fig > .h-fig {
        display: flex;
    }
    .code-fig > .v-fig {
        display: none;
    }
}
</style>
<div class="code-fig">

<figure class="h-fig">
  <svg width="420" viewBox="40 -70 420 140">
    <ellipse cx="150" cy="0" rx="90" ry="50" stroke="var(--fg)" stroke-width="2" fill="var(--theme-hover)" />
    <line class="a a-1" x1="50" y1="0" x2="80" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="80,0 70,-4, 70,4" fill="var(--fg)" />
    <text class="a a-3 a-4" x="150" y="-25" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">L</text>
    <circle class="a a-2" cx="100" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-3 a-4" x1="120" y1="0" x2="180" y2="0" stroke="var(--fg)" stroke-dasharray="5" />
    <polygon class="a a-3 a-4" points="180,0 170,-4, 170,4" fill="var(--fg)" />
    <circle class="a a-5" cx="200" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-5" cx="200" cy="0" r="16" stroke="var(--fg)" stroke-width="2" stroke-dasharray="2" fill="none" />
    <ellipse cx="350" cy="0" rx="90" ry="50" stroke="var(--fg)" stroke-width="2" fill="var(--theme-hover)" />
    <line class="a a-6" x1="220" y1="0" x2="280" y2="0" stroke="var(--fg)" stroke-dasharray="60" />
    <polygon class="a a-6" points="280,0 270,-4, 270,4" fill="var(--fg)" />
    <text class="a a-6" x="250" y="-15" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
    <circle class="a a-7" cx="300" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <text class="a a-8 a-9" x="350" y="-25" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">R</text>
    <line class="a a-8 a-9" x1="320" y1="0" x2="380" y2="0" stroke="var(--fg)" stroke-dasharray="5" />
    <polygon class="a a-8 a-9" points="380,0 370,-4, 370,4" fill="var(--fg)" />
    <circle class="a a-10 a-11" cx="400" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-10 a-11" cx="400" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
  </svg>
</figure>

<figure class="v-fig">
  <svg width="140" viewBox="-70 40 140 420">
    <g transform="rotate(90)">
    <ellipse cx="150" cy="0" rx="90" ry="50" stroke="var(--fg)" stroke-width="2" fill="var(--theme-hover)" />
    <line class="a a-1" x1="50" y1="0" x2="80" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="80,0 70,-4, 70,4" fill="var(--fg)" />
    <text class="a a-3 a-4" x="150" y="-25" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">L</text>
    <circle class="a a-2" cx="100" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-3 a-4" x1="120" y1="0" x2="180" y2="0" stroke="var(--fg)" stroke-dasharray="5" />
    <polygon class="a a-3 a-4" points="180,0 170,-4, 170,4" fill="var(--fg)" />
    <circle class="a a-5" cx="200" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-5" cx="200" cy="0" r="16" stroke="var(--fg)" stroke-width="2" stroke-dasharray="2" fill="none" />
    <ellipse cx="350" cy="0" rx="90" ry="50" stroke="var(--fg)" stroke-width="2" fill="var(--theme-hover)" />
    <line class="a a-6" x1="220" y1="0" x2="280" y2="0" stroke="var(--fg)" stroke-dasharray="60" />
    <polygon class="a a-6" points="280,0 270,-4, 270,4" fill="var(--fg)" />
    <text class="a a-6" x="250" y="-15" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
    <circle class="a a-7" cx="300" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <text class="a a-8 a-9" x="350" y="-25" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">R</text>
    <line class="a a-8 a-9" x1="320" y1="0" x2="380" y2="0" stroke="var(--fg)" stroke-dasharray="5" />
    <polygon class="a a-8 a-9" points="380,0 370,-4, 370,4" fill="var(--fg)" />
    <circle class="a a-10 a-11" cx="400" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-10 a-11" cx="400" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
    </g>
  </svg>
</figure>

```rust,no_run,noplayground
/// Matcher for Regex::Concat.
struct Concat<L, R> {
    left: L,
    right: R,
    right_started: bool,
}

impl<L: Matcher, R: Matcher> Matcher for Concat<L, R> {
    fn start(&mut self) -> bool {
        if self.left.start() {
            self.right_started = true;
            self.right.start();
        } else {
            false
        }
    }

    fn push(&mut self, c: char) -> bool {
        let mut ret = false;

        if self.right_started {
            ret |= self.right.push(c);
        }

        if self.left.push(c) {
            self.right_started = true;
            ret |= self.right.start();
        }

        ret
    }
}
```

</div>

Just one more grammar rule is all we need to parse concatenations.

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Wᴏʀᴅ} & \rarr \text{Rᴇᴘᴇᴀᴛ} \\
& \rarr \text{Wᴏʀᴅ} \; \text{Rᴇᴘᴇᴀᴛ} \\[2pt]
\text{Rᴇɢᴇx} & \rarr \text{Wᴏʀᴅ} \mid \text{Eᴍᴘᴛʏ} \\
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let word = many1(repeat)
        .map(|v| reduce(v, Regex::concat));

    alt((word, empty))
        .parse(input)
}
```

</div>


<div class="h-commit">

## This or that

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/40c116469867941ca6ef7f5cfec3c32bda1da0ca)

</div>

Our next feature is the alternation operator `|`, which lets us match either (or both) of two patterns.

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches either of two patterns.
    Or(Box<Regex>, Box<Regex>),
}
```

The matcher for alternations joins both patterns together with `$\varepsilon$`-transitions.

<div class="code-fig">

<figure>
  <svg width="340" viewBox="-30 -120 340 240">
    <line class="a a-1" x1="-20" y1="0" x2="10" y2="0" stroke="var(--fg)" stroke-dasharray="30" />
    <polygon class="a a-1" points="10,0 0,-4, 0,4" fill="var(--fg)" />
    <circle class="a a-2 a-3 a-4" cx="30" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <ellipse cx="150" cy="-60" rx="90" ry="50" stroke="var(--fg)" stroke-width="2" fill="var(--theme-hover)" />
    <line class="a a-3" x1="44.1421" y1="-14.1421" x2="85.858" y2="-45.858" stroke="var(--fg)" stroke-dasharray="52.403385162353516" />
    <polygon class="a a-3" points="0,0 -10,-5, -10,5" transform="translate(85.858 -45.858) rotate(-40)" fill="var(--fg)" />
    <text class="a a-3" x="45" y="-35" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
    <text class="a a-5 a-6" x="150" y="-85" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">A</text>
    <circle class="a a-4" cx="100" cy="-60" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-5 a-6" x1="120" y1="-60" x2="180" y2="-60" stroke="var(--fg)" stroke-dasharray="5" />
    <polygon class="a a-5 a-6" points="180,-60 170,-64, 170,-56" fill="var(--fg)" />
    <circle class="a a-7" cx="200" cy="-60" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-7" cx="200" cy="-60" r="16" stroke="var(--fg)" stroke-width="2" stroke-dasharray="2" fill="none" />
    <circle class="a a-9 a-10 a-11 a-12" cx="270" cy="0" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-9 a-10 a-11 a-12" cx="270" cy="0" r="16" stroke="var(--fg)" stroke-width="2" fill="none" />
    <line class="a a-8" x1="214.1421" y1="-45.858" x2="255.858" y2="-14.142" stroke="var(--fg)" stroke-dasharray="52.403385162353516" />
    <polygon class="a a-8" points="0,0 -10,-5, -10,5" transform="translate(255.858 -14.142) rotate(40)" fill="var(--fg)" />
    <text class="a a-8" x="250" y="-35" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
    <ellipse cx="150" cy="60" rx="90" ry="50" stroke="var(--fg)" stroke-width="2" fill="var(--theme-hover)" />
    <line class="a a-3" x1="44.1421" y1="14.1421" x2="85.858" y2="45.858" stroke="var(--fg)" stroke-dasharray="52.403385162353516" />
    <polygon class="a a-3" points="0,0 -10,-5, -10,5" transform="translate(85.858 45.858) rotate(40)" fill="var(--fg)" />
    <text class="a a-3" x="45" y="40" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
    <circle class="a a-4" cx="100" cy="60" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <text class="a a-5 a-6 a-7 a-8" x="150" y="35" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">B</text>
    <line class="a a-5 a-6 a-7 a-8" x1="120" y1="60" x2="180" y2="60" stroke="var(--fg)" stroke-dasharray="5" />
    <polygon class="a a-5 a-6 a-7 a-8" points="180,60 170,56, 170,64" fill="var(--fg)" />
    <line class="a a-10" x1="214.1421" y1="45.858" x2="255.858" y2="14.142" stroke="var(--fg)" stroke-dasharray="52.403385162353516" />
    <polygon class="a a-10" points="0,0 -10,-5, -10,5" transform="translate(255.858 14.142) rotate(-40)" fill="var(--fg)" />
    <text class="a a-10" x="250" y="40" text-anchor="middle" fill="var(--fg)" font-family="var(--mono-font)">ε</text>
    <circle class="a a-9" cx="200" cy="60" r="20" stroke="var(--fg)" stroke-width="2" fill="none" />
    <circle class="a a-9" cx="200" cy="60" r="16" stroke="var(--fg)" stroke-width="2" stroke-dasharray="2" fill="none" />
  </svg>
</figure>

```rust,no_run,noplayground
/// Matcher for Regex::Or.
struct Or<A, B>(A, B);

impl<A, B> Matcher for Or<A, B>
where
    A: Matcher,
    B: Matcher,
{
    fn start(&mut self) -> bool {
        self.0.start() | self.1.start()
    }

    fn push(&mut self, c: char) -> bool {
        self.0.push(c) | self.1.push(c)
    }
}
```

</div>

A couple more grammar rules are all we need.

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Mᴇᴛᴀ} & \rarr \texttt{|} \\[2pt]
\text{Cʜᴜɴᴋ} & \rarr \text{Wᴏʀᴅ} \mid \text{Eᴍᴘᴛʏ} \\[2pt]
\text{Rᴇɢᴇx} & \rarr \text{Cʜᴜɴᴋ} \\
& \rarr \text{Rᴇɢᴇx} \; \texttt{|} \; \text{Cʜᴜɴᴋ} \\
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let meta = r"\().*|";
    ...
    let chunk = alt((word, empty));

    separated_list1(char('|'), chunk)
        .map(|v| reduce(v, Regex::or))
        .parse(pattern)
}
```

</div>


<div class="h-commit">

## Feature-complete

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/5b9f5f8f2f8a18661a5999bc4e8c6610387f5f7e),
[commit](https://github.com/tavianator/irregex/commit/1c97b9459bf633c8f221cd6544bd3c620cd90ee6)

</div>

The features we implemented so far are enough to express every [regular language](https://en.wikipedia.org/wiki/Regular_language)&mdash;in other words, to match anything that could be matched by a regular expression.
Actually, we didn't even need `.`, though it would be very inconvenient to have to write

<p style="text-align: center;">
<code>(a|b|c|...|A|B|C|...|0|1|2|...|!|@|#|...)</code>
</p>

instead.

There are still a few other features that regex engines commonly provide, such as the `+` (repeat 1 or more times) and `?` (match 0 or 1 times) operators, that we could easily implement.

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches one or more repetitions.
    Plus(Box<Regex>),
    /// Matches zero or one times.
    Maybe(Box<Regex>),
}
```

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Mᴇᴛᴀ} & \rarr \texttt{+} \mid \texttt{?} \\[2pt]
\text{Rᴇᴘᴇᴀᴛ} & \rarr \text{Rᴇᴘᴇᴀᴛ} \; \texttt{+} \\
& \rarr \text{Rᴇᴘᴇᴀᴛ} \; \texttt{?} \\
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let meta = r"\().*|+?";
    ...
    let repeat = flat_map(atom, |r| fold_many0(
        one_of("*+?"),
        move || r.clone(),
        |r, c| match c {
            '*' => r.star(),
            '+' => r.plus(),
            '?' => r.maybe(),
            _ => unreachable!(),
        },
    ));
    ...
}
```

</div>

We don't even need any new matchers; we can just re-use existing ones.

```rust,no_run,noplayground
impl Regex {
    /// Compile a regular expression.
    fn matcher(&self) -> Box<dyn Matcher> {
        match self {
            ...
            Self::Plus(a) => Box::new(
                // A+ is the same as AA*
                a.matcher().concat(a.matcher().star())
            ),
            Self::Maybe(a) => Box::new(
                // A? is the same as (A|)
                a.matcher().or(Empty::default())
            ),
        }
    }
}
```

We're also missing character classes like `[a-z]`, but this post is already long enough without them.
They could be handled like `Regex::Literal` but with a list of ranges instead of a single `char`.


---

<details>
<summary>Everything below this point is actually incorrect.  Click to show it anyway.</summary>

<div class="h-commit">

## Not doing the work

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/425b3cf19554dfa451215f6ce82310c4c253a1f0)

</div>

Regular languages are [closed under complement](https://en.wikipedia.org/wiki/Regular_language#Closure_properties), which means that for every regex there is another that matches the exact opposite set of strings.
Unfortunately, this complementary regex can be pretty ugly.
Even a simple one like `hello` has a pretty terrible complement:

<p style="text-align: center;">
<code>|([^h]|h[^e]|he[^l]|hel[^l]|hell[^o]|hello.).*</code>
</p>

Typically, users negate their matches on a layer above the regex syntax itself, like with <code>grep&nbsp;-v</code> or <code>if&nbsp;!regex.matches(text)</code>.
But sometimes it would be useful to have dedicated syntax for inverting a regex, especially just part of a regex.
We can invent a `!` operator to express this.

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches the opposite of a pattern.
    Not(Box<Regex>),
}
```

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Mᴇᴛᴀ} & \rarr \texttt{!} \\[2pt]
\text{NᴏᴛWᴏʀᴅ} & \rarr \text{Wᴏʀᴅ} \\
& \rarr \texttt{!} \; \text{NᴏᴛWᴏʀᴅ} \\[2pt]
\text{Cʜᴜɴᴋ} & \rarr \text{NᴏᴛWᴏʀᴅ} \mid \text{Eᴍᴘᴛʏ} \\
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let meta = r"\().*|+?!";
    ...
    let not_word = many0_count(char('!'))
        .and(word)
        .map(|(n, r)| {
            (0..n).fold(r, |r, _| r.not())
        });

    let chunk = alt((not_word, empty));
    ...
}
```

</div>

Now we can write the opposite of `hello` much more simply: `!hello`.

Finding the complement of an arbitrary NFA is expensive: you first [convert the NFA to a DFA](https://en.wikipedia.org/wiki/Powerset_construction), which can blow up its size exponentially, and then flip the accepting/rejecting states.
Lucky for us, we don't have to.

```rust,no_run,noplayground
/// Matcher for Regex::Not.
struct Not<A>(A);

impl<A: Matcher> Matcher for Star<A> {
    fn start(&mut self) -> bool {
        !self.0.start()
    }

    fn push(&mut self, c: char) -> bool {
        !self.0.push(c)
    }
}
```

**This is the key insight of the whole post:** rather than actually finding the complement of an NFA, we can just write a `Matcher` implementation that acts like it.
The `!` operator lets us easily match things like "lines that don't contain hello", but it also opens the door to another more useful feature.


<div class="h-commit">

## Yes, and

[*fa-brands fa-github* Commit](https://github.com/tavianator/irregex/commit/d6c6d42fab7482715d279fccd0bf20764ee531f3)

</div>

Sometimes we might have two patterns and want *both* of them to match.
For example, we might want to find lines that contain both `hello` and `world`.
Regular languages are also [closed under intersection](https://en.wikipedia.org/wiki/Regular_language#Closure_properties), so we should be able to write such a regex.
Again, though, it might be pretty long.

<p style="text-align: center;">
<code>.*hello.*world.*|.*world.*hello.*</code>
</p>

This quickly gets out of hand with more than two patterns.
But with the `!` operator, we can use one of [De Morgan's laws](https://en.wikipedia.org/wiki/De_Morgan%27s_laws),

<p style="text-align: center;">
<code>(A && B) == !(!A || !B)</code>
</p>

to do the same thing without repeating ourselves:

<p style="text-align: center;">
<code>!(!(.*hello.*)|!(.*world.*))</code>
</p>

This is still not the easiest regex to read (*strings that don't (not contain `hello`) or (not contain `world`*)), so let's add an `&` operator to express the concept more directly:

<p style="text-align: center;">
<code>(.*hello.*)&(.*world.*)</code>
</p>

```rust,no_run,noplayground
enum Regex {
    ...
    /// Matches the intersection of two patterns.
    And(Box<Regex>, Box<Regex>),
}
```

<div class="code-fig">

<figure>

```math
\begin{aligned}
\text{Mᴇᴛᴀ} & \rarr \texttt{\&} \\[2pt]
\text{Cʟᴀᴜsᴇ} & \rarr \text{Cʜᴜɴᴋ} \\
& \rarr \text{Cʟᴀᴜsᴇ} \; \texttt{\&} \; \text{Cʜᴜɴᴋ} \\[2pt]
\text{Rᴇɢᴇx} & \rarr \text{Cʟᴀᴜsᴇ} \\
& \rarr \text{Rᴇɢᴇx} \; \texttt{|} \; \text{Cʟᴀᴜsᴇ} \\
\end{aligned}
```

</figure>

```rust,no_run,noplayground
fn regex(pattern: &str) -> IResult<&str, Regex> {
    ...
    let meta = r"\().*|&";
    ...
    let clause = separated_list1(char('&'), chunk)
        .map(|v| reduce(v, Regex::and));

    separated_list1(char('|'), clause)
        .map(|v| reduce(v, Regex::or))
        .parse(pattern)
}
```

</div>

We don't even need a new matcher,

```rust,no_run,noplayground
impl Regex {
    /// Compile a regular expression.
    fn matcher(&self) -> Box<dyn Matcher> {
        match self {
            ...
            Self::And(a, b) => Box::new(
                a.matcher().not()
                    .or(b.matcher().not())
                    .not()
            ),
        }
    }
}
```

but it's not hard to write one anyway.

```rust,no_run,noplayground
/// Matcher for Regex::And.
struct And<A, B>(A, B);

impl<A: Matcher, B: Matcher> Matcher for And<A, B> {
    fn start(&mut self) -> bool {
        self.0.start() & self.1.start()
    }

    fn push(&mut self, c: char) -> bool {
        self.0.push(c) & self.1.push(c)
    }
}
```


## Looking around

As far as I know, our `!` and `&` operators are not features of any major regex implementation.
But a similar feature called [lookaround](https://www.regular-expressions.info/lookaround.html) or positive/negative lookahead/lookbehind is found in many regex engines.

| Feature             | Syntax     | Irregex equivalent |
|:--------------------|:-----------|:-------------------|
| Positive lookahead  | `A(?=B)C`  | `A((B.*)&C)`       |
| Negative lookahead  | `A(?!B)C`  | `A((!B.*)&C)`      |
| Positive lookbehind | `A(?<=B)C` | `(A&(.*B))C`       |
| Negative lookbehind | `A(?<!B)C` | `(A&(!.*B))C`      |

As far as I know, this feature is only provided by regex engines that have [worst-case exponential complexity][exp].
The two major worst-case linear regex engines that I'm aware of, [RE2](https://github.com/google/re2/) and Rust's [regex](https://crates.io/crates/regex) crate, don't support it.

> *As a matter of principle, RE2 does not support constructs for which only backtracking solutions are known to exist.
> Thus, backreferences and look-around assertions are not supported.*
>
> &mdash; <https://github.com/google/re2/issues/156>

> *Notably, backreferences and arbitrary lookahead/lookbehind assertions are not provided.
> In return, regular expression searching provided by this package has excellent worst-case performance.*
>
> &mdash; <https://github.com/rust-lang/regex/issues/127>

But as this post shows, it is certainly possible to support lookaround (not backreferences!) in linear time.
There are some unanswered questions (what about capture groups?), but I'm curious if this implementation strategy would be workable in a production-quality regex engine.

</details>
