# Proving that 1 + 1 = 10 in Rust

<div class="infobar">

<fa:clock-o> 2020-10-18
<fa:user> Tavian Barnes

</div>


*"There are 10 types of people: those who understand binary, and those who don't."*

I recently read [this writeup] about using Rust's type system to prove that 1 + 1 = 2, and was inspired to make a version of it with a more efficient representation.
To recap (but really, read that post first if you haven't already), they used the [Peano] representation of the natural numbers, which is based on the *successor* function `$S$`:

[this writeup]: https://gist.github.com/gretingz/bc194c20a2de2c7bcc0f457282ba2662
[Peano]: https://en.wikipedia.org/wiki/Peano_axioms

```math
\begin{aligned}
1 & = S(0) \\
2 & = S(1) = S(S(0)) \\
3 & = S(2) = S(S(S(0))) \\
\vdots
\end{aligned}
```

In this system, every natural number is defined as some finite recursive applications of `$S$`, terminating at zero.
This is simple, but also tremendously inefficient.
We need a representation of length `$O(n)$` just to represent `$n$`.

Positional systems, like the familiar [decimal] (base 10) system, have representations of length just `$O(\log n)$`.
This is *exponentially* better; we can write down numbers like 1,000,000 without pages and pages of `$S(S(S(\ldots$`
This extra efficiency should let us do some bigger calculations with our numbers-as-types.

[decimal]: https://en.wikipedia.org/wiki/Decimal


## Single-bit operations

We're going to use [binary] rather than decimal, to simplify the case work.
If we were going to represent binary numbers at runtime, we could do something like this:

[binary]: https://en.wikipedia.org/wiki/Binary_number

```rust,no_run,noplayground
##[derive(Clone, Copy, Debug)]
enum Bit {
    Zero,
    One,
}

use Bit::*;
```

The simplest piece of arithmetic we can implement is a [half adder](https://en.wikipedia.org/wiki/Adder_(electronics)#Half_adder):

```rust,edition2018
# #[derive(Clone, Copy, Debug)]
# enum Bit {
#     Zero,
#     One,
# }
#
# use Bit::*;
#
fn half_adder(a: Bit, b: Bit) -> (Bit, Bit) {
    match (a, b) {
        (Zero, Zero) => (Zero, Zero),
        (Zero, One)  => (One,  Zero),
        (One,  Zero) => (One,  Zero),
        (One,  One)  => (Zero, One),
    }
}

let (s, c) = half_adder(One, One);
println!("One plus One is {:?}, carry the {:?}", s, c);
```

But we want to do all this at compile-time, not runtime, so we have to lift a few things up to the type level.
Values become types:

```rust,no_run,noplayground
#[derive(Debug, Default)]
struct Zero;
#[derive(Debug, Default)]
struct One;
```

The type-level version of functions like `half_adder` are traits with [associated types](https://doc.rust-lang.org/stable/rust-by-example/generics/assoc_items/types.html):

```rust,no_run,noplayground
trait HalfAdder {
    type Sum;
    type Carry;
}
```

The "parameters" to the function are passed through the `Self` type.
The "return values" are the associated types `Sum` and `Carry`.
We can "evaluate" the function by writing something like `<(One, One) as HalfAdder>::Sum`.
Note that `(One, One)` is a type here, not a value.

Finally, the type-level version of a `match` block is just different `impl`s:

```rust,no_run,noplayground
impl HalfAdder for (Zero, Zero) {
    type Sum = Zero;
    type Carry = Zero;
}

impl HalfAdder for (Zero, One) {
    type Sum = One;
    type Carry = Zero;
}

impl HalfAdder for (One, Zero) {
    type Sum = One;
    type Carry = Zero;
}

impl HalfAdder for (One, One) {
    type Sum = Zero;
    type Carry = One;
}
```

Let's test this implementation with some type annotations:

```rust
# struct Zero;
# struct One;
#
# trait HalfAdder {
#     type Sum;
#     type Carry;
# }
#
# impl HalfAdder for (Zero, Zero) {
#     type Sum = Zero;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (Zero, One) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, Zero) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, One) {
#     type Sum = Zero;
#     type Carry = One;
# }
#
// Convenient shorthand
type HalfSum<A, B> = <(A, B) as HalfAdder>::Sum;
type HalfCarry<A, B> = <(A, B) as HalfAdder>::Carry;

// The type before the `=` has to match the value
let _: HalfSum<One, One> = Zero;
let _: HalfCarry<One, One> = One;

println!("It works!");
```

We can implement a [full adder](https://en.wikipedia.org/wiki/Adder_(electronics)#Full_adder) on top of the half adder:

```rust,edition2018
# #[derive(Clone, Copy, Debug)]
# enum Bit {
#     Zero,
#     One,
# }
#
# use Bit::*;
#
# fn half_adder(a: Bit, b: Bit) -> (Bit, Bit) {
#     match (a, b) {
#         (Zero, Zero) => (Zero, Zero),
#         (Zero, One)  => (One,  Zero),
#         (One,  Zero) => (One,  Zero),
#         (One,  One)  => (Zero, One),
#     }
# }
#
fn full_adder(a: Bit, b: Bit, c: Bit) -> (Bit, Bit) {
    let (d, e) = half_adder(a, b);
    let (f, g) = half_adder(c, d);
    let (h, _) = half_adder(e, g);
    (f, h)
}

let (s, c) = full_adder(One, One, One);
println!("One plus One plus One is {:?}, carry the {:?}", s, c);
```

Or, at the type level:

```rust,edition2018
# struct Zero;
# struct One;
#
# trait HalfAdder {
#     type Sum;
#     type Carry;
# }
#
# type HalfSum<A, B> = <(A, B) as HalfAdder>::Sum;
# type HalfCarry<A, B> = <(A, B) as HalfAdder>::Carry;
#
# impl HalfAdder for (Zero, Zero) {
#     type Sum = Zero;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (Zero, One) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, Zero) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, One) {
#     type Sum = Zero;
#     type Carry = One;
# }
#
trait FullAdder {
    type Sum;
    type Carry;
}

type FullSum<A, B, C> = <(A, B, C) as FullAdder>::Sum;
type FullCarry<A, B, C> = <(A, B, C) as FullAdder>::Carry;

impl<A, B, C> FullAdder for (A, B, C)
where
    (A, B): HalfAdder,
    (HalfSum<A, B>, C): HalfAdder,
    (HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>): HalfAdder,
{
    type Sum = HalfSum<HalfSum<A, B>, C>;
    type Carry = HalfSum<HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>>;
}

let _: FullSum<One, One, One> = One;
let _: FullCarry<One, One, One> = One;

println!("It works!");
```

## Addition

To represent natural numbers at runtime as sequences of bits, we could do this:

```rust,no_run,noplayground
type Natural = Vec<Bit>;
```

But there's not really a nice equivalent of `Vec` at the type level.
Instead, we can think a little more functionally and use a recursive linked list:

```rust,edition2018
# #[derive(Clone, Copy, Debug)]
# enum Bit {
#     Zero,
#     One,
# }
#
# use Bit::*;
#
##[derive(Debug)]
enum Natural {
    Nil,
    Cons(Bit, Box<Natural>),
}

use Natural::*;

fn cons(bit: Bit, tail: Natural) -> Natural {
    Cons(bit, Box::new(tail))
}

let zero  =                                 Nil;
let one   =                       cons(One, Nil);
let two   =            cons(Zero, cons(One, Nil));
let three =            cons(One,  cons(One, Nil));
let four  = cons(Zero, cons(Zero, cons(One, Nil)));

println!("{:?}", four);
```

The bits are ordered from least to most significant.
This is backwards from our usual way of writing numbers, but it makes the implementation a bit easier.
Here's a [ripple-carry adder](https://en.wikipedia.org/wiki/Adder_(electronics)#Ripple-carry_adder):


```rust,edition2018
# #[derive(Clone, Copy, Debug)]
# enum Bit {
#     Zero,
#     One,
# }
#
# use Bit::*;
#
# fn half_adder(a: Bit, b: Bit) -> (Bit, Bit) {
#     match (a, b) {
#         (Zero, Zero) => (Zero, Zero),
#         (Zero, One)  => (One,  Zero),
#         (One,  Zero) => (One,  Zero),
#         (One,  One)  => (Zero, One),
#     }
# }
#
# fn full_adder(a: Bit, b: Bit, c: Bit) -> (Bit, Bit) {
#     let (d, e) = half_adder(a, b);
#     let (f, g) = half_adder(c, d);
#     let (h, _) = half_adder(e, g);
#     (f, h)
# }
#
# #[derive(Debug)]
# enum Natural {
#     Nil,
#     Cons(Bit, Box<Natural>),
# }
#
# use Natural::*;
#
# fn cons(bit: Bit, tail: Natural) -> Natural {
#     Cons(bit, Box::new(tail))
# }
#
fn ripple_adder(a: Natural, b: Natural, c: Bit) -> Natural {
    match (a, b, c) {
        // Base case: 0 + 0 + 0 == 0
        (Nil, Nil, Zero) => Nil,

        // Base case: 0 + 0 + 1 == 1
        (Nil, Nil, One) => cons(One, Nil),

        // Recursive base case: a + 0 + c
        (Cons(a1, a2), Nil, c) => {
            let (d, e) = half_adder(a1, c);
            cons(d, ripple_adder(*a2, Nil, e))
        },

        // Recursive base case: 0 + b + c
        (Nil, Cons(b1, b2), c) => {
            let (d, e) = half_adder(b1, c);
            cons(d, ripple_adder(Nil, *b2, e))
        },

        // General case: a + b + c
        (Cons(a1, a2), Cons(b1, b2), c) => {
            let (d, e) = full_adder(a1, b1, c);
            cons(d, ripple_adder(*a2, *b2, e))
        },
    }
}

# let two = cons(Zero, cons(One, Nil));
# let three = cons(One,  cons(One, Nil));
let five = ripple_adder(two, three, Zero);
println!("{:?}", five);
```

[Cons cells] are just pairs, so we can use tuple types to represent type-level lists.
This is the only part that's easier to read at the type level :)

[Cons cells]: https://en.wikipedia.org/wiki/Cons

```rust,no_run,noplayground
#[derive(Debug, Default)]
struct Nil;

type NatZero =                     Nil;
type NatOne  =               (One, Nil);
type Two     =        (Zero, (One, Nil));
type Three   =        (One,  (One, Nil));
type Four    = (Zero, (Zero, (One, Nil)));
```

Like before, let's make a trait for our ripple adder function:

```rust,no_run,noplayground
/// Given natural numbers A, B, and a carry bit C, computes A + B + C.
trait RippleAdder {
    type Sum;
}

type RippleSum<A, B, C> = <(A, B, C) as RippleAdder>::Sum;
```

And translate the `match` arms into `impl`s:

```rust,edition2018
# #[derive(Debug, Default)]
# struct Zero;
# #[derive(Debug, Default)]
# struct One;
#
# trait HalfAdder {
#     type Sum;
#     type Carry;
# }
#
# type HalfSum<A, B> = <(A, B) as HalfAdder>::Sum;
# type HalfCarry<A, B> = <(A, B) as HalfAdder>::Carry;
#
# impl HalfAdder for (Zero, Zero) {
#     type Sum = Zero;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (Zero, One) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, Zero) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, One) {
#     type Sum = Zero;
#     type Carry = One;
# }
#
# trait FullAdder {
#     type Sum;
#     type Carry;
# }
#
# type FullSum<A, B, C> = <(A, B, C) as FullAdder>::Sum;
# type FullCarry<A, B, C> = <(A, B, C) as FullAdder>::Carry;
#
# impl<A, B, C> FullAdder for (A, B, C)
# where
#     (A, B): HalfAdder,
#     (HalfSum<A, B>, C): HalfAdder,
#     (HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>): HalfAdder,
# {
#     type Sum = HalfSum<HalfSum<A, B>, C>;
#     type Carry = HalfSum<HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>>;
# }
#
# #[derive(Debug, Default)]
# struct Nil;
#
# trait RippleAdder {
#     type Sum;
# }
#
# type RippleSum<A, B, C> = <(A, B, C) as RippleAdder>::Sum;
#
/// Base case: 0 + 0 + 0 == 0
impl RippleAdder for (Nil, Nil, Zero) {
    type Sum = Nil;
}

/// Base case: 0 + 0 + 1 == 1
impl RippleAdder for (Nil, Nil, One) {
    type Sum = (One, Nil);
}

/// Recursive base case: a + 0 + c
impl<A1, A2, C> RippleAdder for ((A1, A2), Nil, C)
where
    (A1, C): HalfAdder,
    (A2, Nil, HalfCarry<A1, C>): RippleAdder,
{
    type Sum = (HalfSum<A1, C>, RippleSum<A2, Nil, HalfCarry<A1, C>>);
}

/// Recursive base case: 0 + b + c
impl<B1, B2, C> RippleAdder for (Nil, (B1, B2), C)
where
    (B1, C): HalfAdder,
    (Nil, B2, HalfCarry<B1, C>): RippleAdder,
{
    type Sum = (HalfSum<B1, C>, RippleSum<Nil, B2, HalfCarry<B1, C>>);
}

/// General case: a + b + c
impl<A1, A2, B1, B2, C> RippleAdder for ((A1, A2), (B1, B2), C)
where
    (A1, B1, C): FullAdder,
    (A2, B2, FullCarry<A1, B1, C>): RippleAdder,
{
    type Sum = (FullSum<A1, B1, C>, RippleSum<A2, B2, FullCarry<A1, B1, C>>);
}

# type Two = (Zero, (One, Nil));
# type Three = (One, (One, Nil));
type Five = RippleSum<Two, Three, Zero>;
let _: Five = (One, (Zero, (One, Nil)));
println!("It works!");
```


## Multiplication

Multiplication has a nice recursive definition too:

```rust,edition2018
# #[derive(Clone, Copy, Debug)]
# enum Bit {
#     Zero,
#     One,
# }
#
# use Bit::*;
#
# fn half_adder(a: Bit, b: Bit) -> (Bit, Bit) {
#     match (a, b) {
#         (Zero, Zero) => (Zero, Zero),
#         (Zero, One)  => (One,  Zero),
#         (One,  Zero) => (One,  Zero),
#         (One,  One)  => (Zero, One),
#     }
# }
#
# fn full_adder(a: Bit, b: Bit, c: Bit) -> (Bit, Bit) {
#     let (d, e) = half_adder(a, b);
#     let (f, g) = half_adder(c, d);
#     let (h, _) = half_adder(e, g);
#     (f, h)
# }
#
# #[derive(Clone, Debug)]
# enum Natural {
#     Nil,
#     Cons(Bit, Box<Natural>),
# }
#
# use Natural::*;
#
# fn cons(bit: Bit, tail: Natural) -> Natural {
#     Cons(bit, Box::new(tail))
# }
#
# fn ripple_adder(a: Natural, b: Natural, c: Bit) -> Natural {
#     match (a, b, c) {
#         // Base case: 0 + 0 + 0 == 0
#         (Nil, Nil, Zero) => Nil,
#
#         // Base case: 0 + 0 + 1 == 1
#         (Nil, Nil, One) => cons(One, Nil),
#
#         // Recursive base case: a + 0 + c
#         (Cons(a1, a2), Nil, c) => {
#             let (d, e) = half_adder(a1, c);
#             cons(d, ripple_adder(*a2, Nil, e))
#         },
#
#         // Recursive base case: 0 + b + c
#         (Nil, Cons(b1, b2), c) => {
#             let (d, e) = half_adder(b1, c);
#             cons(d, ripple_adder(Nil, *b2, e))
#         },
#
#         // General case: a + b + c
#         (Cons(a1, a2), Cons(b1, b2), c) => {
#             let (d, e) = full_adder(a1, b1, c);
#             cons(d, ripple_adder(*a2, *b2, e))
#         },
#     }
# }
#
fn multiply(a: Natural, b: Natural) -> Natural {
    match (a, b) {
        // Base case: 0 * b == 0
        (Nil, _) => Nil,

        // Base case: a * 0 == 0
        (_, Nil) => Nil,

        // Recursive case: (2 * a) * b == 2 * (a * b)
        (Cons(Zero, a2), b) => cons(Zero, multiply(*a2, b)),

        // Recursive case: (2 * a + 1) * b == 2 * a * b + b
        (Cons(One, a2), b) => {
            let rec = cons(Zero, multiply(*a2, b.clone()));
            ripple_adder(rec, b, Zero)
        },
    }
}

# let one = cons(One, Nil);
# let three = cons(One, cons(One, Nil));
# let four = cons(Zero, cons(Zero, cons(One, Nil)));
# let five = cons(One, cons(Zero, cons(One, Nil)));
let six = ripple_adder(five, one, Zero);
let seven = ripple_adder(four, three, Zero);
let forty_two = multiply(six, seven);
println!("{:?}", forty_two);

let forty_two_in_binary_backwards: String = format!("{:b}", 42).chars().rev().collect();
println!("{}", forty_two_in_binary_backwards);
```

I hoped this would translate directly to the type level too:

```rust,edition2018
# #[derive(Debug, Default)]
# struct Zero;
# #[derive(Debug, Default)]
# struct One;
#
# trait HalfAdder {
#     type Sum;
#     type Carry;
# }
#
# type HalfSum<A, B> = <(A, B) as HalfAdder>::Sum;
# type HalfCarry<A, B> = <(A, B) as HalfAdder>::Carry;
#
# impl HalfAdder for (Zero, Zero) {
#     type Sum = Zero;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (Zero, One) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, Zero) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, One) {
#     type Sum = Zero;
#     type Carry = One;
# }
#
# trait FullAdder {
#     type Sum;
#     type Carry;
# }
#
# type FullSum<A, B, C> = <(A, B, C) as FullAdder>::Sum;
# type FullCarry<A, B, C> = <(A, B, C) as FullAdder>::Carry;
#
# impl<A, B, C> FullAdder for (A, B, C)
# where
#     (A, B): HalfAdder,
#     (HalfSum<A, B>, C): HalfAdder,
#     (HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>): HalfAdder,
# {
#     type Sum = HalfSum<HalfSum<A, B>, C>;
#     type Carry = HalfSum<HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>>;
# }
#
# #[derive(Debug, Default)]
# struct Nil;
#
# trait RippleAdder {
#     type Sum;
# }
#
# type RippleSum<A, B, C> = <(A, B, C) as RippleAdder>::Sum;
#
# impl RippleAdder for (Nil, Nil, Zero) {
#     type Sum = Nil;
# }
#
# impl RippleAdder for (Nil, Nil, One) {
#     type Sum = (One, Nil);
# }
#
# impl<A1, A2, C> RippleAdder for ((A1, A2), Nil, C)
# where
#     (A1, C): HalfAdder,
#     (A2, Nil, HalfCarry<A1, C>): RippleAdder,
# {
#     type Sum = (HalfSum<A1, C>, RippleSum<A2, Nil, HalfCarry<A1, C>>);
# }
#
# impl<B1, B2, C> RippleAdder for (Nil, (B1, B2), C)
# where
#     (B1, C): HalfAdder,
#     (Nil, B2, HalfCarry<B1, C>): RippleAdder,
# {
#     type Sum = (HalfSum<B1, C>, RippleSum<Nil, B2, HalfCarry<B1, C>>);
# }
#
# impl<A1, A2, B1, B2, C> RippleAdder for ((A1, A2), (B1, B2), C)
# where
#     (A1, B1, C): FullAdder,
#     (A2, B2, FullCarry<A1, B1, C>): RippleAdder,
# {
#     type Sum = (FullSum<A1, B1, C>, RippleSum<A2, B2, FullCarry<A1, B1, C>>);
# }
#
/// Given natural numbers (A, B), computes A * B.
trait Multiply {
    type Product;
}

type Product<A, B> = <(A, B) as Multiply>::Product;

/// Base case: 0 * b == 0
impl<B> Multiply for (Nil, B) {
    type Product = Nil;
}

/// Base case: a * 0 == 0
impl<A1, A2> Multiply for ((A1, A2), Nil) {
    type Product = Nil;
}

/// Recursive case: (2 * a) * b == 2 * (a * b)
impl<A, B1, B2> Multiply for ((Zero, A), (B1, B2))
where
    (A, (B1, B2)): Multiply,
{
    type Product = (Zero, Product<A, (B1, B2)>);
}

/// Recursive case: (2 * a + 1) * b == 2 * a * b + b
impl<A, B1, B2> Multiply for ((One, A), (B1, B2))
where
    (A, (B1, B2)): Multiply,
    ((Zero, Product<A, (B1, B2)>), Nil, Zero): RippleAdder,
{
    type Product = RippleSum<(Zero, Product<A, (B1, B2)>), Nil, Zero>;
}
```

But it doesn't work (try it).
The [original post] also ran into a similar error.
I don't exactly understand why, but it seems like Rust's trait solver likes it when recursive `where` clauses involve obviously "smaller" structures than `Self`, so the recursion terminates more easily.
It's the `((Zero, Product<A, (B1, B2)>), Nil, Zero): RippleAdder` bound that's giving us trouble, since `(Zero, Product<A, (B1, B2)>)` can be bigger than the inputs.

[original post]: https://gist.github.com/gretingz/bc194c20a2de2c7bcc0f457282ba2662

So I had to think up a different multiplication algorithm with a simpler recursive structure that would pass the type checker.
The trick I used is to do all the shifting (`B -> (Zero, B)`) ahead of time so I don't have to put it in a `where` clause.
It's kind of a map-reduce style algorithm.

```rust,no_run,noplayground
/// Given (A, B), produces (B, (B, (B, (..., Nil)))) with the same length as A.
trait MulRepeat {
    type Result;
}

type MulRepeated<A, B> = <(A, B) as MulRepeat>::Result;

/// Base case.
impl<B> MulRepeat for (Nil, B) {
    type Result = Nil;
}

/// Recursive case.
impl<A1, A2, B> MulRepeat for ((A1, A2), B)
where
    (A2, B): MulRepeat,
{
    type Result = (B, MulRepeated<A2, B>);
}

/// Bit-shifts every number in a list:
///
///        (B, (B, (B, (..., Nil))))
///     -> ((Zero, B), ((Zero, B), ((Zero, B), (..., Nil))))
///
/// Used as a subroutine for MulShift.
trait ShiftAll {
    type Result;
}

type AllShifted<A> = <A as ShiftAll>::Result;

/// Base case.
impl ShiftAll for Nil {
    type Result = Nil;
}

/// Recursive case.
impl<A, B> ShiftAll for (A, B)
where
    B: ShiftAll,
{
    type Result = ((Zero, A), AllShifted<B>);
}

/// For each i, shifts the ith number i times.
///
///        (B, (B, (B, (..., Nil))))
///     -> (B, ((Zero, B), ((Zero, (Zero, B)), (..., Nil))))
trait MulShift {
    type Result;
}

type MulShifted<A> = <A as MulShift>::Result;

/// Base case.
impl MulShift for Nil {
    type Result = Nil;
}

/// Recursive case.
impl<A, B> MulShift for (A, B)
where
    B: MulShift,
    MulShifted<B>: ShiftAll,
{
    type Result = (A, AllShifted<MulShifted<B>>);
}

/// Given a number A and a list of numbers B with the same length, replaces each
/// B with Nil when A has a zero bit in that position.
///
///     A: (One, (Zero, (One, (..., Nil))))
///     B: (B1, (B2, (B3, (..., Nil))))
///     -> (B1, (Nil, (B3, (..., Nil))))
trait MulMask {
    type Result;
}

type MulMasked<A, B> = <(A, B) as MulMask>::Result;

/// Base case.
impl MulMask for (Nil, Nil) {
    type Result = Nil;
}

/// Recursive case.
impl<A, B1, B2> MulMask for ((Zero, A), (B1, B2))
where
    (A, B2): MulMask,
{
    type Result = (Nil, MulMasked<A, B2>);
}

/// Recursive case.
impl<A, B1, B2> MulMask for ((One, A), (B1, B2))
where
    (A, B2): MulMask,
{
    type Result = (B1, MulMasked<A, B2>);
}

/// Sums up all the numbers in a list.
trait MulReduce {
    type Result;
}

type MulReduced<A> = <A as MulReduce>::Result;

/// Base case.
impl MulReduce for Nil {
    type Result = Nil;
}

/// Recursive case.
impl<A, B> MulReduce for (A, B)
where
    B: MulReduce,
    (A, MulReduced<B>, Zero): RippleAdder,
{
    type Result = RippleSum<A, MulReduced<B>, Zero>;
}

/// Calculates A times B.
///
/// For example:
///
///     A: 101, B: 111
///     MulRepeated<A, B>:  [111, 111, 111]
///     MulShifted<...>:    [111, 1110, 11100]
///     MulMasked<A, ...>:  [111, 0, 11100]
///     MulReduced<...>:    111 + 0 + 11100
///                      == 100011
type Product<A, B> = MulReduced<MulMasked<A, MulShifted<MulRepeated<A, B>>>>;
```

This time, it works!

```rust,edition2018
# #[derive(Debug, Default)]
# struct Zero;
# #[derive(Debug, Default)]
# struct One;
#
# trait HalfAdder {
#     type Sum;
#     type Carry;
# }
#
# type HalfSum<A, B> = <(A, B) as HalfAdder>::Sum;
# type HalfCarry<A, B> = <(A, B) as HalfAdder>::Carry;
#
# impl HalfAdder for (Zero, Zero) {
#     type Sum = Zero;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (Zero, One) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, Zero) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, One) {
#     type Sum = Zero;
#     type Carry = One;
# }
#
# trait FullAdder {
#     type Sum;
#     type Carry;
# }
#
# type FullSum<A, B, C> = <(A, B, C) as FullAdder>::Sum;
# type FullCarry<A, B, C> = <(A, B, C) as FullAdder>::Carry;
#
# impl<A, B, C> FullAdder for (A, B, C)
# where
#     (A, B): HalfAdder,
#     (HalfSum<A, B>, C): HalfAdder,
#     (HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>): HalfAdder,
# {
#     type Sum = HalfSum<HalfSum<A, B>, C>;
#     type Carry = HalfSum<HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>>;
# }
#
# #[derive(Debug, Default)]
# struct Nil;
#
# trait RippleAdder {
#     type Sum;
# }
#
# type RippleSum<A, B, C> = <(A, B, C) as RippleAdder>::Sum;
#
# impl RippleAdder for (Nil, Nil, Zero) {
#     type Sum = Nil;
# }
#
# impl RippleAdder for (Nil, Nil, One) {
#     type Sum = (One, Nil);
# }
#
# impl<A1, A2, C> RippleAdder for ((A1, A2), Nil, C)
# where
#     (A1, C): HalfAdder,
#     (A2, Nil, HalfCarry<A1, C>): RippleAdder,
# {
#     type Sum = (HalfSum<A1, C>, RippleSum<A2, Nil, HalfCarry<A1, C>>);
# }
#
# impl<B1, B2, C> RippleAdder for (Nil, (B1, B2), C)
# where
#     (B1, C): HalfAdder,
#     (Nil, B2, HalfCarry<B1, C>): RippleAdder,
# {
#     type Sum = (HalfSum<B1, C>, RippleSum<Nil, B2, HalfCarry<B1, C>>);
# }
#
# impl<A1, A2, B1, B2, C> RippleAdder for ((A1, A2), (B1, B2), C)
# where
#     (A1, B1, C): FullAdder,
#     (A2, B2, FullCarry<A1, B1, C>): RippleAdder,
# {
#     type Sum = (FullSum<A1, B1, C>, RippleSum<A2, B2, FullCarry<A1, B1, C>>);
# }
#
# trait MulRepeat {
#     type Result;
# }
#
# type MulRepeated<A, B> = <(A, B) as MulRepeat>::Result;
#
# impl<B> MulRepeat for (Nil, B) {
#     type Result = Nil;
# }
#
# impl<A1, A2, B> MulRepeat for ((A1, A2), B)
# where
#     (A2, B): MulRepeat,
# {
#     type Result = (B, MulRepeated<A2, B>);
# }
#
# trait ShiftAll {
#     type Result;
# }
#
# type AllShifted<A> = <A as ShiftAll>::Result;
#
# impl ShiftAll for Nil {
#     type Result = Nil;
# }
#
# impl<A, B> ShiftAll for (A, B)
# where
#     B: ShiftAll,
# {
#     type Result = ((Zero, A), AllShifted<B>);
# }
#
# trait MulShift {
#     type Result;
# }
#
# type MulShifted<A> = <A as MulShift>::Result;
#
# impl MulShift for Nil {
#     type Result = Nil;
# }
#
# impl<A, B> MulShift for (A, B)
# where
#     B: MulShift,
#     MulShifted<B>: ShiftAll,
# {
#     type Result = (A, AllShifted<MulShifted<B>>);
# }
#
# trait MulMask {
#     type Result;
# }
#
# type MulMasked<A, B> = <(A, B) as MulMask>::Result;
#
# impl MulMask for (Nil, Nil) {
#     type Result = Nil;
# }
#
# impl<A, B1, B2> MulMask for ((Zero, A), (B1, B2))
# where
#     (A, B2): MulMask,
# {
#     type Result = (Nil, MulMasked<A, B2>);
# }
#
# impl<A, B1, B2> MulMask for ((One, A), (B1, B2))
# where
#     (A, B2): MulMask,
# {
#     type Result = (B1, MulMasked<A, B2>);
# }
#
# trait MulReduce {
#     type Result;
# }
#
# type MulReduced<A> = <A as MulReduce>::Result;
#
# impl MulReduce for Nil {
#     type Result = Nil;
# }
#
# impl<A, B> MulReduce for (A, B)
# where
#     B: MulReduce,
#     (A, MulReduced<B>, Zero): RippleAdder,
# {
#     type Result = RippleSum<A, MulReduced<B>, Zero>;
# }
#
# type Product<A, B> = MulReduced<MulMasked<A, MulShifted<MulRepeated<A, B>>>>;
#
# type NatZero = Nil;
# type NatOne = (One, Nil);
# type Two = (Zero, (One, Nil));
# type Three = (One, (One, Nil));
# type Four = (Zero, (Zero, (One, Nil)));
#
type Five = RippleSum<Two, Three, Zero>;
type Six = RippleSum<Five, NatOne, Zero>;
type Seven = RippleSum<Four, Three, Zero>;

type FortyTwo = Product<Six, Seven>;
let _: FortyTwo = (Zero, (One, (Zero, (One, (Zero, (One, Nil))))));
println!("It works!");
```

We can compute some pretty big numbers:

```rust,edition2018
# #[derive(Debug, Default)]
# struct Zero;
# #[derive(Debug, Default)]
# struct One;
#
# trait HalfAdder {
#     type Sum;
#     type Carry;
# }
#
# type HalfSum<A, B> = <(A, B) as HalfAdder>::Sum;
# type HalfCarry<A, B> = <(A, B) as HalfAdder>::Carry;
#
# impl HalfAdder for (Zero, Zero) {
#     type Sum = Zero;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (Zero, One) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, Zero) {
#     type Sum = One;
#     type Carry = Zero;
# }
#
# impl HalfAdder for (One, One) {
#     type Sum = Zero;
#     type Carry = One;
# }
#
# trait FullAdder {
#     type Sum;
#     type Carry;
# }
#
# type FullSum<A, B, C> = <(A, B, C) as FullAdder>::Sum;
# type FullCarry<A, B, C> = <(A, B, C) as FullAdder>::Carry;
#
# impl<A, B, C> FullAdder for (A, B, C)
# where
#     (A, B): HalfAdder,
#     (HalfSum<A, B>, C): HalfAdder,
#     (HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>): HalfAdder,
# {
#     type Sum = HalfSum<HalfSum<A, B>, C>;
#     type Carry = HalfSum<HalfCarry<A, B>, HalfCarry<HalfSum<A, B>, C>>;
# }
#
# #[derive(Debug, Default)]
# struct Nil;
#
# trait RippleAdder {
#     type Sum;
# }
#
# type RippleSum<A, B, C> = <(A, B, C) as RippleAdder>::Sum;
#
# impl RippleAdder for (Nil, Nil, Zero) {
#     type Sum = Nil;
# }
#
# impl RippleAdder for (Nil, Nil, One) {
#     type Sum = (One, Nil);
# }
#
# impl<A1, A2, C> RippleAdder for ((A1, A2), Nil, C)
# where
#     (A1, C): HalfAdder,
#     (A2, Nil, HalfCarry<A1, C>): RippleAdder,
# {
#     type Sum = (HalfSum<A1, C>, RippleSum<A2, Nil, HalfCarry<A1, C>>);
# }
#
# impl<B1, B2, C> RippleAdder for (Nil, (B1, B2), C)
# where
#     (B1, C): HalfAdder,
#     (Nil, B2, HalfCarry<B1, C>): RippleAdder,
# {
#     type Sum = (HalfSum<B1, C>, RippleSum<Nil, B2, HalfCarry<B1, C>>);
# }
#
# impl<A1, A2, B1, B2, C> RippleAdder for ((A1, A2), (B1, B2), C)
# where
#     (A1, B1, C): FullAdder,
#     (A2, B2, FullCarry<A1, B1, C>): RippleAdder,
# {
#     type Sum = (FullSum<A1, B1, C>, RippleSum<A2, B2, FullCarry<A1, B1, C>>);
# }
#
# trait MulRepeat {
#     type Result;
# }
#
# type MulRepeated<A, B> = <(A, B) as MulRepeat>::Result;
#
# impl<B> MulRepeat for (Nil, B) {
#     type Result = Nil;
# }
#
# impl<A1, A2, B> MulRepeat for ((A1, A2), B)
# where
#     (A2, B): MulRepeat,
# {
#     type Result = (B, MulRepeated<A2, B>);
# }
#
# trait ShiftAll {
#     type Result;
# }
#
# type AllShifted<A> = <A as ShiftAll>::Result;
#
# impl ShiftAll for Nil {
#     type Result = Nil;
# }
#
# impl<A, B> ShiftAll for (A, B)
# where
#     B: ShiftAll,
# {
#     type Result = ((Zero, A), AllShifted<B>);
# }
#
# trait MulShift {
#     type Result;
# }
#
# type MulShifted<A> = <A as MulShift>::Result;
#
# impl MulShift for Nil {
#     type Result = Nil;
# }
#
# impl<A, B> MulShift for (A, B)
# where
#     B: MulShift,
#     MulShifted<B>: ShiftAll,
# {
#     type Result = (A, AllShifted<MulShifted<B>>);
# }
#
# trait MulMask {
#     type Result;
# }
#
# type MulMasked<A, B> = <(A, B) as MulMask>::Result;
#
# impl MulMask for (Nil, Nil) {
#     type Result = Nil;
# }
#
# impl<A, B1, B2> MulMask for ((Zero, A), (B1, B2))
# where
#     (A, B2): MulMask,
# {
#     type Result = (Nil, MulMasked<A, B2>);
# }
#
# impl<A, B1, B2> MulMask for ((One, A), (B1, B2))
# where
#     (A, B2): MulMask,
# {
#     type Result = (B1, MulMasked<A, B2>);
# }
#
# trait MulReduce {
#     type Result;
# }
#
# type MulReduced<A> = <A as MulReduce>::Result;
#
# impl MulReduce for Nil {
#     type Result = Nil;
# }
#
# impl<A, B> MulReduce for (A, B)
# where
#     B: MulReduce,
#     (A, MulReduced<B>, Zero): RippleAdder,
# {
#     type Result = RippleSum<A, MulReduced<B>, Zero>;
# }
#
# type Product<A, B> = MulReduced<MulMasked<A, MulShifted<MulRepeated<A, B>>>>;
#
# type NatZero = Nil;
# type NatOne = (One, Nil);
# type Two = (Zero, (One, Nil));
# type Three = (One, (One, Nil));
# type Four = (Zero, (Zero, (One, Nil)));
# type Five = RippleSum<Two, Three, Zero>;
# type Six = RippleSum<Five, NatOne, Zero>;
# type Seven = RippleSum<Four, Three, Zero>;
# type FortyTwo = Product<Six, Seven>;
#
type SeventeenSixtyFour = Product<FortyTwo, FortyTwo>;
type SeventeenSixtyFourSquared = Product<SeventeenSixtyFour, SeventeenSixtyFour>;

let x = SeventeenSixtyFourSquared::default();
println!("{:?}", x);

let expected: String = format!("{:b}", 1764 * 1764).chars().rev().collect();
println!("{}", expected);
```

Who needs const generics anyway?
